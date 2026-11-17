-- Operacional › Análise (Nível 3): nucleo.analise_do_operacional no contrato único das telas de painel.
-- Uma passagem pelo Operacional é a sequência de eventos DOp, ACe, CAr e CAn da placa que termina no ETc
-- seguinte; o tempo de cada etapa vai do evento ao próximo evento da placa, e o ciclo, do primeiro evento
-- da passagem ao ETc. A passagem conta no mês do ETc ([início, fim) em São Paulo). Com a permissão de quem
-- chama (a RLS do evento recorta). Os dados fictícios ficam em fev/2026 e são achados pela busca da placa;
-- os totais do mês são comparados antes e depois deles, para valer em qualquer banco.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(20);

select ok(not (select prosecdef from pg_proc where oid = 'nucleo.analise_do_operacional(date,text,text,integer,integer)'::regprocedure),
  '1. a análise roda com a permissão de quem chama (a RLS do evento recorta)');
select ok(not has_function_privilege('anon', 'nucleo.analise_do_operacional(date,text,text,integer,integer)', 'execute'),
  '2. anon não lê a análise');

create function pg_temp.kpi(p_j jsonb, p text) returns numeric language sql as
  $$ select (x->>'valor')::numeric from jsonb_array_elements(p_j->'kpis') x where x->>'id' = p $$;

select tests.como(pg_temp.id('auth_Adm'));
create temp table antes as select nucleo.analise_do_operacional('2026-02-01', null, null, 1, 20) as j;
reset role;

insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values (12901, 'K129A', true, true);
select pg_temp.guardar('t1', nucleo.cadastrar_ativo(
  p_tipo => 'caminhao', p_carroceria_id => (select id from config.carroceria where nome = 'Graneleira'),
  p_renavam => pg_temp.renavam(12901), p_placa => 'FFF1291', p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K129A'), p_operacao_id => pg_temp.id('graos'),
  p_em => '2026-01-10 08:00-03'));
insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem) values
  -- Z: termina às 22:30 de 31/01 em São Paulo (já 01/02 em UTC): conta em janeiro, não em fevereiro.
  (pg_temp.id('t1'), 'DOp', '2026-01-31 21:00-03', 'informada', 'manual'),
  (pg_temp.id('t1'), 'ETc', '2026-01-31 22:30-03', 'informada', 'manual'),
  -- A: DOp 60 min; termina no limite 01/02 00:00 (conta em fevereiro); ciclo 60.
  (pg_temp.id('t1'), 'DOp', '2026-01-31 23:00-03', 'informada', 'manual'),
  (pg_temp.id('t1'), 'ETc', '2026-02-01 00:00-03', 'informada', 'manual'),
  -- B: DOp 60, ACe 90, CAr 150, CAn 30; ciclo 330; espera para carregar 150.
  (pg_temp.id('t1'), 'DOp', '2026-02-02 08:00-03', 'informada', 'manual'),
  (pg_temp.id('t1'), 'ACe', '2026-02-02 09:00-03', 'informada', 'manual'),
  (pg_temp.id('t1'), 'CAr', '2026-02-02 10:30-03', 'informada', 'manual'),
  (pg_temp.id('t1'), 'CAn', '2026-02-02 13:00-03', 'informada', 'manual'),
  (pg_temp.id('t1'), 'ETc', '2026-02-02 13:30-03', 'informada', 'manual'),
  -- C: começa no ACe (20) e vai ao CAr (40); ciclo 60.
  (pg_temp.id('t1'), 'ACe', '2026-02-05 08:00-03', 'informada', 'manual'),
  (pg_temp.id('t1'), 'CAr', '2026-02-05 08:20-03', 'informada', 'manual'),
  (pg_temp.id('t1'), 'ETc', '2026-02-05 09:00-03', 'informada', 'manual'),
  -- D: não termina no ETc (vai ao pátio): não conta.
  (pg_temp.id('t1'), 'DOp', '2026-02-10 08:00-03', 'informada', 'manual'),
  (pg_temp.id('t1'), 'PÁT', '2026-02-10 10:00-03', 'informada', 'manual'),
  -- E: termina em 01/03 00:00: conta em março, não em fevereiro; ciclo 120.
  (pg_temp.id('t1'), 'DOp', '2026-02-28 22:00-03', 'informada', 'manual'),
  (pg_temp.id('t1'), 'ETc', '2026-03-01 00:00-03', 'informada', 'manual');

