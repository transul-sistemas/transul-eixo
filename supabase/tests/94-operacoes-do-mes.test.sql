-- Operações › lista (nucleo.operacoes_do_mes). Só dados fictícios (apoio/operacoes_ficticias.psql).
--  * A cascata do mês por operação, pronta no banco: receita (CT-e/NFS-e autorizados e presentes no
--    Sankhya, pela data de negociação), custo da Frota (despesas dos CRs de frota) e custo de Serviço
--    (despesas dos demais CRs), pela competência gerencial, sem provisão nem despesa invalidada; margem
--    e margem percentual. Intervalo do mês [início, fim).
--  * O CR entra na operação pela montagem do Eixo (CR de serviço na operação, vigente no mês); sem
--    montagem, pelo rótulo do Sankhya (nucleo.cr.operacao_id).
--  * Permissão: quem não tem Operações não lê (42501); o resultado em R$ só para quem tem Resultados;
--    o gestor de frota com Operações por carteira vê só as operações das placas que ele vê.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(31);

-- Uma operação da lista, pelo nome.
create function pg_temp.linha(p_resultado jsonb, p_nome text) returns jsonb language sql as $$
  select l from jsonb_array_elements(p_resultado->'linhas') l where l->>'nome' = p_nome
$$;

-- ---- Estrutura e privilégios ----
select has_function('nucleo', 'operacoes_do_mes', array['date', 'text', 'text[]', 'text', 'integer', 'integer'],
  'existe nucleo.operacoes_do_mes(mês, busca, chips, ordem, página, tamanho)');
select ok(not (select prosecdef from pg_proc where oid = 'nucleo.operacoes_do_mes(date,text,text[],text,integer,integer)'::regprocedure),
  'a lista roda com a permissão de quem chama (security invoker)');
select ok(not has_function_privilege('anon', 'nucleo.operacoes_do_mes(date,text,text[],text,integer,integer)', 'execute'),
  'anon não executa a lista');
select ok(exists (select 1 from config.funcao_executavel where assinatura = 'nucleo.operacoes_do_mes(date,text,text[],text,integer,integer)'),
  'a lista está na relação de funções que o app executa, com a justificativa');

-- ---- Administrador ----
select tests.como(pg_temp.id('auth_Adm'));
create temp table r as select nucleo.operacoes_do_mes('2026-03-01', '94', null, 'nome') as j;
select is((select j->>'mes' from r), '2026-03-01', 'o mês pedido volta como o primeiro dia');
select is((select jsonb_array_length(j->'linhas') from r), 2, 'a busca acha as duas operações fictícias');
select is((select (j->>'ve_resultado')::boolean from r), true, 'o Administrador vê o resultado em R$');
select is((select (pg_temp.linha(j, 'Grãos 94')->>'receita')::numeric from r), 4000.00,
  'Grãos: receita = CT-e autorizado + NFS-e sem status; fora o de 01/04, o que sumiu e o de status R');
select is((select (pg_temp.linha(j, 'Grãos 94')->>'custo_frota')::numeric from r), 400.00,
  'Grãos: custo da Frota sem a provisão');
select is((select (pg_temp.linha(j, 'Grãos 94')->>'custo_servico')::numeric from r), 600.00,
  'Grãos: custo de Serviço sem a invalidada nem a de fevereiro, e sem o CR montado em outra operação');
select is((select (pg_temp.linha(j, 'Grãos 94')->>'margem')::numeric from r), 3000.00, 'Grãos: margem = receita − frota − serviço');
select is((select (pg_temp.linha(j, 'Grãos 94')->>'margem_percentual')::numeric from r), 75.0, 'Grãos: margem de 75,0 %');
select is((select (pg_temp.linha(j, 'Cimento 94')->>'receita')::numeric from r), 2000.00,
  'Cimento: a montagem do CR de serviço vence o rótulo do Sankhya');
select is((select (pg_temp.linha(j, 'Cimento 94')->>'custo_frota')::numeric from r), 0.00, 'Cimento: sem custo de Frota (zero, não vazio)');
select is((select (pg_temp.linha(j, 'Cimento 94')->>'margem')::numeric from r), 1700.00, 'Cimento: margem 1.700,00');
select is((select (pg_temp.linha(j, 'Grãos 94')->>'crs')::int from r), 2, 'Grãos: dois CRs no mês (o terceiro foi montado em Cimento)');
select is((select (pg_temp.linha(j, 'Grãos 94')->>'placas')::int from r), 1, 'Grãos: uma placa vinculada agora');
select is((select pg_temp.linha(j, 'Grãos 94')->>'filial' from r), 'Cordeirópolis', 'a filial é a garagem da base da operação');
select is((select (j->'totais'->>'receita')::numeric from r), 6000.00, 'o total da receita vem pronto do banco');
select is((select (j->'totais'->>'margem')::numeric from r), 4700.00, 'o total da margem vem pronto do banco');
select is((select (j->'chips'->>'operacao')::int from r), 2, 'o chip Operação conta as duas');
drop table r;

select is((select jsonb_array_length(nucleo.operacoes_do_mes('2026-03-01', '94', array['parada'], 'nome')->'linhas')), 0,
  'o chip Parada filtra pelo tipo');
select is((select jsonb_array_length(nucleo.operacoes_do_mes('2026-03-01', '94', array['matriz'], 'nome')->'linhas')), 1,
  'o chip da filial Matriz deixa só Cimento');
select is((select nucleo.operacoes_do_mes('2026-03-01', '94', null, '-receita')->'linhas'->0->>'nome'), 'Grãos 94',
  'ordem pela receita, da maior para a menor');
select is((select nucleo.operacoes_do_mes('2026-03-01', '94', null, 'margem')->'linhas'->0->>'nome'), 'Cimento 94',
  'ordem pela margem, da menor para a maior');
select is(pg_temp.erro_de($$select nucleo.operacoes_do_mes('2026-03-01', null, null, 'qualquer')$$), '22023',
  'ordem desconhecida é recusada');
select is((select (pg_temp.linha(nucleo.operacoes_do_mes('2026-04-01', '94', null, 'nome'), 'Grãos 94')->>'receita')::numeric),
  500.00, 'o CT-e de 01/04 entra em abril (limite do intervalo)');
select is((select nucleo.operacoes_do_mes(null, '94', null, 'nome')->>'mes'), '2026-04-01',
  'sem mês, abre o mais recente com viagens até hoje');

-- ---- Operacional: sem Operações ----
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.erro_de($$select nucleo.operacoes_do_mes('2026-03-01', null, null, 'nome')$$), '42501',
  'o Operacional (sem Operações) não lê a lista');

-- ---- Gestor de frota com Operações por carteira ----
reset role;
select pg_temp.dar_operacoes_ao_gestor();
select tests.como(pg_temp.id('auth_Gestor A'));
select is((select jsonb_path_query_array(nucleo.operacoes_do_mes('2026-03-01', null, null, 'nome'), '$.linhas[*].nome')),
  '["Grãos 94"]'::jsonb, 'o gestor vê só a operação da placa da carteira dele');
select is((select pg_temp.linha(nucleo.operacoes_do_mes('2026-03-01', null, null, 'nome'), 'Grãos 94')->'receita'),
  'null'::jsonb, 'sem Resultados, o gestor não vê o resultado em R$');

reset role;
select * from finish();
rollback;
