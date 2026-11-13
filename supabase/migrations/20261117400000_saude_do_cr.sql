-- CR1, Saúde do CR "como no quadro" (ficha docs/fichas-de-tela/cadastros-saude-do-cr-quadro.md; inventário 25 a 29).
-- Forma mais simples, sem a D0 (lançamento em 10 tipos) e sem o processo P1: o quadro lê os quatro problemas
-- de cadastro direto das tabelas, e as ações gravam por funções atômicas.
--
-- Problemas (códigos que a tela usa): placa_sem_cr · cr_sem_operacao · dois_do_mesmo_tipo · lancamento_sem_cr.
--  * cr_sem_operacao: CR ativo, não bloqueado e analítico sem operação na data (nucleo.operacao_do_cr_em) e sem
--    placa vigente que tenha operação (o CR de frota que já está numa placa com operação não é problema).
--  * lancamento_sem_cr: o centro (CODCENCUS) das despesas do staging que não existe em nucleo.cr e ainda não
--    foi classificado; lido pela RLS de quem consulta (Resultados › ver).
--
-- Funções (assinaturas que a tela usa):
--  * nucleo.resumo_da_saude_do_cr() -> jsonb {cartoes{...}, problemas[{problema, quantidade, dono, prazo_dias}]}
--  * nucleo.problemas_da_saude_do_cr(p_problema, p_pagina, p_tamanho) -> jsonb {total, pagina, tamanho, linhas[]}
--  * 25 Escolher o CR: nucleo.trocar_cr (V0).
--  * 26 nucleo.ligar_cr_a_operacao(p_cr_id, p_operacao_id, p_em, p_motivo, p_chave) -> uuid (o vínculo)
--  * 27 nucleo.encerrar_vinculo_de_cr(p_vinculo_id, p_em, p_motivo, p_versao, p_chave) -> uuid
--  * 28 nucleo.classificar_centro_sem_cr(p_codcencus, p_decisao, p_codigo, p_nome, p_motivo, p_chave) -> uuid
--       (decisão 'criar_cr' cria o CR pelo nucleo.criar_cr; 'sem_destino' registra que fica sem destino)
--  * 29 nucleo.atribuir_dono(p_problema, p_referencia, p_dono_id, p_prazo, p_chave) -> uuid (só o Administrador)

insert into config.parametro (chave, valor, descricao) values
  ('saude_cr_placa_sem_cr_dono', 'Analista de cadastro', 'Saúde do CR: o dono padrão de "placa sem CR vigente".'),
  ('saude_cr_placa_sem_cr_prazo_dias', '5', 'Saúde do CR: prazo (dias) de "placa sem CR vigente".'),
  ('saude_cr_cr_sem_operacao_dono', 'Líder da operação', 'Saúde do CR: o dono padrão de "CR sem operação".'),
  ('saude_cr_cr_sem_operacao_prazo_dias', '5', 'Saúde do CR: prazo (dias) de "CR sem operação".'),
  ('saude_cr_dois_do_mesmo_tipo_dono', 'Gestor da carteira', 'Saúde do CR: o dono padrão de "dois CRs vigentes do mesmo tipo".'),
  ('saude_cr_dois_do_mesmo_tipo_prazo_dias', '5', 'Saúde do CR: prazo (dias) de "dois CRs vigentes do mesmo tipo".'),
  ('saude_cr_lancamento_sem_cr_dono', 'Financeiro', 'Saúde do CR: o dono padrão de "lançamento sem CR conhecido".'),
  ('saude_cr_lancamento_sem_cr_prazo_dias', '3', 'Saúde do CR: prazo (dias) de "lançamento sem CR conhecido".')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Tabelas: a classificação do centro sem CR e o dono do problema
-- ---------------------------------------------------------------------------------------------
create table nucleo.classificacao_de_centro (
  id uuid primary key default gen_random_uuid(),
  codcencus text not null check (length(btrim(codcencus)) > 0),
  decisao text not null check (decisao in ('criar_cr', 'sem_destino')),
  cr_id uuid references nucleo.cr (id),
  motivo text not null check (length(btrim(motivo)) > 0),
  classificado_por uuid references nucleo.pessoa (id),
  classificado_em timestamptz not null default now(),
  constraint classificacao_com_cr check ((decisao = 'criar_cr') = (cr_id is not null))
);
comment on table nucleo.classificacao_de_centro is
  'Saúde do CR, "Classificar": o que se decidiu sobre um centro do Sankhya que não é CR conhecido (criar o CR, ou deixá-lo sem destino). O fato do Sankhya não é editado.';
