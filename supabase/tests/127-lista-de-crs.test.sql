-- Cadastros › CRs (Nível 3): nucleo.lista_de_crs no contrato único das telas de painel. Os CRs analíticos
-- (o agrupador, CR pai, fica de fora), com a placa vigente e a operação vigente de cada um, chips por
-- situação, busca e página; a linha leva à Ficha do CR (nucleo.historia_do_cr, do N1). Cadastros › ver.
-- Cenário fictício (apoio/operacoes_ficticias.psql): K94A com a placa FFF9A01 na Grãos 94; K94B sem placa;
-- K94C ligado à Cimento 94 desde 01/03/2026.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(14);

select ok(not (select prosecdef from pg_proc where oid = 'nucleo.lista_de_crs(date,text,text,integer,integer)'::regprocedure),
  '1. a lista roda com a permissão de quem chama');
select ok(not has_function_privilege('anon', 'nucleo.lista_de_crs(date,text,text,integer,integer)', 'execute'),
  '2. anon não lê a lista de CRs');

select tests.como(pg_temp.id('auth_Adm'));
create temp table k94 as select nucleo.lista_de_crs(null, null, 'K94', 1, 20) as j;
create temp table linha as select x from k94, jsonb_array_elements(j->'tabela'->'linhas') x;
select is((select (j->'tabela'->>'total')::int from k94), 3, '3. a busca acha os três CRs K94');
select is((select x->'celulas'->>'placa' from linha where x->'celulas'->>'cr' = 'K94A'), 'FFF9A01',
  '4. K94A mostra a placa vigente');
select is((select x->'celulas'->>'operacao' from linha where x->'celulas'->>'cr' = 'K94A'), 'Grãos 94',
  '5. K94A mostra a operação vigente');
select ok((select x->'celulas'->'placa' = 'null'::jsonb from linha where x->'celulas'->>'cr' = 'K94B'),
  '6. K94B sem placa vigente: vazio, nada inventado');
select is((select x->'celulas'->>'operacao' from linha where x->'celulas'->>'cr' = 'K94C'), 'Cimento 94',
  '7. K94C mostra a operação do vínculo vigente (não a do cadastro)');
select is((select x->>'href' from linha where x->'celulas'->>'cr' = 'K94A'),
  '/cadastros/crs/' || (select id from nucleo.cr where codcencus = 9401),
  '8. a linha leva à Ficha do CR');
select is((select (nucleo.lista_de_crs(null, 'sem_placa', 'K94', 1, 20)->'tabela'->>'total')::int), 2,
  '9. o chip "Sem placa" filtra (K94B e K94C)');
select is((select (nucleo.lista_de_crs(null, 'com_placa', 'K94', 1, 20)->'tabela'->>'total')::int), 1,
  '10. o chip "Com placa" filtra (K94A)');
select is((select (x->>'contagem')::int from k94, jsonb_array_elements(j->'chips') x where x->>'id' = 'todos'),
  (select count(*)::int from nucleo.cr where excluido_em is null and coalesce(analitico, true)),
  '11. o chip Todos conta os CRs analíticos não excluídos (o agrupador fica fora)');
select is((select jsonb_array_length(nucleo.lista_de_crs(null, null, 'K94', 2, 2)->'tabela'->'linhas')), 1,
  '12. a página 2 de 2 em 2 tem o que sobra');
select is(pg_temp.erro_de($$select nucleo.lista_de_crs(null, 'qualquer', null, 1, 20)$$), '22023',
  '13. filtro desconhecido é recusado');
reset role;

select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.lista_de_crs(null, null, null, 1, 20)$$), '42501',
  '14. o gestor de frota (sem Cadastros › ver) não lê a lista');
reset role;

select * from finish();
rollback;
