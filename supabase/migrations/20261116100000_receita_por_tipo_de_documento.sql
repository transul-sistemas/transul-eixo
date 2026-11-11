-- Receita em DUAS linhas por tipo de documento (CT-e e NFS-e), com UMA definição de "o que é receita".
--
-- Antes, o filtro `coalesce(v.status_cte, 'A') = 'A'` estava repetido em seis lugares (cascata, Visão
-- geral dos Resultados, conciliação de Parceiros, ficha completa e as cópias). Ele misturava a NFS-e
-- (status vazio) na receita de CT-e. docs/cr-regras.md, "Onde o Eixo ainda diverge", item 5: a divergência
-- era de CLASSIFICAÇÃO, não de valor. Aqui a regra vira uma função só, nucleo.linha_de_receita, e a
-- cascata devolve a receita em duas linhas, mantendo o total.
--
--  * CT-e (tipo_documento = 'CTE') entra se status_cte = 'A' (séries com SEFAZ) ou se o status é nulo e a
--    série é 'V' (série V não passa pela SEFAZ: frete direto, TOP 1122). Status I, R e demais ficam fora.
--  * NFS-e (tipo_documento = 'NFSE') entra SÓ se a TOP (codtipoper) estiver ativa em config.receita_top
--    (1100, 1106, 1128 e 1136). A TOP 1124 (Gestão Portuária) fica de fora: contaria duas vezes (a v1
--    conferiu isso). As TOPs vivem em cadastro, não no código.
--  * A atribuição à operação continua pelo CR do lançamento (codcencus, o centro da nota) via
--    nucleo.cr_da_operacao_no_mes: NFS-e sem placa, ou com placa genérica, já vai para a operação pelo
--    centro da nota. NFS-e com placa real também segue o centro da nota (hipótese registrada em
--    docs/decisoes.md).

create table config.receita_top (
  codtipoper integer primary key,
  tipo text not null check (tipo in ('nfse')),
  ativa boolean not null default true,
  motivo text not null check (length(btrim(motivo)) > 0)
);
comment on table config.receita_top is
  'As TOPs (codtipoper) de NFS-e que contam como receita. Ativa conta; inativa fica fora, com o motivo.';
alter table config.receita_top enable row level security;
create trigger t90_auditoria after insert or update or delete on config.receita_top
  for each row execute function auditoria.registrar_mudanca('codtipoper');

create policy receita_top_ler on config.receita_top for select to authenticated
  using (config.usuario_atual() is not null);
create policy receita_top_criar on config.receita_top for insert to authenticated
  with check (config.pode('admin', 'criar'));
create policy receita_top_alterar on config.receita_top for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));
grant select, insert, update on config.receita_top to authenticated;

insert into config.receita_top (codtipoper, tipo, ativa, motivo) values
  (1100, 'nfse', true, 'NFS-e de frete cadastrada como receita.'),
  (1106, 'nfse', true, 'NFS-e de frete cadastrada como receita.'),
  (1128, 'nfse', true, 'NFS-e de frete cadastrada como receita.'),
  (1136, 'nfse', true, 'NFS-e de frete cadastrada como receita.'),
  (1124, 'nfse', false, 'Gestão Portuária: contaria duas vezes (a v1 conferiu); fica fora da receita.');

-- A regra única. Devolve 'cte', 'nfse' ou nulo (o documento não é receita).
create function nucleo.linha_de_receita(
  p_tipo_documento text,
  p_status_cte text,
  p_serie text,
  p_codtipoper integer
)
returns text
language sql
stable
-- Sem `set search_path` de propósito (como nucleo.competencia_gerencial): função SQL com SET não é
-- embutida no plano e seria chamada linha a linha nas ~100 mil notas. O corpo só usa nomes qualificados
-- (config.receita_top) e operadores do pg_catalog; é SECURITY INVOKER, então a RLS de quem consulta vale.
as $$
  select case
    when p_tipo_documento = 'CTE'
     and (p_status_cte = 'A' or (p_status_cte is null and p_serie = 'V'))
      then 'cte'
    when p_tipo_documento = 'NFSE'
     and exists (select 1 from config.receita_top t where t.codtipoper = p_codtipoper and t.ativa)
      then 'nfse'
  end
$$;
revoke all on function nucleo.linha_de_receita(text, text, text, integer) from public, anon;
comment on function nucleo.linha_de_receita(text, text, text, integer) is
  'A linha de receita do documento do staging: cte (status A, ou série V sem status), nfse (TOP ativa em config.receita_top; a 1124 fica fora para não contar duas vezes) ou nulo (não é receita). Fonte única da regra.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.linha_de_receita(text,text,text,integer)',
   'A regra única de receita (CT-e e NFS-e), usada dentro das leituras de Resultados e Operações (SECURITY INVOKER); só lê as TOPs cadastradas.');
grant execute on function nucleo.linha_de_receita(text, text, text, integer) to authenticated;