create unique index classificacao_uma_por_centro on nucleo.classificacao_de_centro (codcencus);
create index classificacao_de_centro_cr_id_idx on nucleo.classificacao_de_centro (cr_id);
create index classificacao_de_centro_classificado_por_idx on nucleo.classificacao_de_centro (classificado_por);
alter table nucleo.classificacao_de_centro enable row level security;
create trigger t40_sem_exclusao_fisica before delete on nucleo.classificacao_de_centro
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.classificacao_de_centro
  for each row execute function auditoria.registrar_mudanca('id');
grant select on nucleo.classificacao_de_centro to authenticated;
create policy classificacao_de_centro_ler on nucleo.classificacao_de_centro for select to authenticated
  using (config.pode_em_tudo('cadastros', 'ver') or config.pode_em_tudo('resultados', 'ver'));

create table nucleo.dono_de_problema (
  id uuid primary key default gen_random_uuid(),
  problema text not null check (problema in ('placa_sem_cr', 'cr_sem_operacao', 'dois_do_mesmo_tipo', 'lancamento_sem_cr')),
  referencia text not null check (length(btrim(referencia)) > 0),
  dono_id uuid not null references nucleo.pessoa (id),
  prazo date,
  atribuido_por uuid references nucleo.pessoa (id),
  atribuido_em timestamptz not null default now(),
  versao integer not null default 1,
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text
);
comment on table nucleo.dono_de_problema is
  'Saúde do CR, "Atribuir dono": quem resolve cada problema (a referência é a placa, o CR ou o centro) e até quando. Reatribuir exclui logicamente o anterior.';
create unique index dono_de_problema_um_vigente on nucleo.dono_de_problema (problema, referencia) where excluido_em is null;
create index dono_de_problema_dono_id_idx on nucleo.dono_de_problema (dono_id);
create index dono_de_problema_atribuido_por_idx on nucleo.dono_de_problema (atribuido_por);
alter table nucleo.dono_de_problema enable row level security;
create trigger t30_versao before update on nucleo.dono_de_problema
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.dono_de_problema
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.dono_de_problema
  for each row execute function auditoria.registrar_mudanca('id');
grant select on nucleo.dono_de_problema to authenticated;
create policy dono_de_problema_ler on nucleo.dono_de_problema for select to authenticated
  using (dono_id = config.usuario_atual() or config.pode_em_tudo('cadastros', 'ver'));

-- ---------------------------------------------------------------------------------------------
-- Leituras (security invoker: a RLS de quem consulta vale)
-- ---------------------------------------------------------------------------------------------
create function nucleo.problemas_da_saude_do_cr(p_problema text, p_pagina integer default 1, p_tamanho integer default 20)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tam integer := least(greatest(coalesce(p_tamanho, 20), 1), 100);
  v_pag integer := greatest(coalesce(p_pagina, 1), 1);
  v_resultado jsonb;
