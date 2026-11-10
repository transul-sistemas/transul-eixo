-- Parceiros (primeira versão): o cadastro do parceiro, a lista e a ficha, a conciliação do mês
-- (acionista e agregado) e a locação de placa.
--
-- Definições (hipótese até o glossário, registrada no relatório da fatia):
--  * Parceiro = uma Pessoa (CPF ou CNPJ, que existe uma vez só; nucleo.pessoa) com os tipos acionista,
--    agregado e locador. O mesmo documento que já é de uma pessoa (um motorista, por exemplo)
--    reaproveita a pessoa; um parceiro por pessoa.
--  * Agrupador do parceiro: o CR pai, no Sankhya, dos CRs de acionista das placas dele (a hierarquia
--    CODCENCUSPAI, com o nome do parceiro). É de um parceiro só e é ele que liga o parceiro às placas e
--    aos lançamentos enquanto a ponte não traz o CODPARC nas despesas.
--  * Placas vinculadas agora: as dos CRs de acionista do agrupador com vínculo vigente, as de posse
--    vigente com o parceiro como dono e as de locação vigente.
--  * Totais do mês: despesas (competência gerencial do staging, sem provisão nem invalidada) e receita
--    (frete da empresa dos CT-e autorizados e presentes no Sankhya) nos CRs de acionista do agrupador.
--    O mês padrão é o mais recente com viagem (o mesmo das Operações).
--  * Conciliação, por CR de acionista no mês: o Eixo espera as placas com vínculo no CR que toca o mês;
--    o Sankhya lançou as despesas e a receita do CR no mês. confere = placa esperada e lançamentos só
--    com ela (ou sem placa); sem_lancamento = placa esperada e nada lançado; diferenca = lançamento num
--    CR sem placa esperada, ou com placa diferente da esperada. justificada = a diferença (ou a falta)
--    tem justificativa registrada no mês. CR sem placa e sem lançamento fica de fora.
--  * Justificar a diferença registra a explicação (motivo); o fato importado nunca muda. A aprovação
--    por alçada fica para depois.
--  * Locação: o parceiro aluga a placa à TranSul por um valor mensal, com vigência [início, fim) e sem
--    sobreposição por placa (EXCLUDE). Encerrar = dizer o dia em que a placa deixa de estar locada.
--
-- Permissão: lê quem tem Parceiros › ver ou Resultados › ver (42501 para os demais); grava quem tem
-- Parceiros › criar (cadastrar, justificar) ou Parceiros › editar (encerrar). As tabelas não têm
-- escrita direta: só as funções gravam (SECURITY DEFINER com justificativa), com a chave de envio.

grant usage on schema parceiros to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------------------------
create table parceiros.parceiro (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references nucleo.pessoa (id),
  tipos text[] not null
    check (cardinality(tipos) between 1 and 3 and tipos <@ array['acionista', 'agregado', 'locador']::text[]),
  cr_agrupador_id uuid references nucleo.cr (id),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text
);
comment on table parceiros.parceiro is
  'O parceiro: uma pessoa (CPF ou CNPJ em nucleo.pessoa_documento, CODPARC em nucleo.pessoa) com os tipos acionista, agregado e locador, e o agrupador do Sankhya (o CR pai dos CRs de acionista das placas dele). Só as funções gravam.';
comment on column parceiros.parceiro.cr_agrupador_id is
  'O CR pai, no Sankhya, dos CRs de acionista das placas do parceiro. Liga o parceiro às placas e aos lançamentos.';
create unique index parceiro_uma_vez_por_pessoa_idx on parceiros.parceiro (pessoa_id) where excluido_em is null;
create unique index parceiro_agrupador_unico_idx on parceiros.parceiro (cr_agrupador_id)
  where excluido_em is null and cr_agrupador_id is not null;
create index parceiro_pessoa_id_idx on parceiros.parceiro (pessoa_id);
create index parceiro_cr_agrupador_id_idx on parceiros.parceiro (cr_agrupador_id);
create index parceiro_nao_excluido_idx on parceiros.parceiro (id) where excluido_em is null;
alter table parceiros.parceiro enable row level security;
create trigger t30_versao before update on parceiros.parceiro
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on parceiros.parceiro
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on parceiros.parceiro
  for each row execute function auditoria.registrar_mudanca('id');

create table parceiros.locacao (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references parceiros.parceiro (id),
  ativo_id uuid not null references nucleo.ativo (id),
  placa text not null,
  inicio date not null,
  fim date,
  periodo daterange generated always as (daterange(inicio, fim, '[)')) stored,
  valor_mensal numeric(15, 2) not null check (valor_mensal > 0),
  motivo_do_encerramento text,
  encerrada_por uuid,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  criado_por uuid,
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint locacao_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint locacao_uma_por_vez exclude using gist (ativo_id with =, periodo with &&) where (excluido_em is null)
);
comment on table parceiros.locacao is
  'A locação de uma placa pelo parceiro, com o valor mensal e a vigência [início, fim): a mesma placa não tem duas locações ao mesmo tempo. Guarda a placa do contrato. Só as funções gravam.';
create index locacao_parceiro_id_idx on parceiros.locacao (parceiro_id);
create index locacao_ativo_id_idx on parceiros.locacao (ativo_id);
create index locacao_nao_excluida_idx on parceiros.locacao (inicio desc, id) where excluido_em is null;
alter table parceiros.locacao enable row level security;
create trigger t30_versao before update on parceiros.locacao
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on parceiros.locacao
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on parceiros.locacao
  for each row execute function auditoria.registrar_mudanca('id');

