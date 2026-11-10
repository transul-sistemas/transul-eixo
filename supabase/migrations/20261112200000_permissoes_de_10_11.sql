-- Permissões decididas por Alexandre em 10/11/2026 (Lote 2).
--  * Só o Administrador muda acesso de usuários e permissões: a Diretoria só lê a Administração (sai
--    admin.criar, admin.editar e admin.excluir; fica admin.ver). As políticas de usuario, usuario_filial,
--    usuario_operacao e permissao_do_perfil já pedem admin.criar/editar: nada muda nelas.
--  * O Gestor de frota não vê Operações (já não tinha operacoes.ver; o pgTAP 103 afirma).
--  * O Operacional vê a Escala só da filial dele: Pessoas › ver com escopo filial. Como config.pode
--    aceita qualquer escopo, o que é "de todos" (a lista, a ficha e a escala de todas as operações) passa
--    a pedir o escopo tudo (config.pode_em_tudo); o escopo filial alcança só as operações da garagem da
--    filial do usuário (nucleo.operacoes_da_escala).
-- A semente (supabase/seed.sql) e o espelho em TypeScript (lib/seguranca/permissoes.ts) mudam junto; esta
-- migration leva a mudança aos bancos que já existem.

-- ---------------------------------------------------------------------------------------------
-- A matriz de permissões
-- ---------------------------------------------------------------------------------------------
delete from config.permissao_do_perfil
 where perfil = 'diretoria' and modulo = 'admin' and acao in ('criar', 'editar', 'excluir');

-- Os catálogos (perfil, módulo, ação, escopo) nascem no seed: num banco novo, esta linha vem de lá;
-- num banco que já existe, entra aqui.
insert into config.permissao_do_perfil (perfil, modulo, acao, escopo)
select p.codigo, m.codigo, a.codigo, e.codigo
  from config.perfil p, config.modulo m, config.acao a, config.escopo e
 where p.codigo = 'operacional' and m.codigo = 'pessoas' and a.codigo = 'ver' and e.codigo = 'filial'
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- A ação no módulo com o escopo tudo (config.pode aceita qualquer escopo)
-- ---------------------------------------------------------------------------------------------
create function config.pode_em_tudo(p_modulo text, p_acao text)
returns boolean
language sql
stable
security definer -- justificativa: igual a config.pode (lê a tabela de permissões e o usuário do próprio auth.uid() sem passar pelas políticas que chamam esta função), só com o escopo tudo; search_path vazio.
set search_path = ''
as $$
  select exists (
    select 1 from config.permissao_do_perfil p
      join nucleo.usuario u on u.perfil = p.perfil
     where u.auth_user_id = (select auth.uid()) and u.ativo
       and p.modulo = p_modulo and p.acao = p_acao and p.escopo = 'tudo'
  )
$$;
revoke all on function config.pode_em_tudo(text, text) from public, anon;
comment on function config.pode_em_tudo(text, text) is
  'O perfil do usuário tem a ação no módulo com o escopo tudo? (config.pode aceita qualquer escopo.)';

-- ---------------------------------------------------------------------------------------------
-- Alcance da escala: nulo = todas (Pessoas, escopo tudo); senão, as operações da filial do usuário
-- (Pessoas › ver com escopo filial, ou o Operacional › ver/editar da filial, como antes)
-- ---------------------------------------------------------------------------------------------
create or replace function nucleo.operacoes_da_escala(p_acao text)
returns uuid[]
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_acao is null or p_acao not in ('ver', 'editar') then
    raise exception 'Ação da escala desconhecida.' using errcode = '22023';
  end if;
  if config.pode_em_tudo('pessoas', p_acao) then
    return null;
  end if;
  -- A filial da operação é a da garagem da base (mesma cidade e UF); config.ve_filial confere o
  -- escopo uma vez por operação (poucas), não por linha lida.
  return coalesce((
    select array_agg(o.id order by o.id)
      from nucleo.operacao o
      join config.garagem g on g.cidade = o.base_cidade and g.uf = o.base_uf
      join config.filial f on f.garagem_id = g.id and f.excluido_em is null
     where o.excluido_em is null
       and (config.ve_filial(f.id, 'pessoas', p_acao) or config.ve_filial(f.id, 'operacional', p_acao))
  ), '{}'::uuid[]);
end;
$$;
comment on function nucleo.operacoes_da_escala(text) is
  'As operações cuja escala quem chama alcança (ver ou editar): nulo para todas (Pessoas, escopo tudo); senão, as da filial do usuário (Pessoas › ver com escopo filial, ou Operacional da filial); vazio para os demais.';