begin
  if p_problema is null or p_problema not in ('placa_sem_cr', 'cr_sem_operacao', 'dois_do_mesmo_tipo', 'lancamento_sem_cr') then
    raise exception 'Problema da Saúde do CR desconhecido.' using errcode = '22023';
  end if;

  with base as (
    select l.ativo_id::text as chave, l.placa as ordem,
           jsonb_build_object('ativo_id', l.ativo_id, 'placa', l.placa, 'tipo', l.tipo, 'gestor', l.gestor, 'operacao', l.operacao) as linha
      from nucleo.leitura_da_placa l
     where p_problema = 'placa_sem_cr'
       and (l.baixada_em is null or l.baixada_em > now())
       and not exists (select 1 from nucleo.cr_do_ativo v where v.ativo_id = l.ativo_id and v.excluido_em is null and v.periodo @> now())
    union all
    select c.id::text, c.codigo,
           jsonb_build_object('cr_id', c.id, 'codigo', c.codigo, 'nome', c.nome, 'codcencus', c.codcencus, 'tipo', c.tipo)
      from nucleo.cr c
     where p_problema = 'cr_sem_operacao'
       and c.excluido_em is null and c.ativo and not c.bloqueado and coalesce(c.analitico, true)
       and nucleo.operacao_do_cr_em(c.id, now()) is null
       and not exists (select 1 from nucleo.cr_do_ativo v
                        where v.cr_id = c.id and v.excluido_em is null and v.periodo @> now()
                          and nucleo.operacao_em(v.ativo_id, now()) is not null)
    union all
    select x.ativo_id::text, l.placa,
           jsonb_build_object('ativo_id', x.ativo_id, 'placa', l.placa, 'gestor', l.gestor, 'tipo_de_cr', x.tipo,
             'crs', (select jsonb_agg(jsonb_build_object('vinculo_id', v.id, 'versao', v.versao, 'cr_id', c.id, 'codigo', c.codigo,
                                                         'inicio', v.inicio) order by v.inicio, v.id)
                       from nucleo.cr_do_ativo v join nucleo.cr c on c.id = v.cr_id
                      where v.ativo_id = x.ativo_id and v.excluido_em is null and v.periodo @> now() and c.tipo = x.tipo))
      from (select v.ativo_id, c.tipo
              from nucleo.cr_do_ativo v join nucleo.cr c on c.id = v.cr_id
             where p_problema = 'dois_do_mesmo_tipo' and v.excluido_em is null and v.periodo @> now()
             group by v.ativo_id, c.tipo having count(distinct v.cr_id) > 1) x
      join nucleo.leitura_da_placa l on l.ativo_id = x.ativo_id
    union all
    select coalesce(d.codcencus, '(vazio)'), coalesce(d.codcencus, ''),
           jsonb_build_object('codcencus', coalesce(d.codcencus, '(vazio)'), 'lancamentos', count(*),
                              'valor', sum(coalesce(d.valor_liquido, 0)), 'ultima_competencia', max(d.dt_competencia))
      from staging.despesa d
     where p_problema = 'lancamento_sem_cr'
       and d.invalidado_em is null
       and (d.codcencus is null or not exists (select 1 from nucleo.cr c where c.codcencus::text = d.codcencus))
       and not exists (select 1 from nucleo.classificacao_de_centro k where k.codcencus = coalesce(d.codcencus, '(vazio)'))
     group by d.codcencus
  ),
  pagina as (
    select b.* from base b order by b.ordem, b.chave offset (v_pag - 1) * v_tam limit v_tam
  )
  select jsonb_build_object(
    'problema', p_problema, 'total', (select count(*) from base), 'pagina', v_pag, 'tamanho', v_tam,
    'linhas', coalesce((
      select jsonb_agg(p.linha || jsonb_build_object('dono', pe.nome, 'dono_id', dp.dono_id, 'prazo', dp.prazo)
                       order by p.ordem, p.chave)
        from pagina p
        left join nucleo.dono_de_problema dp on dp.problema = p_problema and dp.referencia = p.chave and dp.excluido_em is null
        left join nucleo.pessoa pe on pe.id = dp.dono_id), '[]'::jsonb))
    into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.problemas_da_saude_do_cr(text, integer, integer) from public;
comment on function nucleo.problemas_da_saude_do_cr(text, integer, integer) is
  'Saúde do CR: as linhas de um problema (placa_sem_cr, cr_sem_operacao, dois_do_mesmo_tipo, lancamento_sem_cr), paginadas no banco (no máximo 100, desempate pela chave), com o dono e o prazo atribuídos; com a RLS de quem consulta.';

create function nucleo.resumo_da_saude_do_cr()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_placa bigint := (nucleo.problemas_da_saude_do_cr('placa_sem_cr', 1, 1)->>'total')::bigint;
  v_cr bigint := (nucleo.problemas_da_saude_do_cr('cr_sem_operacao', 1, 1)->>'total')::bigint;
  v_dois bigint := (nucleo.problemas_da_saude_do_cr('dois_do_mesmo_tipo', 1, 1)->>'total')::bigint;
  v_lanc bigint := (nucleo.problemas_da_saude_do_cr('lancamento_sem_cr', 1, 1)->>'total')::bigint;
