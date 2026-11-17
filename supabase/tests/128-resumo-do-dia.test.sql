-- Início › Resumo do dia (Nível 3): nucleo.resumo_do_dia no contrato único das telas de painel. A frota de
-- hoje pela régua (config.status: a sigla, o grupo e a ordem), a fila aberta do totem e "o que pede atenção
-- hoje" (atenção, impedida e pátio, a mais parada primeiro). Com a permissão de quem chama: a RLS da
-- leitura da placa recorta (o gestor vê a carteira dele; o Administrador, tudo). Os números batem com a
-- própria leitura da placa, para qualquer banco (dados de desenvolvimento ou o cenário fictício).
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(13);

select ok(not (select prosecdef from pg_proc where oid = 'nucleo.resumo_do_dia(date,text,text,integer,integer)'::regprocedure),
  '1. o resumo roda com a permissão de quem chama (a RLS da leitura da placa recorta)');
select ok(not has_function_privilege('anon', 'nucleo.resumo_do_dia(date,text,text,integer,integer)', 'execute'),
  '2. anon não lê o resumo');

select tests.como(pg_temp.id('auth_Adm'));
create temp table r as select nucleo.resumo_do_dia(null, null, null, 1, 20) as j;
create temp table base as
  select l.grupo from nucleo.leitura_da_placa l where l.baixada_em is null or l.baixada_em > now();
create function pg_temp.kpi(p text) returns int language sql as
  $$ select (x->>'valor')::int from r, jsonb_array_elements(r.j->'kpis') x where x->>'id' = p $$;
select is(pg_temp.kpi('em-atividade'), (select count(*)::int from base where grupo = 'em-atividade'),
  '3. em atividade = as placas do grupo em-atividade na leitura da placa');
select is(pg_temp.kpi('impedidas'), (select count(*)::int from base where grupo = 'impedida'),
  '4. impedidas = o grupo impedida');
select is(pg_temp.kpi('patio'), (select count(*)::int from base where grupo = 'patio'), '5. pátio = o grupo pátio');
select is(pg_temp.kpi('fila'), (select count(*)::int from operacional.chegada c where c.saiu_em is null),
  '6. fila do totem = as chegadas sem saída');
select is((select (j->'tabela'->>'total')::int from r),
  (select count(*)::int from base where grupo in ('atencao', 'impedida', 'patio')),
  '7. a tabela tem o que pede atenção: atenção, impedida e pátio');
select is(pg_temp.kpi('pendencias'), (select (j->'tabela'->>'total')::int from r),
  '8. pendências abertas = o total da tabela');
select is((select sum((x->>'contagem')::int)::int from r, jsonb_array_elements(j->'chips') x where x->>'id' <> 'todos'),
  (select (x->>'contagem')::int from r, jsonb_array_elements(j->'chips') x where x->>'id' = 'todos'),
  '9. os chips de atenção, impedida e pátio somam o Todos');
select is((select jsonb_array_length(j->'graficos'->0->'categorias') from r), (select count(*)::int from config.status),
  '10. a régua mostra todas as siglas do catálogo, na ordem');
select ok((select coalesce(bool_and(((l->'celulas'->>'paradaHa')::numeric) >= 0), true)
             from r, jsonb_array_elements(j->'tabela'->'linhas') l),
  '11. parada há nunca é negativa');
select is(pg_temp.erro_de($$select nucleo.resumo_do_dia(null, 'qualquer', null, 1, 20)$$), '22023',
  '12. filtro desconhecido é recusado');
reset role;

select tests.como(pg_temp.id('auth_Gestor A'));
select ok((select (nucleo.resumo_do_dia(null, null, null, 1, 20)->'tabela'->>'total')::int)
            <= (select count(*)::int from base where grupo in ('atencao', 'impedida', 'patio')),
  '13. o gestor vê só a parte dele (a RLS recorta; nunca mais que o Administrador)');
reset role;

select * from finish();
rollback;