create table parceiros.justificativa_da_conciliacao (
  id uuid primary key default gen_random_uuid(),
  cr_id uuid not null references nucleo.cr (id),
  mes date not null check (mes = date_trunc('month', mes)::date),
  situacao_justificada text not null check (situacao_justificada in ('diferenca', 'sem_lancamento')),
  motivo text not null check (length(btrim(motivo)) between 10 and 500),
  criada_por uuid,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text
);
comment on table parceiros.justificativa_da_conciliacao is
  'A explicação do Eixo para a diferença (ou a falta de lançamento) de um CR de acionista no mês. Não edita o fato importado. Só as funções gravam.';
create unique index justificativa_uma_por_cr_e_mes_idx on parceiros.justificativa_da_conciliacao (cr_id, mes)
  where excluido_em is null;
create index justificativa_da_conciliacao_cr_id_idx on parceiros.justificativa_da_conciliacao (cr_id);
create index justificativa_nao_excluida_idx on parceiros.justificativa_da_conciliacao (mes) where excluido_em is null;
alter table parceiros.justificativa_da_conciliacao enable row level security;
create trigger t30_versao before update on parceiros.justificativa_da_conciliacao
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on parceiros.justificativa_da_conciliacao
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on parceiros.justificativa_da_conciliacao
  for each row execute function auditoria.registrar_mudanca('id');

-- Leitura: Parceiros › ver ou Resultados › ver. Sem INSERT, UPDATE nem DELETE para authenticated.
create policy parceiro_ler on parceiros.parceiro for select to authenticated
  using ((select config.pode('parceiros', 'ver')) or (select config.pode('resultados', 'ver')));
create policy locacao_ler on parceiros.locacao for select to authenticated
  using ((select config.pode('parceiros', 'ver')) or (select config.pode('resultados', 'ver')));
create policy justificativa_da_conciliacao_ler on parceiros.justificativa_da_conciliacao for select to authenticated
  using ((select config.pode('parceiros', 'ver')) or (select config.pode('resultados', 'ver')));
grant select on parceiros.parceiro, parceiros.locacao, parceiros.justificativa_da_conciliacao to authenticated;

-- ---------------------------------------------------------------------------------------------
-- A conciliação por CR de acionista no mês (uma definição só: a lista soma por agrupador)
-- ---------------------------------------------------------------------------------------------
create function nucleo.conciliacao_por_cr(p_mes date, p_agrupador uuid default null)
returns table (
  cr_id uuid, agrupador_id uuid, placas text[], dias integer, despesa numeric, receita numeric,
  lancamentos integer, fora_da_placa numeric, situacao text
)
language sql
stable
set search_path = ''
as $$
  with mes as (
    select p_mes as inicio, (p_mes + interval '1 month')::date as fim,
           tstzrange(p_mes::timestamp at time zone 'America/Sao_Paulo',
                     (p_mes + interval '1 month')::timestamp at time zone 'America/Sao_Paulo', '[)') as faixa
  ),
  cr as (
    select c.id, c.codcencus::text as codcencus, c.cr_pai_id
      from nucleo.cr c
     where c.tipo = 'acionista' and c.excluido_em is null and c.cr_pai_id is not null
       and (p_agrupador is null or c.cr_pai_id = p_agrupador)
  ),
  vinculo as (
    select v.cr_id, v.ativo_id, v.periodo * mes.faixa as no_mes
      from nucleo.cr_do_ativo v
      join cr on cr.id = v.cr_id
      cross join mes
     where v.excluido_em is null and v.periodo && mes.faixa
  ),
  esperado as (
    select v.cr_id,
           array_agg(distinct pa.placa order by pa.placa) filter (where pa.placa is not null) as placas,
           sum(round(extract(epoch from upper(v.no_mes) - lower(v.no_mes)) / 86400))::integer as dias
      from vinculo v
      left join nucleo.placa_do_ativo pa on pa.ativo_id = v.ativo_id and pa.fim is null and pa.excluido_em is null
     group by v.cr_id
  ),
  -- Todas as placas que o ativo já teve (a placa convertida para Mercosul é a mesma).
  placa_valida as (
    select distinct v.cr_id, pa.placa
      from vinculo v join nucleo.placa_do_ativo pa on pa.ativo_id = v.ativo_id and pa.excluido_em is null
  ),
  lancamento as (
    select d.codcencus, d.placa, d.valor_desdobramento as despesa, 0::numeric as receita
      from staging.despesa d, mes
     where d.dt_competencia >= mes.inicio and d.dt_competencia < mes.fim
       and d.invalidado_em is null and d.provisao is distinct from 'PROVISAO'
       and d.codcencus in (select codcencus from cr)
    union all
    select v.codcencus, v.placa, 0, v.frete_empresa
      from staging.viagem v, mes
     where v.dt_negociacao >= mes.inicio and v.dt_negociacao < mes.fim
       and v.sumiu_do_sankhya_em is null and coalesce(v.status_cte, 'A') = 'A'
       and v.codcencus in (select codcencus from cr)
  ),
  lancado as (
    select cr.id as cr_id,
           sum(l.despesa) as despesa, sum(l.receita) as receita, count(*)::integer as lancamentos,
           coalesce(sum(abs(l.despesa) + abs(l.receita)) filter (
             where l.placa is not null and not exists (
               select 1 from placa_valida pv where pv.cr_id = cr.id and pv.placa = upper(replace(l.placa, '-', ''))
             )), 0) as fora_da_placa
      from lancamento l join cr on cr.codcencus = l.codcencus
     group by cr.id
  )
  select cr.id, cr.cr_pai_id, coalesce(e.placas, '{}'), coalesce(e.dias, 0),
         coalesce(l.despesa, 0)::numeric(15, 2), coalesce(l.receita, 0)::numeric(15, 2),
         coalesce(l.lancamentos, 0), coalesce(l.fora_da_placa, 0)::numeric(15, 2),
         case
           when e.cr_id is null then 'diferenca'
           when l.cr_id is null then 'sem_lancamento'
           when l.fora_da_placa > 0 then 'diferenca'
           else 'confere'
         end
    from cr
    left join esperado e on e.cr_id = cr.id
    left join lancado l on l.cr_id = cr.id
   where e.cr_id is not null or l.cr_id is not null
