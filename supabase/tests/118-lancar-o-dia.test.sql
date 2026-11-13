-- A2, Lançar o dia (inventário 5, 6 e 7).
--  * nucleo.lancar_o_dia_em_lote: mesma sigla e mesma hora para vários conjuntos, TUDO OU NADA, com "X de Y" e a
--    lista dos recusados (a tela oferece "remover da lista e lançar os outros"). Chave de envio.
--  * Programado (Alexandre: sim): nucleo.programar_situacao (dia futuro, fora do realizado),
--    nucleo.confirmar_situacao_programada (no dia, vira evento), nucleo.cancelar_situacao_programada.
--    Política situacao_programada_ler.
--  * nucleo.corrigir_ultimo_evento: exclusão lógica do último evento da camada (com motivo), que desfaz o efeito;
--    opcionalmente registra a sigla certa na mesma hora. Nada some do histórico.
begin;
\ir apoio/como_usuario.psql
\ir apoio/transferencia.psql

select plan(33);

select pg_temp.pessoa('Gestor A', 118000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 118000002, 'gestor_de_frota', true);
insert into nucleo.operacao (nome) values ('Op 118');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (11801, 'K118A', true, true), (11802, 'K118B', true, true), (11803, 'K118C', true, true);
create function pg_temp.cavalo(p_nome text, p_n bigint, p_placa text, p_gestor text, p_cr text) returns uuid language sql as $$
  select pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => 'cavalo', p_renavam => pg_temp.renavam(p_n), p_placa => p_placa, p_gestor_id => pg_temp.id(p_gestor),
    p_cr_id => (select id from nucleo.cr where codigo = p_cr),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Op 118'), p_em => '2026-01-10 08:00-03'))
$$;
select pg_temp.cavalo('k1', 11801, 'FFF1181', 'Gestor A', 'K118A');
select pg_temp.cavalo('k2', 11802, 'FFF1182', 'Gestor A', 'K118B');
select pg_temp.cavalo('k3', 11803, 'FFF1183', 'Gestor B', 'K118C');
select pg_temp.disparar();
select set_config('t.hoje', nucleo.hoje_em_sao_paulo()::text, true);
create function pg_temp.hoje() returns date language sql as $$ select current_setting('t.hoje')::date $$;
create function pg_temp.eventos(p_nome text) returns bigint language sql as $$
  select count(*) from nucleo.evento_de_status where ativo_id = pg_temp.id(p_nome)
$$;

-- ---- lote ----
select tests.como(pg_temp.id('auth_Gestor A'));
select set_config('t.lote', nucleo.lancar_o_dia_em_lote(array[pg_temp.id('k1'), pg_temp.id('k2')], 'PÁT', pg_temp.hoje() - 1, '08:00',
  '11800000-0000-4000-8000-000000000001')::text, true);
select is((current_setting('t.lote')::jsonb->>'lancados')::int, 2, '1. o lote lança os 2');
select is((current_setting('t.lote')::jsonb->>'total')::int, 2, '2. "2 de 2"');
reset role;
select is(nucleo.situacao_no_dia(pg_temp.id('k1'), pg_temp.hoje() - 1), 'PÁT', '3. k1 ficou PÁT no dia');
select is((select max(em) from nucleo.evento_de_status where ativo_id = pg_temp.id('k2') and sigla = 'PÁT' and excluido_em is null),
  ((pg_temp.hoje() - 1) + time '08:00') at time zone 'America/Sao_Paulo', '4. na mesma hora para todos');
select set_config('t.ev1', pg_temp.eventos('k1')::text, true);
select tests.como(pg_temp.id('auth_Gestor A'));
select ok((nucleo.lancar_o_dia_em_lote(array[pg_temp.id('k1'), pg_temp.id('k2')], 'PÁT', pg_temp.hoje() - 1, '08:00',
  '11800000-0000-4000-8000-000000000001')->>'repetido')::boolean, '5. a mesma chave não lança de novo');
select set_config('t.lote2', nucleo.lancar_o_dia_em_lote(array[pg_temp.id('k1'), pg_temp.id('k3')], 'DOp', pg_temp.hoje(), '06:00', null)::text, true);
select is((current_setting('t.lote2')::jsonb->>'lancados')::int, 0, '6. tudo ou nada: um recusado, nenhum lançado');
select ok(exists (select 1 from jsonb_array_elements(current_setting('t.lote2')::jsonb->'recusados') r
                   where r->>'ativo_id' = pg_temp.id('k3')::text and length(r->>'motivo') > 0),
  '7. o recusado vem com o motivo (para remover da lista)');
reset role;
select is(pg_temp.eventos('k1')::text, current_setting('t.ev1'), '8. nada foi gravado em k1');
select tests.como(pg_temp.id('auth_Gestor A'));
select is((nucleo.lancar_o_dia_em_lote(array[pg_temp.id('k1')], 'ETc', pg_temp.hoje(), '06:00', null)->>'lancados')::int, 0,
  '9. sigla que não vale para o cavalo solto: recusa');
select is(pg_temp.erro_de(format($$select nucleo.lancar_o_dia_em_lote(array[%L]::uuid[], 'PÁT', %L, '08:00', null)$$,
  pg_temp.id('k1'), pg_temp.hoje() + 1)), '22023', '10. dia futuro não se lança (se programa)');
