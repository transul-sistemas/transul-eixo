-- Paginação no banco das listas de Operações (nucleo.operacoes_do_mes) e de Parceiros
-- (nucleo.parceiros_do_mes). Só dados fictícios (apoio/operacoes_ficticias.psql e os de baixo), e cada
-- consulta filtra pela busca dos fictícios deste teste, para não depender do que mais houver no banco.
--  * p_pagina (padrão 1) e p_tam (padrão 20, teto 100); a resposta traz pagina, paginas, tam e total.
--  * Página além do fim devolve a última (como nucleo.listar_placas); página menor que 1 vira a 1.
--  * Ordem estável: o desempate final é a chave única (armadilha 1), sem repetir nem omitir linha
--    entre as páginas.
--  * Totais, chips e meses continuam sobre o conjunto filtrado inteiro, nunca só sobre a página.
--  * As permissões não mudam: quem recebia 42501 continua recebendo.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(46);

-- 105 operações fictícias: "Paginada 106 001" a "Paginada 106 105"; a cada cinco, uma é Parada (21),
-- as outras são Operação (84). Nenhuma tem placa (o campo "placas" empata em todas).
insert into nucleo.operacao (nome, tipo)
select format('Paginada 106 %s', lpad(n::text, 3, '0')), case when n % 5 = 0 then 'parada' else 'operacao' end
  from generate_series(1, 105) n;

-- 105 parceiros fictícios: "Parceiro Paginado 106 001" a "... 104" e mais um "... 020" (o mesmo nome
-- duas vezes, para o desempate pelo id cair bem na virada da página 1 para a 2). A cada três, um é
-- locador (35); os outros são agregados (70).
create temp table parceiros_106 (n integer, nome text, pessoa_id uuid, parceiro_id uuid);
insert into parceiros_106 (n, nome)
select n, format('Parceiro Paginado 106 %s', lpad(case when n = 105 then 20 else n end::text, 3, '0'))
  from generate_series(1, 105) n;
update parceiros_106 t set pessoa_id = p.id
  from (select x.n, gen_random_uuid() as id from parceiros_106 x) p where p.n = t.n;
insert into nucleo.pessoa (id, nome) select pessoa_id, nome from parceiros_106;
update parceiros_106 t set parceiro_id = gen_random_uuid();
insert into parceiros.parceiro (id, pessoa_id, tipos)
select parceiro_id, pessoa_id, case when n % 3 = 0 then array['locador'] else array['agregado'] end
  from parceiros_106;
grant select on parceiros_106 to authenticated;

-- Os nomes de uma página, em ordem.
create function pg_temp.nomes(p_resultado jsonb) returns text[] language sql as $$
  select coalesce(array_agg(l->>'nome' order by i), '{}') from jsonb_array_elements(p_resultado->'linhas') with ordinality x (l, i)
$$;
create function pg_temp.ids(p_resultado jsonb) returns text[] language sql as $$
  select coalesce(array_agg(l->>'id' order by i), '{}') from jsonb_array_elements(p_resultado->'linhas') with ordinality x (l, i)
$$;
grant execute on function pg_temp.nomes(jsonb), pg_temp.ids(jsonb) to authenticated;

-- ---- Estrutura e privilégios ----
select has_function('nucleo', 'operacoes_do_mes', array['date', 'text', 'text[]', 'text', 'integer', 'integer'],
  'existe nucleo.operacoes_do_mes(mês, busca, chips, ordem, página, tamanho)');
select hasnt_function('nucleo', 'operacoes_do_mes', array['date', 'text', 'text[]', 'text'],
  'a assinatura antiga saiu (sem duas versões da mesma lista)');
select has_function('nucleo', 'parceiros_do_mes', array['date', 'text', 'text[]', 'integer', 'integer'],
  'existe nucleo.parceiros_do_mes(mês, busca, chips, página, tamanho)');
select hasnt_function('nucleo', 'parceiros_do_mes', array['date', 'text', 'text[]'],
  'a assinatura antiga de parceiros saiu');
