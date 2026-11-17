-- Operações › Comparativo e Resultados › Por operação (uma leitura só) e Operações › Análise (variação).
--  * nucleo.resultado_por_operacao(p_mes): a cascata de cada operação no mês (nucleo.cascata_das_operacoes, a
--    mesma da lista e da ficha), com a receita em DUAS linhas (CT-e e NFS-e), resultado, margem e peso na receita;
--    os KPIs somados no banco; o custo por natureza e o total da Visão geral (nucleo.visao_geral_dos_resultados),
--    com a diferença "fora das operações" explícita: operações + fora = Visão geral.
--  * nucleo.variacao_das_operacoes(p_mes): o mês contra o anterior, por operação, com a cascata da variação
--    (receita, custo da frota, custo do serviço) e a maior alta e a maior queda.
--  Dinheiro só para Resultados › ver. Dados fictícios (apoio/operacoes_ficticias.psql).
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(14);

select tests.como(pg_temp.id('auth_Adm'));
select set_config('t.r', nucleo.resultado_por_operacao('2026-03-01')::text, true);
create function pg_temp.r() returns jsonb language sql as $$ select current_setting('t.r')::jsonb $$;
create function pg_temp.op(p_nome text) returns jsonb language sql as $$
  select o from jsonb_array_elements(pg_temp.r()->'operacoes') o where o->>'nome' = p_nome
$$;
select ok((pg_temp.r()->>'ve_resultado')::boolean, '1. quem vê Resultados recebe os números');
select is((pg_temp.r()->'kpis'->>'receita')::numeric, 6000.00, '2. receita das operações somada no banco');
select is((pg_temp.r()->'kpis'->>'receita_cte')::numeric, 3000.00, '3. receita em duas linhas: CT-e');
select is((pg_temp.r()->'kpis'->>'receita_nfse')::numeric, 3000.00, '4. e NFS-e');
select is((pg_temp.op('Grãos 94')->>'resultado')::numeric, 3000.00, '5. resultado da operação = receita − frota − serviço');
select is(pg_temp.r()->'operacoes'->0->>'nome', 'Cimento 94', '6. da maior para a menor margem');
select is((pg_temp.op('Grãos 94')->>'peso_na_receita')::numeric, 66.7, '7. peso na receita, com uma casa');
select is((pg_temp.r()->'kpis'->>'receita')::numeric + (pg_temp.r()->'fora_das_operacoes'->>'receita')::numeric,
  (pg_temp.r()->'visao_geral'->>'receita')::numeric, '8. operações + fora das operações = a Visão geral');

select set_config('t.v', nucleo.variacao_das_operacoes('2026-03-01')::text, true);
select is((current_setting('t.v')::jsonb->'kpis'->>'variacao')::numeric, 4770.00, '9. a variação do resultado contra o mês anterior');
select is(current_setting('t.v')::jsonb->'kpis'->'maior_alta'->>'nome', 'Grãos 94', '10. a maior alta');
select is(current_setting('t.v')::jsonb->'kpis'->'maior_queda', 'null'::jsonb, '11. sem queda, sem "maior queda" inventada');
select is((select (o->>'variacao_custo_servico')::numeric from jsonb_array_elements(current_setting('t.v')::jsonb->'operacoes') o
            where o->>'nome' = 'Grãos 94'), 530.00, '12. a cascata da variação (custo do serviço)');
reset role;

select tests.como(pg_temp.id('auth_Oper'));
select ok(not (nucleo.resultado_por_operacao('2026-03-01')->>'ve_resultado')::boolean
          and nucleo.resultado_por_operacao('2026-03-01')->'operacoes' is null, '13. sem Resultados › ver, nenhum número');
select ok(not (nucleo.variacao_das_operacoes('2026-03-01')->>'ve_resultado')::boolean, '14. nem a variação');
reset role;

select * from finish();
rollback;
