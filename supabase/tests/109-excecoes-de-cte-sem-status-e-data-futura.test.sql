-- Decisões de 11/11/2026: CT-e sem status e data futura a confirmar na fila de exceções; "dados até" do
-- abastecimento e da folha. Só dados fictícios.
--  * tipo_da_data: valida (01/01/2020 até hoje + 1 ano), futura_a_confirmar (até hoje + 10 anos) e
--    fora_de_faixa (antes de 2020 ou além de hoje + 10 anos). Só a válida entra no resultado.
--  * Cada lançamento fora da faixa abre UMA exceção do tipo certo; rodar de novo não duplica; provisão e
--    lançamento válido não geram exceção.
--  * CT-e sem status fora da série V gera `cte_sem_status`; série V sem status e CT-e com status A não.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(26);

-- ---- Os tipos da data ----
select has_function('nucleo', 'tipo_da_data', array['date'], 'existe nucleo.tipo_da_data');
select is(nucleo.tipo_da_data(date '2026-03-10'), 'valida', 'uma data comum é válida');
select is(nucleo.tipo_da_data((nucleo.hoje_em_sao_paulo() + interval '1 year')::date), 'valida', 'hoje + 1 ano ainda é válida');
select is(nucleo.tipo_da_data((nucleo.hoje_em_sao_paulo() + interval '1 year 1 day')::date), 'futura_a_confirmar', 'um dia além: futura a confirmar');
select is(nucleo.tipo_da_data(date '2028-08-15'), 'futura_a_confirmar', '2028 é futura a confirmar');
select is(nucleo.tipo_da_data((nucleo.hoje_em_sao_paulo() + interval '10 years')::date), 'futura_a_confirmar', 'hoje + 10 anos ainda é futura a confirmar');
select is(nucleo.tipo_da_data((nucleo.hoje_em_sao_paulo() + interval '10 years 1 day')::date), 'fora_de_faixa', 'um dia além de 10 anos: fora de faixa');
select is(nucleo.tipo_da_data(date '2206-01-01'), 'fora_de_faixa', '2206 é fora de faixa');
select is(nucleo.tipo_da_data(date '2926-09-09'), 'fora_de_faixa', '2926 é fora de faixa');
select is(nucleo.tipo_da_data(date '1999-12-31'), 'fora_de_faixa', '1999 é fora de faixa');
select is(nucleo.tipo_da_data(null), 'fora_de_faixa', 'sem data é fora de faixa');
select is(nucleo.data_na_faixa(date '2028-08-15'), false, 'a futura a confirmar fica fora do resultado');

-- ---- Fixtures: despesas e CT-e ----
insert into staging.despesa (origem_id, nufin, codcencus, codnat, dt_competencia, provisao, valor_desdobramento, valor_liquido) values
  ('d109-1', '1091', '9402', '94002', '2028-08-15', 'REAL', 100.00, 100.00),
  ('d109-2', '1092', '9402', '94002', '2206-01-01', 'REAL', 100.00, 100.00),
  ('d109-3', '1093', '9402', '94002', '2926-09-09', 'REAL', 100.00, 100.00),
  ('d109-4', '1094', '9402', '94002', '1999-12-31', 'REAL', 100.00, 100.00),
  ('d109-5', '1095', '9402', '94002', '2026-03-10', 'REAL', 100.00, 100.00),
  ('d109-6', '1096', '9402', '94002', '2029-01-01', 'PROVISAO', 100.00, 100.00);
insert into staging.viagem (nunota, serie, codcencus, dt_negociacao, tipo_documento, status_cte, codtipoper, frete_empresa) values
  (109001, '1', '9402', '2026-03-02', 'CTE', null, null, 10.00),
  (109002, 'V', '9402', '2026-03-03', 'CTE', null, 1122, 10.00),
  (109003, '1', '9402', '2026-03-04', 'CTE', 'A', null, 10.00),
  (109004, null, '9402', '2026-03-05', 'NFSE', null, 1136, 10.00);

select is(nucleo.registrar_excecoes_de_data(), 4, 'a primeira rodada abre quatro exceções de data (2028, 2206, 2926 e 1999)');
select is(nucleo.registrar_excecoes_de_data(), 0, 'rodar de novo não duplica as de data');
select is((select count(*) from nucleo.fila_de_excecoes where assunto = 'data_futura_a_confirmar'), 1::bigint, 'uma exceção de data futura a confirmar (2028)');
select is((select count(*) from nucleo.fila_de_excecoes where assunto = 'data_fora_de_faixa'), 3::bigint, 'três de fora de faixa (2206, 2926 e 1999), separadas da futura');
select is((select lancamento_origem_id from nucleo.fila_de_excecoes where assunto = 'data_futura_a_confirmar'), 'd109-1', 'a futura é o lançamento de 2028');
select is((select count(*) from nucleo.fila_de_excecoes where lancamento_origem_id in ('d109-5', 'd109-6')), 0::bigint,
  'o lançamento válido e a provisão não geram exceção');
select ok((select descricao like 'Data futura a confirmar:%' from nucleo.fila_de_excecoes where assunto = 'data_futura_a_confirmar'),
  'a descrição da futura começa com "Data futura a confirmar:"');
select is((select coalesce(sum(valor), 0) from nucleo.despesa_na_competencia('2026-03-01') where codcencus = '9402'), 700.00,
  'no resultado de março só entra o válido (600 do fixture e 100 deste teste); 2028, 2206, 2926 e 1999 ficam fora');

select is(nucleo.registrar_excecoes_de_cte_sem_status(), 1, 'o CT-e série 1 sem status gera uma exceção');
select is(nucleo.registrar_excecoes_de_cte_sem_status(), 0, 'rodar de novo não duplica a do CT-e');
select is((select array_agg(lancamento_origem_id) from nucleo.fila_de_excecoes where assunto = 'cte_sem_status'), array['109001/1'],
  'só o CT-e série 1 sem status: nem a série V, nem o status A, nem a NFS-e');

-- ---- Dados até do abastecimento e da folha ----
insert into staging.abastecimento (origem_id, placa, data, litros, valor_total) values
  ('a109-1', 'FFF9A01', '2026-03-05', 10, 50), ('a109-2', 'FFF9A01', '2026-02-01', 10, 50), ('a109-3', 'FFF9A01', '2926-01-01', 10, 50);
select tests.como(pg_temp.id('auth_Adm'));
select is(nucleo.abastecimento_ate(), date '2026-03-05', 'abastecimento até: a data mais recente válida (a de 2926 não conta)');
select is(nucleo.folha_ate(), date '2026-03-01', 'folha até: o último mês de referência carregado, sem inventar dia');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(nucleo.folha_ate(), null, 'sem Resultados › ver, a folha não tem "dados até"');
reset role;

select * from finish();
rollback;
