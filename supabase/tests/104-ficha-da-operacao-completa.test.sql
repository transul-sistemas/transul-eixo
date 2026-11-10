-- Operações › ficha completa (10/11/2026): nucleo.mes_fechado_mais_recente, nucleo.resultado_da_operacao
-- e nucleo.contexto_da_operacao. Só dados fictícios (apoio/operacoes_ficticias.psql; março de 2026:
-- Grãos 94 tem receita 4.000,00, custo da Frota 400,00, de Serviço 600,00 e margem 3.000,00; fevereiro
-- tem 70,00 de custo de Serviço).
--  * O mês fechado muda no dia seguinte ao corte (limites 10 e 11, e a virada do ano).
--  * O resultado do período traz o período, o anterior, a evolução de 12 meses, a curva dia a dia
--    (só em um mês) e o custo por natureza, pelas mesmas definições da cascata.
--  * Permissão: sem Operações › ver, 42501; fora do escopo, nulo; sem Resultados › ver, sem número.
--  * O contexto traz pessoas, linha do tempo, mapa e árvore; nome de pessoa só com Pessoas › ver.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(44);

-- ---- Estrutura ----
select has_function('nucleo', 'mes_fechado_mais_recente', array['date'], 'existe nucleo.mes_fechado_mais_recente');
select has_function('nucleo', 'resultado_da_operacao', array['uuid', 'date', 'date'], 'existe nucleo.resultado_da_operacao');
select has_function('nucleo', 'contexto_da_operacao', array['uuid', 'date'], 'existe nucleo.contexto_da_operacao');
select ok(not (select bool_or(prosecdef) from pg_proc
                where oid in ('nucleo.mes_fechado_mais_recente(date)'::regprocedure,
                              'nucleo.resultado_da_operacao(uuid,date,date)'::regprocedure,
                              'nucleo.contexto_da_operacao(uuid,date)'::regprocedure)),
  'as três leem com a permissão de quem chama (security invoker)');
select ok(not has_function_privilege('anon', 'nucleo.resultado_da_operacao(uuid,date,date)', 'execute'), 'anon não executa o resultado');
select ok(not has_function_privilege('anon', 'nucleo.contexto_da_operacao(uuid,date)', 'execute'), 'anon não executa o contexto');

-- Pessoas vinculadas à operação (como o dono do banco; a escala entra pela marcação).
insert into pessoas.vinculo (pessoa_id, operacao_id, funcao, inicio)
  values (pg_temp.id('Dir'), pg_temp.id('graos'), 'motorista', '2026-01-01');
insert into pessoas.marcacao_da_escala (pessoa_id, operacao_id, dia, sigla)
  values (pg_temp.id('Dir'), pg_temp.id('graos'), '2026-03-02', 'T'), (pg_temp.id('Dir'), pg_temp.id('graos'), '2026-03-03', 'T');

-- ---- O mês fechado (limites do corte no dia 10) ----
select tests.como(pg_temp.id('auth_Adm'));
select is(nucleo.mes_fechado_mais_recente('2026-11-10'), '2026-09-01'::date, 'no dia do corte (10), o mês passado ainda não fechou');
select is(nucleo.mes_fechado_mais_recente('2026-11-11'), '2026-10-01'::date, 'no dia seguinte ao corte, o mês passado fechou');
select is(nucleo.mes_fechado_mais_recente('2026-01-10'), '2025-11-01'::date, 'a virada do ano no dia do corte');
select is(nucleo.mes_fechado_mais_recente('2026-01-11'), '2025-12-01'::date, 'a virada do ano depois do corte');
select is(nucleo.mes_fechado_mais_recente(), nucleo.mes_fechado_mais_recente(nucleo.hoje_em_sao_paulo()), 'sem data, usa hoje (São Paulo)');