select ok(not (select prosecdef from pg_proc where oid = 'nucleo.operacoes_do_mes(date,text,text[],text,integer,integer)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'nucleo.parceiros_do_mes(date,text,text[],integer,integer)'::regprocedure),
  'as duas listas continuam com a permissão de quem chama (security invoker)');
select ok(not has_function_privilege('anon', 'nucleo.operacoes_do_mes(date,text,text[],text,integer,integer)', 'execute')
  and not has_function_privilege('anon', 'nucleo.parceiros_do_mes(date,text,text[],integer,integer)', 'execute'),
  'anon não executa as listas');
select ok(has_function_privilege('authenticated', 'nucleo.operacoes_do_mes(date,text,text[],text,integer,integer)', 'execute')
  and has_function_privilege('authenticated', 'nucleo.parceiros_do_mes(date,text,text[],integer,integer)', 'execute'),
  'authenticated executa as listas (a permissão é conferida dentro)');
select is((select count(*)::int from config.funcao_executavel where assinatura in (
    'nucleo.operacoes_do_mes(date,text,text[],text,integer,integer)', 'nucleo.parceiros_do_mes(date,text,text[],integer,integer)')),
  2, 'as assinaturas novas estão na relação de funções que o app executa');
select is((select count(*)::int from config.funcao_executavel where assinatura in (
    'nucleo.operacoes_do_mes(date,text,text[],text)', 'nucleo.parceiros_do_mes(date,text,text[])')),
  0, 'as assinaturas antigas saíram da relação');

-- ---- Operações (Administrador) ----
select tests.como(pg_temp.id('auth_Adm'));
create temp table op as
  select p, nucleo.operacoes_do_mes('2026-03-01', 'Paginada 106', null, 'nome', p, 20) as j from generate_series(1, 6) p;
select is((select (j->>'total')::int from op where p = 1), 105, 'o total conta as 105 da busca');
select is((select (j->>'paginas')::int from op where p = 1), 6, 'com 20 por página, são 6 páginas');
select is((select (j->>'tam')::int from op where p = 1), 20, 'o tamanho volta na resposta');
select is((select (j->>'pagina')::int from op where p = 2), 2, 'a página pedida volta na resposta');
select is((select jsonb_array_length(j->'linhas') from op where p = 1), 20, 'a página 1 traz 20 linhas');
select is((select pg_temp.nomes(j) from op where p = 1)[1:2], array['Paginada 106 001', 'Paginada 106 002'],
  'a página 1 começa pela primeira em ordem de nome');
select is((select pg_temp.nomes(j) from op where p = 2)[1], 'Paginada 106 021', 'a página 2 começa logo depois da 1');
select is((select count(*)::int from op, unnest(pg_temp.ids(j)) i), 105, 'as seis páginas somam as 105 linhas');
select is((select count(distinct i)::int from op, unnest(pg_temp.ids(j)) i), 105, 'sem repetir nem omitir linha');
select is((select jsonb_array_length(j->'linhas') from op where p = 6), 5, 'a última página traz as 5 que sobram');
select is((select (j->'totais'->>'operacoes')::int from op where p = 2), 105, 'os totais são do filtro inteiro, não da página');
select is((select (j->'chips'->>'operacao')::int from op where p = 2), 84, 'os chips contam o filtro inteiro');
select ok((select jsonb_array_length(j->'meses') > 0 and j->>'mes' = '2026-03-01' from op where p = 2), 'mês e meses continuam na resposta');
drop table op;

-- Desempate: pelas placas (todas zero) a ordem cai no nome e no id, igual em todas as páginas.
create temp table op as
  select p, nucleo.operacoes_do_mes('2026-03-01', 'Paginada 106', null, '-placas', p, 20) as j from generate_series(1, 6) p;
select is((select array_agg(n order by p, k) from op, unnest(pg_temp.nomes(j)) with ordinality x (n, k)),
  (select array_agg(format('Paginada 106 %s', lpad(n::text, 3, '0')) order by n) from generate_series(1, 105) n),
  'com o campo empatado, as páginas seguem nome e id, sem pular nem repetir');
drop table op;

select is((select jsonb_array_length(nucleo.operacoes_do_mes('2026-03-01', 'Paginada 106', null, 'nome', 1, 500)->'linhas')), 100,
  'o tamanho tem teto de 100');
select is((select (nucleo.operacoes_do_mes('2026-03-01', 'Paginada 106', null, 'nome', 1, 500)->>'tam')::int), 100,
  'o teto volta como o tamanho usado');
select is((select nucleo.operacoes_do_mes('2026-03-01', 'Paginada 106', null, 'nome', 99, 20)->>'pagina'), '6',
  'página além do fim devolve a última');
select is((select pg_temp.nomes(nucleo.operacoes_do_mes('2026-03-01', 'Paginada 106', null, 'nome', 99, 20))),
  array['Paginada 106 101', 'Paginada 106 102', 'Paginada 106 103', 'Paginada 106 104', 'Paginada 106 105'],
  'e com as linhas da última');
select is((select nucleo.operacoes_do_mes('2026-03-01', 'Paginada 106', null, 'nome', 0, 20)->>'pagina'), '1',
  'página menor que 1 vira a primeira');
create temp table op as select nucleo.operacoes_do_mes('2026-03-01', 'Paginada 106', array['parada'], 'nome', 2, 20) as j;
select is((select (j->>'total')::int from op), 21, 'o total respeita o chip (21 paradas)');
select is((select (j->>'paginas')::int from op), 2, 'e as páginas também');
select is((select pg_temp.nomes(j) from op), array['Paginada 106 105'], 'a página 2 das paradas traz a 21.ª');
select is((select (j->'chips'->>'operacao')::int from op), 84, 'o chip do outro tipo conta ignorando a própria seleção');
drop table op;
select is((select (nucleo.operacoes_do_mes('2026-03-01', 'Paginada 106 10', null, 'nome')->>'total')::int), 6,
  'o total respeita a busca (100 a 105)');
create temp table op as select nucleo.operacoes_do_mes('2026-03-01', 'Paginada 106', null, 'nome') as j;
select is((select jsonb_array_length(j->'linhas') from op), 20, 'sem os parâmetros novos, a chamada antiga traz no máximo 20');
select is((select (j->>'pagina')::int || '/' || (j->>'tam') from op), '1/20', 'na página 1, com 20 por página');
drop table op;
select ok((select jsonb_array_length(nucleo.operacoes_do_mes()->'linhas') <= 20), 'a chamada sem nenhum argumento também');

-- ---- Parceiros (Administrador) ----
create temp table pa as
  select p, nucleo.parceiros_do_mes('2026-03-01', 'Parceiro Paginado 106', null, p, 20) as j from generate_series(1, 6) p;
select is((select (j->>'total')::int || '/' || (j->>'paginas') || '/' || (j->>'tam') from pa where p = 1), '105/6/20',
  'parceiros: total, páginas e tamanho');
select is((select count(distinct i)::int from pa, unnest(pg_temp.ids(j)) i), 105, 'parceiros: as páginas cobrem os 105, sem repetir');
select is(
  array[(select pg_temp.ids(j) from pa where p = 1)[20], (select pg_temp.ids(j) from pa where p = 2)[1]],
  (select array_agg(parceiro_id::text order by parceiro_id) from parceiros_106 where nome = 'Parceiro Paginado 106 020'),
  'parceiros: o mesmo nome desempata pelo id, na virada da página 1 para a 2');
select is((select (j->'totais'->>'parceiros')::int from pa where p = 3), 105, 'parceiros: os totais são do filtro inteiro');
select is((select (j->'chips'->>'locador')::int from pa where p = 3), 35, 'parceiros: os chips contam o filtro inteiro');
drop table pa;
select is((select (nucleo.parceiros_do_mes('2026-03-01', 'Parceiro Paginado 106', array['locador'], 99, 20)->>'pagina')::int), 2,
  'parceiros: página além do fim devolve a última (35 locadores, 2 páginas)');
select is((select jsonb_array_length(nucleo.parceiros_do_mes('2026-03-01', 'Parceiro Paginado 106', null, 1, 500)->'linhas')), 100,
  'parceiros: o tamanho tem teto de 100');
select is((select jsonb_array_length(nucleo.parceiros_do_mes('2026-03-01', 'Parceiro Paginado 106', null)->'linhas')), 20,
  'parceiros: a chamada antiga traz no máximo 20');

-- ---- As permissões de antes ----
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.erro_de($$select nucleo.operacoes_do_mes('2026-03-01', null, null, 'nome', 2, 20)$$), '42501',
  'o Operacional (sem Operações) continua sem a lista, com ou sem página');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.parceiros_do_mes('2026-03-01', null, null, 1, 20)$$), '42501',
  'o gestor de frota (sem Parceiros nem Resultados) continua sem a lista de parceiros');

reset role;
select * from finish();
rollback;
