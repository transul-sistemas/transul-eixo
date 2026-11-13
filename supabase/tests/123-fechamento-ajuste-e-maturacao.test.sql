-- Resultados (Nível 2), na forma mais simples (inventário 34, 35 e 36):
--  * Fechar o mês (nucleo.fechar_mes): só a Diretoria, só mês cujo corte já passou; grava a FOTO (os totais da
--    Visão geral e o resultado por operação naquele momento), que não muda depois. Fechar de novo não duplica.
--  * Reabrir o mês (nucleo.reabrir_mes): só a Diretoria, com motivo; a foto fica no histórico; reabrir de novo não
--    muda nada (roda duas vezes). Fechar depois de reabrir grava uma foto nova.
--  * Fechamentos (nucleo.fechamentos_do_resultado): meses fechados, último fechamento, diferença contra o vivo e
--    reaberturas, prontos no banco.
--  * Pedir ajuste (nucleo.pedir_ajuste) com Resultados › criar; decidir (nucleo.decidir_ajuste) só a Diretoria e
--    QUEM PEDE NÃO DECIDE. O fato importado nunca é editado. Leitura nucleo.ajustes_do_resultado com os KPIs.
--  * Maturação (nucleo.maturacao_da_divida): negociado, pago, saldo e quitado dos títulos do período (parâmetros).
--  * Políticas fechamento_do_mes_ler e ajuste_ler (Resultados › ver), com usuário de cada perfil.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(32);

select pg_temp.pessoa('Dir 2', 940000009, 'diretoria', false);

-- ---- fechar ----
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.erro_de($$select nucleo.fechar_mes('2026-03-01', null)$$), '42501', '1. só a Diretoria fecha o mês');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is(pg_temp.erro_de(format($$select nucleo.fechar_mes(%L, null)$$, date_trunc('month', nucleo.hoje_em_sao_paulo())::date)),
  '23514', '2. o mês em curso não fecha (o corte ainda não passou)');
select set_config('t.f1', nucleo.fechar_mes('2026-03-01', null)::text, true);
select is(nucleo.fechar_mes('2026-03-01', null)::text, current_setting('t.f1'), '3. fechar de novo não duplica (roda duas vezes)');
select is((select (foto->'por_operacao'->'kpis'->>'receita')::numeric from financeiro.fechamento_do_mes where id = current_setting('t.f1')::uuid),
  6000.00, '4. a foto guarda o resultado por operação do momento');
select is((nucleo.fechamentos_do_resultado()->'kpis'->>'fechados')::int, 1, '5. um mês fechado');
select is((nucleo.fechamentos_do_resultado()->'kpis'->>'diferenca_contra_o_vivo')::numeric, 0.00, '6. sem mudança, a foto bate com o vivo');
reset role;
insert into staging.viagem (nunota, codcencus, dt_negociacao, tipo_documento, status_cte, frete_empresa)
values (941001, '9401', '2026-03-20', 'CTE', 'A', 100.00);
select tests.como(pg_temp.id('auth_Dir'));
select is((nucleo.fechamentos_do_resultado()->'kpis'->>'diferenca_contra_o_vivo')::numeric, 100.00,
  '7. o fato que chegou depois aparece como diferença contra o vivo; a foto não muda');
select is(pg_temp.erro_de($$select nucleo.reabrir_mes('2026-03-01', ' ', null)$$), '23514', '8. reabrir pede o motivo');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.erro_de($$select nucleo.reabrir_mes('2026-03-01', 'Nota atrasada', null)$$), '42501', '9. só a Diretoria reabre');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select lives_ok($$select nucleo.reabrir_mes('2026-03-01', 'Nota atrasada', null)$$, '10. a Diretoria reabre com o motivo');
select lives_ok($$select nucleo.reabrir_mes('2026-03-01', 'Nota atrasada', null)$$, '11. reabrir de novo não muda nada');
select is((nucleo.fechamentos_do_resultado()->'kpis'->>'reaberturas')::int, 1, '12. uma reabertura, com a foto no histórico');
select is((nucleo.fechamentos_do_resultado()->'kpis'->>'fechados')::int, 0, '13. o mês reaberto não conta como fechado');
select ok(nucleo.fechar_mes('2026-03-01', null)::text <> current_setting('t.f1'), '14. fechar depois de reabrir grava uma foto nova');
reset role;
select is((select count(*) from financeiro.fechamento_do_mes where mes = '2026-03-01'), 2::bigint, '15. nada some: a foto antiga e a nova');
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.erro_de($$select nucleo.fechamentos_do_resultado()$$), '42501', '16. sem Resultados › ver, sem fechamentos');
select is(pg_temp.erro_de($$select nucleo.pedir_ajuste('2026-03-01', null, null, 'receita', 10, 'x', null)$$), '42501', '17. sem Resultados › criar, sem ajuste');
reset role;