select is(pg_temp.erro_de(format($$select nucleo.lancar_o_dia_em_lote(array[]::uuid[], 'PÁT', %L, '08:00', null)$$,
  pg_temp.hoje())), '22023', '11. lote vazio é recusado');
reset role;

-- ---- programado ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.programar_situacao(%L, %L, 'MAN', '07:00', null)$$, pg_temp.id('k1'), pg_temp.hoje())),
  '22023', '12. programar é para dia futuro');
select ok(nucleo.programar_situacao(pg_temp.id('k1'), pg_temp.hoje() + 2, 'DOp', '07:00', null) is not null, '13. programa DOp para depois de amanhã');
select ok(nucleo.programar_situacao(pg_temp.id('k1'), pg_temp.hoje() + 2, 'PÁT', '09:00', null) is not null, '14. reprogramar o mesmo dia troca a sigla');
reset role;
select is((select count(*) from nucleo.situacao_programada where ativo_id = pg_temp.id('k1') and situacao = 'programada'), 1::bigint,
  '15. uma programada por conjunto e dia');
select is(pg_temp.eventos('k1')::text, current_setting('t.ev1'), '16. Programado fica fora do realizado (nenhum evento)');
select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.programar_situacao(%L, %L, 'DOp', '07:00', null)$$, pg_temp.id('k1'), pg_temp.hoje() + 2)),
  '42501', '17. outro gestor não programa');
select is((select count(*) from nucleo.situacao_programada where ativo_id = pg_temp.id('k1')), 0::bigint, '18. situacao_programada_ler: nem lê');
reset role;
select set_config('t.prog', (select id::text from nucleo.situacao_programada where ativo_id = pg_temp.id('k1') and situacao = 'programada'), true);
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.confirmar_situacao_programada(%L, %s, null)$$, current_setting('t.prog'),
  (select versao from nucleo.situacao_programada where id = current_setting('t.prog')::uuid))), '23514', '19. não se confirma antes do dia');
reset role;
-- o dia chegou (o teste traz a programada para hoje)
update nucleo.situacao_programada set dia = pg_temp.hoje(), hora = '00:01' where id = current_setting('t.prog')::uuid;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.confirmar_situacao_programada(%L, 99, null)$$, current_setting('t.prog'))),
  '40001', '20. versão velha: "este registro mudou"');
select ok(nucleo.confirmar_situacao_programada(current_setting('t.prog')::uuid,
  (select versao from nucleo.situacao_programada where id = current_setting('t.prog')::uuid), null) is not null, '21. confirma no dia');
reset role;
select is(nucleo.situacao_no_dia(pg_temp.id('k1'), pg_temp.hoje()), 'PÁT', '22. a confirmada vira o realizado');
select ok((select situacao = 'confirmada' and evento_id is not null from nucleo.situacao_programada where id = current_setting('t.prog')::uuid),
  '23. a programada fica confirmada, ligada ao evento');
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.confirmar_situacao_programada(%L, %s, null)$$, current_setting('t.prog'),
  (select versao from nucleo.situacao_programada where id = current_setting('t.prog')::uuid))), '23514', '24. não se confirma duas vezes');
select set_config('t.prog2', nucleo.programar_situacao(pg_temp.id('k2'), pg_temp.hoje() + 3, 'DOp', '07:00', null)::text, true);
select is(pg_temp.erro_de(format($$select nucleo.cancelar_situacao_programada(%L, '', null)$$, current_setting('t.prog2'))),
  '23514', '25. cancelar pede o motivo');
select ok(nucleo.cancelar_situacao_programada(current_setting('t.prog2')::uuid, 'Mudou o plano', null) is not null, '26. cancela');
select is((select count(*) from nucleo.situacoes_programadas(pg_temp.hoje(), pg_temp.hoje() + 10)), 0::bigint,
  '27. a lista do período não traz a cancelada nem a confirmada');
reset role;

-- ---- corrigir o último evento ----
select set_config('t.ult', (select id::text from nucleo.evento_de_status where ativo_id = pg_temp.id('k2') and sigla = 'PÁT' and excluido_em is null order by em desc limit 1), true);
select set_config('t.ev2', pg_temp.eventos('k2')::text, true);
select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.corrigir_ultimo_evento(%L, 'x', null, null)$$, current_setting('t.ult'))),
  '42501', '28. outro gestor não corrige');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.corrigir_ultimo_evento(%L, ' ', null, null)$$, current_setting('t.ult'))),
  '23514', '29. corrigir pede o motivo');
select ok(nucleo.corrigir_ultimo_evento(current_setting('t.ult')::uuid, 'Era DOp, não PÁT', 'DOp', null) is not null,
  '30. corrige o último evento e registra a sigla certa');
reset role;
select is(nucleo.situacao_no_dia(pg_temp.id('k2'), pg_temp.hoje() - 1), 'DOp', '31. o dia passou a DOp');
select is(pg_temp.eventos('k2'), current_setting('t.ev2')::bigint + 1, '32. nada some: o evento excluído fica, com o novo ao lado');
select ok((select excluido_em is not null and length(motivo_da_exclusao) > 0 from nucleo.evento_de_status where id = current_setting('t.ult')::uuid),
  '33. o corrigido fica excluído com o motivo');

select * from finish();
rollback;