$$;
revoke all on function nucleo.conciliacao_por_cr(date, uuid) from public, anon;
comment on function nucleo.conciliacao_por_cr(date, uuid) is
  'A conciliação do mês por CR de acionista: as placas que o Eixo espera (vínculo que toca o mês), os dias, o que o Sankhya lançou (despesa e receita) e o valor lançado com outra placa, com a situação (confere, diferenca, sem_lancamento). Lê o staging pela RLS de quem chama.';

-- As placas de cada parceiro agora: CR de acionista do agrupador, posse com o parceiro como dono e
-- locação vigente.
create function nucleo.placas_dos_parceiros_agora()
returns table (parceiro_id uuid, ativo_id uuid, origem text)
language sql
stable
set search_path = ''
as $$
  select p.id, v.ativo_id, 'cr_de_acionista'
    from parceiros.parceiro p
    join nucleo.cr c on c.cr_pai_id = p.cr_agrupador_id and c.tipo = 'acionista' and c.excluido_em is null
    join nucleo.cr_do_ativo v on v.cr_id = c.id and v.excluido_em is null and v.periodo @> now()
   where p.excluido_em is null
  union
  select p.id, po.ativo_id, 'posse'
    from parceiros.parceiro p
    join nucleo.posse_do_ativo po on po.pessoa_dona_id = p.pessoa_id and po.excluido_em is null and po.periodo @> now()
   where p.excluido_em is null
  union
  select p.id, l.ativo_id, 'locacao'
    from parceiros.parceiro p
    join parceiros.locacao l on l.parceiro_id = p.id and l.excluido_em is null
     and l.periodo @> nucleo.hoje_em_sao_paulo()
   where p.excluido_em is null
$$;
revoke all on function nucleo.placas_dos_parceiros_agora() from public, anon;
comment on function nucleo.placas_dos_parceiros_agora() is
  'As placas de cada parceiro agora, com a origem do vínculo (cr_de_acionista, posse, locacao). Lida com a RLS de quem chama.';

-- ---------------------------------------------------------------------------------------------
-- Parceiros › lista
-- ---------------------------------------------------------------------------------------------
create function nucleo.parceiros_do_mes(p_mes date default null, p_busca text default null, p_chips text[] default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_tipos text[] := array(select c from unnest(coalesce(p_chips, '{}')) c where c in ('acionista', 'agregado', 'locador'));
  v_meses date[];
  v_mes date;
  v_resultado jsonb;
begin
  if not (config.pode('parceiros', 'ver') or config.pode('resultados', 'ver')) then
    raise exception 'Seu perfil não tem acesso aos parceiros.' using errcode = '42501';
  end if;
  v_meses := nucleo.meses_das_operacoes();
  v_mes := date_trunc('month', coalesce(p_mes, v_meses[1], nucleo.hoje_em_sao_paulo()))::date;

  with base as (
    select p.id, p.tipos, p.versao, p.cr_agrupador_id, s.nome, s.documento_mascarado, s.codparc,
           a.codigo as agrupador_codigo, a.nome as agrupador_nome
      from parceiros.parceiro p
      join nucleo.pessoa s on s.id = p.pessoa_id
      left join nucleo.cr a on a.id = p.cr_agrupador_id
     where p.excluido_em is null
       and (v_busca is null
            or nucleo.texto_simples(s.nome) like '%' || nucleo.texto_simples(v_busca) || '%'
            or s.codparc::text = v_busca)
  ),
  conciliacao as (
    select c.agrupador_id, sum(c.despesa) as despesa, sum(c.receita) as receita
      from nucleo.conciliacao_por_cr(v_mes) c group by c.agrupador_id
  ),
  placas as (
    select x.parceiro_id, count(distinct x.ativo_id)::integer as placas
      from nucleo.placas_dos_parceiros_agora() x group by x.parceiro_id
  ),
  locacao as (
    select l.parceiro_id, sum(l.valor_mensal) as valor
      from parceiros.locacao l
     where l.excluido_em is null and l.periodo @> nucleo.hoje_em_sao_paulo()
     group by l.parceiro_id
  ),
  linha as (
    select b.*, coalesce(pl.placas, 0) as placas, coalesce(c.despesa, 0) as despesa,
           coalesce(c.receita, 0) as receita, coalesce(l.valor, 0) as locacao_mensal,
           (cardinality(v_tipos) = 0 or b.tipos && v_tipos) as no_tipo
      from base b
      left join placas pl on pl.parceiro_id = b.id
      left join conciliacao c on c.agrupador_id = b.cr_agrupador_id
      left join locacao l on l.parceiro_id = b.id
  )
  select jsonb_build_object(
           'mes', v_mes,
           'meses', to_jsonb(v_meses),
           'linhas', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', l.id, 'nome', l.nome, 'documento_mascarado', l.documento_mascarado, 'codparc', l.codparc,
                      'tipos', to_jsonb(l.tipos), 'agrupador_codigo', l.agrupador_codigo, 'agrupador_nome', l.agrupador_nome,
                      'cr_agrupador_id', l.cr_agrupador_id, 'placas', l.placas, 'despesa', l.despesa, 'receita', l.receita,
                      'locacao_mensal', l.locacao_mensal, 'versao', l.versao
                    ) order by l.nome, l.id)
               from linha l where l.no_tipo), '[]'::jsonb),
           'totais', (
             select jsonb_build_object(
                      'parceiros', count(*), 'placas', coalesce(sum(l.placas), 0),
                      'despesa', coalesce(sum(l.despesa), 0), 'receita', coalesce(sum(l.receita), 0),
                      'locacao_mensal', coalesce(sum(l.locacao_mensal), 0))
               from linha l where l.no_tipo),
           'chips', (
             select jsonb_build_object(
                      'acionista', count(*) filter (where 'acionista' = any (l.tipos)),
                      'agregado', count(*) filter (where 'agregado' = any (l.tipos)),
                      'locador', count(*) filter (where 'locador' = any (l.tipos)))
               from linha l),
           -- Os agrupadores do Sankhya que ainda não são de nenhum parceiro (para o assistente).
           'agrupadores_livres', coalesce((
             select jsonb_agg(jsonb_build_object('id', a.id, 'codigo', a.codigo, 'nome', a.nome, 'crs', a.crs)
                              order by a.nome, a.codigo)
               from (select g.id, g.codigo, g.nome, count(f.id)::integer as crs
                       from nucleo.cr g
                       join nucleo.cr f on f.cr_pai_id = g.id and f.tipo = 'acionista' and f.excluido_em is null
                      where g.excluido_em is null
                        and not exists (select 1 from parceiros.parceiro p
                                         where p.cr_agrupador_id = g.id and p.excluido_em is null)
                      group by g.id, g.codigo, g.nome) a), '[]'::jsonb)
         )
    into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.parceiros_do_mes(date, text, text[]) from public, anon;
