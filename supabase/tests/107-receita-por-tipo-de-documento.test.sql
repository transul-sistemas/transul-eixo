-- Receita em duas linhas (CT-e e NFS-e) com UMA definição: nucleo.linha_de_receita + config.receita_top.
-- Só dados fictícios (apoio/operacoes_ficticias.psql e linhas próprias, em março de 2026).
--  * A regra: CT-e entra com status A, ou sem status na série V; status I e R ficam fora. NFS-e entra só
--    se a TOP estiver ativa em config.receita_top (1100, 1106, 1128, 1136); a 1124 (Gestão Portuária)
--    fica fora, para não contar duas vezes.
--  * O total (CT-e + NFS-e) é igual ao da regra antiga (`coalesce(status_cte, 'A') = 'A'`) numa
--    população em que as duas coincidem.
--  * A operação vem do centro da nota (codcencus): NFS-e sem placa ou com placa genérica cai nela.
--  * RLS: sem Resultados › ver não chega número; as TOPs só quem tem Administração grava.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(30);

-- Uma operação da lista de Operações, pelo nome.
create function pg_temp.linha_da_lista(p_nome text) returns jsonb language sql as $$
  select l from jsonb_array_elements(nucleo.operacoes_do_mes('2026-03-01', p_nome, null, 'nome')->'linhas') l where l->>'nome' = p_nome
$$;

-- ---- Estrutura ----
select has_table('config', 'receita_top', 'existe config.receita_top');
select has_function('nucleo', 'linha_de_receita', array['text', 'text', 'text', 'integer'], 'existe nucleo.linha_de_receita');
select ok(not (select prosecdef from pg_proc where oid = 'nucleo.linha_de_receita(text,text,text,integer)'::regprocedure),
  'a regra roda com a permissão de quem chama (security invoker)');
select ok(not has_function_privilege('anon', 'nucleo.linha_de_receita(text,text,text,integer)', 'execute'),
  'anon não executa a regra');
select ok(exists (select 1 from config.funcao_executavel where assinatura = 'nucleo.linha_de_receita(text,text,text,integer)'),
  'a regra está na relação de funções que o app executa, com a justificativa');
select policies_are('config', 'receita_top', array['receita_top_ler', 'receita_top_criar', 'receita_top_alterar'],
  'as políticas de config.receita_top');
select ok((select relrowsecurity from pg_class where oid = 'config.receita_top'::regclass), 'config.receita_top tem RLS');
select ok(exists (select 1 from pg_indexes where schemaname = 'config' and tablename = 'receita_top'),
  'a chave da TOP tem índice (a primária)');

-- ---- As TOPs cadastradas ----
select is((select array_agg(codtipoper order by codtipoper) from config.receita_top where ativa), array[1100, 1106, 1128, 1136],
  'as TOPs ativas são 1100, 1106, 1128 e 1136');
select is((select ativa from config.receita_top where codtipoper = 1124), false, 'a 1124 (Gestão Portuária) está cadastrada como inativa');
select ok((select motivo from config.receita_top where codtipoper = 1124) like '%duas vezes%', 'a 1124 diz o motivo: contaria duas vezes');

-- ---- A regra, linha a linha ----
select is(nucleo.linha_de_receita('CTE', 'A', '1', null), 'cte', 'CT-e série 1 com status A entra como cte');
select is(nucleo.linha_de_receita('CTE', null, 'V', 1122), 'cte', 'CT-e série V sem status entra como cte (frete direto)');
select is(nucleo.linha_de_receita('CTE', 'R', '2', null), null, 'CT-e com status R fica fora');
select is(nucleo.linha_de_receita('CTE', 'I', '2', null), null, 'CT-e com status I fica fora');
select is(nucleo.linha_de_receita('CTE', null, '2', null), null, 'CT-e sem status fora da série V fica fora');
select is(nucleo.linha_de_receita('NFSE', null, null, 1136), 'nfse', 'NFS-e da TOP 1136 entra como nfse');
select is(nucleo.linha_de_receita('NFSE', null, null, 1124), null, 'NFS-e da TOP 1124 fica fora (não conta duas vezes)');
select is(nucleo.linha_de_receita('NFSE', null, null, null), null, 'NFS-e sem TOP fica fora');

-- ---- A cascata: duas linhas separam certo e o centro da nota leva à operação ----
insert into nucleo.operacao (nome, tipo, base_cidade, base_uf) values ('Receita 107', 'operacao', 'Cordeirópolis', 'SP'),
  ('Coincide 107', 'operacao', 'Cordeirópolis', 'SP');