-- ---- ajustes ----
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.erro_de(format($$select nucleo.pedir_ajuste('2026-03-01', %L, null, 'custo_frota', -150, ' ', null)$$, pg_temp.id('graos'))),
  '23514', '18. o ajuste pede a justificativa');
select is(pg_temp.erro_de(format($$select nucleo.pedir_ajuste('2026-03-01', %L, null, 'custo_frota', 0, 'x', null)$$, pg_temp.id('graos'))),
  '22023', '19. ajuste de valor zero é recusado');
select set_config('t.a1', nucleo.pedir_ajuste('2026-03-01', pg_temp.id('graos'), null, 'custo_frota', -150.00, 'Nota lançada em dobro', null)::text, true);
reset role;
select tests.como(pg_temp.id('auth_Dir 2'));
select set_config('t.a2', nucleo.pedir_ajuste('2026-03-01', pg_temp.id('cimento'), null, 'receita', 80.00, 'Frete sem CT-e', null)::text, true);
select is(pg_temp.erro_de(format($$select nucleo.decidir_ajuste(%L, 1, 'aprovado', null, null)$$, current_setting('t.a2'))), '42501',
  '20. quem pede não decide');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select lives_ok(format($$select nucleo.decidir_ajuste(%L, 1, 'aprovado', null, null)$$, current_setting('t.a1')), '21. a Diretoria aprova');
select lives_ok(format($$select nucleo.decidir_ajuste(%L, 1, 'aprovado', null, null)$$, current_setting('t.a1')), '22. aprovar de novo não muda nada');
select is(pg_temp.erro_de(format($$select nucleo.decidir_ajuste(%L, 1, 'recusado', ' ', null)$$, current_setting('t.a2'))), '23514',
  '23. recusar pede o motivo');
select is((nucleo.ajustes_do_resultado('2026-03-01', null, 1, 50)->'kpis'->>'pendentes')::int, 1, '24. pendentes de aprovação');
select is((nucleo.ajustes_do_resultado('2026-03-01', null, 1, 50)->'kpis'->>'valor_ajustado')::numeric, -150.00, '25. valor ajustado (aprovados do mês)');
select is((select (foto->'por_operacao'->'kpis'->>'custo_frota')::numeric from financeiro.fechamento_do_mes
            where mes = '2026-03-01' and situacao = 'fechado'), 400.00, '26. o ajuste não edita o fato nem a foto');
reset role;

-- ---- maturação ----
update config.parametro set valor = '2026-02-01' where chave = 'maturacao_inicio';
update config.parametro set valor = '2026-04-01' where chave = 'maturacao_fim';
update staging.despesa set baixado = true, dhbaixa = '2026-04-05 10:00-03' where origem_id = 'd94-3';
select tests.como(pg_temp.id('auth_Dir'));
select is((nucleo.maturacao_da_divida(1, 50)->'kpis'->>'negociado')::numeric, 1370.00, '27. negociado: os títulos do período, sem provisão e sem invalidado');
select is((nucleo.maturacao_da_divida(1, 50)->'kpis'->>'pago')::numeric, 600.00, '28. pago: os baixados');
select is((nucleo.maturacao_da_divida(1, 50)->'kpis'->>'percentual')::numeric, 43.8, '29. quitado, com uma casa');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.erro_de($$select nucleo.maturacao_da_divida(1, 50)$$), '42501', '30. sem Resultados › ver, sem maturação');
select is((select count(*) from financeiro.ajuste) + (select count(*) from financeiro.fechamento_do_mes), 0::bigint,
  '31. ajuste_ler e fechamento_do_mes_ler: o Operacional não lê');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is((select count(*) from financeiro.ajuste) + (select count(*) from financeiro.fechamento_do_mes), 4::bigint,
  '32. ajuste_ler e fechamento_do_mes_ler: o Administrador (Resultados › ver) lê');
reset role;

select * from finish();
rollback;