-- ---------------------------------------------------------------------------------------------
-- RLS: o "tudo" agora pede o escopo tudo
-- ---------------------------------------------------------------------------------------------
drop policy vinculo_ler on pessoas.vinculo;
create policy vinculo_ler on pessoas.vinculo for select to authenticated
  using ((select config.pode_em_tudo('pessoas', 'ver')) or operacao_id = any (coalesce((select nucleo.operacoes_da_escala('ver')), '{}'::uuid[])));
drop policy marcacao_da_escala_ler on pessoas.marcacao_da_escala;
create policy marcacao_da_escala_ler on pessoas.marcacao_da_escala for select to authenticated
  using ((select config.pode_em_tudo('pessoas', 'ver')) or operacao_id = any (coalesce((select nucleo.operacoes_da_escala('ver')), '{}'::uuid[])));

-- ---------------------------------------------------------------------------------------------
-- Pessoas › lista e ficha: só com Pessoas › ver no escopo tudo (o corpo é o de 20261111400000, só
-- com config.pode_em_tudo no lugar de config.pode)
-- ---------------------------------------------------------------------------------------------
create or replace function nucleo.pessoas_da_lista(
  p_busca text default null,
  p_chips text[] default null,
  p_operacao uuid default null,
  p_ordem text default 'nome',
  p_pagina integer default 1,
  p_tam integer default 50
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tam integer := least(greatest(coalesce(p_tam, 50), 1), 100);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_digitos text := nullif(nucleo.normalizar_documento(p_busca), '');
  v_ordem text := coalesce(nullif(btrim(p_ordem), ''), 'nome');
  v_campo text := ltrim(v_ordem, '-');
  v_desc boolean := v_ordem like '-%';
  v_situacoes text[] := array(select c from unnest(coalesce(p_chips, '{}')) c
                               where c in ('com_vinculo', 'sem_vinculo', 'pendente'));
  v_funcoes text[];
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_resultado jsonb;
begin
  if not config.pode_em_tudo('pessoas', 'ver') then
    raise exception 'Seu perfil não tem acesso às pessoas.' using errcode = '42501';
  end if;
  if v_campo not in ('nome', 'funcao', 'operacao', 'desde') then
    raise exception 'Ordem da lista de pessoas desconhecida.' using errcode = '22023';
  end if;
  v_funcoes := array(select c from unnest(coalesce(p_chips, '{}')) c
                      where c in (select f.codigo from pessoas.funcao f));

  with atual as (
    select distinct on (v.pessoa_id) v.pessoa_id, v.operacao_id, v.funcao, v.inicio
      from pessoas.vinculo v
     where v.excluido_em is null and v.periodo @> v_hoje
     order by v.pessoa_id, v.inicio desc, v.id
  ),
  base as (
    select p.id, p.nome, p.documento_mascarado, a.operacao_id, o.nome as operacao, a.funcao,
           f.nome as funcao_nome, a.inicio as desde,
           case when p.cadastro_pendente then 'pendente'
                when a.pessoa_id is not null then 'com_vinculo'
                else 'sem_vinculo' end as situacao
      from nucleo.pessoa p
      left join atual a on a.pessoa_id = p.id
      left join nucleo.operacao o on o.id = a.operacao_id
      left join pessoas.funcao f on f.codigo = a.funcao
     where p.excluido_em is null
       and (p_operacao is null or a.operacao_id = p_operacao)
       and (v_busca is null
            or nucleo.texto_simples(p.nome) like '%' || nucleo.texto_simples(v_busca) || '%'
            or (length(v_digitos) >= 3
                and nucleo.normalizar_documento(p.documento_mascarado) like '%' || v_digitos || '%'))
  ),
  calculada as (
    select b.*,
           (cardinality(v_situacoes) = 0 or b.situacao = any (v_situacoes)) as na_situacao,
           (cardinality(v_funcoes) = 0 or b.funcao = any (v_funcoes)) as na_funcao
      from base b
  ),
  ordenada as (
    select c.*,
           row_number() over (order by
             case when v_campo = 'funcao' and not v_desc then c.funcao_nome end asc nulls last,
             case when v_campo = 'funcao' and v_desc then c.funcao_nome end desc nulls last,
             case when v_campo = 'operacao' and not v_desc then c.operacao end asc nulls last,
             case when v_campo = 'operacao' and v_desc then c.operacao end desc nulls last,
             case when v_campo = 'desde' and not v_desc then c.desde end asc nulls last,
             case when v_campo = 'desde' and v_desc then c.desde end desc nulls last,
             case when v_campo = 'nome' and v_desc then c.nome end desc,
             c.nome asc, c.id asc) as n,
           count(*) over () as filtradas
      from calculada c
     where c.na_situacao and c.na_funcao
  ),
  paginada as (
    select o.*, least(v_pagina, greatest(ceil(o.filtradas::numeric / v_tam)::integer, 1)) as pagina
      from ordenada o
  )
  select jsonb_build_object(
           'linhas', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', p.id, 'nome', p.nome, 'documento_mascarado', p.documento_mascarado,
                      'situacao', p.situacao, 'funcao', p.funcao, 'funcao_nome', p.funcao_nome,
                      'operacao_id', p.operacao_id, 'operacao', p.operacao, 'desde', p.desde
                    ) order by p.n)
               from paginada p
              where p.n > (p.pagina - 1) * v_tam and p.n <= p.pagina * v_tam), '[]'::jsonb),
           'filtradas', (select count(*) from ordenada),
           'pagina', coalesce((select max(p.pagina) from paginada p), 1),
           'paginas', greatest(ceil((select count(*) from ordenada)::numeric / v_tam)::integer, 1),
           'tam', v_tam,
           -- Cada grupo de chips conta ignorando a própria seleção.
           'chips', (select jsonb_build_object(
                              'com_vinculo', count(*) filter (where c.na_funcao and c.situacao = 'com_vinculo'),
                              'sem_vinculo', count(*) filter (where c.na_funcao and c.situacao = 'sem_vinculo'),
                              'pendente', count(*) filter (where c.na_funcao and c.situacao = 'pendente'))
                       from calculada c)
                    || coalesce((select jsonb_object_agg(f.codigo, coalesce(x.n, 0))
                                   from pessoas.funcao f
                                   left join (select c.funcao, count(*) as n from calculada c
                                               where c.na_situacao group by c.funcao) x on x.funcao = f.codigo), '{}'::jsonb),
           'operacoes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'nome', o.nome) order by o.nome, o.id)
                                    from nucleo.operacao o where o.excluido_em is null), '[]'::jsonb)
         )
    into v_resultado;

  return v_resultado;