comment on function nucleo.parceiros_do_mes(date, text, text[]) is
  'Parceiros › lista: cada parceiro com os tipos, o agrupador, as placas vinculadas agora, a despesa e a receita do mês nos CRs do agrupador e a locação mensal vigente; os totais, as contagens dos chips e os agrupadores ainda livres.';

-- ---------------------------------------------------------------------------------------------
-- Parceiros › ficha
-- ---------------------------------------------------------------------------------------------
create function nucleo.ficha_do_parceiro(p_parceiro uuid, p_mes date default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_meses date[];
  v_mes date;
  v_parceiro jsonb;
  v_agrupador uuid;
begin
  if not (config.pode('parceiros', 'ver') or config.pode('resultados', 'ver')) then
    raise exception 'Seu perfil não tem acesso aos parceiros.' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'id', p.id, 'nome', s.nome, 'documento_mascarado', s.documento_mascarado, 'codparc', s.codparc,
           'tipos', to_jsonb(p.tipos), 'agrupador_codigo', a.codigo, 'agrupador_nome', a.nome,
           'cr_agrupador_id', p.cr_agrupador_id, 'versao', p.versao, 'criado_em', p.criado_em),
         p.cr_agrupador_id
    into v_parceiro, v_agrupador
    from parceiros.parceiro p
    join nucleo.pessoa s on s.id = p.pessoa_id
    left join nucleo.cr a on a.id = p.cr_agrupador_id
   where p.id = p_parceiro and p.excluido_em is null;
  if v_parceiro is null then
    return null;
  end if;
  v_meses := nucleo.meses_das_operacoes();
  v_mes := date_trunc('month', coalesce(p_mes, v_meses[1], nucleo.hoje_em_sao_paulo()))::date;

  return jsonb_build_object(
    'parceiro', v_parceiro,
    'mes', v_mes,
    'meses', to_jsonb(v_meses),
    'totais', (
      select jsonb_build_object(
               'despesa', coalesce(sum(c.despesa), 0), 'receita', coalesce(sum(c.receita), 0),
               'crs', count(*),
               'confere', count(*) filter (where c.situacao = 'confere'),
               'diferenca', count(*) filter (where c.situacao = 'diferenca'),
               'sem_lancamento', count(*) filter (where c.situacao = 'sem_lancamento'))
        from nucleo.conciliacao_por_cr(v_mes, v_agrupador) c where v_agrupador is not null),
    'placas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ativo_id', x.ativo_id, 'placa', l.placa, 'tipo', l.tipo, 'modelo', l.modelo,
               'origens', to_jsonb(x.origens)) order by l.placa, x.ativo_id)
        from (select y.ativo_id, array_agg(y.origem order by y.origem) as origens
                from nucleo.placas_dos_parceiros_agora() y where y.parceiro_id = p_parceiro group by y.ativo_id) x
        join nucleo.leitura_da_placa l on l.ativo_id = x.ativo_id), '[]'::jsonb),
    'locacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'placa', l.placa, 'inicio', l.inicio, 'fim', l.fim, 'valor_mensal', l.valor_mensal,
               'vigente', l.periodo @> nucleo.hoje_em_sao_paulo()) order by l.inicio desc, l.id)
        from parceiros.locacao l where l.parceiro_id = p_parceiro and l.excluido_em is null), '[]'::jsonb)
  );
end;
$$;
revoke all on function nucleo.ficha_do_parceiro(uuid, date) from public, anon;
comment on function nucleo.ficha_do_parceiro(uuid, date) is
  'Parceiros › ficha: o parceiro (com a versão), os totais e as situações da conciliação do mês, as placas vinculadas agora (com a origem) e as locações. Nula se o parceiro não existe.';