-- ---- O resultado de um mês ----
create temp table r as select nucleo.resultado_da_operacao(pg_temp.id('graos'), '2026-03-01', '2026-04-01') as j;
select is((select (j->'atual'->>'receita')::numeric from r), 4000.00, 'mês: receita');
select is((select (j->'atual'->>'custo_frota')::numeric from r), 400.00, 'mês: custo da Frota');
select is((select (j->'atual'->>'custo_servico')::numeric from r), 600.00, 'mês: custo de Serviço');
select is((select (j->'atual'->>'margem')::numeric from r), 3000.00, 'mês: margem, igual à da cascata da ficha');
select is((select (j->'atual'->>'margem_percentual')::numeric from r), 75.0, 'mês: margem percentual');
select is((select (j->'atual'->>'placas')::int from r), 1, 'mês: placas do período');
select is((select (j->'atual'->>'receita_por_placa')::numeric from r), 4000.00, 'mês: receita por placa');
select is((select (j->'anterior'->>'custo_servico')::numeric from r), 70.00, 'o período anterior é fevereiro (custo de Serviço de 70,00)');
select is((select (j->'anterior'->>'receita')::numeric from r), 0::numeric, 'fevereiro não tem receita');
select is((select jsonb_array_length(j->'serie') from r), 12, 'a evolução tem 12 meses');
select is((select j->'serie'->11->>'mes' from r), '2026-03-01', 'e termina no último mês do período');
select is((select jsonb_array_length(j->'dias') from r), 31, 'a curva tem um ponto por dia do mês');
select is((select (j->'dias'->4->>'receita')::numeric from r), 1000.00, 'a receita cai no dia da negociação (dia 5)');
select is((select (j->'dias'->9->>'custo')::numeric from r), 400.00, 'a despesa cai no dia da competência (dia 10)');
select is((select j->'frota_por_natureza'->0->>'natureza' from r), 'Combustível 94', 'custo da Frota por natureza');
select is((select (j->'servico_por_natureza'->0->>'valor')::numeric from r), 600.00, 'custo de Serviço por natureza');
drop table r;

-- ---- O acumulado de dois meses ----
create temp table a as select nucleo.resultado_da_operacao(pg_temp.id('graos'), '2026-02-01', '2026-04-01') as j;
select is((select (j->'atual'->>'custo_servico')::numeric from a), 670.00, 'acumulado: fevereiro e março somados');
select is((select jsonb_array_length(j->'dias') from a), 0, 'acumulado: sem curva dia a dia');
select is((select jsonb_array_length(j->'meses_do_periodo') from a), 2, 'acumulado: os dois meses, um a um');
drop table a;
select is(pg_temp.erro_de(format('select nucleo.resultado_da_operacao(%L, %L, %L)', pg_temp.id('graos'), '2026-04-01', '2026-03-01')),
  '22023', 'período invertido é recusado');
select is(nucleo.resultado_da_operacao('00000000-0000-0000-0000-000000000000', '2026-03-01', '2026-04-01'), null, 'operação inexistente volta nula');

-- ---- O contexto ----
create temp table c as select nucleo.contexto_da_operacao(pg_temp.id('graos'), '2026-03-01') as j;
select is((select j->'pessoas'->0->>'funcao' from c), 'motorista', 'contexto: a função da pessoa vinculada');
select is((select (j->'pessoas'->0->'escala'->>'T')::int from c), 2, 'contexto: a escala do mês por sigla');
select ok((select j->'pessoas'->0->'nomes' <> 'null'::jsonb from c), 'contexto: quem tem Pessoas › ver recebe os nomes');
select ok((select j->'linha_do_tempo' @> '[{"tipo": "placa_entrou", "objeto": "FFF9A01"}]'::jsonb from c), 'contexto: a linha do tempo traz a entrada da placa');
select is((select j->'mapa'->'base'->>'cidade' from c), 'Cordeirópolis', 'contexto: a base da operação');
select is((select jsonb_path_query_array(j, '$.arvore.crs[*].codigo') from c), '["K94A", "K94B"]'::jsonb, 'contexto: a árvore traz o CR da placa e o de serviço da operação');
drop table c;

-- ---- Operacional: sem Operações ----
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.erro_de(format('select nucleo.resultado_da_operacao(%L, %L, %L)', pg_temp.id('graos'), '2026-03-01', '2026-04-01')),
  '42501', 'o Operacional (sem Operações) não lê o resultado');
select is(pg_temp.erro_de(format('select nucleo.contexto_da_operacao(%L, %L)', pg_temp.id('graos'), '2026-03-01')),
  '42501', 'o Operacional (sem Operações) não lê o contexto');

-- ---- Gestor de frota com Operações por carteira: sem número, sem nome ----
reset role;
select pg_temp.dar_operacoes_ao_gestor();
select tests.como(pg_temp.id('auth_Gestor A'));
select is(nucleo.resultado_da_operacao(pg_temp.id('graos'), '2026-03-01', '2026-04-01')->>'ve_resultado', 'false', 'o gestor abre a da carteira, sem o resultado em R$');
select is(nucleo.resultado_da_operacao(pg_temp.id('cimento'), '2026-03-01', '2026-04-01'), null, 'o gestor não abre operação fora da carteira');
select is(nucleo.contexto_da_operacao(pg_temp.id('cimento'), '2026-03-01'), null, 'nem o contexto de fora da carteira');
select is(nucleo.contexto_da_operacao(pg_temp.id('graos'), '2026-03-01')->>'ve_pessoas', 'false', 'o gestor (sem Pessoas) não recebe nome de pessoa');

reset role;
select * from finish();
rollback;
