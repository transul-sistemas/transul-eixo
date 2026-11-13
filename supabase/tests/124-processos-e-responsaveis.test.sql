-- Administração (Nível 3), na forma mais simples (inventário 32, 33 e 37; docs/gerenciador-de-processos.md):
--  * config.processo: o catálogo de processos com o perfil responsável (a fila) e o prazo em horas; só o
--    Administrador cadastra e edita (nucleo.salvar_processo, com versão).
--  * nucleo.tarefas_abertas(): as tarefas NASCEM dos estados das tabelas de negócio (transferência, baixa
--    pedida, ajuste pedido, exceção aberta, pedido de aprovação), sem reescrevê-las; o prazo vem do processo.
--  * Reatribuir tarefa (32): só o Administrador (H5), com motivo; reatribuir de novo FECHA a reatribuição
--    anterior (roda duas vezes e confere as contagens).
--  * Delegar (33): a pessoa delega as próprias tarefas por um período [início, fim), sem sobreposição;
--    alterar a delegação muda o fim; fim no início cancela (exclusão lógica). A delegada vê as tarefas.
--  * Pedir aprovação (37): qualquer pessoa com login pede; só a Diretoria decide e quem pede não decide.
--  * Leituras no contrato único das telas de painel: nucleo.painel_de_processos e
--    nucleo.processos_e_responsaveis (Administração › ver).
--  * Políticas processo_ler, reatribuicao_de_tarefa_ler, delegacao_ler e pedido_de_aprovacao_ler.
begin;
\ir apoio/como_usuario.psql
\ir apoio/operacoes_ficticias.psql

select plan(47);

select pg_temp.pessoa('Gestor B', 940000011, 'gestor_de_frota', true);
select pg_temp.pessoa('Dir 2', 940000012, 'diretoria', false);

-- ---- catálogo ----
select is((select perfil_responsavel from config.processo where codigo = 'transferencia_de_placa'), 'gestor_de_frota',
  '1. o catálogo nasce com a transferência de placa, do Gestor de frota');
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.salvar_processo('teste_124', 'Teste 124', null, 'diretoria', 24, true, null, null)$$),
  '42501', '2. só o Administrador cadastra processo');
select ok((select count(*) from config.processo) > 0, '3. processo_ler: quem tem login lê o catálogo');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(nucleo.salvar_processo('teste_124', 'Teste 124', 'Um processo de teste', 'diretoria', 24, true, null, null), 'teste_124',
  '4. o Administrador cadastra o processo');
select is(pg_temp.erro_de($$select nucleo.salvar_processo('teste_124', 'Teste 124', null, 'diretoria', 24, true, null, null)$$),
  '23505', '5. o mesmo código não nasce duas vezes');
select lives_ok($$select nucleo.salvar_processo('teste_124', 'Teste 124', null, 'operacional', 48, true, 1, null)$$,
  '6. editar o processo com a versão');
select is(pg_temp.erro_de($$select nucleo.salvar_processo('teste_124', 'Teste 124', null, 'operacional', 72, true, 1, null)$$),
  '40001', '7. versão velha: o processo mudou');
select is(pg_temp.erro_de($$select nucleo.salvar_processo('teste_124', 'Teste 124', null, 'operacional', 0, true, 2, null)$$),
  '23514', '8. o prazo é de pelo menos uma hora');
select is((nucleo.processos_e_responsaveis(null, null, null, 1, 20)->'tabela'->>'total')::int,
  (select count(*)::int from config.processo), '9. Processos e responsáveis: a tabela tem todos os processos');
reset role;

-- ---- tarefas nascem dos estados ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.pedir_aprovacao('mes_fechado', 'curto', '2026-03', null)$$), '23514',
  '10. o pedido de aprovação explica o que se pede (10 a 500 caracteres)');
select set_config('t.ap1', nucleo.pedir_aprovacao('mes_fechado', 'Lançar nota atrasada de março', '2026-03', null)::text, true);
select is(nucleo.pedir_aprovacao('mes_fechado', 'Lançar nota atrasada de março', '2026-03', '00000000-0000-0000-0000-000000000124')::text,
  nucleo.pedir_aprovacao('mes_fechado', 'Lançar nota atrasada de março', '2026-03', '00000000-0000-0000-0000-000000000124')::text,
  '11. a chave de envio não duplica o pedido');
select is(pg_temp.erro_de($$select nucleo.painel_de_processos(null, null, null, 1, 20)$$), '42501',
  '12. sem Administração › ver, sem Painel de processos');
