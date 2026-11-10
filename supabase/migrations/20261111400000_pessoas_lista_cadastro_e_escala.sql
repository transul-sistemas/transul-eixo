-- Pessoas › lista, ficha, cadastro e Escala (primeira versão).
--
-- Hipóteses (registradas no relatório da fatia, até o glossário detalhar):
--  * Vínculo da pessoa (pessoas.vinculo): operação × função, com vigência [início, fim) em dias; uma
--    pessoa tem um vínculo por vez (EXCLUDE). Trocar a operação ou a função fecha o atual no dia da
--    troca e abre o novo no mesmo dia. As funções são um catálogo pequeno (pessoas.funcao).
--  * Situação na lista: pendente (cadastro da v1 sem CPF), com vínculo (vigente hoje) ou sem vínculo.
--  * Escala (pessoas.marcacao_da_escala): uma marcação por pessoa e dia, com a sigla T (trabalho),
--    F (folga), FE (férias) ou AT (atestado), só nos dias do vínculo com a operação. A grade do mês
--    mostra quem tem vínculo com a operação em algum dia do mês.
--  * Alcance: Pessoas › ver/editar (escopo tudo) alcança todas as operações; o Operacional alcança a
--    escala das operações da sua filial (a garagem da base da operação), com Operacional › ver/editar.
--    A lista e a ficha de pessoas são só de Pessoas › ver.
--  * O CPF completo nunca sai: a lista e a ficha trazem só o mascarado. O cadastro aceita só CPF.
--
-- Escrita: as tabelas não têm INSERT nem UPDATE diretos; só as funções gravam, e rodam como dono
-- depois de conferir a permissão (e a filial, na escala). As leituras rodam com a RLS de quem consulta.

grant usage on schema pessoas to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Catálogo de funções
-- ---------------------------------------------------------------------------------------------
create table pessoas.funcao (
  codigo text primary key check (codigo ~ '^[a-z_]+$'),
  nome text not null unique check (length(btrim(nome)) > 0),
  ordem smallint not null
);
comment on table pessoas.funcao is 'As funções que uma pessoa exerce na operação (catálogo provisório, ampliável).';
alter table pessoas.funcao enable row level security;

insert into pessoas.funcao (codigo, nome, ordem) values
  ('motorista', 'Motorista', 1),
  ('operador', 'Operador de máquina', 2),
  ('ajudante', 'Ajudante', 3),
  ('mecanico', 'Mecânico', 4),
  ('lider', 'Líder de operação', 5),
  ('administrativo', 'Administrativo', 6);

-- ---------------------------------------------------------------------------------------------
-- Vínculo da pessoa (operação × função, com vigência)
-- ---------------------------------------------------------------------------------------------
create table pessoas.vinculo (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references nucleo.pessoa (id),
  operacao_id uuid not null references nucleo.operacao (id),
  funcao text not null references pessoas.funcao (codigo),
  inicio date not null,
  fim date,
  periodo daterange generated always as (daterange(inicio, fim, '[)')) stored,
  registrado_por uuid,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint vinculo_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint vinculo_um_por_vez exclude using gist (pessoa_id with =, periodo with &&) where (excluido_em is null)
);
comment on table pessoas.vinculo is
  'O vínculo da pessoa com a operação e a função, com vigência [início, fim). Um por vez (EXCLUDE). Só as funções gravam.';
create index vinculo_pessoa_id_idx on pessoas.vinculo (pessoa_id);
create index vinculo_operacao_id_idx on pessoas.vinculo (operacao_id, inicio) where excluido_em is null;
create index vinculo_funcao_idx on pessoas.vinculo (funcao);
alter table pessoas.vinculo enable row level security;

create trigger t30_versao before update on pessoas.vinculo
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on pessoas.vinculo
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on pessoas.vinculo
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- Escala: uma marcação por pessoa e dia
-- ---------------------------------------------------------------------------------------------
create table pessoas.marcacao_da_escala (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references nucleo.pessoa (id),
  operacao_id uuid not null references nucleo.operacao (id),
  dia date not null,
  sigla text not null check (sigla in ('T', 'F', 'FE', 'AT')),
  registrada_por uuid,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  constraint marcacao_uma_por_pessoa_e_dia unique (pessoa_id, dia)
);
comment on table pessoas.marcacao_da_escala is
  'A escala: uma marcação por pessoa e dia (T trabalho, F folga, FE férias, AT atestado), dentro do vínculo com a operação. Só as funções gravam.';