select tests.como(pg_temp.id('auth_Adm'));
create temp table r as select nucleo.analise_do_operacional('2026-02-01', null, null, 1, 20) as j;
create temp table so as select nucleo.analise_do_operacional('2026-02-01', null, 'fff1291', 1, 20) as j;
create temp table linhas as
  select l.ord, l.x from so, jsonb_array_elements(so.j->'tabela'->'linhas') with ordinality l(x, ord);

select is((select j->>'mes' from r), '2026-02-01', '3. o mês pedido volta no contrato');
select is(pg_temp.kpi((select j from r), 'passagens') - pg_temp.kpi((select j from antes), 'passagens'), 3::numeric,
  '4. três passagens a mais em fevereiro (Z é de janeiro no horário de São Paulo; A no limite de 01/02 entra; D não termina no ETc; E é de março)');
select is(pg_temp.kpi((select j from r), 'passagens'), (select (j->'tabela'->>'total')::numeric from r),
  '5. passagens concluídas = o total da tabela sem filtro');
select is((select (j->'tabela'->>'total')::int from so), 3, '6. a busca pela placa acha as três passagens');
select is((select x->'celulas'->>'ciclo' from linhas where ord = 1), '60',
  '7. a mais recente primeiro (C): ciclo de 60 minutos, do ACe ao ETc');
select is((select x->'celulas'->>'etapa' from linhas where ord = 1), 'CAr', '8. a etapa mais longa de C é o CAr');
select is((select x->'celulas'->>'ciclo' from linhas where ord = 2), '330', '9. B: ciclo de 330 minutos, do DOp ao ETc');
select is((select x->'celulas'->>'espera' from linhas where ord = 2), '150', '10. B: espera para carregar = DOp + ACe = 150');
select is((select string_agg(d->>'valor', ',' order by o) from linhas, jsonb_array_elements(x->'detalhes') with ordinality e(d, o)
            where ord = 2 and d->>'rotulo' like 'Tempo em %'), '60,90,150,30',
  '11. B: o tempo de cada etapa (DOp, ACe, CAr e CAn) vai do evento ao próximo');
select is((select x->'celulas'->>'ciclo' from linhas where ord = 3), '60', '12. A: termina às 00:00 de 01/02 e conta em fevereiro');
select is((select (nucleo.analise_do_operacional('2026-03-01', null, 'FFF1291', 1, 20)->'tabela'->'linhas'->0->'celulas'->>'ciclo')),
  '120', '13. E conta em março (o ETc em 01/03 00:00)');
select ok(pg_temp.kpi((select j from r), 'maior-espera') >= 150, '14. a maior espera do mês é pelo menos a de B');
select is((select sum((x->>'contagem')::int)::int from r, jsonb_array_elements(j->'chips') x where x->>'id' <> 'todos'),
  (select (x->>'contagem')::int from r, jsonb_array_elements(j->'chips') x where x->>'id' = 'todos'),
  '15. os chips das filiais somam o Todos');
select is((select jsonb_array_length(j->'graficos'->0->'categorias') from r), 4, '16. o gráfico das etapas tem DOp, ACe, CAr e CAn');
select is((select jsonb_array_length(g->'categorias') from r, jsonb_array_elements(j->'graficos') g where g->>'id' = 'evolucao'), 12,
  '17. a evolução mostra os 12 meses até o pedido');
select ok((select j->'meses' from r) ? '2026-02-01', '18. fevereiro está nos meses que se podem escolher');
select is(pg_temp.erro_de($$select nucleo.analise_do_operacional('2026-02-01', 'qualquer', null, 1, 20)$$), '22023',
  '19. filtro desconhecido é recusado');
reset role;

select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.analise_do_operacional('2026-02-01', null, null, 1, 20)$$), '42501',
  '20. sem Operacional › ver, a análise é recusada');
reset role;

select * from finish();
rollback;