select is((nucleo.minhas_tarefas()->>'total')::int, 0, '13. o pedido não é tarefa de quem pediu');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select set_config('t.aj1', nucleo.pedir_ajuste('2026-03-01', pg_temp.id('graos'), null, 'receita', 10, 'Frete sem CT-e', null)::text, true);
select is((select count(*)::int from jsonb_array_elements(nucleo.painel_de_processos(null, null, null, 1, 20)->'kpis') k
            where k->>'id' = 'abertas'
              and (k->>'valor')::int = 3 + (select count(*)::int from nucleo.fila_de_excecoes where resolvida_em is null)), 1,
  '14. Painel de processos: dois pedidos de aprovação e um ajuste abertos, mais as exceções abertas');
select is((select (c->>'contagem')::int from jsonb_array_elements(nucleo.painel_de_processos(null, null, null, 1, 20)->'chips') c
            where c->>'id' = 'pedido_de_aprovacao'), 2, '15. o chip conta as tarefas do processo');
select is((nucleo.painel_de_processos(null, 'ajuste_do_resultado', null, 1, 20)->'tabela'->>'total')::int, 1,
  '16. o chip filtra a tabela');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is((nucleo.minhas_tarefas()->>'total')::int, 3, '17. a fila da Diretoria: as três tarefas');

-- ---- reatribuir ----
select is(pg_temp.erro_de(format($$select nucleo.reatribuir_tarefa('pedido_de_aprovacao', %L, %L, 'Férias', null)$$,
  current_setting('t.ap1'), pg_temp.id('Gestor B'))), '42501', '18. só o Administrador reatribui (H5)');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.erro_de(format($$select nucleo.reatribuir_tarefa('pedido_de_aprovacao', %L, %L, ' ', null)$$,
  current_setting('t.ap1'), pg_temp.id('Dir 2'))), '23514', '19. reatribuir pede o motivo');
select is(pg_temp.erro_de(format($$select nucleo.reatribuir_tarefa('pedido_de_aprovacao', %L, %L, 'Sem dono', null)$$,
  gen_random_uuid(), pg_temp.id('Dir 2'))), 'P0002', '20. tarefa que não está aberta não se reatribui');
select set_config('t.r1', nucleo.reatribuir_tarefa('pedido_de_aprovacao', current_setting('t.ap1'), pg_temp.id('Dir 2'), 'Cobre a Diretoria', null)::text, true);
select is(nucleo.reatribuir_tarefa('pedido_de_aprovacao', current_setting('t.ap1'), pg_temp.id('Dir 2'), 'Cobre a Diretoria', null)::text,
  current_setting('t.r1'), '21. reatribuir à mesma pessoa de novo não muda nada');
reset role;
select is((select count(*)::int from nucleo.reatribuicao_de_tarefa), 1, '22. uma reatribuição, aberta');
select tests.como(pg_temp.id('auth_Dir 2'));
select is((select count(*)::int from jsonb_array_elements(nucleo.minhas_tarefas()->'linhas') l where l->>'origem' = 'minha'), 1,
  '23. a tarefa reatribuída é dela');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is((nucleo.minhas_tarefas()->>'total')::int, 2, '24. sai da fila da Diretoria');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select lives_ok(format($$select nucleo.reatribuir_tarefa('pedido_de_aprovacao', %L, %L, 'Volta à Diretoria', null)$$,
  current_setting('t.ap1'), pg_temp.id('Dir')), '25. reatribuir a outra pessoa');
select lives_ok(format($$select nucleo.reatribuir_tarefa('pedido_de_aprovacao', %L, %L, 'Volta à Diretoria', null)$$,
  current_setting('t.ap1'), pg_temp.id('Dir')), '26. ... duas vezes');
reset role;
select is((select count(*)::int from nucleo.reatribuicao_de_tarefa where encerrada_em is null), 1,
  '27. reatribuir de novo fecha a anterior: uma aberta');
select is((select count(*)::int from nucleo.reatribuicao_de_tarefa where encerrada_em is not null), 1, '28. ... e uma fechada, com motivo');
select is((select count(*)::int from nucleo.reatribuicao_de_tarefa), 2, '29. ... nada apagado: duas linhas');

-- ---- delegar ----
select tests.como(pg_temp.id('auth_Dir'));
select is(pg_temp.erro_de(format($$select nucleo.delegar_tarefas(%L, nucleo.hoje_em_sao_paulo(), nucleo.hoje_em_sao_paulo() + 5, null, 'Férias', null, null)$$,
  pg_temp.id('Dir'))), '22023', '30. não se delega a si mesmo');