create index marcacao_da_escala_operacao_id_idx on pessoas.marcacao_da_escala (operacao_id, dia);
alter table pessoas.marcacao_da_escala enable row level security;

create trigger t30_versao before update on pessoas.marcacao_da_escala
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on pessoas.marcacao_da_escala
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on pessoas.marcacao_da_escala
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- Alcance da escala: nulo = todas as operações (Pessoas, escopo tudo); senão, as da filial
-- ---------------------------------------------------------------------------------------------
create function nucleo.operacoes_da_escala(p_acao text)
returns uuid[]
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_acao is null or p_acao not in ('ver', 'editar') then
    raise exception 'Ação da escala desconhecida.' using errcode = '22023';
  end if;
  if config.pode('pessoas', p_acao) then
    return null;
  end if;
  -- A filial da operação é a da garagem da base (mesma cidade e UF); config.ve_filial confere o
  -- escopo do Operacional uma vez por operação (poucas), não por linha lida.
  return coalesce((
    select array_agg(o.id order by o.id)
      from nucleo.operacao o
      join config.garagem g on g.cidade = o.base_cidade and g.uf = o.base_uf
      join config.filial f on f.garagem_id = g.id and f.excluido_em is null
     where o.excluido_em is null
       and config.ve_filial(f.id, 'operacional', p_acao)
  ), '{}'::uuid[]);
end;
$$;
revoke all on function nucleo.operacoes_da_escala(text) from public, anon;
comment on function nucleo.operacoes_da_escala(text) is
  'As operações cuja escala quem chama alcança (ver ou editar): nulo para todas (Pessoas, escopo tudo); senão, as da filial do Operacional; vazio para os demais.';

-- ---------------------------------------------------------------------------------------------
-- RLS: só leitura
-- ---------------------------------------------------------------------------------------------
create policy funcao_ler on pessoas.funcao for select to authenticated
  using ((select config.usuario_atual()) is not null);
create policy vinculo_ler on pessoas.vinculo for select to authenticated
  using ((select config.pode('pessoas', 'ver')) or operacao_id = any (coalesce((select nucleo.operacoes_da_escala('ver')), '{}'::uuid[])));
create policy marcacao_da_escala_ler on pessoas.marcacao_da_escala for select to authenticated
  using ((select config.pode('pessoas', 'ver')) or operacao_id = any (coalesce((select nucleo.operacoes_da_escala('ver')), '{}'::uuid[])));

