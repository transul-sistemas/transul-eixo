-- Administração › Auditoria (Nível 3): nucleo.eventos_de_auditoria no contrato único das telas de painel.
-- Quem mudou o quê, quando e por quê, lido de auditoria.evento pela política auditoria_evento_ler
-- (Administração › ver: Administrador e Diretoria). Eventos fictícios num mês isolado (01/2020), para as
-- contagens serem exatas: 3 inclusões, 2 edições e 1 exclusão, de duas pessoas e da carga (sem pessoa).
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(22);

insert into auditoria.evento (tabela, operacao, registro_id, antes, depois, usuario_id, em, motivo) values
  ('nucleo.ativo', 'INSERT', 'a1', null, '{"tipo": "cavalo"}', pg_temp.id('auth_Adm'), '2020-01-03 10:00-03', null),
  ('nucleo.ativo', 'UPDATE', 'a1', '{"tipo": "cavalo", "ano": 2019}', '{"tipo": "cavalo", "ano": 2020}', pg_temp.id('auth_Adm'), '2020-01-03 11:00-03', 'Ano corrigido'),
  ('pessoas.vinculo', 'INSERT', 'v1', null, '{}', pg_temp.id('auth_Dir'), '2020-01-04 09:00-03', null),
  ('parceiros.parceiro', 'INSERT', 'p1', null, '{}', null, '2020-01-05 08:00-03', null),
  ('nucleo.operacao', 'UPDATE', 'o1', '{"nome": "A"}', '{"nome": "B"}', pg_temp.id('auth_Dir'), '2020-01-05 15:00-03', null),
  ('config.modelo', 'DELETE', 'm1', '{}', null, pg_temp.id('auth_Adm'), '2020-01-31 23:30-03', null),
  ('nucleo.ativo', 'INSERT', 'a2', null, '{}', pg_temp.id('auth_Adm'), '2020-02-01 00:00-03', null);

-- ---- Estrutura ----
select ok(not (select prosecdef from pg_proc where oid = 'nucleo.eventos_de_auditoria(date,text,text,integer,integer)'::regprocedure),
  '1. a leitura roda com a permissão de quem chama (a política auditoria_evento_ler decide)');
select ok(not has_function_privilege('anon', 'nucleo.eventos_de_auditoria(date,text,text,integer,integer)', 'execute'),
  '2. anon não lê a auditoria');
select is(nucleo.modulo_da_tabela('nucleo.ativo'), 'Frota', '3. nucleo.ativo é da Frota');
select is(nucleo.modulo_da_tabela('nucleo.operacao'), 'Operações', '4. nucleo.operacao é de Operações');
select is(nucleo.modulo_da_tabela('pessoas.vinculo'), 'Pessoas', '5. o esquema pessoas é de Pessoas');
select is(nucleo.modulo_da_tabela('config.modelo'), 'Cadastros', '6. o esquema config é de Cadastros');

-- ---- Administrador ----
select tests.como(pg_temp.id('auth_Adm'));
create temp table jan as select nucleo.eventos_de_auditoria('2020-01-01', null, null, 1, 20) as j;
select is((select (x->>'valor')::int from jan, jsonb_array_elements(j->'kpis') x where x->>'id' = 'eventos'), 6,
  '7. seis eventos em 01/2020 (o de 01/02 às 00:00 de São Paulo, o limite, fica fora: [início, fim))');
select is((select (x->>'valor')::int from jan, jsonb_array_elements(j->'kpis') x where x->>'id' = 'pessoas'), 2,
  '8. duas pessoas ativas (a carga sem pessoa não conta)');
select is((select (x->>'valor')::int from jan, jsonb_array_elements(j->'kpis') x where x->>'id' = 'alteracoes'), 2,
  '9. duas edições');
select ok((select x->'valor' = 'null'::jsonb from jan, jsonb_array_elements(j->'kpis') x where x->>'id' = 'recusas'),
  '10. acessos recusados ficam sem número (sem fonte ainda), nunca zero inventado');
select is((select jsonb_object_agg(x->>'id', (x->>'contagem')::int) from jan, jsonb_array_elements(j->'chips') x),
  '{"todos": 6, "inclusao": 3, "edicao": 2, "exclusao": 1}'::jsonb, '11. chips com a contagem de cada ação');
select is((select (j->'tabela'->>'total')::int from jan), 6, '12. a tabela tem o total do filtro');
select is((select j->'tabela'->'linhas'->0->'celulas'->>'acao' from jan), 'exclusão',
  '13. o mais recente primeiro (a exclusão de 31/01)');
select is((select j->'tabela'->'linhas'->2->'celulas'->>'pessoa' from jan), 'Sistema (carga ou rotina)',
  '14. evento sem pessoa aparece como Sistema');
select is((select count(*)::int from jan, jsonb_array_elements(j->'tabela'->'linhas') l
            where l->'celulas'->>'acao' = 'edição' and l->'detalhes' @> '[{"rotulo": "Campos alterados"}]'::jsonb), 2,
  '15. a edição diz os campos alterados (só os nomes)');
select is((select x->'valor' from jan, jsonb_array_elements(j->'tabela'->'linhas') l, jsonb_array_elements(l->'detalhes') x
            where l->'celulas'->>'registro' like '%a1' and l->'celulas'->>'acao' = 'edição' and x->>'rotulo' = 'Campos alterados'),
  '"ano"'::jsonb, '16. só o campo que mudou (ano), não o que ficou igual');
select is((select (nucleo.eventos_de_auditoria('2020-01-01', 'edicao', null, 1, 20)->'tabela'->>'total')::int), 2,
  '17. o chip filtra a tabela (só edições)');
select is((select (nucleo.eventos_de_auditoria('2020-01-01', null, 'operacao', 1, 20)->'tabela'->>'total')::int), 1,
  '18. a busca acha pela tabela');
select is((select (nucleo.eventos_de_auditoria('2020-01-01', null, null, 2, 4)->'tabela'->>'pagina')::int), 2,
  '19. a página 2 de 4 em 4');
select is((select jsonb_array_length(nucleo.eventos_de_auditoria('2020-01-01', null, null, 2, 4)->'tabela'->'linhas')), 2,
  '20. a página 2 tem as duas que sobram');
reset role;

-- ---- Sem Administração › ver ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.eventos_de_auditoria('2020-01-01', null, null, 1, 20)$$), '42501',
  '21. o gestor de frota não lê a auditoria');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.erro_de($$select nucleo.eventos_de_auditoria('2020-01-01', null, null, 1, 20)$$), '42501',
  '22. o Operacional não lê a auditoria');
reset role;

select * from finish();
rollback;