-- A cascata do mês por operação, agora com a receita em duas linhas. `receita` e `documentos` continuam
-- sendo os TOTAIS (CT-e + NFS-e), para não quebrar quem lê.
drop function nucleo.cascata_das_operacoes(date);
create function nucleo.cascata_das_operacoes(p_mes date)
returns table (
  operacao_id uuid, crs integer, receita numeric, documentos integer,
  custo_frota numeric, custo_servico numeric,
  receita_cte numeric, documentos_cte integer, receita_nfse numeric, documentos_nfse integer
)
language sql
stable
set search_path = ''
as $$
  with cr as (select * from nucleo.cr_da_operacao_no_mes(p_mes)),
  receita as (
    select x.codcencus,
           sum(x.frete_empresa) filter (where x.linha = 'cte') as valor_cte,
           count(*) filter (where x.linha = 'cte')::integer as documentos_cte,
           sum(x.frete_empresa) filter (where x.linha = 'nfse') as valor_nfse,
           count(*) filter (where x.linha = 'nfse')::integer as documentos_nfse
      from (select v.codcencus, v.frete_empresa,
                   nucleo.linha_de_receita(v.tipo_documento, v.status_cte, v.serie, v.codtipoper) as linha
              from staging.viagem v
             where v.dt_negociacao >= p_mes and v.dt_negociacao < (p_mes + interval '1 month')::date
               and v.sumiu_do_sankhya_em is null) x
     where x.linha is not null
     group by x.codcencus
  ),
  despesa as (
    select d.codcencus, sum(d.valor) as valor from nucleo.despesa_na_competencia(p_mes) d group by d.codcencus
  )
  select cr.operacao_id,
         count(*)::integer,
         (coalesce(sum(r.valor_cte), 0) + coalesce(sum(r.valor_nfse), 0))::numeric(15, 2),
         (coalesce(sum(r.documentos_cte), 0) + coalesce(sum(r.documentos_nfse), 0))::integer,
         coalesce(sum(d.valor) filter (where cr.frota), 0)::numeric(15, 2),
         coalesce(sum(d.valor) filter (where not cr.frota), 0)::numeric(15, 2),
         coalesce(sum(r.valor_cte), 0)::numeric(15, 2),
         coalesce(sum(r.documentos_cte), 0)::integer,
         coalesce(sum(r.valor_nfse), 0)::numeric(15, 2),
         coalesce(sum(r.documentos_nfse), 0)::integer
    from cr
    left join receita r on r.codcencus = cr.codcencus
    left join despesa d on d.codcencus = cr.codcencus
   group by cr.operacao_id
$$;
revoke all on function nucleo.cascata_das_operacoes(date) from public, anon;
comment on function nucleo.cascata_das_operacoes(date) is
  'A cascata do mês por operação: receita total e em duas linhas (CT-e e NFS-e, pela regra única nucleo.linha_de_receita), custo da Frota e de Serviço (competência gerencial). A operação vem do CR do lançamento (centro da nota).';
grant execute on function nucleo.cascata_das_operacoes(date) to authenticated;


