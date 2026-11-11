-- Corte já aplicado na origem, dados congelados e data fora de faixa (docs/cr-regras.md, divergências 5 e 6).
--
--  * Faixa válida de data (hipótese simples, docs/decisoes.md, 11/11/2026): a `dt_competencia` da despesa vale
--    entre 01/01/2020 e hoje + 1 ano. Os dois limites são parâmetros. Um só lugar decide: nucleo.data_na_faixa.
--    Lançamento fora da faixa fica FORA do resultado em toda função que lê despesa e entra na fila de
--    exceções com o assunto `data_fora_de_faixa`. Provisão não é erro: continua fora do resultado e NÃO
--    entra na fila.
--  * Dados congelados: nucleo.dados_do_staging_ate() diz até que dia o staging vai; o mês da data limite é
--    incompleto e o "mês fechado mais recente" nunca é um mês incompleto.
--  * Corte do dia 10: o staging.despesa não tem a DTNEG, só a competência com o corte já aplicado pela v1.
--    O parâmetro do dia do corte NÃO age sobre as despesas do staging; a edição dele fica TRAVADA no banco
--    enquanto staging.despesa não tiver a coluna dtneg (nucleo.staging_tem_dtneg()).

insert into config.parametro (chave, valor, descricao) values
  ('data_minima_do_staging', '2020-01-01',
   'A menor data de competência de despesa que vale. Antes dela, o lançamento é erro de digitação: fica fora do resultado e vai para a fila de exceções.'),
  ('anos_a_frente_do_staging', '1',
   'Quantos anos além de hoje uma data de competência de despesa ainda vale. Depois disso, o lançamento é erro de digitação: fica fora do resultado e vai para a fila de exceções.')
on conflict (chave) do nothing;

-- A faixa válida. Embutível no plano (sem SET): só nomes qualificados, SECURITY INVOKER.
create function nucleo.data_na_faixa(p_data date)
returns boolean
language sql
stable
as $$
  select p_data is not null
     and p_data >= coalesce((select p.valor::date from config.parametro p where p.chave = 'data_minima_do_staging'), date '2020-01-01')
     and p_data <= nucleo.hoje_em_sao_paulo()
                   + make_interval(years => coalesce((select p.valor::integer from config.parametro p where p.chave = 'anos_a_frente_do_staging'), 1))
$$;
revoke all on function nucleo.data_na_faixa(date) from public, anon;
comment on function nucleo.data_na_faixa(date) is
  'Verdadeiro se a data cabe na faixa válida (de data_minima_do_staging até hoje + anos_a_frente_do_staging). Fonte única: lançamento fora dela fica fora do resultado e vai para a fila de exceções.';

-- Até que dia o staging vai. É a MENOR das duas datas mais recentes (viagem e despesa), porque um mês só
-- está completo quando as duas fontes chegam ao fim dele; a despesa costuma passar da viagem (lançamentos
-- com competência recente), então a MAIOR faria o mês de receita incompleto parecer fechado. Só conta
-- data na faixa e até hoje; viagem que sumiu do Sankhya, despesa invalidada e provisão não contam.
create function nucleo.dados_do_staging_ate()
returns date
language sql
stable
set search_path = ''
as $$
  select least(
    (select max(v.dt_negociacao) from staging.viagem v
      where v.sumiu_do_sankhya_em is null and nucleo.data_na_faixa(v.dt_negociacao)
        and v.dt_negociacao <= nucleo.hoje_em_sao_paulo()),
    (select max(d.dt_competencia) from staging.despesa d
      where d.invalidado_em is null and d.provisao is distinct from 'PROVISAO'
        and nucleo.data_na_faixa(d.dt_competencia) and d.dt_competencia <= nucleo.hoje_em_sao_paulo())
  )
$$;
revoke all on function nucleo.dados_do_staging_ate() from public, anon;
comment on function nucleo.dados_do_staging_ate() is
  'A data até onde o staging vai (a menor entre a última negociação de viagem e a última competência de despesa, na faixa válida). Nula sem dados ou sem permissão em Resultados.';

