-- S4, Baixa de placa com quatro olhos (inventário 10; plano S4). Por motivo, sem sigla nova (Alexandre):
-- venda e devolução gravam VND; sucata e sinistro gravam SUC (hipótese registrada em docs/decisoes.md).
--  * nucleo.pedir_baixa: só o gestor vigente da carteira; motivo e justificativa obrigatórios; transferência em
--    andamento ou pedido aberto bloqueiam. A placa continua ativa até a aprovação.
--  * nucleo.aprovar_baixa: só a Diretoria, e QUEM PEDE NÃO APROVA; grava a baixa (nucleo.registrar_baixa) e
--    encerra na data o vínculo com o CR e a montagem na operação; nada se apaga. Versão e chave de envio.
--  * nucleo.recusar_baixa (motivo) e nucleo.cancelar_pedido_de_baixa (só quem pediu, enquanto pedida).
--  * Política pedido_de_baixa_ler, com usuário de cada perfil.
begin;
\ir apoio/como_usuario.psql
\ir apoio/transferencia.psql

select plan(41);

select pg_temp.pessoa('Gestor A', 116000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 116000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Dir G', 116000003, 'diretoria', true);
select pg_temp.pessoa('Dir 2', 116000004, 'diretoria', false);
select pg_temp.pessoa('Adm', 116000005, 'administrador', false);
insert into nucleo.operacao (nome) values ('Op 116');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (11601, 'K116A', true, true), (11602, 'K116B', true, true), (11603, 'K116C', true, true), (11604, 'K116D', true, true);
create function pg_temp.cavalo(p_nome text, p_n bigint, p_placa text, p_gestor text, p_cr text) returns uuid language sql as $$
  select pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => 'cavalo', p_renavam => pg_temp.renavam(p_n), p_placa => p_placa, p_gestor_id => pg_temp.id(p_gestor),
    p_cr_id => (select id from nucleo.cr where codigo = p_cr),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Op 116'), p_em => '2026-01-10 08:00-03'))
$$;
select pg_temp.cavalo('c1', 11601, 'FFF1161', 'Gestor A', 'K116A');
select pg_temp.cavalo('c2', 11602, 'FFF1162', 'Gestor A', 'K116B');
select pg_temp.cavalo('c3', 11603, 'FFF1163', 'Dir G', 'K116C');
select pg_temp.cavalo('c4', 11604, 'FFF1164', 'Gestor A', 'K116D');
select pg_temp.disparar();
-- c2 está sendo enviada a outro gestor (transferência em andamento).
select tests.como(pg_temp.id('auth_Gestor A'));
select nucleo.disponibilizar_placa(pg_temp.id('c2'), pg_temp.id('Gestor B'), 'Troca de carteira', '{}',
  (select versao from nucleo.ativo where id = pg_temp.id('c2')));
reset role;

create function pg_temp.pedido(p_nome text) returns nucleo.pedido_de_baixa language sql as $$
  select p from nucleo.pedido_de_baixa p where p.ativo_id = pg_temp.id(p_nome) order by p.pedido_em desc, p.id limit 1
$$;

-- ---- motivo e sigla ----
select is(nucleo.sigla_da_baixa('venda'), 'VND', '1. venda grava VND');
select is(nucleo.sigla_da_baixa('devolucao'), 'VND', '2. devolução grava VND (sem sigla nova)');
select is(nucleo.sigla_da_baixa('sucata'), 'SUC', '3. sucata grava SUC');
select is(nucleo.sigla_da_baixa('sinistro'), 'SUC', '4. sinistro grava SUC (sem sigla nova)');

-- ---- pedir ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.pedir_baixa(%L, 'venda', '2026-11-01 00:00-03', ' ', null, null)$$, pg_temp.id('c1'))),
  '23514', '5. sem justificativa é recusado');
select is(pg_temp.erro_de(format($$select nucleo.pedir_baixa(%L, 'doacao', '2026-11-01 00:00-03', 'x', null, null)$$, pg_temp.id('c1'))),
  '23514', '6. motivo fora da lista é recusado');