CREATE OR REPLACE FUNCTION nucleo.visao_geral_dos_resultados(p_mes date DEFAULT NULL::date, p_garagem_id uuid DEFAULT NULL::uuid, p_operacao_id uuid DEFAULT NULL::uuid, p_agrupamento text DEFAULT 'operacao'::text, p_top integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_agrupamento text := coalesce(nullif(btrim(p_agrupamento), ''), 'operacao');
  v_top integer := least(greatest(coalesce(p_top, 10), 1), 50);
  v_corte integer := nucleo.dia_do_corte_da_competencia();
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_resultado jsonb;
begin
  if not config.pode('resultados', 'ver') then
    raise exception 'Seu perfil não vê Resultados. Peça o acesso a quem administra o sistema.' using errcode = '42501';
  end if;
  if v_agrupamento not in ('operacao', 'unidade', 'filial') then
    raise exception 'Agrupe por operação, unidade ou filial.' using errcode = '22023';
  end if;

  with crs as materialized (
    select distinct on (c.codcencus) c.codcencus::text as codcencus,
           c.garagem_id, g.rotulo as garagem, c.unidade_gerencial, u.rotulo as unidade, u.ordem as ordem_da_unidade
      from nucleo.cr c
      left join config.garagem g on g.id = c.garagem_id
      left join config.unidade_gerencial u on u.codigo = c.unidade_gerencial
     where c.codcencus is not null
     order by c.codcencus, c.excluido_em nulls first, c.criado_em desc
  ),
  -- Todos os lançamentos com a competência, uma vez (receita positiva, custo positivo).
  lancamentos as materialized (
    select nucleo.competencia_gerencial(v.dt_negociacao, null, v_corte) as competencia,
           date_trunc('month', v.dt_negociacao::timestamp)::date as base,
           false as sem_dtentsai,
           v.codcencus, null::text as codnat, v.frete_empresa as receita, 0::numeric as custo
      from staging.viagem v
     where v.sumiu_do_sankhya_em is null
       and nucleo.linha_de_receita(v.tipo_documento, v.status_cte, v.serie, v.codtipoper) is not null
       and v.frete_empresa is not null
       and v.dt_negociacao is not null
    union all
    select nucleo.competencia_gerencial(d.dt_competencia, d.dtentsai, v_corte, null, d.provisao = 'PROVISAO'),
           date_trunc('month', d.dt_competencia::timestamp)::date,
           d.dtentsai is null,
           d.codcencus, d.codnat, 0::numeric, d.valor_liquido
      from staging.despesa d
     where d.invalidado_em is null
       and d.valor_liquido is not null
       and d.dt_competencia is not null
  ),
  meses as (
    select l.competencia as mes, sum(l.receita) as receita
      from lancamentos l
     where l.competencia is not null and l.competencia <= v_hoje
     group by l.competencia
  ),
  alvo as (
    select coalesce(
             date_trunc('month', p_mes::timestamp)::date,
             (select max(m.mes) from meses m where m.receita > 0),
             (select max(m.mes) from meses m),
             date_trunc('month', v_hoje::timestamp)::date
           ) as mes
  ),
  janela as (
    select a.mes, (a.mes - interval '11 months')::date as inicio from alvo a
  ),
  -- A operação de cada CR em cada mês da janela: a mesma regra das Operações (montagem ou rótulo).
  operacao_no_mes as materialized (
    select m.mes::date as mes, x.codcencus, x.operacao_id, o.nome as operacao
      from janela j
     cross join generate_series(j.inicio, j.mes, interval '1 month') m (mes)
     cross join lateral nucleo.cr_da_operacao_no_mes(m.mes::date) x
      left join nucleo.operacao o on o.id = x.operacao_id
  ),
  -- Os lançamentos dos 12 meses, no contexto (filial e operação), com o grupo.
  no_contexto as materialized (
    select l.*, c.codcencus is not null as com_cr,
           case v_agrupamento
             when 'operacao' then om.operacao_id::text
             when 'filial' then c.garagem_id::text
             else c.unidade_gerencial
           end as chave,
           case v_agrupamento
             when 'operacao' then coalesce(om.operacao, 'Sem operação')
             when 'filial' then coalesce(c.garagem, 'Sem filial')
             else coalesce(c.unidade, 'Sem unidade')
           end as rotulo,
           case v_agrupamento when 'unidade' then c.ordem_da_unidade else 0 end as ordem
      from lancamentos l
      cross join janela j
      left join crs c on c.codcencus = l.codcencus
      left join operacao_no_mes om on om.codcencus = l.codcencus and om.mes = l.competencia
     where l.competencia between j.inicio and j.mes
       and (p_garagem_id is null or c.garagem_id = p_garagem_id)
       and (p_operacao_id is null or om.operacao_id = p_operacao_id)
  ),
  do_mes as materialized (
    select n.* from no_contexto n, janela j where n.competencia = j.mes
  ),
  total as (
    select coalesce(sum(m.receita), 0) as receita, coalesce(sum(m.custo), 0) as custo from do_mes m
  ),
  grupos as (
    select m.chave, m.rotulo, m.ordem, sum(m.receita) as receita, sum(m.custo) as custo
      from do_mes m
     group by m.chave, m.rotulo, m.ordem
  ),
  por_natureza as (
    select m.codnat, coalesce(nat.descricao, 'Natureza ' || m.codnat, 'Sem natureza') as descricao,
           sum(m.custo) as valor,
           row_number() over (order by sum(m.custo) desc, m.codnat nulls last) as n
      from do_mes m
      left join staging.natureza nat on nat.codnat = m.codnat
     where m.custo <> 0
     group by m.codnat, nat.descricao
  ),
  serie as (
    select s.mes::date as mes,
           coalesce(sum(n.receita), 0) as receita,
           coalesce(sum(n.custo), 0) as custo
      from janela j
     cross join generate_series(j.inicio, j.mes, interval '1 month') s (mes)
      left join no_contexto n on n.competencia = s.mes::date
     group by s.mes
  )
  select jsonb_build_object(
    'mes', (select j.mes from janela j),
    'agrupamento', v_agrupamento,
    'dia_do_corte', v_corte,
    'meses', (select coalesce(jsonb_agg(m.mes order by m.mes desc), '[]'::jsonb) from meses m),
    'kpis', (
      select jsonb_build_object(
        'receita', t.receita,
        'custo', t.custo,
        'resultado', t.receita - t.custo,
        'margem', round(100.0 * (t.receita - t.custo) / nullif(t.receita, 0), 1),
        'mudaram_de_mes', (select jsonb_build_object('lancamentos', count(*), 'valor', coalesce(sum(m.custo + m.receita), 0))
                             from do_mes m where m.competencia <> m.base),
        'sem_dtentsai', (select jsonb_build_object('lancamentos', count(*), 'valor', coalesce(sum(m.custo), 0))
                           from do_mes m where m.sem_dtentsai and m.custo <> 0),
        'sem_cr', (select jsonb_build_object('lancamentos', count(*), 'valor', coalesce(sum(m.custo + m.receita), 0))
                     from do_mes m where not m.com_cr)
      )
        from total t
    ),
    'serie', (
      select jsonb_agg(jsonb_build_object(
               'mes', s.mes, 'receita', s.receita, 'custo', s.custo, 'resultado', s.receita - s.custo,
               'margem', round(100.0 * (s.receita - s.custo) / nullif(s.receita, 0), 1)
             ) order by s.mes)
        from serie s
    ),
    'grupos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'chave', g.chave, 'rotulo', g.rotulo, 'receita', g.receita, 'custo', g.custo,
               'resultado', g.receita - g.custo,
               'margem', round(100.0 * (g.receita - g.custo) / nullif(g.receita, 0), 1)
             ) order by g.chave is null, g.ordem, g.rotulo, g.chave), '[]'::jsonb)
        from grupos g
    ),
    'total', (
      select jsonb_build_object(
        'receita', t.receita, 'custo', t.custo, 'resultado', t.receita - t.custo,
        'margem', round(100.0 * (t.receita - t.custo) / nullif(t.receita, 0), 1))
        from total t
    ),
    'naturezas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'codnat', p.codnat, 'descricao', p.descricao, 'valor', p.valor,
               'participacao', round(100.0 * p.valor / nullif(t.custo, 0), 1)
             ) order by p.n), '[]'::jsonb)
        from por_natureza p, total t
       where p.n <= v_top
    ),
    'outras', (
      select jsonb_build_object(
        'naturezas', count(p.codnat),
        'valor', coalesce(sum(p.valor), 0),
        'participacao', round(100.0 * coalesce(sum(p.valor), 0) / nullif(max(t.custo), 0), 1))
        from total t
        left join por_natureza p on p.n > v_top
    ),
    'opcoes', jsonb_build_object(
      'filiais', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.rotulo) order by g.rotulo), '[]'::jsonb)
                    from config.garagem g),
      'operacoes', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'nome', o.nome) order by o.nome, o.id), '[]'::jsonb)
                      from nucleo.operacao o where o.excluido_em is null)
    )
  ) into v_resultado;

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION nucleo.conciliacao_por_cr(p_mes date, p_agrupador uuid DEFAULT NULL::uuid)
 RETURNS TABLE(cr_id uuid, agrupador_id uuid, placas text[], dias integer, despesa numeric, receita numeric, lancamentos integer, fora_da_placa numeric, situacao text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
       and v.sumiu_do_sankhya_em is null and nucleo.linha_de_receita(v.tipo_documento, v.status_cte, v.serie, v.codtipoper) is not null
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
$function$;

CREATE OR REPLACE FUNCTION nucleo.resultado_da_operacao(p_operacao uuid, p_inicio date, p_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_vejo uuid[] := nucleo.operacoes_que_vejo();
  v_ini date := date_trunc('month', p_inicio::timestamp)::date;
  v_fim date := date_trunc('month', p_fim::timestamp)::date;
  v_n integer;
  v_ant_ini date;
  v_base date;
  v_corte integer := nucleo.dia_do_corte_da_competencia();
  v_resultado jsonb;
begin
  if p_inicio is null or p_fim is null or v_fim <= v_ini then
    raise exception 'Informe um período com pelo menos um mês.' using errcode = '22023';
  end if;
  v_n := ((extract(year from v_fim) - extract(year from v_ini)) * 12 + extract(month from v_fim) - extract(month from v_ini))::integer;
  if v_n > 60 then
    raise exception 'O período passa de 60 meses.' using errcode = '22023';
  end if;
  if v_vejo is not null and not (p_operacao = any (v_vejo)) then
    return null;
  end if;
  if not exists (select 1 from nucleo.operacao o where o.id = p_operacao and o.excluido_em is null) then
    return null;
  end if;
  if not config.pode('resultados', 'ver') then
    return jsonb_build_object('ve_resultado', false, 'inicio', v_ini, 'fim', v_fim);
  end if;

  v_ant_ini := (v_ini - make_interval(months => v_n))::date;
  -- A janela da evolução: doze meses terminando no último mês do período.
  v_base := least(v_ant_ini, (v_fim - interval '12 months')::date);

  with meses as (
    select g.m::date as mes
      from generate_series(v_base, (v_fim - interval '1 month')::date, interval '1 month') g (m)
  ),
  cr_mes as materialized (
    select ms.mes, c.codcencus, c.frota
      from meses ms
     cross join lateral nucleo.cr_da_operacao_no_mes(ms.mes) c
     where c.operacao_id = p_operacao
  ),
  codigos as (select distinct x.codcencus from cr_mes x),
  lanc as materialized (
    select nucleo.competencia_gerencial(v.dt_negociacao, null, v_corte) as competencia,
           v.dt_negociacao as dia, v.codcencus::text as codcencus, null::text as codnat,
           v.frete_empresa as receita, 0::numeric as custo, 1 as documentos,
           nucleo.linha_de_receita(v.tipo_documento, v.status_cte, v.serie, v.codtipoper) as linha
      from staging.viagem v
     where v.dt_negociacao >= v_base and v.dt_negociacao < v_fim
       and v.codcencus::text in (select x.codcencus from codigos x)
       and v.sumiu_do_sankhya_em is null
       and nucleo.linha_de_receita(v.tipo_documento, v.status_cte, v.serie, v.codtipoper) is not null
       and v.frete_empresa is not null
    union all
    select d.comp,
           case when d.comp = date_trunc('month', d.dt_competencia::timestamp)::date then d.dt_competencia else d.dtentsai end,
           d.codcencus::text, d.codnat::text, 0::numeric, d.valor_liquido, 0, null::text
      from (select s.dt_competencia, s.dtentsai, s.codcencus, s.codnat, s.valor_liquido,
                   nucleo.competencia_gerencial(s.dt_competencia, s.dtentsai, v_corte, null, s.provisao = 'PROVISAO') as comp
              from staging.despesa s
             where s.dt_competencia < v_fim
               and s.codcencus::text in (select x.codcencus from codigos x)
               and s.invalidado_em is null
               and s.valor_liquido is not null
               and s.dt_competencia is not null) d
     where d.comp >= v_base and d.comp < v_fim
  ),
  no_op as materialized (
    select l.*, c.frota
      from lanc l
      join cr_mes c on c.codcencus = l.codcencus and c.mes = l.competencia
  ),
  por_mes as (
    select ms.mes,
           coalesce(sum(n.receita), 0) as receita,
           coalesce(sum(n.documentos), 0)::integer as documentos,
           coalesce(sum(n.receita) filter (where n.linha = 'cte'), 0) as receita_cte,
           coalesce(sum(n.documentos) filter (where n.linha = 'cte'), 0)::integer as documentos_cte,
           coalesce(sum(n.receita) filter (where n.linha = 'nfse'), 0) as receita_nfse,
           coalesce(sum(n.documentos) filter (where n.linha = 'nfse'), 0)::integer as documentos_nfse,
           coalesce(sum(n.custo) filter (where n.frota), 0) as custo_frota,
           coalesce(sum(n.custo) filter (where not n.frota), 0) as custo_servico
      from meses ms
      left join no_op n on n.competencia = ms.mes
     group by ms.mes
  ),
  placas as (
    select (select count(distinct p.ativo_id)
              from nucleo.placa_na_operacao p
             where p.operacao_id = p_operacao and p.excluido_em is null
               and p.periodo && tstzrange(v_ini::timestamp at time zone 'America/Sao_Paulo',
                                          v_fim::timestamp at time zone 'America/Sao_Paulo', '[)'))::integer as atual,
           (select count(distinct p.ativo_id)
              from nucleo.placa_na_operacao p
             where p.operacao_id = p_operacao and p.excluido_em is null
               and p.periodo && tstzrange(v_ant_ini::timestamp at time zone 'America/Sao_Paulo',
                                          v_ini::timestamp at time zone 'America/Sao_Paulo', '[)'))::integer as anterior
  ),
  totais as (
    select t.periodo,
           sum(t.receita) as receita, sum(t.documentos)::integer as documentos,
           sum(t.receita_cte) as receita_cte, sum(t.documentos_cte)::integer as documentos_cte,
           sum(t.receita_nfse) as receita_nfse, sum(t.documentos_nfse)::integer as documentos_nfse,
           sum(t.custo_frota) as custo_frota, sum(t.custo_servico) as custo_servico
      from (select case when m.mes >= v_ini then 'atual' when m.mes >= v_ant_ini then 'anterior' end as periodo, m.*
              from por_mes m) t
     where t.periodo is not null
     group by t.periodo
  ),
  por_natureza as (
    select n.frota, coalesce(nat.descricao, 'Natureza ' || coalesce(n.codnat, 'sem código')) as natureza,
           sum(n.custo) as valor
      from no_op n
      left join staging.natureza nat on nat.codnat = n.codnat
     where n.competencia >= v_ini and n.custo <> 0
     group by 1, 2
  ),
  agrupada as (
    select p.frota, case when p.posicao <= 6 then p.natureza else 'Outras naturezas' end as natureza,
           sum(p.valor) as valor, min(p.posicao) as posicao
      from (select x.*, row_number() over (partition by x.frota order by x.valor desc, x.natureza) as posicao
              from por_natureza x) p
     group by 1, 2
  ),
  dias as (
    select g.d::date as dia,
           coalesce(sum(n.receita), 0) as receita,
           coalesce(sum(n.custo), 0) as custo
      from generate_series(v_ini, (v_fim - interval '1 day')::date, interval '1 day') g (d)
      left join no_op n on n.dia = g.d::date and n.competencia = v_ini
     where v_n = 1
     group by g.d
  )
  select jsonb_build_object(
    've_resultado', true,
    'inicio', v_ini, 'fim', v_fim, 'inicio_anterior', v_ant_ini,
    'atual', (select jsonb_build_object(
                'receita', coalesce(t.receita, 0), 'documentos', coalesce(t.documentos, 0),
                'receita_cte', coalesce(t.receita_cte, 0), 'documentos_cte', coalesce(t.documentos_cte, 0),
                'receita_nfse', coalesce(t.receita_nfse, 0), 'documentos_nfse', coalesce(t.documentos_nfse, 0),
                'custo_frota', coalesce(t.custo_frota, 0), 'custo_servico', coalesce(t.custo_servico, 0),
                'margem', coalesce(t.receita, 0) - coalesce(t.custo_frota, 0) - coalesce(t.custo_servico, 0),
                'margem_percentual', case when coalesce(t.receita, 0) > 0
                    then round((t.receita - t.custo_frota - t.custo_servico) / t.receita * 100, 1) end,
                'placas', p.atual,
                'receita_por_placa', case when p.atual > 0 then round(coalesce(t.receita, 0) / p.atual, 2) end)
                from placas p left join totais t on t.periodo = 'atual'),
    'anterior', (select jsonb_build_object(
                'receita', coalesce(t.receita, 0), 'documentos', coalesce(t.documentos, 0),
                'receita_cte', coalesce(t.receita_cte, 0), 'documentos_cte', coalesce(t.documentos_cte, 0),
                'receita_nfse', coalesce(t.receita_nfse, 0), 'documentos_nfse', coalesce(t.documentos_nfse, 0),
                'custo_frota', coalesce(t.custo_frota, 0), 'custo_servico', coalesce(t.custo_servico, 0),
                'margem', coalesce(t.receita, 0) - coalesce(t.custo_frota, 0) - coalesce(t.custo_servico, 0),
                'margem_percentual', case when coalesce(t.receita, 0) > 0
                    then round((t.receita - t.custo_frota - t.custo_servico) / t.receita * 100, 1) end,
                'placas', p.anterior,
                'receita_por_placa', case when p.anterior > 0 then round(coalesce(t.receita, 0) / p.anterior, 2) end)
                from placas p left join totais t on t.periodo = 'anterior'),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object(
                'mes', m.mes, 'receita', m.receita, 'custo_frota', m.custo_frota, 'custo_servico', m.custo_servico,
                'margem', m.receita - m.custo_frota - m.custo_servico) order by m.mes), '[]'::jsonb)
                from por_mes m where m.mes >= (v_fim - interval '12 months')::date),
    'meses_do_periodo', (select coalesce(jsonb_agg(jsonb_build_object(
                'mes', m.mes, 'receita', m.receita, 'custo_frota', m.custo_frota, 'custo_servico', m.custo_servico,
                'margem', m.receita - m.custo_frota - m.custo_servico) order by m.mes), '[]'::jsonb)
                from por_mes m where m.mes >= v_ini),
    'dias', (select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'receita', d.receita, 'custo', d.custo) order by d.dia), '[]'::jsonb)
                from dias d),
    'frota_por_natureza', (select coalesce(jsonb_agg(jsonb_build_object('natureza', a.natureza, 'valor', a.valor) order by a.posicao), '[]'::jsonb)
                from agrupada a where a.frota),
    'servico_por_natureza', (select coalesce(jsonb_agg(jsonb_build_object('natureza', a.natureza, 'valor', a.valor) order by a.posicao), '[]'::jsonb)
                from agrupada a where not a.frota)
  ) into v_resultado;

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION nucleo.ficha_da_operacao(p_operacao uuid, p_mes date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_vejo uuid[] := nucleo.operacoes_que_vejo();
  v_ve_resultado boolean := config.pode('resultados', 'ver');
  v_meses date[] := nucleo.meses_das_operacoes();
  v_mes date := date_trunc('month', coalesce(p_mes, v_meses[1], nucleo.hoje_em_sao_paulo()))::date;
  v_operacao jsonb;
  v_cascata jsonb;
  v_pessoas jsonb;
  v_placas jsonb;
begin
  if v_vejo is not null and not (p_operacao = any (v_vejo)) then
    return null;
  end if;

  select jsonb_build_object(
           'id', o.id, 'nome', o.nome, 'tipo', o.tipo, 'base_cidade', o.base_cidade, 'base_uf', o.base_uf,
           'filial', g.rotulo, 'filial_codigo', g.codigo, 'versao', o.versao)
    into v_operacao
    from nucleo.operacao o
    left join config.garagem g on g.cidade = o.base_cidade and g.uf = o.base_uf
   where o.id = p_operacao and o.excluido_em is null;
  if v_operacao is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'ativo_id', l.ativo_id, 'placa', l.placa, 'tipo', l.tipo, 'modelo', l.modelo, 'sigla', l.sigla,
           'grupo', l.grupo, 'nome_da_situacao', l.nome_da_situacao, 'cr', l.cr, 'gestor', l.gestor, 'desde', l.desde
         ) order by l.placa, l.ativo_id), '[]'::jsonb)
    into v_placas
    from nucleo.leitura_da_placa l
   where l.operacao_id = p_operacao and l.baixada_em is null;

  if v_ve_resultado then
    with cr as (
      select c.codcencus, c.frota from nucleo.cr_da_operacao_no_mes(v_mes) c where c.operacao_id = p_operacao
    ),
    por_natureza as (
      select cr.frota, coalesce(n.descricao, 'Natureza ' || coalesce(d.codnat, 'sem código')) as natureza,
             sum(d.valor) as valor
        from nucleo.despesa_na_competencia(v_mes) d
        join cr on cr.codcencus = d.codcencus
        left join staging.natureza n on n.codnat = d.codnat
       group by 1, 2
    ),
    -- As seis maiores naturezas de cada lado; o resto vira "Outras naturezas".
    agrupada as (
      select p.frota, case when p.posicao <= 6 then p.natureza else 'Outras naturezas' end as natureza,
             sum(p.valor) as valor, min(p.posicao) as posicao
        from (select x.*, row_number() over (partition by x.frota order by x.valor desc, x.natureza) as posicao
                from por_natureza x) p
       group by 1, 2
    )
    select jsonb_build_object(
             'receita', c.receita, 'documentos', c.documentos,
             'receita_cte', c.receita_cte, 'documentos_cte', c.documentos_cte,
             'receita_nfse', c.receita_nfse, 'documentos_nfse', c.documentos_nfse,
             'custo_frota', c.custo_frota,
             'custo_servico', c.custo_servico, 'margem', c.receita - c.custo_frota - c.custo_servico,
             'margem_percentual', case when c.receita > 0 then round((c.receita - c.custo_frota - c.custo_servico) / c.receita * 100, 1) end,
             'crs', c.crs,
             'frota_por_natureza', coalesce((select jsonb_agg(jsonb_build_object('natureza', a.natureza, 'valor', a.valor) order by a.posicao)
                                               from agrupada a where a.frota), '[]'::jsonb),
             'servico_por_natureza', coalesce((select jsonb_agg(jsonb_build_object('natureza', a.natureza, 'valor', a.valor) order by a.posicao)
                                                 from agrupada a where not a.frota), '[]'::jsonb))
      into v_cascata
      from (select coalesce(max(x.crs), 0) as crs, coalesce(max(x.receita), 0) as receita,
                   coalesce(max(x.documentos), 0) as documentos, coalesce(max(x.custo_frota), 0) as custo_frota,
                   coalesce(max(x.receita_cte), 0) as receita_cte, coalesce(max(x.documentos_cte), 0) as documentos_cte,
                   coalesce(max(x.receita_nfse), 0) as receita_nfse, coalesce(max(x.documentos_nfse), 0) as documentos_nfse,
                   coalesce(max(x.custo_servico), 0) as custo_servico
              from nucleo.cascata_das_operacoes(v_mes) x where x.operacao_id = p_operacao) c;

    with cr as (
      select c.codcencus from nucleo.cr_da_operacao_no_mes(v_mes) c where c.operacao_id = p_operacao
    ),
    folha as (
      select f.codfunc, coalesce(nullif(btrim(f.departamento), ''), 'Sem departamento') as departamento, f.salario_bruto
        from staging.folha f join cr on cr.codcencus = f.codcencus
       where f.referencia >= v_mes and f.referencia < (v_mes + interval '1 month')::date
    )
    select jsonb_build_object(
             'funcionarios', (select count(distinct codfunc) from folha),
             'salario_bruto', (select coalesce(sum(salario_bruto), 0) from folha),
             'por_departamento', coalesce((
               select jsonb_agg(jsonb_build_object('departamento', d.departamento, 'funcionarios', d.funcionarios,
                                                   'salario_bruto', d.salario_bruto)
                                order by d.salario_bruto desc, d.departamento)
                 from (select departamento, count(distinct codfunc) as funcionarios, coalesce(sum(salario_bruto), 0) as salario_bruto
                         from folha group by departamento) d), '[]'::jsonb))
      into v_pessoas;
  end if;

  return jsonb_build_object(
    'operacao', v_operacao,
    'mes', v_mes,
    'meses', to_jsonb(v_meses),
    've_resultado', v_ve_resultado,
    'cascata', v_cascata,
    'placas', v_placas,
    'pessoas', v_pessoas
  );