-- O último mês COMPLETO do staging: o mês da data limite se ela é o último dia dele; senão, o anterior.
create function nucleo.ultimo_mes_completo_do_staging()
returns date
language sql
stable
set search_path = ''
as $$
  select case
           when x.ate = (date_trunc('month', x.ate::timestamp) + interval '1 month - 1 day')::date
             then date_trunc('month', x.ate::timestamp)::date
           else (date_trunc('month', x.ate::timestamp) - interval '1 month')::date
         end
    from (select nucleo.dados_do_staging_ate() as ate) x
   where x.ate is not null
$$;
revoke all on function nucleo.ultimo_mes_completo_do_staging() from public, anon;
comment on function nucleo.ultimo_mes_completo_do_staging() is
  'O último mês completo do staging (primeiro dia); nulo sem dados.';

-- O mês fechado mais recente nunca é um mês incompleto: o menor entre o do calendário (corte) e o último
-- mês completo do staging.
create or replace function nucleo.mes_fechado_mais_recente(p_hoje date default null)
returns date
language sql
stable
set search_path = ''
as $$
  select least(x.calendario, coalesce(nucleo.ultimo_mes_completo_do_staging(), x.calendario))
    from (select (date_trunc('month', y.hoje::timestamp)
                  - case when extract(day from y.hoje) > y.corte then interval '1 month' else interval '2 months' end)::date as calendario
            from (select coalesce(p_hoje, nucleo.hoje_em_sao_paulo()) as hoje, nucleo.dia_do_corte_da_competencia() as corte) y) x
$$;
comment on function nucleo.mes_fechado_mais_recente(date) is
  'O mês fechado mais recente (primeiro dia): o mês M fecha quando passa o dia do corte do mês seguinte, e nunca é um mês incompleto do staging (com dados até 28/10, o padrão é setembro).';

-- Corte do dia 10: a trava.
create function nucleo.staging_tem_dtneg()
returns boolean
language sql
stable
set search_path = ''
as $$
  -- No catálogo (pg_attribute), não em information_schema.columns: este só mostra colunas que o usuário
  -- pode ler, e a resposta não pode depender de quem pergunta.
  select exists (select 1 from pg_catalog.pg_attribute a
                  where a.attrelid = 'staging.despesa'::regclass
                    and a.attname = 'dtneg' and a.attnum > 0 and not a.attisdropped)
$$;
revoke all on function nucleo.staging_tem_dtneg() from public, anon;
comment on function nucleo.staging_tem_dtneg() is
  'Verdadeiro quando staging.despesa tem a coluna dtneg (a data de negociação bruta). Enquanto for falso, o dia do corte não age sobre as despesas e o parâmetro fica travado.';

create function nucleo.travar_corte_sem_dtneg()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.chave = 'dia_do_corte_da_competencia' and new.valor is distinct from old.valor
     and not nucleo.staging_tem_dtneg() then
    raise exception 'O dia do corte não pode ser mudado agora: as despesas do staging já chegam com o corte do dia % aplicado na origem (v1) e não trazem a data de negociação (DTNEG), então a mudança não alteraria nenhum lançamento. Peça para a ponte do Sankhya gravar a DTNEG; depois disso o parâmetro libera sozinho.', old.valor
      using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.travar_corte_sem_dtneg() from public, anon;
create trigger t10_corte_travado before update on config.parametro
  for each row execute function nucleo.travar_corte_sem_dtneg();

-- A fila de exceções para lançamento.
alter table nucleo.fila_de_excecoes add column lancamento_origem_id text;
comment on column nucleo.fila_de_excecoes.lancamento_origem_id is
  'A origem do lançamento do staging (staging.despesa.origem_id) quando a exceção é de lançamento, e não de placa, pessoa ou CR.';
create index fila_de_excecoes_lancamento_origem_id_idx on nucleo.fila_de_excecoes (lancamento_origem_id);
create unique index fila_de_excecoes_uma_aberta_por_lancamento on nucleo.fila_de_excecoes (lancamento_origem_id, assunto)
  where resolvida_em is null and lancamento_origem_id is not null;

