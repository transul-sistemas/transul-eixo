-- Lançar abastecimento (inventário 12): o Sankhya é a fonte principal; o lançamento manual fica PROVISÓRIO e é
-- conferido depois (casado com o abastecimento do Sankhya pelo id de origem, ou descartado com motivo).
--  * nucleo.lancar_abastecimento_provisorio: o gestor da carteira (Frota › criar); dia até hoje; litros > 0.
--  * nucleo.conferir_abastecimento_provisorio: conferido (com o id de origem do Sankhya da mesma placa) ou
--    descartado (com motivo); versão; decidir de novo o mesmo não muda nada (roda duas vezes).
--  * nucleo.abastecimento_do_mes_v2: a leitura do Abastecimento com os provisórios em aberto À PARTE (nunca somam
--    no total do Sankhya, que é o fato). Política abastecimento_provisorio_ler, com usuário de cada perfil.
begin;
\ir apoio/como_usuario.psql
\ir apoio/transferencia.psql

select plan(20);

select pg_temp.pessoa('Gestor A', 120000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 120000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm 120', 120000003, 'administrador', false);
select pg_temp.pessoa('Op 120', 120000004, 'operacional', false);
insert into nucleo.operacao (nome) values ('Op 120');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values (12001, 'K120A', true, true);
select pg_temp.guardar('k1', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(12001), p_placa => 'FFF1201', p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K120A'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Op 120'), p_em => '2026-01-10 08:00-03'));
select pg_temp.disparar();
select set_config('t.hoje', nucleo.hoje_em_sao_paulo()::text, true);
create function pg_temp.hoje() returns date language sql as $$ select current_setting('t.hoje')::date $$;
insert into staging.abastecimento (origem_id, placa, data, km_inicial, km_final, litros, valor_total, origem)
values ('T120-1', 'FFF1201', pg_temp.hoje(), 1000, 1500, 200, 1200.00, 'teste');

select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.lancar_abastecimento_provisorio(%L, %L, 100, 600, null, null, null, null)$$,
  pg_temp.id('k1'), pg_temp.hoje() + 1)), '22023', '1. dia futuro não se lança');
select is(pg_temp.erro_de(format($$select nucleo.lancar_abastecimento_provisorio(%L, %L, 0, 600, null, null, null, null)$$,
  pg_temp.id('k1'), pg_temp.hoje())), '22023', '2. litros precisam ser maiores que zero');
select set_config('t.p1', nucleo.lancar_abastecimento_provisorio(pg_temp.id('k1'), pg_temp.hoje(), 150.5, 900.30, 1500, 'Diesel S10', 'Posto Teste',
  '12000000-0000-4000-8000-000000000001')::text, true);
select is(nucleo.lancar_abastecimento_provisorio(pg_temp.id('k1'), pg_temp.hoje(), 150.5, 900.30, 1500, 'Diesel S10', 'Posto Teste',
  '12000000-0000-4000-8000-000000000001')::text, current_setting('t.p1'), '3. a mesma chave não lança duas vezes');
select set_config('t.p2', nucleo.lancar_abastecimento_provisorio(pg_temp.id('k1'), pg_temp.hoje(), 50, 300, null, null, null, null)::text, true);
select is((select situacao from nucleo.abastecimento_provisorio where id = current_setting('t.p1')::uuid), 'provisorio',
  '4. o lançamento manual nasce provisório');
select is((nucleo.abastecimento_do_mes_v2(pg_temp.hoje(), null, 'placa', 1, 50)->'totais'->>'litros')::numeric, 200::numeric,
  '5. o total do mês continua só o do Sankhya (o fato)');
select is((nucleo.abastecimento_do_mes_v2(pg_temp.hoje(), null, 'placa', 1, 50)->'provisorios'->>'abastecimentos')::int, 2,
  '6. os provisórios em aberto vêm à parte');
select is((nucleo.abastecimento_do_mes_v2(pg_temp.hoje(), null, 'placa', 1, 50)->'provisorios'->>'litros')::numeric, 200.5::numeric,
  '7. com os litros prontos no banco');
select is((nucleo.abastecimento_do_mes_v2(pg_temp.hoje(), null, 'placa', 1, 50)->'linhas'->0->'provisorios'->>'abastecimentos')::int, 2,
  '8. e na linha da placa');
reset role;

select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.lancar_abastecimento_provisorio(%L, %L, 10, 60, null, null, null, null)$$,
  pg_temp.id('k1'), pg_temp.hoje())), '42501', '9. outro gestor não lança na placa alheia');
select is((select count(*) from nucleo.abastecimento_provisorio), 0::bigint, '10. abastecimento_provisorio_ler: o outro gestor nem lê');
select is(pg_temp.erro_de(format($$select nucleo.conferir_abastecimento_provisorio(%L, 1, 'descartado', null, 'x', null)$$,
  current_setting('t.p2'))), '42501', '11. nem confere');
reset role;

select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.conferir_abastecimento_provisorio(%L, 1, 'conferido', 'NAO-EXISTE', null, null)$$,
  current_setting('t.p1'))), '23514', '12. conferir pede o abastecimento do Sankhya da mesma placa');
select is(pg_temp.erro_de(format($$select nucleo.conferir_abastecimento_provisorio(%L, 1, 'descartado', null, ' ', null)$$,
  current_setting('t.p2'))), '23514', '13. descartar pede o motivo');
select is(pg_temp.erro_de(format($$select nucleo.conferir_abastecimento_provisorio(%L, 9, 'conferido', 'T120-1', null, null)$$,
  current_setting('t.p1'))), '40001', '14. versão velha: "este registro mudou"');
select lives_ok(format($$select nucleo.conferir_abastecimento_provisorio(%L, 1, 'conferido', 'T120-1', null, null)$$, current_setting('t.p1')),
  '15. confere com o abastecimento do Sankhya');
select lives_ok(format($$select nucleo.conferir_abastecimento_provisorio(%L, 1, 'conferido', 'T120-1', null, null)$$, current_setting('t.p1')),
  '16. conferir de novo não muda nada (roda duas vezes)');
select lives_ok(format($$select nucleo.conferir_abastecimento_provisorio(%L, 1, 'descartado', null, 'Lançado em dobro', null)$$, current_setting('t.p2')),
  '17. descarta com o motivo');
select is((nucleo.abastecimento_do_mes_v2(pg_temp.hoje(), null, 'placa', 1, 50)->'provisorios'->>'abastecimentos')::int, 0,
  '18. conferido e descartado saem dos provisórios em aberto (nada conta duas vezes)');
reset role;
select is((select count(*) from nucleo.abastecimento_provisorio where situacao <> 'provisorio'), 2::bigint,
  '19. nada some: os dois ficam com a decisão');

select tests.como(pg_temp.id('auth_Op 120'));
select is((select count(*) from nucleo.abastecimento_provisorio), 0::bigint, '20. abastecimento_provisorio_ler: o Operacional não lê o abastecimento da Frota');
reset role;

select * from finish();
rollback;