grant select on pessoas.funcao, pessoas.vinculo, pessoas.marcacao_da_escala to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Pessoas › lista
-- ---------------------------------------------------------------------------------------------
create function nucleo.pessoas_da_lista(
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
  if not config.pode('pessoas', 'ver') then
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
revoke all on function nucleo.pessoas_da_lista(text, text[], uuid, text, integer, integer) from public, anon;
comment on function nucleo.pessoas_da_lista(text, text[], uuid, text, integer, integer) is
  'Pessoas › lista: cada pessoa com o CPF mascarado, a situação e o vínculo de hoje (operação e função), filtrada (busca por nome ou dígitos do CPF mascarado, chips de situação e de função, operação), ordenada (desempate pelo nome e id) e paginada no banco, com as contagens dos chips.';

-- ---------------------------------------------------------------------------------------------
-- Pessoas › ficha
-- ---------------------------------------------------------------------------------------------
create function nucleo.ficha_da_pessoa(p_pessoa uuid)
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
  if not config.pode('pessoas', 'ver') then
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
revoke all on function nucleo.ficha_da_pessoa(uuid) from public, anon;
comment on function nucleo.ficha_da_pessoa(uuid) is
  'Pessoas › ficha: a pessoa (CPF mascarado, papéis, versão), os vínculos (o vigente marcado) e as marcações da escala do mês corrente. Nula se a pessoa não existe ou está arquivada.';

-- ---------------------------------------------------------------------------------------------
-- Cadastrar pessoa (assistente "Cadastrar pessoa")
-- ---------------------------------------------------------------------------------------------
create function nucleo.cadastrar_pessoa(
  p_nome text,
  p_documento text,
  p_email text default null,
  p_operacao uuid default null,
  p_funcao text default null,
  p_inicio date default null
)
returns jsonb
language plpgsql
security definer -- justificativa: o vínculo não tem INSERT direto; a função confere Pessoas › criar e grava pessoa, CPF e vínculo juntos, com search_path vazio.
set search_path = ''
as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_documento text := nucleo.normalizar_documento(p_documento);
  v_id uuid;
  v_versao integer;
begin
  if not config.pode('pessoas', 'criar') then
    raise exception 'Seu perfil não permite cadastrar pessoas.' using errcode = '42501';
  end if;
  if length(v_nome) < 2 then
    raise exception 'Informe o nome da pessoa, com pelo menos 2 letras.' using errcode = '22023';
  end if;
  if length(v_documento) <> 11 or not nucleo.documento_valido(v_documento) then
    raise exception 'Este CPF não é válido. Confira os 11 dígitos.' using errcode = '22023';
  end if;
  if exists (select 1 from nucleo.pessoa_documento d where d.documento = v_documento) then
    raise exception 'Já existe uma pessoa com este CPF. Procure-a na lista em vez de cadastrar de novo.'
      using errcode = '23505';
  end if;
  if p_operacao is not null then
    if p_funcao is null or not exists (select 1 from pessoas.funcao f where f.codigo = p_funcao) then
      raise exception 'Escolha a função da pessoa na operação.' using errcode = '22023';
    end if;
    if p_inicio is null then
      raise exception 'Informe desde quando a pessoa está na operação.' using errcode = '22023';
    end if;
    if not exists (select 1 from nucleo.operacao o where o.id = p_operacao and o.excluido_em is null) then
      raise exception 'A operação escolhida não existe mais. Escolha outra.' using errcode = '22023';
    end if;
  end if;

  insert into nucleo.pessoa (nome, email) values (v_nome, nullif(btrim(coalesce(p_email, '')), ''))
    returning id into v_id;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_id, v_documento);
  if p_operacao is not null then
    insert into pessoas.vinculo (pessoa_id, operacao_id, funcao, inicio, registrado_por)
    values (v_id, p_operacao, p_funcao, p_inicio, config.usuario_atual());
  end if;

  select p.versao into v_versao from nucleo.pessoa p where p.id = v_id;
  return jsonb_build_object('id', v_id, 'nome', v_nome, 'versao', v_versao);
end;
$$;
revoke all on function nucleo.cadastrar_pessoa(text, text, text, uuid, text, date) from public, anon;
comment on function nucleo.cadastrar_pessoa(text, text, text, uuid, text, date) is
  'Cadastra a pessoa com o CPF (validado, sem duplicata) e, se informado, o vínculo com a operação e a função. Só com Pessoas › criar.';

-- ---------------------------------------------------------------------------------------------
-- Editar pessoa (assistente "Editar pessoa")
-- ---------------------------------------------------------------------------------------------
create function nucleo.editar_pessoa(
  p_pessoa uuid,
  p_versao integer,
  p_nome text,
  p_email text default null,
  p_operacao uuid default null,
  p_funcao text default null,
  p_inicio date default null
)
returns jsonb
language plpgsql
security definer -- justificativa: o vínculo não tem INSERT nem UPDATE diretos; a função confere Pessoas › editar e a versão vista, e troca o vínculo sem sobreposição, com search_path vazio.
set search_path = ''
as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_versao integer;
  v_atual pessoas.vinculo%rowtype;
  v_muda boolean;
  v_resultado jsonb;