-- Abre a exceção `data_fora_de_faixa` de cada lançamento que ainda não a tem. Idempotente: rodar de novo
-- não duplica, e uma exceção já resolvida não reabre. Só a carga (o dono do banco) executa.
create function nucleo.registrar_excecoes_de_data()
returns integer
language plpgsql
security definer -- justificativa: a carga não tem grant de escrita na fila de exceções; a função só abre a exceção data_fora_de_faixa dos lançamentos do staging fora da faixa, com search_path vazio e sem dado pessoal na descrição.
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into nucleo.fila_de_excecoes (lancamento_origem_id, assunto, descricao)
  select d.origem_id, 'data_fora_de_faixa',
         'Data fora de faixa: a competência do lançamento ' || d.origem_id || ' é ' || to_char(d.dt_competencia, 'DD/MM/YYYY')
         || ', fora da faixa válida. O lançamento fica fora do resultado até a data ser corrigida no Sankhya.'
    from staging.despesa d
   where d.invalidado_em is null
     and d.provisao is distinct from 'PROVISAO'
     and d.dt_competencia is not null
     and not nucleo.data_na_faixa(d.dt_competencia)
     and not exists (select 1 from nucleo.fila_de_excecoes f
                      where f.lancamento_origem_id = d.origem_id and f.assunto = 'data_fora_de_faixa')
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function nucleo.registrar_excecoes_de_data() from public, anon, authenticated;
comment on function nucleo.registrar_excecoes_de_data() is
  'Abre a exceção data_fora_de_faixa dos lançamentos do staging fora da faixa válida (provisão e invalidados não entram). Idempotente; devolve quantas abriu.';

-- Funções que o app executa.
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.data_na_faixa(date)', 'A faixa válida de data de despesa, usada dentro das leituras de Resultados (SECURITY INVOKER); só lê os parâmetros.'),
  ('nucleo.dados_do_staging_ate()', 'O aviso "dados até" das telas de número do staging, lido com a RLS de quem consulta.'),
  ('nucleo.ultimo_mes_completo_do_staging()', 'O último mês completo do staging, usada pelo mês fechado mais recente, com a RLS de quem consulta.'),
  ('nucleo.staging_tem_dtneg()', 'A trava do dia do corte: diz se o staging das despesas já tem a DTNEG; só lê o catálogo.');
grant execute on function nucleo.data_na_faixa(date) to authenticated;
grant execute on function nucleo.dados_do_staging_ate() to authenticated;
grant execute on function nucleo.ultimo_mes_completo_do_staging() to authenticated;
grant execute on function nucleo.staging_tem_dtneg() to authenticated;


CREATE OR REPLACE FUNCTION nucleo.despesa_na_competencia(p_mes date)
 RETURNS TABLE(codcencus text, codnat text, valor numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select d.codcencus::text, d.codnat::text, sum(d.valor_liquido)
    from staging.despesa d
   where d.invalidado_em is null
     and d.valor_liquido is not null
     and d.dt_competencia is not null
     and nucleo.data_na_faixa(d.dt_competencia)
     -- A competência nunca é antes do mês da base: corta pelo índice antes da regra.
     and d.dt_competencia < (p_mes + interval '1 month')::date
     and nucleo.competencia_gerencial(d.dt_competencia, d.dtentsai, (select nucleo.dia_do_corte_da_competencia()),
                                      null, d.provisao = 'PROVISAO') = date_trunc('month', p_mes::timestamp)::date
   group by d.codcencus, d.codnat
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
               and s.dt_competencia is not null
               and nucleo.data_na_faixa(s.dt_competencia)) d
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
       and nucleo.data_na_faixa(d.dt_competencia)
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
             (select max(m.mes) from meses m where m.receita > 0
                 and m.mes <= coalesce(nucleo.ultimo_mes_completo_do_staging(), m.mes)),
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
       and nucleo.data_na_faixa(d.dt_competencia)
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

-- No banco que já tem lançamentos (a carga), abre as exceções que faltam. Sem staging, não faz nada.
select nucleo.registrar_excecoes_de_data();