begin
  return jsonb_build_object(
    'cartoes', jsonb_build_object(
      'crs_ativos', (select count(*) from nucleo.cr c where c.excluido_em is null and c.ativo and coalesce(c.analitico, true)),
      'placas_sem_cr', v_placa, 'crs_sem_operacao', v_cr, 'placas_com_dois_do_mesmo_tipo', v_dois,
      'centros_sem_cr', v_lanc),
    'problemas', jsonb_build_array(
      jsonb_build_object('problema', 'placa_sem_cr', 'quantidade', v_placa,
        'dono', (select valor from config.parametro where chave = 'saude_cr_placa_sem_cr_dono'),
        'prazo_dias', (select valor::int from config.parametro where chave = 'saude_cr_placa_sem_cr_prazo_dias')),
      jsonb_build_object('problema', 'cr_sem_operacao', 'quantidade', v_cr,
        'dono', (select valor from config.parametro where chave = 'saude_cr_cr_sem_operacao_dono'),
        'prazo_dias', (select valor::int from config.parametro where chave = 'saude_cr_cr_sem_operacao_prazo_dias')),
      jsonb_build_object('problema', 'dois_do_mesmo_tipo', 'quantidade', v_dois,
        'dono', (select valor from config.parametro where chave = 'saude_cr_dois_do_mesmo_tipo_dono'),
        'prazo_dias', (select valor::int from config.parametro where chave = 'saude_cr_dois_do_mesmo_tipo_prazo_dias')),
      jsonb_build_object('problema', 'lancamento_sem_cr', 'quantidade', v_lanc,
        'dono', (select valor from config.parametro where chave = 'saude_cr_lancamento_sem_cr_dono'),
        'prazo_dias', (select valor::int from config.parametro where chave = 'saude_cr_lancamento_sem_cr_prazo_dias')))
  );
end;
$$;
revoke all on function nucleo.resumo_da_saude_do_cr() from public;
comment on function nucleo.resumo_da_saude_do_cr() is
  'Saúde do CR: os cartões de contagem e a tabela "o que fazer, por dono e prazo" (donos e prazos padrão em config.parametro); contagens do banco, com a RLS de quem consulta.';

-- ---------------------------------------------------------------------------------------------
-- Ações
-- ---------------------------------------------------------------------------------------------
-- Quem grava cadastro de CR: Cadastros › editar no escopo tudo, menos a Diretoria (H6).
create function nucleo.pode_gravar_cadastro_de_cr()
returns boolean
language sql
stable
set search_path = ''
as $$
  select config.usuario_atual() is not null and config.pode_em_tudo('cadastros', 'editar')
     and config.perfil_atual() is distinct from 'diretoria'
$$;
revoke all on function nucleo.pode_gravar_cadastro_de_cr() from public;

create function nucleo.ligar_cr_a_operacao(p_cr_id uuid, p_operacao_id uuid, p_em timestamptz, p_motivo text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: o vínculo CR-operação é da montagem (Operações) e a fila de exceções é de Cadastros; a função confere por dentro Cadastros › editar no escopo tudo (sem a Diretoria, H6), só mexe no vínculo deste CR e só fecha a exceção cr_sem_operacao dele; search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
  v_atual record;
begin
  if not nucleo.pode_gravar_cadastro_de_cr() then
    raise exception 'Só o cadastro liga o CR à operação.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'ligar_cr_a_operacao');
  if v_id is not null then
    return v_id;
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Ligar o CR à operação pede o motivo.' using errcode = '23514';
  end if;
  if p_em is null or not exists (select 1 from nucleo.operacao where id = p_operacao_id and excluido_em is null)
     or not exists (select 1 from nucleo.cr where id = p_cr_id and excluido_em is null) then
    raise exception 'Escolha o CR, a operação e a data.' using errcode = '23514';
  end if;

  select id, operacao_id, inicio into v_atual
    from nucleo.cr_de_servico_na_operacao
   where cr_id = p_cr_id and excluido_em is null and periodo @> p_em
     for update;
  if v_atual.id is not null and v_atual.operacao_id = p_operacao_id then
    v_id := v_atual.id;
  else
    perform set_config('eixo.motivo', btrim(p_motivo), true);
    if v_atual.id is not null then
      if v_atual.inicio >= p_em then
        raise exception 'O CR entrou na operação atual depois desta data.' using errcode = '23514';
      end if;
      update nucleo.cr_de_servico_na_operacao set fim = p_em, fim_origem = 'informada' where id = v_atual.id;
    end if;
    insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem, montado_por)
    values (p_cr_id, p_operacao_id, p_em, 'informada', config.usuario_atual())
    returning id into v_id;
    perform set_config('eixo.motivo', '', true);
  end if;

  update nucleo.fila_de_excecoes
     set resolvida_em = now(), resolvida_por = config.usuario_atual(), resolucao = 'O CR foi ligado à operação.'
   where cr_id = p_cr_id and assunto = 'cr_sem_operacao' and resolvida_em is null;

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.ligar_cr_a_operacao(uuid, uuid, timestamptz, text, uuid) from public;