-- ---------------------------------------------------------------------------------------------
-- Parceiros › conciliação
-- ---------------------------------------------------------------------------------------------
create function nucleo.conciliacao_do_mes(p_mes date default null, p_agrupador uuid default null, p_situacao text default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_meses date[];
  v_mes date;
  v_situacao text := nullif(btrim(coalesce(p_situacao, '')), '');
  v_resultado jsonb;
begin
  if not (config.pode('parceiros', 'ver') or config.pode('resultados', 'ver')) then
    raise exception 'Seu perfil não tem acesso aos parceiros.' using errcode = '42501';
  end if;
  if v_situacao is not null and v_situacao not in ('confere', 'diferenca', 'sem_lancamento', 'justificada') then
    raise exception 'Situação da conciliação desconhecida.' using errcode = '22023';
  end if;
  v_meses := nucleo.meses_das_operacoes();
  v_mes := date_trunc('month', coalesce(p_mes, v_meses[1], nucleo.hoje_em_sao_paulo()))::date;

  with base as (
    select c.*, cr.codigo as cr_codigo, cr.nome as cr_nome, a.codigo as agrupador_codigo, a.nome as agrupador_nome,
           p.id as parceiro_id, s.nome as parceiro_nome, p.tipos,
           j.id as justificativa_id, j.motivo, j.criado_em as justificada_em
      from nucleo.conciliacao_por_cr(v_mes, p_agrupador) c
      join nucleo.cr cr on cr.id = c.cr_id
      join nucleo.cr a on a.id = c.agrupador_id
      left join parceiros.parceiro p on p.cr_agrupador_id = c.agrupador_id and p.excluido_em is null
      left join nucleo.pessoa s on s.id = p.pessoa_id
      left join parceiros.justificativa_da_conciliacao j
        on j.cr_id = c.cr_id and j.mes = v_mes and j.excluido_em is null
  ),
  linha as (
    select b.*, case when b.situacao <> 'confere' and b.justificativa_id is not null then 'justificada'
                     else b.situacao end as situacao_final
      from base b
  )
  select jsonb_build_object(
           'mes', v_mes,
           'meses', to_jsonb(v_meses),
           'linhas', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'cr_id', l.cr_id, 'cr_codigo', l.cr_codigo, 'cr_nome', l.cr_nome,
                      'agrupador_id', l.agrupador_id, 'agrupador_codigo', l.agrupador_codigo,
                      'agrupador_nome', l.agrupador_nome, 'parceiro_id', l.parceiro_id,
                      'parceiro_nome', l.parceiro_nome, 'tipos', to_jsonb(l.tipos),
                      'placas', to_jsonb(l.placas), 'dias', l.dias, 'despesa', l.despesa, 'receita', l.receita,
                      'lancamentos', l.lancamentos, 'fora_da_placa', l.fora_da_placa,
                      'situacao', l.situacao_final, 'motivo', l.motivo, 'justificada_em', l.justificada_em
                    ) order by case l.situacao_final when 'diferenca' then 1 when 'sem_lancamento' then 2
                                     when 'justificada' then 3 else 4 end,
                               coalesce(l.parceiro_nome, l.agrupador_nome), l.agrupador_codigo, l.cr_codigo, l.cr_id)
               from linha l where v_situacao is null or l.situacao_final = v_situacao), '[]'::jsonb),
           'contagens', (
             select jsonb_build_object(
                      'todas', count(*),
                      'confere', count(*) filter (where l.situacao_final = 'confere'),
                      'diferenca', count(*) filter (where l.situacao_final = 'diferenca'),
                      'sem_lancamento', count(*) filter (where l.situacao_final = 'sem_lancamento'),
                      'justificada', count(*) filter (where l.situacao_final = 'justificada'))
               from linha l),
           'totais', (
             select jsonb_build_object(
                      'despesa', coalesce(sum(l.despesa), 0), 'receita', coalesce(sum(l.receita), 0),
                      'fora_da_placa', coalesce(sum(l.fora_da_placa), 0))
               from linha l where v_situacao is null or l.situacao_final = v_situacao),
           -- Os agrupadores com linha no mês, para escolher o parceiro.
           'parceiros', coalesce((
             select jsonb_agg(jsonb_build_object('agrupador_id', g.agrupador_id, 'nome', g.nome, 'cadastrado', g.cadastrado)
                              order by g.nome, g.agrupador_id)
               from (select distinct l.agrupador_id, coalesce(l.parceiro_nome, l.agrupador_nome, l.agrupador_codigo) as nome,
                            l.parceiro_id is not null as cadastrado
                       from linha l) g), '[]'::jsonb)
         )
    into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.conciliacao_do_mes(date, uuid, text) from public, anon;
comment on function nucleo.conciliacao_do_mes(date, uuid, text) is
  'Parceiros › conciliação: por CR de acionista no mês, o que o Sankhya lançou × as placas que o Eixo espera, com a situação (confere, diferença, sem lançamento, justificada), as contagens e os totais prontos. Filtra por agrupador (o parceiro) e situação.';