begin
  if not config.pode('pessoas', 'editar') then
    raise exception 'Seu perfil não permite editar pessoas.' using errcode = '42501';
  end if;
  select p.versao into v_versao from nucleo.pessoa p where p.id = p_pessoa and p.excluido_em is null for update;
  if not found then
    raise exception 'Esta pessoa não existe mais ou foi arquivada. Volte à lista e procure de novo.'
      using errcode = '22023';
  end if;
  if p_versao is distinct from v_versao then
    raise exception 'Esta pessoa mudou desde que você abriu a ficha.' using errcode = '40001';
  end if;
  if length(v_nome) < 2 then
    raise exception 'Informe o nome da pessoa, com pelo menos 2 letras.' using errcode = '22023';
  end if;

  select v.* into v_atual from pessoas.vinculo v
   where v.pessoa_id = p_pessoa and v.excluido_em is null and v.fim is null
   for update;
  v_muda := case when p_operacao is null then v_atual.id is not null
                 else v_atual.id is null or v_atual.operacao_id <> p_operacao or v_atual.funcao is distinct from p_funcao end;

  if v_muda then
    if p_inicio is null then
      raise exception 'Informe a partir de quando vale a mudança do vínculo.' using errcode = '22023';
    end if;
    if p_operacao is not null then
      if p_funcao is null or not exists (select 1 from pessoas.funcao f where f.codigo = p_funcao) then
        raise exception 'Escolha a função da pessoa na operação.' using errcode = '22023';
      end if;
      if not exists (select 1 from nucleo.operacao o where o.id = p_operacao and o.excluido_em is null) then
        raise exception 'A operação escolhida não existe mais. Escolha outra.' using errcode = '22023';
      end if;
    end if;
    if v_atual.id is not null then
      if p_inicio <= v_atual.inicio then
        raise exception 'A mudança tem de valer depois do início do vínculo atual (%).', to_char(v_atual.inicio, 'DD/MM/YYYY')
          using errcode = '22023';
      end if;
      update pessoas.vinculo set fim = p_inicio where id = v_atual.id;
    end if;
    if p_operacao is not null then
      insert into pessoas.vinculo (pessoa_id, operacao_id, funcao, inicio, registrado_por)
      values (p_pessoa, p_operacao, p_funcao, p_inicio, config.usuario_atual());
    end if;
  end if;

  update nucleo.pessoa p
     set nome = v_nome, email = nullif(btrim(coalesce(p_email, '')), '')
   where p.id = p_pessoa
  returning jsonb_build_object('id', p.id, 'nome', p.nome, 'versao', p.versao) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.editar_pessoa(uuid, integer, text, text, uuid, text, date) from public, anon;
comment on function nucleo.editar_pessoa(uuid, integer, text, text, uuid, text, date) is
  'Edita nome e e-mail com a versão vista; se a operação ou a função mudam, fecha o vínculo atual no dia informado e abre o novo (sem operação: só fecha). Só com Pessoas › editar.';