create function nucleo.encerrar_vinculo_de_cr(p_vinculo_id uuid, p_em timestamptz, p_motivo text, p_versao integer, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: o gestor encerra o vínculo da placa da carteira, mas a fila de exceções é de Cadastros; a função confere por dentro o gestor vigente (Frota › editar) ou o cadastro (sem a Diretoria), encerra só este vínculo (com data de fim, nunca exclui) e só fecha a exceção de dois CRs do mesmo tipo desta placa quando ela deixou de valer; search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.usuario_atual();
  v record;
  v_id uuid;
begin
  select id, ativo_id, inicio, fim, versao into v from nucleo.cr_do_ativo where id = p_vinculo_id and excluido_em is null for update;
  if v.id is null or v_eu is null or not (
       (config.ve_ativo(v.ativo_id, array['frota'], 'editar')
        and exists (select 1 from nucleo.gestor_da_carteira g
                     where g.ativo_id = v.ativo_id and g.gestor_id = v_eu and g.excluido_em is null and g.periodo @> now()))
       or nucleo.pode_gravar_cadastro_de_cr()) then
    raise exception 'Só o gestor da carteira ou o cadastro encerra este vínculo.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'encerrar_vinculo_de_cr');
  if v_id is not null then
    return v_id;
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null or p_em is null then
    raise exception 'Encerrar o vínculo pede a data e o motivo.' using errcode = '23514';
  end if;

  -- Já encerrado nesta data: nada a fazer (a segunda rodada não muda nada).
  if v.fim is null or v.fim <> p_em then
    if p_versao is distinct from v.versao then
      raise exception 'O vínculo mudou desde que você abriu: confira e tente de novo.' using errcode = '40001';
    end if;
    if p_em <= v.inicio then
      raise exception 'A data de fim tem de ser depois do início do vínculo.' using errcode = '23514';
    end if;
    perform set_config('eixo.motivo', btrim(p_motivo), true);
    update nucleo.cr_do_ativo set fim = p_em, fim_origem = 'informada' where id = v.id;
    perform set_config('eixo.motivo', '', true);
  end if;

  -- Fecha a exceção de dois do mesmo tipo que deixou de valer (idempotente).
  if not exists (
    select 1 from nucleo.cr_do_ativo x join nucleo.cr c on c.id = x.cr_id
     where x.ativo_id = v.ativo_id and x.excluido_em is null and x.periodo @> now()
     group by c.tipo having count(distinct x.cr_id) > 1
  ) then
    update nucleo.fila_de_excecoes
       set resolvida_em = now(), resolvida_por = v_eu, resolucao = 'Um dos CRs do mesmo tipo foi encerrado; ficou um vigente.'
     where ativo_id = v.ativo_id and assunto = 'placa_com_dois_cr_do_mesmo_tipo' and resolvida_em is null;
  end if;

  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.encerrar_vinculo_de_cr(uuid, timestamptz, text, integer, uuid) from public;

create function nucleo.classificar_centro_sem_cr(
  p_codcencus text, p_decisao text, p_codigo text, p_nome text, p_motivo text, p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: a classificação não tem grant de escrita para o app; a função confere por dentro Cadastros › editar no escopo tudo (sem a Diretoria), cria o CR só pelo nucleo.criar_cr (que confere de novo) e grava uma classificação por centro; o fato do Sankhya não é tocado; search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
  v_cr uuid;
begin
  if not nucleo.pode_gravar_cadastro_de_cr() then
    raise exception 'Só o cadastro classifica o centro sem CR.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'classificar_centro_sem_cr');
  if v_id is not null then
    return v_id;
  end if;
  if nullif(btrim(coalesce(p_codcencus, '')), '') is null or p_decisao not in ('criar_cr', 'sem_destino')
     or nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o centro, a decisão (criar o CR ou sem destino) e o motivo.' using errcode = '23514';
  end if;

  select id into v_id from nucleo.classificacao_de_centro where codcencus = btrim(p_codcencus);
  if v_id is null then
    if p_decisao = 'criar_cr' then
      if btrim(p_codcencus) !~ '^[0-9]+$' then
        raise exception 'Só centro com código numérico do Sankhya vira CR.' using errcode = '23514';
      end if;
      v_cr := nucleo.criar_cr(btrim(p_codcencus)::bigint, coalesce(nullif(btrim(p_codigo), ''), btrim(p_codcencus)), p_nome, null);
    end if;
    insert into nucleo.classificacao_de_centro (codcencus, decisao, cr_id, motivo, classificado_por)
    values (btrim(p_codcencus), p_decisao, v_cr, btrim(p_motivo), config.usuario_atual())
    returning id into v_id;
  end if;

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.classificar_centro_sem_cr(text, text, text, text, text, uuid) from public;

create function nucleo.atribuir_dono(p_problema text, p_referencia text, p_dono_id uuid, p_prazo date, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: só o Administrador distribui o dono do problema (ele reatribui, mas não resolve em nome de ninguém, H5); a função confere o perfil por dentro e só grava o dono deste problema e desta referência, excluindo logicamente o anterior; search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.usuario_atual();
  v_id uuid;
  v_atual record;
begin
  if v_eu is null or config.perfil_atual() is distinct from 'administrador' then
    raise exception 'Só o Administrador atribui o dono do problema.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'atribuir_dono');
  if v_id is not null then
    return v_id;
  end if;
  if p_problema not in ('placa_sem_cr', 'cr_sem_operacao', 'dois_do_mesmo_tipo', 'lancamento_sem_cr')
     or nullif(btrim(coalesce(p_referencia, '')), '') is null
     or not exists (select 1 from nucleo.pessoa where id = p_dono_id and excluido_em is null) then
    raise exception 'Escolha o problema, a referência e a pessoa.' using errcode = '23514';
  end if;

  select id, dono_id, prazo into v_atual from nucleo.dono_de_problema
   where problema = p_problema and referencia = p_referencia and excluido_em is null for update;
  if v_atual.id is not null and v_atual.dono_id = p_dono_id and v_atual.prazo is not distinct from p_prazo then
    v_id := v_atual.id;
  else
    if v_atual.id is not null then
      update nucleo.dono_de_problema
         set excluido_em = now(), excluido_por = v_eu, motivo_da_exclusao = 'Reatribuído pelo Administrador'
       where id = v_atual.id;
    end if;
    insert into nucleo.dono_de_problema (problema, referencia, dono_id, prazo, atribuido_por)
    values (p_problema, p_referencia, p_dono_id, p_prazo, v_eu)
    returning id into v_id;
  end if;

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.atribuir_dono(text, text, uuid, date, uuid) from public;

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.problemas_da_saude_do_cr(text,integer,integer)', 'Saúde do CR: as linhas de um problema, paginadas, com a RLS de quem consulta.'),
  ('nucleo.resumo_da_saude_do_cr()', 'Saúde do CR: os cartões e a tabela por dono e prazo, com a RLS de quem consulta.'),
  ('nucleo.pode_gravar_cadastro_de_cr()', 'Saúde do CR: quem chama grava cadastro de CR? (Cadastros › editar no escopo tudo, sem a Diretoria).'),
  ('nucleo.ligar_cr_a_operacao(uuid,uuid,timestamp with time zone,text,uuid)', 'Saúde do CR, Ligar à operação: grava o vínculo CR-operação e fecha a exceção. Conferência por dentro e chave de envio.'),
  ('nucleo.encerrar_vinculo_de_cr(uuid,timestamp with time zone,text,integer,uuid)', 'Saúde do CR, Escolher o vigente: encerra um vínculo placa-CR (data de fim) e fecha a exceção que deixou de valer. Conferência por dentro, versão e chave de envio.'),
  ('nucleo.classificar_centro_sem_cr(text,text,text,text,text,uuid)', 'Saúde do CR, Classificar: decide o centro sem CR (criar o CR ou sem destino). Conferência por dentro e chave de envio.'),
  ('nucleo.atribuir_dono(text,text,uuid,date,uuid)', 'Saúde do CR, Atribuir dono: só o Administrador. Conferência por dentro e chave de envio.');
grant execute on function nucleo.problemas_da_saude_do_cr(text, integer, integer) to authenticated;
grant execute on function nucleo.resumo_da_saude_do_cr() to authenticated;
grant execute on function nucleo.pode_gravar_cadastro_de_cr() to authenticated;
grant execute on function nucleo.ligar_cr_a_operacao(uuid, uuid, timestamptz, text, uuid) to authenticated;
grant execute on function nucleo.encerrar_vinculo_de_cr(uuid, timestamptz, text, integer, uuid) to authenticated;
grant execute on function nucleo.classificar_centro_sem_cr(text, text, text, text, text, uuid) to authenticated;
grant execute on function nucleo.atribuir_dono(text, text, uuid, date, uuid) to authenticated;
