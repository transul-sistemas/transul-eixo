-- Operacional (Nível 2): os KPIs do Pátio, das Ordens e do Totem prontos no banco, e o avanço em lote.
--  * nucleo.kpis_do_operacional(): no pátio, na fila, maior espera e tempo médio no pátio (minutos), por situação,
--    ordens abertas e do dia; pela RLS e pela filial de quem consulta (Operacional › ver).
--  * nucleo.avancar_no_patio_em_lote(p_ativos, p_acao, p_motivo, p_chave): a mesma ação para várias placas, TUDO OU
--    NADA, com "X de Y" e os recusados com o motivo (como o Lançar o dia em lote). Chave de envio.
begin;
\ir apoio/como_usuario.psql
\ir apoio/transferencia.psql

select plan(16);

select pg_temp.pessoa('Gestor A', 121000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Oper N', 121000004, 'operacional', false);
select pg_temp.pessoa('Oper S', 121000005, 'operacional', false);
insert into config.filial (nome) values ('Norte 121'), ('Sul 121');
insert into nucleo.usuario_filial (usuario_id, filial_id) values
  (pg_temp.id('Oper N'), (select id from config.filial where nome = 'Norte 121')),
  (pg_temp.id('Oper S'), (select id from config.filial where nome = 'Sul 121'));
insert into nucleo.operacao (nome) values ('Op 121');
create function pg_temp.caminhao(p_nome text, p_n bigint, p_placa text) returns uuid language plpgsql as $$
begin
  insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values (p_n, 'K' || p_n, true, true);
  return pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => 'caminhao', p_renavam => pg_temp.renavam(p_n), p_placa => p_placa,
    p_gestor_id => pg_temp.id('Gestor A'), p_cr_id => (select id from nucleo.cr where codigo = 'K' || p_n),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Op 121'), p_em => '2026-01-10 08:00-03'));
end;
$$;
create function pg_temp.entregar(p_nome text, p_filial text) returns uuid language sql as $$
  select nucleo.entregar_ao_operacional(pg_temp.id(p_nome), (select id from config.filial where nome = p_filial),
    '2026-03-01 08:00-03', (select versao from nucleo.ativo where id = pg_temp.id(p_nome)))
$$;
select pg_temp.caminhao('T1', 12101, 'GGG1A21');
select pg_temp.caminhao('T2', 12102, 'GGG1A22');
select pg_temp.caminhao('T3', 12103, 'GGG1A23');
select pg_temp.disparar();
select pg_temp.entregar('T1', 'Norte 121');
select pg_temp.entregar('T2', 'Norte 121');
select pg_temp.entregar('T3', 'Sul 121');
select pg_temp.disparar();

-- ---- KPIs ----
select tests.como(pg_temp.id('auth_Oper N'));
select is((nucleo.kpis_do_operacional()->>'no_patio')::int, 2, '1. no pátio: só as placas da filial de quem consulta');
select is((nucleo.kpis_do_operacional()->>'na_fila')::int, 0, '2. ninguém na fila ainda');
select is(nucleo.kpis_do_operacional()->>'maior_espera_min', null, '3. sem fila, sem maior espera (nunca 0 inventado)');
select ok((nucleo.kpis_do_operacional()->>'tempo_medio_no_patio_min')::numeric > 0, '4. tempo médio no pátio, em minutos, pronto no banco');
select is((nucleo.kpis_do_operacional()->'por_situacao'->>'DOp')::int, 2, '5. por situação (DOp)');
select nucleo.registrar_chegada('GGG1A21', now() - interval '30 minutes', null);
select is((nucleo.kpis_do_operacional()->>'na_fila')::int, 1, '6. a chegada no totem entra na fila');
select ok((nucleo.kpis_do_operacional()->>'maior_espera_min')::numeric >= 29, '7. a maior espera conta desde a chegada');
select is((nucleo.kpis_do_operacional()->>'ordens_abertas')::int, 0, '8. ordens abertas');
reset role;
select tests.como(pg_temp.id('auth_Oper S'));
select is((nucleo.kpis_do_operacional()->>'no_patio')::int, 1, '9. a outra filial vê o seu pátio');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.kpis_do_operacional()$$), '42501', '10. quem não vê o Operacional não lê os KPIs');
reset role;

-- ---- lote ----
select tests.como(pg_temp.id('auth_Oper N'));
select set_config('t.lote', nucleo.avancar_no_patio_em_lote(array[pg_temp.id('T1'), pg_temp.id('T3')], 'aceitar', null,
  '12100000-0000-4000-8000-000000000001')::text, true);
select is((current_setting('t.lote')::jsonb->>'avancados')::int, 0, '11. tudo ou nada: a placa de outra filial recusa o lote');
select ok(exists (select 1 from jsonb_array_elements(current_setting('t.lote')::jsonb->'recusados') r
                   where r->>'ativo_id' = pg_temp.id('T3')::text and length(r->>'motivo') > 0), '12. o recusado vem com o motivo');
select is(nucleo.situacao_atual(pg_temp.id('T1')), 'DOp', '13. nada foi gravado em T1');
select is((nucleo.avancar_no_patio_em_lote(array[pg_temp.id('T1'), pg_temp.id('T2')], 'aceitar', null,
  '12100000-0000-4000-8000-000000000002')->>'avancados')::int, 2, '14. "2 de 2" aceitas');
select ok((nucleo.avancar_no_patio_em_lote(array[pg_temp.id('T1'), pg_temp.id('T2')], 'aceitar', null,
  '12100000-0000-4000-8000-000000000002')->>'repetido')::boolean, '15. a mesma chave não avança de novo');
select is(pg_temp.erro_de($$select nucleo.avancar_no_patio_em_lote(array[]::uuid[], 'aceitar', null, null)$$), '22023', '16. lote vazio é recusado');
reset role;

select * from finish();
rollback;