-- ---------------------------------------------------------------------------------------------
-- Pessoas › Escala: a grade do mês da operação
-- ---------------------------------------------------------------------------------------------
create function nucleo.escala_do_mes(p_operacao uuid default null, p_mes date default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_vejo uuid[] := nucleo.operacoes_da_escala('ver');
  v_marco uuid[] := nucleo.operacoes_da_escala('editar');
  v_mes date := date_trunc('month', coalesce(p_mes, nucleo.hoje_em_sao_paulo()))::date;
  v_fim date;
  v_operacoes jsonb;
  v_operacao uuid;
  v_resultado jsonb;
begin
  if v_vejo is not null and cardinality(v_vejo) = 0 then
    raise exception 'Seu perfil não tem acesso à escala.' using errcode = '42501';
  end if;
  v_fim := (v_mes + interval '1 month')::date;

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'nome', o.nome) order by o.nome, o.id), '[]'::jsonb)
    into v_operacoes
    from nucleo.operacao o
   where o.excluido_em is null and (v_vejo is null or o.id = any (v_vejo));

  if p_operacao is not null then
    if v_vejo is not null and not (p_operacao = any (v_vejo)) then
      raise exception 'A escala desta operação está fora do seu alcance.' using errcode = '42501';
    end if;
    v_operacao := p_operacao;
  else
    -- Sem operação escolhida: a primeira (pelo nome) com alguém vinculado no mês; senão, a primeira.
    select v.operacao_id into v_operacao
      from pessoas.vinculo v join nucleo.operacao o on o.id = v.operacao_id
     where v.excluido_em is null and o.excluido_em is null and v.periodo && daterange(v_mes, v_fim, '[)')
       and (v_vejo is null or v.operacao_id = any (v_vejo))
     order by o.nome, o.id
     limit 1;
    v_operacao := coalesce(v_operacao, (v_operacoes->0->>'id')::uuid);
  end if;

  with vinculo as (
    select v.pessoa_id, v.funcao, v.inicio, v.fim
      from pessoas.vinculo v
      join nucleo.pessoa p on p.id = v.pessoa_id and p.excluido_em is null
     where v.excluido_em is null and v.operacao_id = v_operacao and v.periodo && daterange(v_mes, v_fim, '[)')
  ),
  por_pessoa as (
    select v.pessoa_id,
           (array_agg(v.funcao order by v.inicio desc))[1] as funcao,
           jsonb_agg(jsonb_build_object('inicio', v.inicio, 'fim', v.fim) order by v.inicio) as periodos
      from vinculo v
     group by v.pessoa_id
  ),
  marcacao as (
    select m.pessoa_id, m.sigla,
           jsonb_build_object('sigla', m.sigla, 'versao', m.versao) as valor, to_char(m.dia, 'YYYY-MM-DD') as dia
      from pessoas.marcacao_da_escala m
     where m.operacao_id = v_operacao and m.dia >= v_mes and m.dia < v_fim
  ),
  dias as (
    select m.pessoa_id, jsonb_object_agg(m.dia, m.valor) as dias
      from marcacao m
     group by m.pessoa_id
  )
  select jsonb_build_object(
           'mes', v_mes,
           'dias_no_mes', (v_fim - v_mes),
           'operacao', (select jsonb_build_object('id', o.id, 'nome', o.nome) from nucleo.operacao o where o.id = v_operacao),
           'operacoes', v_operacoes,
           'pode_marcar', v_operacao is not null and (v_marco is null or v_operacao = any (v_marco)),
           'pessoas', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', p.id, 'nome', p.nome, 'funcao', pp.funcao, 'funcao_nome', f.nome,
                      'periodos', pp.periodos, 'dias', coalesce(d.dias, '{}'::jsonb)
                    ) order by p.nome, p.id)
               from por_pessoa pp
               join nucleo.pessoa p on p.id = pp.pessoa_id
               join pessoas.funcao f on f.codigo = pp.funcao
               left join dias d on d.pessoa_id = pp.pessoa_id), '[]'::jsonb),
           'totais', (select jsonb_build_object(
                               'pessoas', (select count(*) from por_pessoa),
                               'T', count(*) filter (where m.sigla = 'T'), 'F', count(*) filter (where m.sigla = 'F'),
                               'FE', count(*) filter (where m.sigla = 'FE'), 'AT', count(*) filter (where m.sigla = 'AT'))
                        from marcacao m)
         )
    into v_resultado;

  return v_resultado;
end;
$$;
revoke all on function nucleo.escala_do_mes(uuid, date) from public, anon;
comment on function nucleo.escala_do_mes(uuid, date) is
  'Pessoas › Escala: a grade do mês (pessoas vinculadas à operação no mês × dias), com as marcações, os períodos de vínculo, os totais por sigla e as operações ao alcance. Pessoas › ver alcança todas; o Operacional, as da sua filial.';

-- ---------------------------------------------------------------------------------------------
-- Marcar o dia da escala (mini-assistente da Escala)
-- ---------------------------------------------------------------------------------------------
create function nucleo.marcar_escala(
  p_pessoa uuid,
  p_operacao uuid,
  p_dia date,
  p_sigla text,
  p_versao integer default null
)
returns jsonb
language plpgsql
security definer -- justificativa: a escala não tem INSERT nem UPDATE diretos; a função confere o alcance (Pessoas › editar, ou o Operacional da filial), a sigla, o vínculo do dia e a versão vista, com search_path vazio.
set search_path = ''
as $$
declare
  v_marco uuid[] := nucleo.operacoes_da_escala('editar');
  v_existente integer;
  v_resultado jsonb;
