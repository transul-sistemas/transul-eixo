-- Operações › ficha (nucleo.ficha_da_operacao) e o assistente "Editar operação" (a política
-- operacao_alterar). Só dados fictícios (apoio/operacoes_ficticias.psql).
--  * A ficha traz a operação (com a versão), a cascata do mês pela mesma regra da lista, o custo de
--    Frota e de Serviço por natureza, as placas vinculadas agora e as pessoas da folha dos CRs da
--    operação (só contagens e totais, sem nome nem CPF).
--  * Quem não tem Operações não lê (42501); operação inexistente ou fora do escopo volta nula.
--  * Editar a operação: quem tem Operações › editar ou Cadastros › editar; os demais não alteram nada.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(24);

-- ---- Estrutura ----
select has_function('nucleo', 'ficha_da_operacao', array['uuid', 'date'], 'existe nucleo.ficha_da_operacao(operação, mês)');
select ok(not (select prosecdef from pg_proc where oid = 'nucleo.ficha_da_operacao(uuid,date)'::regprocedure),
  'a ficha roda com a permissão de quem chama (security invoker)');
select ok(not has_function_privilege('anon', 'nucleo.ficha_da_operacao(uuid,date)', 'execute'), 'anon não executa a ficha');

-- ---- Administrador ----
select tests.como(pg_temp.id('auth_Adm'));
create temp table f as select nucleo.ficha_da_operacao(pg_temp.id('graos'), '2026-03-01') as j;
select is((select j->'operacao'->>'nome' from f), 'Grãos 94', 'a ficha traz a operação');
select is((select (j->'operacao'->>'versao')::int from f), 1, 'com a versão, para o assistente');
select is((select j->'operacao'->>'filial' from f), 'Cordeirópolis', 'e a filial (a garagem da base)');
select is((select (j->'cascata'->>'receita')::numeric from f), 4000.00, 'cascata: receita do mês');
select is((select (j->'cascata'->>'documentos')::int from f), 2, 'cascata: dois documentos de frete');
select is((select (j->'cascata'->>'custo_frota')::numeric from f), 400.00, 'cascata: custo da Frota');
select is((select (j->'cascata'->>'custo_servico')::numeric from f), 600.00, 'cascata: custo de Serviço');
select is((select (j->'cascata'->>'margem')::numeric from f), 3000.00, 'cascata: margem, igual à da lista');
select is((select j->'cascata'->'frota_por_natureza'->0->>'natureza' from f), 'Combustível 94', 'o custo da Frota por natureza');
select is((select (j->'cascata'->'servico_por_natureza'->0->>'valor')::numeric from f), 600.00, 'o custo de Serviço por natureza');
select is((select jsonb_path_query_array(j, '$.placas[*].placa') from f), '["FFF9A01"]'::jsonb, 'as placas vinculadas agora');
select is((select (j->'pessoas'->>'funcionarios')::int from f), 2, 'pessoas: funcionários distintos na folha do mês');
select is((select (j->'pessoas'->>'salario_bruto')::numeric from f), 2700.00, 'pessoas: salário bruto do mês');
select is((select j->'pessoas'->'por_departamento'->0->>'departamento' from f), 'Departamento 94', 'pessoas por departamento');
drop table f;
select is(nucleo.ficha_da_operacao('00000000-0000-0000-0000-000000000000', '2026-03-01'), null, 'operação inexistente volta nula');

-- ---- Operacional: sem Operações ----
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.erro_de(format('select nucleo.ficha_da_operacao(%L, %L)', pg_temp.id('graos'), '2026-03-01')), '42501',
  'o Operacional (sem Operações) não lê a ficha');

-- ---- Gestor de frota com Operações por carteira ----
reset role;
select pg_temp.dar_operacoes_ao_gestor();
select tests.como(pg_temp.id('auth_Gestor A'));
select is(nucleo.ficha_da_operacao(pg_temp.id('cimento'), '2026-03-01'), null, 'o gestor não abre operação fora da carteira');
select is(nucleo.ficha_da_operacao(pg_temp.id('graos'), '2026-03-01')->'cascata', 'null'::jsonb,
  'o gestor abre a da carteira, sem o resultado em R$');

-- ---- Editar a operação (política operacao_alterar) ----
create function pg_temp.renomear(p_id uuid, p_nome text) returns int language plpgsql as $$
declare v int;
begin
  update nucleo.operacao set nome = p_nome where id = p_id;
  get diagnostics v = row_count;
  return v;
end;
$$;
grant execute on function pg_temp.renomear(uuid, text) to authenticated;
select is(pg_temp.renomear(pg_temp.id('graos'), 'Grãos 94 (gestor)'), 0, 'operacao_alterar: o gestor de frota não edita');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.renomear(pg_temp.id('graos'), 'Grãos 94 (operacional)'), 0, 'operacao_alterar: o Operacional não edita');
reset role;
-- Diretoria tem Operações › editar; tira-se Cadastros › editar para provar que Operações basta.
delete from config.permissao_do_perfil where perfil = 'diretoria' and modulo = 'cadastros' and acao = 'editar';
select tests.como(pg_temp.id('auth_Dir'));
select is(pg_temp.renomear(pg_temp.id('graos'), 'Grãos 94 Norte'), 1, 'operacao_alterar: quem tem Operações › editar edita');

reset role;
select * from finish();
rollback;