end;
$$;

create or replace function nucleo.ficha_da_pessoa(p_pessoa uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_mes date := date_trunc('month', nucleo.hoje_em_sao_paulo())::date;
  v_pessoa jsonb;
  v_vinculos jsonb;
  v_escala jsonb;
begin
  if not config.pode_em_tudo('pessoas', 'ver') then
    raise exception 'Seu perfil não tem acesso às pessoas.' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'id', p.id, 'nome', p.nome, 'documento_mascarado', p.documento_mascarado, 'email', p.email,
           'codparc', p.codparc, 'cadastro_pendente', p.cadastro_pendente, 'versao', p.versao,
           'papeis', coalesce((select jsonb_agg(c.nome order by c.nome)
                                 from nucleo.papel_da_pessoa pp join config.papel c on c.codigo = pp.papel
                                where pp.pessoa_id = p.id), '[]'::jsonb))
    into v_pessoa
    from nucleo.pessoa p
   where p.id = p_pessoa and p.excluido_em is null;
  if v_pessoa is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'operacao_id', v.operacao_id, 'operacao', o.nome, 'funcao', v.funcao,
           'funcao_nome', f.nome, 'inicio', v.inicio, 'fim', v.fim, 'vigente', v.periodo @> v_hoje
         ) order by v.inicio desc, v.id), '[]'::jsonb)
    into v_vinculos
    from pessoas.vinculo v
    join nucleo.operacao o on o.id = v.operacao_id
    join pessoas.funcao f on f.codigo = v.funcao
   where v.pessoa_id = p_pessoa and v.excluido_em is null;

  select jsonb_build_object(
           'mes', v_mes,
           'T', count(*) filter (where m.sigla = 'T'), 'F', count(*) filter (where m.sigla = 'F'),
           'FE', count(*) filter (where m.sigla = 'FE'), 'AT', count(*) filter (where m.sigla = 'AT'))
    into v_escala
    from pessoas.marcacao_da_escala m
   where m.pessoa_id = p_pessoa and m.dia >= v_mes and m.dia < (v_mes + interval '1 month')::date;

  return jsonb_build_object(
    'pessoa', v_pessoa,
    'vinculos', v_vinculos,
    'vinculo_atual', (select x from jsonb_array_elements(v_vinculos) x where (x->>'vigente')::boolean limit 1),
    'escala', v_escala,
    'operacoes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'nome', o.nome) order by o.nome, o.id)
                             from nucleo.operacao o where o.excluido_em is null), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- O que o app executa
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('config.pode_em_tudo(text,text)', 'Escopo tudo nas políticas e funções de Pessoas (roda como dono; usa só auth.uid()).');
grant execute on function config.pode_em_tudo(text, text) to authenticated;
