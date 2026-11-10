-- Competência gerencial (Resultados). A regra única do banco, com casos de limite e dados fictícios.
--  * Base = DTNEG do título; se o DTENTSAI for igual ou posterior ao dia (corte + 1) do mês seguinte ao
--    da base, a competência vira o mês do DTENTSAI; senão fica no mês da base.
--  * Sem DTENTSAI: o mês da base. DTENTSAI antes da base: o mês da base.
--  * Renegociado: a base é a menor DTNEG dos títulos de origem.
--  * Provisão fica fora (competência nula).
--  * O dia do corte é parâmetro em config.parametro (dia_do_corte_da_competencia = 10).
begin;
\ir apoio/como_usuario.psql

select plan(22);

-- ---- Estrutura ----
select has_function('nucleo', 'competencia_gerencial', array['date', 'date', 'integer', 'date', 'boolean'],
  'a regra da competência gerencial existe no banco');
select is(
  (select provolatile from pg_proc where oid = 'nucleo.competencia_gerencial(date,date,integer,date,boolean)'::regprocedure),
  'i'::"char", 'a regra é pura (IMMUTABLE): o mesmo título dá sempre a mesma competência');
select ok(
  has_function_privilege('authenticated', 'nucleo.competencia_gerencial(date,date,integer,date,boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'nucleo.competencia_gerencial(date,date,integer,date,boolean)', 'EXECUTE'),
  'quem consulta (authenticated) executa a regra pura dentro das leituras; anon não');
select is((select valor from config.parametro where chave = 'dia_do_corte_da_competencia'), '10',
  'o dia do corte é parâmetro (10)');
select is(nucleo.dia_do_corte_da_competencia(), 10, 'nucleo.dia_do_corte_da_competencia lê o parâmetro');

-- ---- Casos de limite (corte no dia 10) ----
select is(nucleo.competencia_gerencial('2026-09-15', '2026-10-10', 10), '2026-09-01'::date,
  'nota de setembro lançada em 10/10: setembro (o dia 10 ainda é do mês da base)');
select is(nucleo.competencia_gerencial('2026-09-15', '2026-10-11', 10), '2026-10-01'::date,
  'nota de setembro lançada em 11/10: outubro (o mês do lançamento)');
select is(nucleo.competencia_gerencial('2026-07-20', '2026-09-05', 10), '2026-09-01'::date,
  'nota de julho lançada em 05/09: setembro (vários meses de atraso)');
select is(nucleo.competencia_gerencial('2026-09-15', '2026-09-30', 10), '2026-09-01'::date,
  'lançada no próprio mês: o mês da base');
select is(nucleo.competencia_gerencial('2026-09-15', '2026-08-30', 10), '2026-09-01'::date,
  'lançamento antecipado (antes da negociação): o mês da base');
select is(nucleo.competencia_gerencial('2026-09-30', null, 10), '2026-09-01'::date,
  'sem DTENTSAI: o mês da negociação');
select is(nucleo.competencia_gerencial('2026-12-20', '2027-01-10', 10), '2026-12-01'::date,
  'virada do ano, dia 10: dezembro');
select is(nucleo.competencia_gerencial('2026-12-20', '2027-01-11', 10), '2027-01-01'::date,
  'virada do ano, dia 11: janeiro');
select is(nucleo.competencia_gerencial('2026-01-31', '2026-02-10', 10), '2026-01-01'::date,
  'base no último dia do mês: o limite é o dia 11 do mês seguinte, não 31 dias depois');
select is(nucleo.competencia_gerencial(null, '2026-02-10', 10), null::date, 'sem DTNEG, sem competência');

-- ---- Dia do corte como parâmetro ----
select is(nucleo.competencia_gerencial('2026-09-15', '2026-10-05', 5), '2026-09-01'::date, 'corte no dia 5: o dia 5 fica na base');
select is(nucleo.competencia_gerencial('2026-09-15', '2026-10-06', 5), '2026-10-01'::date, 'corte no dia 5: o dia 6 muda de mês');

-- ---- Renegociado e provisão ----
select is(nucleo.competencia_gerencial('2026-10-05', '2026-09-10', 10, '2026-08-03'), '2026-08-01'::date,
  'renegociado: herda a menor DTNEG de origem (agosto) e o lançamento até 10/09 fica em agosto');
select is(nucleo.competencia_gerencial('2026-10-05', '2026-09-11', 10, '2026-08-03'), '2026-09-01'::date,
  'renegociado: lançado a partir de 11/09, vai para o mês do lançamento');
select is(nucleo.competencia_gerencial('2026-10-05', '2026-10-06', 10, null), '2026-10-01'::date,
  'sem título de origem, a base é a própria DTNEG');
select is(nucleo.competencia_gerencial('2026-09-15', '2026-09-20', 10, null, true), null::date,
  'provisão fica fora (sem competência)');
select is(nucleo.competencia_gerencial('2026-09-15', '2026-09-20', 10, null, false), '2026-09-01'::date,
  'título real entra');

select * from finish();
rollback;