select set_config('t.d1', nucleo.delegar_tarefas(pg_temp.id('Gestor B'), nucleo.hoje_em_sao_paulo(), nucleo.hoje_em_sao_paulo() + 5,
  null, 'Férias', null, null)::text, true);
select is(pg_temp.erro_de(format($$select nucleo.delegar_tarefas(%L, nucleo.hoje_em_sao_paulo() + 2, nucleo.hoje_em_sao_paulo() + 9, null, 'Férias', null, null)$$,
  pg_temp.id('Dir 2'))), '23P01', '31. duas delegações no mesmo período não se sobrepõem');
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is((select count(*)::int from jsonb_array_elements(nucleo.minhas_tarefas()->'linhas') l where l->>'origem' = 'delegada'), 1,
  '32. quem recebe a delegação vê a tarefa da pessoa delegante');
select is((select count(*)::int from nucleo.delegacao), 1, '33. delegacao_ler: a delegada lê a delegação');
select is(pg_temp.erro_de(format($$select nucleo.alterar_delegacao(%L, 1, nucleo.hoje_em_sao_paulo() + 1, 'x', null)$$,
  current_setting('t.d1'))), '42501', '34. só quem delegou (ou o Administrador) altera');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select lives_ok(format($$select nucleo.alterar_delegacao(%L, 1, nucleo.hoje_em_sao_paulo(), 'Voltei antes', null)$$,
  current_setting('t.d1')), '35. fim no início cancela a delegação');
select lives_ok(format($$select nucleo.alterar_delegacao(%L, 2, nucleo.hoje_em_sao_paulo(), 'Voltei antes', null)$$,
  current_setting('t.d1')), '36. ... duas vezes, sem mudar nada');
reset role;
select is((select count(*)::int from nucleo.delegacao where excluido_em is not null), 1, '37. a delegação cancelada fica, com motivo');
select tests.como(pg_temp.id('auth_Gestor B'));
select is((nucleo.minhas_tarefas()->>'total')::int, 0, '38. sem delegação vigente, sem a tarefa');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select lives_ok(format($$select nucleo.delegar_tarefas(%L, nucleo.hoje_em_sao_paulo() + 1, nucleo.hoje_em_sao_paulo() + 5, null, 'Viagem', null, null)$$,
  pg_temp.id('Gestor B')), '38a. delegação que começa amanhã');
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is((nucleo.minhas_tarefas()->>'total')::int, 0, '38b. a delegação futura ainda não vale hoje');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select set_config('t.ap3', nucleo.pedir_aprovacao('permissao', 'Acesso à Conciliação por um mês', null, null)::text, true);
select is(pg_temp.erro_de(format($$select nucleo.decidir_aprovacao(%L, 1, 'aprovado', null, null)$$, current_setting('t.ap3'))), '42501',
  '38c. a Diretoria que pede não decide o próprio pedido');
reset role;

-- ---- decidir a aprovação ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.decidir_aprovacao(%L, 1, 'aprovado', null, null)$$, current_setting('t.ap1'))), '42501',
  '39. só a Diretoria decide');
select is((select count(*)::int from nucleo.pedido_de_aprovacao), 2, '40. pedido_de_aprovacao_ler: quem pediu lê os seus');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select lives_ok(format($$select nucleo.decidir_aprovacao(%L, 1, 'aprovado', null, null)$$, current_setting('t.ap1')), '41. a Diretoria aprova');
select is((select count(*)::int from jsonb_array_elements(nucleo.minhas_tarefas()->'linhas') l where l->>'tarefa_id' = current_setting('t.ap1')), 0,
  '42. a tarefa aprovada sai da caixa (e a reatribuição fica no histórico)');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is((select count(*) from nucleo.pedido_de_aprovacao) + (select count(*) from nucleo.reatribuicao_de_tarefa)
          + (select count(*) from nucleo.delegacao), 0::bigint,
  '43. pedido_de_aprovacao_ler, reatribuicao_de_tarefa_ler e delegacao_ler: o Operacional não lê os de outros');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is((select count(*) from nucleo.reatribuicao_de_tarefa) + (select count(*) from nucleo.delegacao), 4::bigint,
  '44. o Administrador lê as reatribuições e as delegações');
reset role;

select * from finish();
rollback;