end;
$function$;

CREATE OR REPLACE FUNCTION nucleo.operacoes_do_mes(p_mes date DEFAULT NULL::date, p_busca text DEFAULT NULL::text, p_chips text[] DEFAULT NULL::text[], p_ordem text DEFAULT 'nome'::text, p_pagina integer DEFAULT 1, p_tam integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_vejo uuid[] := nucleo.operacoes_que_vejo();
  v_ve_resultado boolean := config.pode('resultados', 'ver');
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_ordem text := coalesce(nullif(btrim(p_ordem), ''), 'nome');
  v_campo text := ltrim(v_ordem, '-');
  v_desc boolean := v_ordem like '-%';
  v_tipos text[] := array(select c from unnest(coalesce(p_chips, '{}')) c
                           where c in ('operacao', 'parada', 'administrativa', 'holding', 'acionista'));
  v_filiais text[] := array(select c from unnest(coalesce(p_chips, '{}')) c
                             where c in (select g.codigo from config.garagem g));
  v_meses date[] := nucleo.meses_das_operacoes();
  v_mes date := date_trunc('month', coalesce(p_mes, v_meses[1], nucleo.hoje_em_sao_paulo()))::date;
  v_tam integer := least(greatest(coalesce(p_tam, 20), 1), 100);
  v_resultado jsonb;
begin
  if v_campo not in ('nome', 'placas', 'crs', 'receita', 'custo_frota', 'custo_servico', 'margem', 'margem_percentual') then
    raise exception 'Ordem da lista de operações desconhecida.' using errcode = '22023';
  end if;

  with base as (
    select o.id, o.nome, o.tipo, o.base_cidade, o.base_uf, g.codigo as filial_codigo, g.rotulo as filial
      from nucleo.operacao o
      left join config.garagem g on g.cidade = o.base_cidade and g.uf = o.base_uf
     where o.excluido_em is null
       and (v_vejo is null or o.id = any (v_vejo))
       and (v_busca is null or nucleo.texto_simples(o.nome) like '%' || nucleo.texto_simples(v_busca) || '%')
  ),
  placas as (
    select l.operacao_id, count(*)::integer as placas
      from nucleo.leitura_da_placa l
     where l.baixada_em is null and l.operacao_id is not null
     group by l.operacao_id
  ),
  linha as (
    select b.*, coalesce(p.placas, 0) as placas, coalesce(c.crs, 0) as crs,
           case when v_ve_resultado then coalesce(c.receita, 0) end as receita,
           case when v_ve_resultado then coalesce(c.documentos, 0) end as documentos,
           case when v_ve_resultado then coalesce(c.receita_cte, 0) end as receita_cte,
           case when v_ve_resultado then coalesce(c.documentos_cte, 0) end as documentos_cte,
           case when v_ve_resultado then coalesce(c.receita_nfse, 0) end as receita_nfse,
           case when v_ve_resultado then coalesce(c.documentos_nfse, 0) end as documentos_nfse,
           case when v_ve_resultado then coalesce(c.custo_frota, 0) end as custo_frota,
           case when v_ve_resultado then coalesce(c.custo_servico, 0) end as custo_servico,
           case when v_ve_resultado then coalesce(c.receita, 0) - coalesce(c.custo_frota, 0) - coalesce(c.custo_servico, 0) end as margem
      from base b
      left join placas p on p.operacao_id = b.id
      left join nucleo.cascata_das_operacoes(v_mes) c on c.operacao_id = b.id
  ),
  calculada as (
    select l.*, case when l.receita > 0 then round(l.margem / l.receita * 100, 1) end as margem_percentual,
           (cardinality(v_tipos) = 0 or l.tipo = any (v_tipos)) as no_tipo,
           (cardinality(v_filiais) = 0 or l.filial_codigo = any (v_filiais)) as na_filial
      from linha l
  ),
  filtrada as (
    select c.*,
           row_number() over (order by
             case when not v_desc then
               case v_campo when 'placas' then c.placas when 'crs' then c.crs when 'receita' then c.receita
                 when 'custo_frota' then c.custo_frota when 'custo_servico' then c.custo_servico
                 when 'margem' then c.margem when 'margem_percentual' then c.margem_percentual end
             end asc nulls last,
             case when v_desc then
               case v_campo when 'placas' then c.placas when 'crs' then c.crs when 'receita' then c.receita
                 when 'custo_frota' then c.custo_frota when 'custo_servico' then c.custo_servico
                 when 'margem' then c.margem when 'margem_percentual' then c.margem_percentual end
             end desc nulls last,
             case when v_campo = 'nome' and v_desc then c.nome end desc,
             c.nome asc, c.id asc) as n
      from calculada c
     where c.no_tipo and c.na_filial
  ),
  -- A página: além do fim, a última; menor que 1, a primeira.
  pagina as (
    select x.total, x.paginas, least(greatest(coalesce(p_pagina, 1), 1), x.paginas) as pagina
      from (select count(*)::integer as total,
                   greatest(1, ceil(count(*)::numeric / v_tam)::integer) as paginas
              from filtrada) x
  )
  select jsonb_build_object(
           'mes', v_mes,
           'meses', to_jsonb(v_meses),
           've_resultado', v_ve_resultado,
           'total', pg.total,
           'pagina', pg.pagina,
           'paginas', pg.paginas,
           'tam', v_tam,
           'linhas', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'base_cidade', f.base_cidade, 'base_uf', f.base_uf,
                      'filial', f.filial, 'filial_codigo', f.filial_codigo, 'placas', f.placas, 'crs', f.crs,
                      'receita', f.receita, 'documentos', f.documentos,
                      'receita_cte', f.receita_cte, 'documentos_cte', f.documentos_cte,
                      'receita_nfse', f.receita_nfse, 'documentos_nfse', f.documentos_nfse,
                      'custo_frota', f.custo_frota,
                      'custo_servico', f.custo_servico, 'margem', f.margem, 'margem_percentual', f.margem_percentual
                    ) order by f.n)
               from filtrada f
              where f.n > (pg.pagina - 1) * v_tam and f.n <= pg.pagina * v_tam), '[]'::jsonb),
           'totais', (
             select jsonb_build_object(
                      'operacoes', count(*), 'placas', coalesce(sum(f.placas), 0),
                      'receita', case when v_ve_resultado then coalesce(sum(f.receita), 0) end,
                      'receita_cte', case when v_ve_resultado then coalesce(sum(f.receita_cte), 0) end,
                      'receita_nfse', case when v_ve_resultado then coalesce(sum(f.receita_nfse), 0) end,
                      'custo_frota', case when v_ve_resultado then coalesce(sum(f.custo_frota), 0) end,
                      'custo_servico', case when v_ve_resultado then coalesce(sum(f.custo_servico), 0) end,
                      'margem', case when v_ve_resultado then coalesce(sum(f.margem), 0) end,
                      'margem_percentual', case when v_ve_resultado and sum(f.receita) > 0
                                                then round(sum(f.margem) / sum(f.receita) * 100, 1) end)
               from filtrada f),
           -- Cada grupo de chips conta ignorando a própria seleção.
           'chips', (
             select jsonb_build_object(
                      'operacao', count(*) filter (where c.na_filial and c.tipo = 'operacao'),
                      'parada', count(*) filter (where c.na_filial and c.tipo = 'parada'),
                      'administrativa', count(*) filter (where c.na_filial and c.tipo = 'administrativa'),
                      'holding', count(*) filter (where c.na_filial and c.tipo = 'holding'),
                      'matriz', count(*) filter (where c.no_tipo and c.filial_codigo = 'matriz'),
                      'cordeiropolis', count(*) filter (where c.no_tipo and c.filial_codigo = 'cordeiropolis'),
                      'parauapebas', count(*) filter (where c.no_tipo and c.filial_codigo = 'parauapebas'))
               from calculada c)
         )
    into v_resultado
    from pagina pg;

  return v_resultado;
end;
$function$;