-- ---------------------------------------------------------------------------------------------
-- Parceiros › locação (leitura)
-- ---------------------------------------------------------------------------------------------
create function nucleo.locacoes(p_situacao text default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_situacao text := coalesce(nullif(btrim(coalesce(p_situacao, '')), ''), 'todas');
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_resultado jsonb;
begin
  if not (config.pode('parceiros', 'ver') or config.pode('resultados', 'ver')) then
    raise exception 'Seu perfil não tem acesso aos parceiros.' using errcode = '42501';
  end if;
  if v_situacao not in ('todas', 'vigente', 'futura', 'encerrada') then
    raise exception 'Situação da locação desconhecida.' using errcode = '22023';
  end if;

  with linha as (
    select l.id, l.parceiro_id, s.nome as parceiro_nome, l.ativo_id, l.placa, l.inicio, l.fim, l.valor_mensal,
           l.motivo_do_encerramento, l.versao,
           case when l.periodo @> v_hoje then 'vigente' when l.inicio > v_hoje then 'futura' else 'encerrada' end as situacao
      from parceiros.locacao l
      join parceiros.parceiro p on p.id = l.parceiro_id
      join nucleo.pessoa s on s.id = p.pessoa_id
     where l.excluido_em is null
  )
  select jsonb_build_object(
           'hoje', v_hoje,
           'linhas', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', l.id, 'parceiro_id', l.parceiro_id, 'parceiro_nome', l.parceiro_nome, 'ativo_id', l.ativo_id,
                      'placa', l.placa, 'inicio', l.inicio, 'fim', l.fim, 'valor_mensal', l.valor_mensal,
                      'motivo_do_encerramento', l.motivo_do_encerramento, 'situacao', l.situacao, 'versao', l.versao
                    ) order by case l.situacao when 'vigente' then 1 when 'futura' then 2 else 3 end,
                               l.inicio desc, l.placa, l.id)
               from linha l where v_situacao = 'todas' or l.situacao = v_situacao), '[]'::jsonb),
           'contagens', (
             select jsonb_build_object(
                      'todas', count(*),
                      'vigente', count(*) filter (where l.situacao = 'vigente'),
                      'futura', count(*) filter (where l.situacao = 'futura'),
                      'encerrada', count(*) filter (where l.situacao = 'encerrada'))
               from linha l),
           'totais', (
             select jsonb_build_object(
                      'valor_mensal_vigente', coalesce(sum(l.valor_mensal) filter (where l.situacao = 'vigente'), 0),
                      'placas_vigentes', count(distinct l.ativo_id) filter (where l.situacao = 'vigente'))
               from linha l),
           'parceiros', coalesce((
             select jsonb_agg(jsonb_build_object('id', p.id, 'nome', s.nome, 'tipos', to_jsonb(p.tipos))
                              order by s.nome, p.id)
               from parceiros.parceiro p join nucleo.pessoa s on s.id = p.pessoa_id
              where p.excluido_em is null), '[]'::jsonb)
         )
    into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.locacoes(text) from public, anon;
comment on function nucleo.locacoes(text) is
  'Parceiros › locação: os contratos (vigentes primeiro) com a situação (vigente, futura, encerrada), as contagens, o valor mensal vigente e os parceiros para o assistente.';

-- ---------------------------------------------------------------------------------------------
-- Gravações
-- ---------------------------------------------------------------------------------------------
create function nucleo.cadastrar_parceiro(
  p_documento text, p_nome text, p_tipos text[], p_codparc bigint default null,
  p_cr_agrupador_id uuid default null, p_chave uuid default null
)
returns jsonb
language plpgsql
security definer -- justificativa: as tabelas de Parceiros e a pessoa não têm escrita direta para quem cadastra parceiro; a função confere parceiros.criar, valida o documento e o agrupador e reaproveita a pessoa do mesmo CPF/CNPJ; search_path vazio.
set search_path = ''
as $$
declare
  v_documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_nome text := btrim(coalesce(p_nome, ''));
  v_tipos text[] := array(select distinct t from unnest(coalesce(p_tipos, '{}')) t order by t);
  v_pessoa uuid;
  v_codparc bigint;
  v_existente boolean := false;
  v_id uuid;
begin
  if not config.pode('parceiros', 'criar') then
    raise exception 'Você não tem permissão para cadastrar parceiro. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  if v_documento !~ '^([0-9]{11}|[0-9]{14})$' or not nucleo.documento_valido(v_documento) then
    raise exception 'O CPF ou CNPJ não é válido. Confira os números (CPF com 11, CNPJ com 14).' using errcode = '23514';
  end if;
  if cardinality(v_tipos) = 0 or not (v_tipos <@ array['acionista', 'agregado', 'locador']::text[]) then
    raise exception 'Escolha ao menos um tipo: acionista, agregado ou locador.' using errcode = '23514';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'cadastrar_parceiro');
  if v_id is not null then
    return (select jsonb_build_object('parceiro_id', p.id, 'nome', s.nome, 'pessoa_existente', true)
              from parceiros.parceiro p join nucleo.pessoa s on s.id = p.pessoa_id where p.id = v_id);
  end if;

  if p_cr_agrupador_id is not null then
    if not exists (select 1 from nucleo.cr f
                    where f.cr_pai_id = p_cr_agrupador_id and f.tipo = 'acionista' and f.excluido_em is null) then
      raise exception 'O agrupador escolhido não é o CR pai de CRs de acionista no Sankhya. Escolha outro.' using errcode = '23514';
    end if;
    if exists (select 1 from parceiros.parceiro p where p.cr_agrupador_id = p_cr_agrupador_id and p.excluido_em is null) then
      raise exception 'Este agrupador do Sankhya já é de outro parceiro.' using errcode = '23505';
    end if;
  end if;

  select d.pessoa_id into v_pessoa from nucleo.pessoa_documento d where d.documento = v_documento;
  if v_pessoa is not null then
    v_existente := true;
    if exists (select 1 from parceiros.parceiro p where p.pessoa_id = v_pessoa and p.excluido_em is null) then
      raise exception 'Este CPF ou CNPJ já é de um parceiro. Procure-o na lista.' using errcode = '23505';
    end if;
  else
    if length(v_nome) = 0 then
      raise exception 'Diga o nome ou a razão social do parceiro.' using errcode = '23514';
    end if;
    insert into nucleo.pessoa (nome) values (v_nome) returning id into v_pessoa;
    insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, v_documento);
  end if;

  if p_codparc is not null then
    select s.codparc into v_codparc from nucleo.pessoa s where s.id = v_pessoa;
    if v_codparc is null then
      if exists (select 1 from nucleo.pessoa s where s.codparc = p_codparc) then
        raise exception 'O código do parceiro no Sankhya (CODPARC) % já é de outra pessoa.', p_codparc using errcode = '23505';
      end if;
      update nucleo.pessoa set codparc = p_codparc where id = v_pessoa;
    elsif v_codparc <> p_codparc then
      raise exception 'Esta pessoa já tem outro código no Sankhya (CODPARC %).', v_codparc using errcode = '23514';
    end if;
  end if;

  insert into parceiros.parceiro (pessoa_id, tipos, cr_agrupador_id, criado_por)
  values (v_pessoa, v_tipos, p_cr_agrupador_id, auth.uid())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);

  return (select jsonb_build_object('parceiro_id', p.id, 'nome', s.nome, 'pessoa_existente', v_existente)
            from parceiros.parceiro p join nucleo.pessoa s on s.id = p.pessoa_id where p.id = v_id);