select pg_temp.guardar('rec', (select id from nucleo.operacao where nome = 'Receita 107'));
select pg_temp.guardar('coin', (select id from nucleo.operacao where nome = 'Coincide 107'));
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio, operacao_id) values
  (107001, 'K107A', false, null, pg_temp.id('rec')),
  (107002, 'K107B', false, null, pg_temp.id('coin'));

insert into staging.viagem (nunota, serie, codcencus, placa, dt_negociacao, tipo_documento, status_cte, codtipoper, frete_empresa) values
  -- Receita 107: dois CT-e (série 1 status A; série V sem status) e duas NFS-e (TOP 1136 sem placa; TOP 1100 em placa genérica).
  (107001, '1', '107001', null, '2026-03-02', 'CTE', 'A', null, 1000.00),
  (107002, 'V', '107001', null, '2026-03-03', 'CTE', null, 1122, 1000.00),
  (107003, '2', '107001', null, '2026-03-04', 'CTE', 'R', null, 1000.00),
  (107004, '2', '107001', null, '2026-03-05', 'CTE', 'I', null, 1000.00),
  (107005, null, '107001', null, '2026-03-06', 'NFSE', null, 1136, 1000.00),
  (107006, null, '107001', null, '2026-03-07', 'NFSE', null, 1124, 1000.00),
  (107007, null, '107001', 'XYZ', '2026-03-08', 'NFSE', null, 1100, 1000.00),
  -- Coincide 107: a regra antiga e a nova dão o mesmo total.
  (107101, '1', '107002', null, '2026-03-02', 'CTE', 'A', null, 2000.00),
  (107102, 'V', '107002', null, '2026-03-03', 'CTE', null, 1122, 500.00),
  (107103, null, '107002', null, '2026-03-04', 'NFSE', null, 1128, 300.00);

select tests.como(pg_temp.id('auth_Adm'));
create temp table c as select * from nucleo.cascata_das_operacoes('2026-03-01') where operacao_id = pg_temp.id('rec');
select is((select receita_cte from c), 2000.00, 'Receita 107: a linha de CT-e soma série 1 (A) e série V (sem status), fora o R e o I');
select is((select documentos_cte from c), 2, 'Receita 107: dois CT-e');
select is((select receita_nfse from c), 2000.00,
  'Receita 107: a linha de NFS-e soma a TOP 1136 sem placa e a TOP 1100 na placa genérica XYZ (centro da nota), fora a TOP 1124');
select is((select documentos_nfse from c), 2, 'Receita 107: duas NFS-e');
select is((select receita from c), 4000.00, 'Receita 107: o total é CT-e + NFS-e');
select is((select documentos from c), 4, 'Receita 107: o total de documentos é CT-e + NFS-e');
drop table c;

-- (a) O total é igual ao da regra antiga onde as duas coincidem.
select is(
  (select receita from nucleo.cascata_das_operacoes('2026-03-01') where operacao_id = pg_temp.id('coin')),
  (select sum(v.frete_empresa)::numeric(15, 2) from staging.viagem v
    where v.codcencus = '107002' and v.sumiu_do_sankhya_em is null and coalesce(v.status_cte, 'A') = 'A'
      and v.dt_negociacao >= '2026-03-01' and v.dt_negociacao < '2026-04-01'),
  'Coincide 107: o total novo é igual ao da regra antiga (status vazio ou A)');

-- A lista e a ficha trazem as duas linhas e mantêm o total.
select is((select (pg_temp.linha_da_lista('Receita 107')->>'receita_nfse')::numeric), 2000.00, 'a lista traz a receita de NFS-e');
select is((select (nucleo.ficha_da_operacao(pg_temp.id('rec'), '2026-03-01')->'cascata'->>'receita_cte')::numeric), 2000.00,
  'a ficha traz a receita de CT-e e mantém o total em receita');

-- ---- RLS: sem Resultados não chega número ----
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is((select count(*) from nucleo.cascata_das_operacoes('2026-03-01') where receita <> 0), 0::bigint,
  'o Operacional (sem Resultados) não recebe receita na cascata');
select is(pg_temp.erro_de($$insert into config.receita_top (codtipoper, tipo, motivo) values (1999, 'nfse', 'teste')$$), '42501',
  'o Operacional não grava TOP de receita');

reset role;
select * from finish();
rollback;
