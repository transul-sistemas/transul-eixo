-- Correção de 11/11/2026: a exceção de data aberta que a classificação atual não confirma mais é FECHADA
-- (nunca apagada), com motivo. Caso real: a migration 20261116110000 abriu 'data_fora_de_faixa' para 18
-- lançamentos; a 20261116120000 reclassificou 15 deles como 'data_futura_a_confirmar' e deixou as antigas
-- abertas, duplicadas. Só dados fictícios; datas relativas a hoje, para o teste não envelhecer.
begin;

select plan(12);

select has_function('nucleo', 'registrar_excecoes_de_data', 'existe nucleo.registrar_excecoes_de_data');

insert into staging.despesa (origem_id, nufin, codcencus, codnat, dt_competencia, provisao, valor_desdobramento, valor_liquido) values
  ('d110-futura', '1101', '9411', '94011', (nucleo.hoje_em_sao_paulo() + interval '2 years')::date, 'REAL', 100.00, 100.00),
  ('d110-absurda', '1102', '9411', '94011', '2926-09-09', 'REAL', 100.00, 100.00),
  ('d110-corrigida', '1103', '9411', '94011', '2026-03-10', 'REAL', 100.00, 100.00);

-- O estado que a versão anterior da função deixou: tudo aberto como 'data_fora_de_faixa'.
insert into nucleo.fila_de_excecoes (lancamento_origem_id, assunto, descricao) values
  ('d110-futura', 'data_fora_de_faixa', 'aberta pela versão anterior'),
  ('d110-absurda', 'data_fora_de_faixa', 'aberta pela versão anterior'),
  ('d110-corrigida', 'data_fora_de_faixa', 'aberta pela versão anterior');

select is(nucleo.registrar_excecoes_de_data(), 1, 'a primeira rodada abre só a que faltava (a futura a confirmar)');

select is((select count(*)::int from nucleo.fila_de_excecoes
            where lancamento_origem_id = 'd110-futura' and assunto = 'data_fora_de_faixa' and resolvida_em is null),
          0, 'a antiga da data futura foi fechada: não fica duplicada');
select is((select count(*)::int from nucleo.fila_de_excecoes
            where lancamento_origem_id = 'd110-futura' and assunto = 'data_futura_a_confirmar' and resolvida_em is null),
          1, 'a data futura tem uma exceção aberta do tipo certo');
select ok((select resolucao like 'Reclassificada%' from nucleo.fila_de_excecoes
            where lancamento_origem_id = 'd110-futura' and assunto = 'data_fora_de_faixa'),
          'a antiga foi fechada com o motivo "reclassificada"');

select is((select count(*)::int from nucleo.fila_de_excecoes
            where lancamento_origem_id = 'd110-absurda' and assunto = 'data_fora_de_faixa' and resolvida_em is null),
          1, 'a data absurda continua aberta como fora de faixa (a classificação não mudou)');

select is((select count(*)::int from nucleo.fila_de_excecoes
            where lancamento_origem_id = 'd110-corrigida' and resolvida_em is null),
          0, 'a data que passou a ser válida fechou');
select ok((select resolucao like 'Fechada pela carga%' from nucleo.fila_de_excecoes
            where lancamento_origem_id = 'd110-corrigida'),
          'fechada com o motivo "data válida"');

select is((select count(*)::int from nucleo.fila_de_excecoes where lancamento_origem_id like 'd110-%'),
          4, 'nada foi apagado: as 3 antigas continuam na tabela, mais a nova da data futura');

select is(nucleo.registrar_excecoes_de_data(), 0, 'rodar de novo não abre nada (idempotente)');
select is((select count(*)::int from nucleo.fila_de_excecoes
            where lancamento_origem_id like 'd110-%' and resolvida_em is null),
          2, 'ao fim, duas abertas: a futura a confirmar e a absurda');
select is((select count(*)::int from nucleo.fila_de_excecoes where lancamento_origem_id like 'd110-%'),
          4, 'e continuam 4 linhas depois da segunda rodada');

select * from finish();
rollback;