end;
$$;
revoke all on function nucleo.cadastrar_parceiro(text, text, text[], bigint, uuid, uuid) from public, anon;
comment on function nucleo.cadastrar_parceiro(text, text, text[], bigint, uuid, uuid) is
  'Cadastrar parceiro: CPF ou CNPJ válido e sem duplicata (a pessoa do mesmo documento é reaproveitada), os tipos, o CODPARC e o agrupador do Sankhya (de um parceiro só). Chave de envio.';

create function nucleo.justificar_diferenca(p_cr_id uuid, p_mes date, p_motivo text, p_chave uuid default null)
returns jsonb
language plpgsql
security definer -- justificativa: a justificativa não tem escrita direta; a função confere parceiros.criar e que a linha do mês tem diferença ou falta de lançamento (pela mesma conta da tela); search_path vazio.
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', p_mes)::date;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_situacao text;
  v_id uuid;
begin
  if not config.pode('parceiros', 'criar') then
    raise exception 'Você não tem permissão para justificar a conciliação. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  if length(v_motivo) < 10 or length(v_motivo) > 500 then
    raise exception 'Explique o motivo da diferença (de 10 a 500 caracteres).' using errcode = '23514';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'justificar_diferenca');
  if v_id is not null then
    return jsonb_build_object('justificativa_id', v_id);
  end if;
  select c.situacao into v_situacao from nucleo.conciliacao_por_cr(v_mes) c where c.cr_id = p_cr_id;
  if v_situacao is null or v_situacao = 'confere' then
    raise exception 'Esta linha não tem diferença no mês: não há o que justificar.' using errcode = '23514';
  end if;
  if exists (select 1 from parceiros.justificativa_da_conciliacao j
              where j.cr_id = p_cr_id and j.mes = v_mes and j.excluido_em is null) then
    raise exception 'Esta diferença já foi justificada neste mês.' using errcode = '23505';
  end if;
  insert into parceiros.justificativa_da_conciliacao (cr_id, mes, situacao_justificada, motivo, criada_por)
  values (p_cr_id, v_mes, v_situacao, v_motivo, auth.uid())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return jsonb_build_object('justificativa_id', v_id, 'situacao_justificada', v_situacao);
end;
$$;
revoke all on function nucleo.justificar_diferenca(uuid, date, text, uuid) from public, anon;
comment on function nucleo.justificar_diferenca(uuid, date, text, uuid) is
  'Justificar diferença: registra o motivo da diferença (ou da falta de lançamento) do CR de acionista no mês. Não edita o fato importado. Chave de envio.';

create function nucleo.cadastrar_locacao(
  p_parceiro_id uuid, p_placa text, p_inicio date, p_valor_mensal numeric, p_fim date default null, p_chave uuid default null
)
returns jsonb
language plpgsql
security definer -- justificativa: a locação não tem escrita direta e quem a cadastra pode não ver a placa pela RLS da Frota; a função confere parceiros.criar, acha a placa vigente e grava com a vigência sem sobreposição (EXCLUDE); search_path vazio.
set search_path = ''
as $$
declare
  v_placa text := upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g'));
  v_ativo uuid;
  v_id uuid;
begin
  if not config.pode('parceiros', 'criar') then
    raise exception 'Você não tem permissão para cadastrar locação. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  if not exists (select 1 from parceiros.parceiro p where p.id = p_parceiro_id and p.excluido_em is null) then
    raise exception 'Escolha o parceiro da locação.' using errcode = '23514';
  end if;
  if p_inicio is null then
    raise exception 'Diga o dia em que a locação começa.' using errcode = '23514';
  end if;
  if p_fim is not null and p_fim <= p_inicio then
    raise exception 'O fim da locação vem depois do início.' using errcode = '23514';
  end if;
  if p_valor_mensal is null or p_valor_mensal <= 0 or p_valor_mensal <> round(p_valor_mensal, 2) then
    raise exception 'Diga o valor mensal da locação, maior que zero e com centavos.' using errcode = '23514';
  end if;
  select pa.ativo_id into v_ativo
    from nucleo.placa_do_ativo pa
    join nucleo.ativo a on a.id = pa.ativo_id and a.excluido_em is null
   where pa.placa = v_placa and pa.excluido_em is null and pa.fim is null;
  if v_ativo is null then
    raise exception 'A placa % não está na frota. Confira a placa ou cadastre-a em Frota › Placas.', v_placa using errcode = '23514';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'cadastrar_locacao');
  if v_id is null then
    begin
      insert into parceiros.locacao (parceiro_id, ativo_id, placa, inicio, fim, valor_mensal, criado_por)
      values (p_parceiro_id, v_ativo, v_placa, p_inicio, p_fim, p_valor_mensal, auth.uid())
      returning id into v_id;
    exception when exclusion_violation then
      raise exception 'A placa % já tem locação nesse período. Encerre a anterior ou escolha outro início.', v_placa using errcode = '23P01';
    end;
    perform auditoria.concluir_envio(p_chave, v_id);
  end if;
  return (select jsonb_build_object('locacao_id', l.id, 'placa', l.placa, 'versao', l.versao)
            from parceiros.locacao l where l.id = v_id);