select is(pg_temp.erro_de(format($$select nucleo.pedir_baixa(%L, 'venda', '2026-11-01 00:00-03', 'Venda do cavalo', null, null)$$, pg_temp.id('c2'))),
  '23514', '7. transferência em andamento bloqueia o pedido');
select ok(nucleo.pedir_baixa(pg_temp.id('c1'), 'venda', '2026-11-01 00:00-03', 'Venda do cavalo', 'baixas/c1/contrato.pdf',
  '11600000-0000-4000-8000-000000000001') is not null, '8. o gestor pede a baixa');
select is(nucleo.pedir_baixa(pg_temp.id('c1'), 'venda', '2026-11-01 00:00-03', 'Venda do cavalo', 'baixas/c1/contrato.pdf',
  '11600000-0000-4000-8000-000000000001'), (pg_temp.pedido('c1')).id, '9. a mesma chave devolve o mesmo pedido');
select is(pg_temp.erro_de(format($$select nucleo.pedir_baixa(%L, 'venda', '2026-11-01 00:00-03', 'De novo', null, null)$$, pg_temp.id('c1'))),
  '23514', '10. um pedido aberto por placa');
reset role;
select is((select count(*) from nucleo.baixa_do_ativo where ativo_id = pg_temp.id('c1')), 0::bigint, '11. até aprovar, a placa continua ativa');
select is((pg_temp.pedido('c1')).situacao, 'pedida', '12. o pedido fica "pedida" (baixa pedida)');

select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.pedir_baixa(%L, 'venda', '2026-11-01 00:00-03', 'x', null, null)$$, pg_temp.id('c4'))),
  '42501', '13. outro gestor não pede');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.erro_de(format($$select nucleo.pedir_baixa(%L, 'venda', '2026-11-01 00:00-03', 'x', null, null)$$, pg_temp.id('c4'))),
  '42501', '14. o Administrador não pede em nome do gestor (H5)');
reset role;

-- ---- aprovar: só a Diretoria, quem pede não aprova ----
select set_config('t.v1', (pg_temp.pedido('c1')).versao::text, true);
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.aprovar_baixa(%L, %s, null)$$, (pg_temp.pedido('c1')).id, current_setting('t.v1'))),
  '42501', '15. o gestor não aprova');
reset role;
select set_config('t.p1', (pg_temp.pedido('c1')).id::text, true);
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.erro_de(format($$select nucleo.aprovar_baixa(%L, %s, null)$$, current_setting('t.p1'), current_setting('t.v1'))),
  '42501', '16. o Administrador não aprova');
reset role;
select tests.como(pg_temp.id('auth_Dir G'));
select ok(nucleo.pedir_baixa(pg_temp.id('c3'), 'sucata', '2026-11-01 00:00-03', 'Sucata', null, null) is not null,
  '17. a pessoa da Diretoria que é gestora da placa pede a baixa dela');
select is(pg_temp.erro_de(format($$select nucleo.aprovar_baixa(%L, %s, null)$$, (pg_temp.pedido('c3')).id, (pg_temp.pedido('c3')).versao)),
  '42501', '18. quem pede não aprova (quatro olhos)');
reset role;
select tests.como(pg_temp.id('auth_Dir 2'));
select is(pg_temp.erro_de(format($$select nucleo.aprovar_baixa(%L, 99, null)$$, current_setting('t.p1'))),
  '40001', '19. versão velha: "este registro mudou"');
select is(nucleo.aprovar_baixa(current_setting('t.p1')::uuid, current_setting('t.v1')::int, '11600000-0000-4000-8000-000000000002'),
  current_setting('t.p1')::uuid, '20. outra pessoa da Diretoria aprova');
select is(pg_temp.erro_de(format($$select nucleo.aprovar_baixa(%L, %s, null)$$, current_setting('t.p1'), current_setting('t.v1')::int + 1)),
  '23514', '21. pedido já decidido não se aprova de novo');
