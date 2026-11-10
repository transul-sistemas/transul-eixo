-- Operações pela competência gerencial (regra 4: uma definição só). Só dados fictícios
-- (apoio/operacoes_ficticias.psql, mais as despesas abaixo).
--  * A lista e a ficha da operação contam o custo pela competência gerencial
--    (nucleo.competencia_gerencial: DTENTSAI a partir do dia 11 do mês seguinte leva a despesa ao mês do
--    DTENTSAI) e pelo valor líquido, como a Visão geral dos Resultados.
--  * A Visão geral põe cada CR na operação pela mesma regra das Operações (a montagem do Eixo vence o
--    rótulo do Sankhya), então a ficha e a Visão geral dão o mesmo total para a mesma operação e mês.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

-- Despesas a mais (fictícias):
--   d102-1: 9402, base fevereiro, DTENTSAI 15/03 (depois do corte do dia 10) → competência março (80,00);
--   d102-2: 9402, base março, DTENTSAI 10/03 → fica em março (90,00);
--   d102-3: 9401, março, desdobramento 100,00 e líquido 95,00 → conta o líquido;
--   d102-4: 9402, base fevereiro, DTENTSAI 10/03 (no dia do corte) → fica em fevereiro (40,00).
insert into staging.despesa (origem_id, nufin, codcencus, codnat, dt_competencia, dtentsai, provisao, valor_desdobramento, valor_liquido) values
  ('d102-1', '1021', '9402', '94002', '2026-02-20', '2026-03-15', 'REAL', 80.00, 80.00),
  ('d102-2', '1022', '9402', '94002', '2026-03-05', '2026-03-10', 'REAL', 90.00, 90.00),
  ('d102-3', '1023', '9401', '94001', '2026-03-12', null, 'REAL', 100.00, 95.00),
  ('d102-4', '1024', '9402', '94002', '2026-02-18', '2026-03-10', 'REAL', 40.00, 40.00);

select plan(14);

select tests.como(pg_temp.id('auth_Adm'));
create temp table ficha as
  select o.chave, m.mes, nucleo.ficha_da_operacao(pg_temp.id(o.chave), m.mes)->'cascata' as c
    from (values ('graos'), ('cimento')) o (chave), (values ('2026-02-01'::date), ('2026-03-01'::date)) m (mes);
create temp table visao as
  select m.mes, g
    from (values ('2026-02-01'::date), ('2026-03-01'::date)) m (mes),
         jsonb_array_elements(nucleo.visao_geral_dos_resultados(m.mes, null, null, 'operacao')->'grupos') g;
create temp table lista as
  select m.mes, l
    from (values ('2026-02-01'::date), ('2026-03-01'::date)) m (mes),
         jsonb_array_elements(nucleo.operacoes_do_mes(m.mes)->'linhas') l;

-- ---- A ficha pela competência gerencial e pelo valor líquido ----
select is((select (c->>'custo_servico')::numeric from ficha where chave = 'graos' and mes = '2026-03-01'), 770.00,
  'ficha de março: o serviço soma 600 + 80 (DTENTSAI depois do corte) + 90 (DTENTSAI até o corte)');
select is((select (c->>'custo_frota')::numeric from ficha where chave = 'graos' and mes = '2026-03-01'), 495.00,
  'ficha de março: a Frota conta o valor líquido (400 + 95)');
select is((select (c->>'custo_servico')::numeric from ficha where chave = 'graos' and mes = '2026-02-01'), 110.00,
  'ficha de fevereiro: fica a despesa de fevereiro (70) e a do DTENTSAI no dia do corte (40); a de 80 foi para março');
select is((select sum((n->>'valor')::numeric) from ficha, jsonb_array_elements(c->'servico_por_natureza') n
            where chave = 'graos' and mes = '2026-03-01'), 770.00,
  'o serviço por natureza fecha com o custo de serviço');
select is((select (c->>'margem')::numeric from ficha where chave = 'graos' and mes = '2026-03-01'), 2735.00,
  'a margem de março sai da competência (4.000 − 495 − 770)');

-- ---- A lista e a ficha dão o mesmo número ----
select is((select (l->>'custo_servico')::numeric + (l->>'custo_frota')::numeric from lista
            where mes = '2026-03-01' and l->>'id' = pg_temp.id('graos')::text), 1265.00,
  'a lista de março traz o mesmo custo da ficha');

-- ---- A ficha e a Visão geral dão o mesmo total para a mesma operação e mês ----
select is(
  (select (g->>'receita')::numeric from visao where mes = '2026-03-01' and g->>'chave' = pg_temp.id('graos')::text),
  (select (c->>'receita')::numeric from ficha where chave = 'graos' and mes = '2026-03-01'),
  'Grãos, março: a mesma receita na ficha e na Visão geral');
select is(
  (select (g->>'custo')::numeric from visao where mes = '2026-03-01' and g->>'chave' = pg_temp.id('graos')::text),
  (select (c->>'custo_frota')::numeric + (c->>'custo_servico')::numeric from ficha where chave = 'graos' and mes = '2026-03-01'),
  'Grãos, março: o mesmo custo na ficha e na Visão geral');
select is(
  (select (g->>'resultado')::numeric from visao where mes = '2026-03-01' and g->>'chave' = pg_temp.id('graos')::text),
  (select (c->>'margem')::numeric from ficha where chave = 'graos' and mes = '2026-03-01'),
  'Grãos, março: o resultado da Visão geral é a margem da ficha');
select is(
  (select (g->>'receita')::numeric from visao where mes = '2026-03-01' and g->>'chave' = pg_temp.id('cimento')::text),
  2000.00,
  'Cimento, março: a Visão geral também segue a montagem do Eixo (o CR 9403 montado em Cimento)');
select is(
  (select (g->>'custo')::numeric from visao where mes = '2026-03-01' and g->>'chave' = pg_temp.id('cimento')::text),
  (select (c->>'custo_frota')::numeric + (c->>'custo_servico')::numeric from ficha where chave = 'cimento' and mes = '2026-03-01'),
  'Cimento, março: o mesmo custo na ficha e na Visão geral');
select is(
  (select (g->>'custo')::numeric from visao where mes = '2026-02-01' and g->>'chave' = pg_temp.id('graos')::text),
  (select (c->>'custo_frota')::numeric + (c->>'custo_servico')::numeric from ficha where chave = 'graos' and mes = '2026-02-01'),
  'Grãos, fevereiro: o mesmo custo na ficha e na Visão geral');
-- Antes da montagem (fevereiro), o 9403 fica no rótulo do Sankhya (Grãos) nos dois lados.
select is(
  (select (g->>'custo')::numeric from visao where mes = '2026-02-01' and g->>'chave' = pg_temp.id('cimento')::text),
  null,
  'Cimento, fevereiro: sem lançamento antes da montagem');
select ok(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'nucleo' and p.proname in ('cascata_das_operacoes', 'ficha_da_operacao')
                 and pg_get_functiondef(p.oid) like '%dt_competencia >=%'),
  'a cascata e a ficha não filtram mais pela dt_competencia da v1');

reset role;
select * from finish();
rollback;