end;
$$;
revoke all on function nucleo.cadastrar_locacao(uuid, text, date, numeric, date, uuid) from public, anon;
comment on function nucleo.cadastrar_locacao(uuid, text, date, numeric, date, uuid) is
  'Cadastrar locação: o parceiro, a placa (a vigente na frota), o início, o fim (opcional) e o valor mensal em numeric(15,2). A mesma placa não tem duas locações ao mesmo tempo (EXCLUDE). Chave de envio.';

create function nucleo.encerrar_locacao(p_locacao_id uuid, p_fim date, p_motivo text, p_versao integer, p_chave uuid default null)
returns jsonb
language plpgsql
security definer -- justificativa: a locação não tem escrita direta; a função confere parceiros.editar, a versão que a pessoa viu e que o fim vem depois do início; search_path vazio.
set search_path = ''
as $$
declare
  v_locacao record;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_id uuid;
begin
  if not config.pode('parceiros', 'editar') then
    raise exception 'Você não tem permissão para encerrar locação. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  if length(v_motivo) = 0 or length(v_motivo) > 500 then
    raise exception 'Diga o motivo do encerramento (até 500 caracteres).' using errcode = '23514';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'encerrar_locacao');
  if v_id is not null then
    return (select jsonb_build_object('locacao_id', l.id, 'placa', l.placa, 'fim', l.fim, 'versao', l.versao)
              from parceiros.locacao l where l.id = v_id);
  end if;
  select * into v_locacao from parceiros.locacao where id = p_locacao_id and excluido_em is null for update;
  if not found then
    raise exception 'Esta locação não existe mais. Atualize a lista.' using errcode = '23514';
  end if;
  if v_locacao.versao <> p_versao then
    raise exception 'Esta locação mudou desde que você abriu. Feche e abra de novo.' using errcode = '40001';
  end if;
  if p_fim is null or p_fim <= v_locacao.inicio then
    raise exception 'O encerramento vem depois do início da locação.' using errcode = '23514';
  end if;
  if v_locacao.fim is not null and p_fim > v_locacao.fim then
    raise exception 'A locação já termina antes desse dia. Escolha um dia até o fim combinado.' using errcode = '23514';
  end if;
  update parceiros.locacao
     set fim = p_fim, motivo_do_encerramento = v_motivo, encerrada_por = auth.uid()
   where id = p_locacao_id;
  perform auditoria.concluir_envio(p_chave, p_locacao_id);
  return (select jsonb_build_object('locacao_id', l.id, 'placa', l.placa, 'fim', l.fim, 'versao', l.versao)
            from parceiros.locacao l where l.id = p_locacao_id);
end;
$$;
revoke all on function nucleo.encerrar_locacao(uuid, date, text, integer, uuid) from public, anon;
comment on function nucleo.encerrar_locacao(uuid, date, text, integer, uuid) is
  'Encerrar locação: o dia em que a placa deixa de estar locada (o fim, exclusivo) e o motivo, com a versão que a pessoa viu. Chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Funções que o app executa (com o porquê) e os grants
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.conciliacao_por_cr(date,uuid)', 'Parceiros: a conciliação do mês por CR de acionista, lida do staging pela RLS de quem chama (usada pela lista, pela ficha e pela conciliação).'),
  ('nucleo.placas_dos_parceiros_agora()', 'Parceiros: as placas de cada parceiro agora (CR de acionista, posse e locação), com a RLS de quem chama.'),
  ('nucleo.parceiros_do_mes(date,text,text[])', 'Parceiros › lista: os parceiros com as placas e os totais do mês prontos.'),
  ('nucleo.ficha_do_parceiro(uuid,date)', 'Parceiros › ficha: o parceiro, as placas, as locações e a conciliação do mês.'),
  ('nucleo.conciliacao_do_mes(date,uuid,text)', 'Parceiros › conciliação: as linhas do mês com a situação, as contagens e os totais prontos.'),
  ('nucleo.locacoes(text)', 'Parceiros › locação: os contratos com a situação, as contagens e o valor mensal vigente.'),
  ('nucleo.cadastrar_parceiro(text,text,text[],bigint,uuid,uuid)', 'Cadastrar parceiro: confere a permissão, o documento e o agrupador e grava pela função.'),
  ('nucleo.justificar_diferenca(uuid,date,text,uuid)', 'Justificar diferença: registra a explicação sem editar o fato importado.'),
  ('nucleo.cadastrar_locacao(uuid,text,date,numeric,date,uuid)', 'Cadastrar locação: confere a permissão e a placa e grava a vigência sem sobreposição.'),
  ('nucleo.encerrar_locacao(uuid,date,text,integer,uuid)', 'Encerrar locação: confere a permissão e a versão e grava o fim da vigência.');

grant execute on function nucleo.conciliacao_por_cr(date, uuid) to authenticated;
grant execute on function nucleo.placas_dos_parceiros_agora() to authenticated;
grant execute on function nucleo.parceiros_do_mes(date, text, text[]) to authenticated;
grant execute on function nucleo.ficha_do_parceiro(uuid, date) to authenticated;
grant execute on function nucleo.conciliacao_do_mes(date, uuid, text) to authenticated;
grant execute on function nucleo.locacoes(text) to authenticated;
grant execute on function nucleo.cadastrar_parceiro(text, text, text[], bigint, uuid, uuid) to authenticated;
grant execute on function nucleo.justificar_diferenca(uuid, date, text, uuid) to authenticated;
grant execute on function nucleo.cadastrar_locacao(uuid, text, date, numeric, date, uuid) to authenticated;
grant execute on function nucleo.encerrar_locacao(uuid, date, text, integer, uuid) to authenticated;
