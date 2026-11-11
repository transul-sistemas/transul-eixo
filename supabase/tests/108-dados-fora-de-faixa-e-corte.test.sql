-- Data fora de faixa, dados congelados e a trava do dia do corte (11/11/2026). Só dados fictícios.
--  * nucleo.data_na_faixa: de 01/01/2020 até hoje + 1 ano. Fora da faixa, o lançamento fica fora do
--    resultado (despesa_na_competencia e a cascata) e vira exceção `data_fora_de_faixa` na fila, uma por
--    lançamento (rodar de novo não duplica). Provisão e lançamento válido não geram exceção.
--  * nucleo.dados_do_staging_ate e o mês fechado mais recente (nunca um mês incompleto).
--  * O parâmetro do dia do corte fica travado enquanto staging.despesa não tem a coluna dtneg.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(32);

-- ---- A faixa ----
select has_function('nucleo', 'data_na_faixa', array['date'], 'existe nucleo.data_na_faixa');
select is(nucleo.data_na_faixa(date '2026-03-10'), true, 'uma data comum está na faixa');
select is(nucleo.data_na_faixa(date '2020-01-01'), true, 'o primeiro dia da faixa vale (limite incluído)');
select is(nucleo.data_na_faixa(date '2019-12-31'), false, 'o dia antes da faixa não vale');
select is(nucleo.data_na_faixa(date '2926-09-09'), false, 'o ano 2926 (erro de digitação) está fora');
select is(nucleo.data_na_faixa(null), false, 'sem data está fora');
select is(nucleo.data_na_faixa((nucleo.hoje_em_sao_paulo() + interval '1 year')::date), true, 'hoje + 1 ano é o último dia que vale');
select is(nucleo.data_na_faixa((nucleo.hoje_em_sao_paulo() + interval '1 year 1 day')::date), false, 'um dia depois do limite está fora');

-- ---- Lançamentos fictícios no CR 9402 (serviço da operação Grãos 94), março de 2026 ----
insert into staging.despesa (origem_id, nufin, codcencus, codnat, dt_competencia, provisao, valor_desdobramento, valor_liquido) values
  ('d108-1', '1081', '9402', '94002', '2926-09-09', 'REAL', 7000.00, 7000.00),
  ('d108-2', '1082', '9402', '94002', '1999-12-31', 'REAL', 8000.00, 8000.00),
  ('d108-3', '1083', '9402', '94002', '2026-03-10', 'REAL', 500.00, 500.00),
  ('d108-4', '1084', '9402', '94002', '2926-01-01', 'PROVISAO', 9000.00, 9000.00);

select tests.como(pg_temp.id('auth_Adm'));
select is((select coalesce(sum(valor), 0) from nucleo.despesa_na_competencia('2026-03-01') where codcencus = '9402'), 1100.00,
  'março: a despesa do CR 9402 soma só o que está na faixa (600 do fixture + 500)');
select is((select count(*) from nucleo.despesa_na_competencia('2926-09-01') where codcencus = '9402'), 0::bigint,
  'o lançamento do ano 2926 não aparece em mês nenhum');
select is((select count(*) from nucleo.despesa_na_competencia('1999-12-01') where codcencus = '9402'), 0::bigint,
  'o lançamento de 1999 não aparece em mês nenhum');
select is((select custo_servico from nucleo.cascata_das_operacoes('2026-03-01') where operacao_id = pg_temp.id('graos')), 1100.00,
  'a cascata de Grãos 94 não conta os lançamentos fora da faixa');
reset role;

-- ---- A fila ----
select ok(not has_function_privilege('authenticated', 'nucleo.registrar_excecoes_de_data()', 'execute'),
  'só a carga executa registrar_excecoes_de_data (authenticated não)');
select is(nucleo.registrar_excecoes_de_data(), 2, 'a primeira rodada abre duas exceções (2926 e 1999)');
select is(nucleo.registrar_excecoes_de_data(), 0, 'rodar de novo não duplica');
select is((select count(*) from nucleo.fila_de_excecoes where assunto = 'data_fora_de_faixa' and resolvida_em is null), 2::bigint,
  'a fila tem uma exceção aberta por lançamento fora da faixa');
select is((select count(*) from nucleo.fila_de_excecoes where lancamento_origem_id in ('d108-3', 'd108-4')), 0::bigint,
  'o lançamento válido e a provisão não geram exceção');
select ok((select bool_and(descricao like 'Data fora de faixa:%') from nucleo.fila_de_excecoes where assunto = 'data_fora_de_faixa'),
  'a descrição começa com "Data fora de faixa:"');
select throws_ok(
  $$insert into nucleo.fila_de_excecoes (lancamento_origem_id, assunto, descricao) values ('d108-1', 'data_fora_de_faixa', 'duplicada')$$,
  '23505', null, 'o banco recusa a segunda exceção aberta do mesmo lançamento (índice único parcial)');

select tests.como(pg_temp.id('auth_Adm'));
select is((select count(*) from nucleo.fila_de_excecoes where assunto = 'data_fora_de_faixa'), 2::bigint,
  'quem edita Cadastros lê as exceções de data');
select ok((select (nucleo.excecoes_abertas('data_fora_de_faixa', 1, 50)->>'total')::int = 2), 'a fila em tela traz as duas, filtradas pelo assunto');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is((select count(*) from nucleo.fila_de_excecoes where assunto = 'data_fora_de_faixa'), 0::bigint,
  'o Operacional (sem Cadastros › editar) não lê a fila de lançamentos');
reset role;

-- ---- Dados até e mês incompleto ----
select tests.como(pg_temp.id('auth_Adm'));
select is(nucleo.dados_do_staging_ate(), date '2026-03-20',
  'dados até: a menor entre a última viagem (01/04) e a última despesa real na faixa (20/03); 2926 e provisão não contam');
select is(nucleo.ultimo_mes_completo_do_staging(), date '2026-02-01', 'março está incompleto (parou em 20/03): o último completo é fevereiro');
select is(nucleo.mes_fechado_mais_recente(date '2026-11-11'), date '2026-02-01',
  'o mês fechado mais recente nunca é um mês incompleto, mesmo que o calendário já o feche');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(nucleo.dados_do_staging_ate(), null, 'sem Resultados › ver, não há "dados até"');
reset role;

-- ---- A trava do dia do corte ----
select is(nucleo.staging_tem_dtneg(), false, 'staging.despesa ainda não tem a coluna dtneg');
select is(pg_temp.erro_de($$update config.parametro set valor = '15' where chave = 'dia_do_corte_da_competencia'$$), '55000',
  'o banco recusa mudar o dia do corte enquanto não há DTNEG');
select is(pg_temp.erro_de($$update config.parametro set valor = '10' where chave = 'dia_do_corte_da_competencia'$$), 'executou',
  'regravar o mesmo valor não é mudança');
select is(pg_temp.erro_de($$update config.parametro set valor = '2021-01-01' where chave = 'data_minima_do_staging'$$), 'executou',
  'os outros parâmetros seguem livres');
alter table staging.despesa add column dtneg date;
select is(nucleo.staging_tem_dtneg(), true, 'com a coluna dtneg a função vira verdadeira');
select is(pg_temp.erro_de($$update config.parametro set valor = '15' where chave = 'dia_do_corte_da_competencia'$$), 'executou',
  'e a trava cai sozinha');

select * from finish();
rollback;