reset role;
select is((select sigla from nucleo.baixa_do_ativo where ativo_id = pg_temp.id('c1') and excluido_em is null), 'VND', '22. a baixa gravou VND');
select is(nucleo.situacao_em(pg_temp.id('c1'), '2026-11-01 00:00-03'), 'VND', '23. a situação na data é VND');
select is((select fim from nucleo.cr_do_ativo where ativo_id = pg_temp.id('c1') and excluido_em is null),
  '2026-11-01 00:00-03'::timestamptz, '24. o vínculo com o CR encerra na data');
select is((select fim from nucleo.placa_na_operacao where ativo_id = pg_temp.id('c1') and excluido_em is null),
  '2026-11-01 00:00-03'::timestamptz, '25. a operação deixa de contar a placa na data');
select is(nucleo.operacao_em(pg_temp.id('c1'), '2026-10-31 12:00-03'), (select id from nucleo.operacao where nome = 'Op 116'),
  '26. antes da data a placa continua na operação');
select is((select count(*) from nucleo.cr_do_ativo where ativo_id = pg_temp.id('c1')), 1::bigint, '27. nada se apaga (encerrar não é excluir)');
select ok((select situacao = 'aprovada' and decidido_por = pg_temp.id('Dir 2') from nucleo.pedido_de_baixa where id = current_setting('t.p1')::uuid),
  '28. o pedido fica aprovado, com quem aprovou');

-- ---- recusar e cancelar ----
select tests.como(pg_temp.id('auth_Dir 2'));
select is(pg_temp.erro_de(format($$select nucleo.recusar_baixa(%L, '', %s, null)$$, (pg_temp.pedido('c3')).id, (pg_temp.pedido('c3')).versao)),
  '23514', '29. recusar pede o motivo');
select ok(nucleo.recusar_baixa((pg_temp.pedido('c3')).id, 'Falta o laudo', (pg_temp.pedido('c3')).versao, null) is not null, '30. a Diretoria recusa');
reset role;
select is((pg_temp.pedido('c3')).situacao, 'recusada', '31. o pedido fica recusado');
select is((select count(*) from nucleo.baixa_do_ativo where ativo_id = pg_temp.id('c3')), 0::bigint, '32. a placa recusada segue ativa');
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(nucleo.pedir_baixa(pg_temp.id('c4'), 'sinistro', '2026-11-05 00:00-03', 'Sinistro na rodovia', null, null) is not null, '33. pede a baixa de c4');
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.cancelar_pedido_de_baixa(%L, null)$$, (select id from nucleo.pedido_de_baixa limit 0))),
  '42501', '34. pedido que não se enxerga não se cancela');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(nucleo.cancelar_pedido_de_baixa((pg_temp.pedido('c4')).id, null) is not null, '35. quem pediu cancela');
select is((pg_temp.pedido('c4')).situacao, 'cancelada', '36. o pedido fica cancelado');
select ok(nucleo.pedir_baixa(pg_temp.id('c4'), 'sinistro', '2026-11-05 00:00-03', 'Sinistro na rodovia', null, null) is not null,
  '37. depois de cancelado, pede de novo');
select is((select count(*) from nucleo.pedido_de_baixa where ativo_id = pg_temp.id('c4')), 2::bigint, '38. pedido_de_baixa_ler: o gestor lê os pedidos da carteira');
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is((select count(*) from nucleo.pedido_de_baixa where ativo_id = pg_temp.id('c4')), 0::bigint, '39. outro gestor não lê');
reset role;
select tests.como(pg_temp.id('auth_Dir 2'));
select ok(exists (select 1 from nucleo.pedidos_de_baixa('pedida') p where p.ativo_id = pg_temp.id('c4') and p.sigla = 'SUC'),
  '40. a Diretoria vê o pedido aberto para aprovar, com a sigla');
select ok((nucleo.impacto_da_baixa(pg_temp.id('c2'), now())->>'transferencia_aberta')::boolean, '41. o impacto mostra a transferência em andamento');
reset role;

select * from finish();
rollback;