begin
  if p_operacao is null or (v_marco is not null and not (p_operacao = any (v_marco))) then
    raise exception 'Seu perfil não permite marcar a escala desta operação.' using errcode = '42501';
  end if;
  if p_sigla is null or p_sigla not in ('T', 'F', 'FE', 'AT') then
    raise exception 'Escolha a marcação do dia: T (trabalho), F (folga), FE (férias) ou AT (atestado).'
      using errcode = '22023';
  end if;
  if p_dia is null or not exists (
    select 1 from pessoas.vinculo v
     where v.pessoa_id = p_pessoa and v.operacao_id = p_operacao and v.excluido_em is null and v.periodo @> p_dia
  ) then
    raise exception 'A pessoa não está vinculada a esta operação em %. Confira o vínculo na ficha da pessoa.',
      coalesce(to_char(p_dia, 'DD/MM/YYYY'), 'dia sem data') using errcode = '22023';
  end if;

  select m.versao into v_existente from pessoas.marcacao_da_escala m
   where m.pessoa_id = p_pessoa and m.dia = p_dia for update;
  if v_existente is distinct from p_versao then
    raise exception 'A marcação deste dia mudou desde que você abriu a escala.' using errcode = '40001';
  end if;

  insert into pessoas.marcacao_da_escala (pessoa_id, operacao_id, dia, sigla, registrada_por)
  values (p_pessoa, p_operacao, p_dia, p_sigla, config.usuario_atual())
  on conflict (pessoa_id, dia) do update
    set sigla = excluded.sigla, operacao_id = excluded.operacao_id, registrada_por = excluded.registrada_por
  returning jsonb_build_object('id', id, 'pessoa_id', pessoa_id, 'operacao_id', operacao_id, 'dia', dia,
                               'sigla', sigla, 'versao', versao)
    into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.marcar_escala(uuid, uuid, date, text, integer) from public, anon;
comment on function nucleo.marcar_escala(uuid, uuid, date, text, integer) is
  'Marca o dia da escala (T, F, FE ou AT; uma marcação por pessoa e dia), dentro do vínculo com a operação, com a versão vista (nula se o dia ainda não tem marcação).';

-- ---------------------------------------------------------------------------------------------
-- Funções que o app executa (com o porquê) e os grants
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.operacoes_da_escala(text)', 'Escala: as operações ao alcance de quem chama (usada nas políticas e nas funções da escala).'),
  ('nucleo.pessoas_da_lista(text,text[],uuid,text,integer,integer)', 'Pessoas › lista: filtrada, ordenada e paginada no banco, com o CPF mascarado.'),
  ('nucleo.ficha_da_pessoa(uuid)', 'Pessoas › ficha: a pessoa, os vínculos e a escala do mês.'),
  ('nucleo.cadastrar_pessoa(text,text,text,uuid,text,date)', 'Assistente Cadastrar pessoa: pessoa, CPF e vínculo juntos; confere a permissão por dentro.'),
  ('nucleo.editar_pessoa(uuid,integer,text,text,uuid,text,date)', 'Assistente Editar pessoa: com a versão e a troca de vínculo sem sobreposição; confere a permissão por dentro.'),
  ('nucleo.escala_do_mes(uuid,date)', 'Pessoas › Escala: a grade do mês da operação, com a RLS de quem consulta.'),
  ('nucleo.marcar_escala(uuid,uuid,date,text,integer)', 'Escala: marca o dia da pessoa; confere o alcance e o vínculo por dentro.');

grant execute on function nucleo.operacoes_da_escala(text) to authenticated;
grant execute on function nucleo.pessoas_da_lista(text, text[], uuid, text, integer, integer) to authenticated;
grant execute on function nucleo.ficha_da_pessoa(uuid) to authenticated;
grant execute on function nucleo.cadastrar_pessoa(text, text, text, uuid, text, date) to authenticated;
grant execute on function nucleo.editar_pessoa(uuid, integer, text, text, uuid, text, date) to authenticated;
grant execute on function nucleo.escala_do_mes(uuid, date) to authenticated;
grant execute on function nucleo.marcar_escala(uuid, uuid, date, text, integer) to authenticated;
