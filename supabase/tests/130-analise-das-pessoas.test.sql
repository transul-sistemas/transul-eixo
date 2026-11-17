-- Pessoas › Análise (Nível 3): nucleo.analise_das_pessoas no contrato único das telas de painel. Efetivo
-- médio = média, pelos dias do mês até hoje, das pessoas com vínculo vigente; ausência = FE ou AT na
-- escala; desligamento = vínculo que termina no mês sem outro que comece no mesmo dia; rotatividade =
-- desligamentos ÷ efetivo médio × 100. As pessoas fictícias (com "130" no nome) ficam em fev/2026; os
-- totais do mês são comparados antes e depois delas, para valer em qualquer banco.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(16);

select ok(not (select prosecdef from pg_proc where oid = 'nucleo.analise_das_pessoas(date,text,text,integer,integer)'::regprocedure),
  '1. a análise roda com a permissão de quem chama (a RLS do vínculo e da escala recorta)');
select ok(not has_function_privilege('anon', 'nucleo.analise_das_pessoas(date,text,text,integer,integer)', 'execute'),
  '2. anon não lê a análise');

create function pg_temp.kpi(p_j jsonb, p text) returns numeric language sql as
  $$ select (x->>'valor')::numeric from jsonb_array_elements(p_j->'kpis') x where x->>'id' = p $$;

select tests.como(pg_temp.id('auth_Adm'));
create temp table antes as select nucleo.analise_das_pessoas('2026-02-01', null, null, 1, 20) as j;
reset role;

insert into nucleo.pessoa (nome) values ('Ana 130'), ('Bia 130'), ('Caio 130');
insert into pessoas.vinculo (pessoa_id, operacao_id, funcao, inicio, fim) values
  ((select id from nucleo.pessoa where nome = 'Ana 130'), pg_temp.id('graos'), 'motorista', '2026-01-01', null),
  ((select id from nucleo.pessoa where nome = 'Bia 130'), pg_temp.id('graos'), 'ajudante', '2026-01-01', '2026-02-15'),
  ((select id from nucleo.pessoa where nome = 'Caio 130'), pg_temp.id('cimento'), 'motorista', '2026-02-15', null);
insert into pessoas.marcacao_da_escala (pessoa_id, operacao_id, dia, sigla)
  select (select id from nucleo.pessoa where nome = 'Ana 130'), pg_temp.id('graos'), d::date, s
    from (values ('2026-02-02', 'T'), ('2026-02-03', 'T'), ('2026-02-04', 'T'), ('2026-02-07', 'F'),
                 ('2026-02-09', 'FE'), ('2026-02-10', 'FE'), ('2026-02-11', 'AT')) v(d, s);
insert into pessoas.marcacao_da_escala (pessoa_id, operacao_id, dia, sigla) values
  ((select id from nucleo.pessoa where nome = 'Bia 130'), pg_temp.id('graos'), '2026-02-02', 'T');

select tests.como(pg_temp.id('auth_Adm'));
create temp table r as select nucleo.analise_das_pessoas('2026-02-01', null, null, 1, 20) as j;
create temp table so as select nucleo.analise_das_pessoas('2026-02-01', null, '130', 1, 20) as j;

select is((select j->>'mes' from r), '2026-02-01', '3. o mês pedido volta no contrato');
select is(pg_temp.kpi((select j from r), 'efetivo') - pg_temp.kpi((select j from antes), 'efetivo'), 2::numeric,
  '4. duas pessoas a mais por dia em fevereiro (Bia até 14/02, Caio desde 15/02, Ana o mês todo)');
select is(pg_temp.kpi((select j from r), 'ausencias') - pg_temp.kpi((select j from antes), 'ausencias'), 3::numeric,
  '5. três dias de ausência a mais (dois de férias e um de atestado; a folga não é ausência)');
select is((select (j->'tabela'->>'total')::int from so), 3, '6. a busca acha as três pessoas do mês');
select is((select j->'tabela'->'linhas'->0->>'item' from so), 'Ana 130', '7. a com mais ausências primeiro');
select is((select (j->'tabela'->'linhas'->0->'celulas') - 'pessoa'::text - 'operacao'::text from so),
  '{"funcao": "Motorista", "dias": 3, "folgas": 1, "ausencias": 3}'::jsonb, '8. Ana: 3 dias trabalhados, 1 folga, 3 ausências');
select is((select (nucleo.analise_das_pessoas('2026-02-01', 'ajudante', '130', 1, 20)->'tabela'->'linhas'->0->>'item')),
  'Bia 130', '9. o chip da função filtra (Bia é ajudante)');
select is((select sum((x->>'contagem')::int)::int from r, jsonb_array_elements(j->'chips') x where x->>'id' <> 'todos'),
  (select (x->>'contagem')::int from r, jsonb_array_elements(j->'chips') x where x->>'id' = 'todos'),
  '10. os chips das funções somam o Todos');
select is(pg_temp.kpi((select j from r), 'rotatividade'),
  (select round(
     (select count(distinct v.pessoa_id) from pessoas.vinculo v
       where v.excluido_em is null and v.fim >= '2026-02-01' and v.fim < '2026-03-01'
         and not exists (select 1 from pessoas.vinculo o where o.excluido_em is null and o.pessoa_id = v.pessoa_id and o.periodo @> v.fim))
     * 100.0 / avg((select count(*) from pessoas.vinculo v join nucleo.pessoa p on p.id = v.pessoa_id and p.excluido_em is null
                     where v.excluido_em is null and v.periodo @> d::date)), 1)
     from generate_series('2026-02-01'::date, '2026-02-28'::date, interval '1 day') d),
  '11. rotatividade = desligamentos do mês ÷ efetivo médio × 100 (Bia é desligada em 15/02)');
select ok(pg_temp.kpi((select j from r), 'rotatividade') > 0, '12. com Bia desligada, a rotatividade de fevereiro não é zero');
select ok((select coalesce(x->'valor', 'null'::jsonb) = 'null'::jsonb from r, jsonb_array_elements(j->'kpis') x where x->>'id' = 'custo'),
  '13. o custo por pessoa fica sem dados (depende da folha)');
select is((select jsonb_array_length(g->'categorias') from r, jsonb_array_elements(j->'graficos') g where g->>'id' = 'por-mes'), 12,
  '14. o gráfico por mês mostra os 12 meses até o pedido');
select is(pg_temp.erro_de($$select nucleo.analise_das_pessoas('2026-02-01', 'qualquer', null, 1, 20)$$), '22023',
  '15. filtro desconhecido é recusado');
reset role;

select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.analise_das_pessoas('2026-02-01', null, null, 1, 20)$$), '42501',
  '16. sem Pessoas › ver nem filial do Operacional, a análise é recusada');
reset role;

select * from finish();
rollback;
