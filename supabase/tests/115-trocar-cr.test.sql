-- V0, Trocar CR e CR com história (docs/vinculos-com-historia.md; ficha docs/fichas-de-tela/trocar-cr.md).
--  * nucleo.trocar_cr: fecha o vínculo do mesmo tipo e abre o novo NA MESMA DATA, sem buraco, sem apagar;
--    a placa segue o CR (H1): com CR de frota de outra operação, a placa muda de operação na data (a A guarda
--    a placa até a troca, a B depois). Frota e acionista convivem; dois do mesmo tipo vigentes: recusa e manda
--    escolher o vigente. Troca retroativa fica marcada "correção tardia" (H3). Versão e chave de envio.
--  * Quem troca: o gestor vigente da carteira, ou Cadastros › editar no escopo tudo (o Administrador); a
--    Diretoria não grava direto (H6). A placa sem CR que ganha CR fecha a exceção placa_sem_cr (uma vez).
--  * O vínculo CR-operação vale para todo CR (a montagem deixa de exigir CR de serviço).
--  * Leituras: crs_da_placa, historia_do_cr, placas_e_crs_da_operacao, divergencias_de_operacao.
--  * Política troca_de_cr_ler (o registro da troca), com usuário de cada perfil.
begin;
\ir apoio/como_usuario.psql
\ir apoio/transferencia.psql

select plan(40);

select pg_temp.pessoa('Gestor A', 115000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 115000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 115000003, 'administrador', false);
select pg_temp.pessoa('Dir', 115000004, 'diretoria', false);
insert into nucleo.operacao (nome) values ('Op A 115'), ('Op B 115');
create function pg_temp.op(p text) returns uuid language sql as $$ select id from nucleo.operacao where nome = p $$;
create function pg_temp.cr(p text) returns uuid language sql as $$ select id from nucleo.cr where codigo = p $$;
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (11501, 'F1-115', true, true), (11502, 'F2-115', true, true), (11503, 'F3-115', true, true),
  (11504, 'F4-115', true, true), (11505, 'F5-115', true, true), (11507, 'F7-115', true, true),
  (11508, 'F8-115', true, true), (11509, 'F9-115', true, true), (11510, 'F10-115', true, true);
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio, tipo, tipo_origem) values
  (11521, 'X1-115', true, true, 'acionista', 'informada'), (11522, 'X2-115', true, true, 'acionista', 'informada');
-- F9 e F7 estão ligados à operação B pelo vínculo CR-operação; F8 só pelo cadastro (operação A).
insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem) values
  (pg_temp.cr('F9-115'), pg_temp.op('Op B 115'), '2026-01-01 00:00-03', 'informada'),
  (pg_temp.cr('F7-115'), pg_temp.op('Op B 115'), '2026-01-01 00:00-03', 'informada');
update nucleo.cr set operacao_id = pg_temp.op('Op A 115') where codigo = 'F8-115';

create function pg_temp.cavalo(p_nome text, p_n bigint, p_placa text, p_gestor text, p_cr text) returns uuid language sql as $$
  select pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => 'cavalo', p_renavam => pg_temp.renavam(p_n), p_placa => p_placa, p_gestor_id => pg_temp.id(p_gestor),
    p_cr_id => pg_temp.cr(p_cr), p_operacao_id => pg_temp.op('Op A 115'), p_em => '2026-01-10 08:00-03'))
$$;
select pg_temp.cavalo('c1', 11501, 'FFF1151', 'Gestor A', 'F1-115');
select pg_temp.cavalo('c2', 11502, 'FFF1152', 'Gestor A', 'F2-115');
select pg_temp.cavalo('c3', 11503, 'FFF1153', 'Gestor A', 'F3-115');
select pg_temp.cavalo('c4', 11504, 'FFF1154', 'Gestor A', 'F4-115');
select pg_temp.cavalo('c5', 11505, 'FFF1155', 'Gestor A', 'F7-115');
select pg_temp.disparar();
-- c2 tem também o CR de acionista; c3 tem dois de frota (o legado); c4 ficou sem CR.
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values
  (pg_temp.id('c2'), pg_temp.cr('X1-115'), '2026-01-10 08:00-03', 'informada'),
  (pg_temp.id('c3'), pg_temp.cr('F10-115'), '2026-01-10 08:00-03', 'informada');
update nucleo.cr_do_ativo set fim = '2026-06-01 00:00-03', fim_origem = 'informada' where ativo_id = pg_temp.id('c4');
insert into nucleo.fila_de_excecoes (ativo_id, assunto, descricao) values (pg_temp.id('c4'), 'placa_sem_cr', 'Placa sem CR (teste).');
select pg_temp.disparar();

create function pg_temp.vinculo(p_nome text, p_cr text) returns nucleo.cr_do_ativo language sql as $$
  select v from nucleo.cr_do_ativo v where v.ativo_id = pg_temp.id(p_nome) and v.cr_id = pg_temp.cr(p_cr) and v.excluido_em is null
$$;

-- ---- a troca de c1: F1 (operação A) por F9 (operação B) em 12/10 ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.trocar_cr(%L, %L, '2026-10-12 00:00-03', 'Ordem de serviço', 'informada', 99, null)$$,
  pg_temp.id('c1'), pg_temp.cr('F9-115'))), '40001', '1. versão velha do vínculo: "este registro mudou"');
select is(pg_temp.erro_de(format($$select nucleo.trocar_cr(%L, %L, '2026-10-12 00:00-03', '  ', 'informada', %s, null)$$,
  pg_temp.id('c1'), pg_temp.cr('F9-115'), (pg_temp.vinculo('c1', 'F1-115')).versao)), '23514', '2. sem motivo é recusado');
select is(pg_temp.erro_de(format($$select nucleo.trocar_cr(%L, %L, '2026-10-12 00:00-03', 'Mesmo', 'informada', %s, null)$$,
  pg_temp.id('c1'), pg_temp.cr('F1-115'), (pg_temp.vinculo('c1', 'F1-115')).versao)), '23514', '3. trocar pelo mesmo CR é recusado');
select set_config('t.troca', nucleo.trocar_cr(pg_temp.id('c1'), pg_temp.cr('F9-115'), '2026-10-12 00:00-03', 'Ordem de serviço',
  'informada', (pg_temp.vinculo('c1', 'F1-115')).versao, '11500000-0000-4000-8000-000000000001')::text, true);
select is(nucleo.trocar_cr(pg_temp.id('c1'), pg_temp.cr('F9-115'), '2026-10-12 00:00-03', 'Ordem de serviço',
  'informada', 1, '11500000-0000-4000-8000-000000000001')::text, current_setting('t.troca'),
  '4. a mesma chave de envio devolve a mesma troca');
reset role;
select is((pg_temp.vinculo('c1', 'F1-115')).fim, '2026-10-12 00:00-03'::timestamptz, '5. o CR antigo fecha na data da troca');
select is((pg_temp.vinculo('c1', 'F9-115')).inicio, '2026-10-12 00:00-03'::timestamptz, '6. o novo abre na mesma data (sem buraco)');
select is((pg_temp.vinculo('c1', 'F9-115')).fim, null, '7. o novo fica vigente');
select is((select count(*) from nucleo.cr_do_ativo where ativo_id = pg_temp.id('c1')), 2::bigint, '8. nada se apaga: 2 vínculos');
select is(nucleo.operacao_em(pg_temp.id('c1'), '2026-10-11 23:00-03'), pg_temp.op('Op A 115'), '9. a operação A tem a placa até a troca');
select is(nucleo.operacao_em(pg_temp.id('c1'), '2026-10-12 00:00-03'), pg_temp.op('Op B 115'), '10. a operação B tem a placa da troca em diante');
select is((select count(*) from nucleo.placa_na_operacao where ativo_id = pg_temp.id('c1')), 2::bigint, '11. a montagem antiga continua, encerrada');
select ok((select correcao_tardia and operacao_antiga_id = pg_temp.op('Op A 115') and operacao_nova_id = pg_temp.op('Op B 115')
             and cr_antigo_id = pg_temp.cr('F1-115') and length(btrim(motivo)) > 0
             from nucleo.troca_de_cr where id = current_setting('t.troca')::uuid),
  '12. o registro da troca: retroativa (correção tardia), as duas operações, o CR antigo e o motivo');
select is(nucleo.cr_em(pg_temp.id('c1'), '2026-11-01 00:00-03'), pg_temp.cr('F9-115'), '13. o custo da data segue o CR novo');

-- ---- frota e acionista convivem; o mesmo tipo vigente duas vezes manda escolher antes ----
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(nucleo.trocar_cr(pg_temp.id('c2'), pg_temp.cr('F8-115'), '2026-11-01 00:00-03', 'Troca de frota', 'informada',
  (pg_temp.vinculo('c2', 'F2-115')).versao, null) is not null, '14. troca o de frota de c2');
reset role;
select is((pg_temp.vinculo('c2', 'X1-115')).fim, null, '15. o de acionista segue vigente (tipos diferentes convivem)');
select is((select count(*) from nucleo.placa_na_operacao where ativo_id = pg_temp.id('c2')), 1::bigint,
  '16. CR novo da mesma operação: a placa não muda de operação');
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.trocar_cr(%L, %L, '2026-11-01 00:00-03', 'x', 'informada', null, null)$$,
  pg_temp.id('c3'), pg_temp.cr('F5-115'))), '23514', '17. dois de frota vigentes: escolha o vigente antes');

-- ---- quem troca ----
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.trocar_cr(%L, %L, '2026-11-01 00:00-03', 'x', 'informada', %s, null)$$,
  pg_temp.id('c2'), pg_temp.cr('X2-115'), 1)), '42501', '18. outro gestor não troca');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is(pg_temp.erro_de(format($$select nucleo.trocar_cr(%L, %L, '2026-11-01 00:00-03', 'x', 'informada', %s, null)$$,
  pg_temp.id('c2'), pg_temp.cr('X2-115'), 1)), '42501', '19. a Diretoria não grava direto (H6)');
reset role;
select tests.como_anonimo();
select is(pg_temp.erro_de(format($$select nucleo.trocar_cr(%L, %L, '2026-11-01 00:00-03', 'x', 'informada', null, null)$$,
  pg_temp.id('c2'), pg_temp.cr('X2-115'))), '42501', '20. anon não executa');
reset role;
select set_config('t.vx1', (pg_temp.vinculo('c2', 'X1-115')).versao::text, true);
select tests.como(pg_temp.id('auth_Adm'));
select ok(nucleo.trocar_cr(pg_temp.id('c2'), pg_temp.cr('X2-115'), '2026-11-02 00:00-03', 'Acerto de cadastro', 'informada',
  current_setting('t.vx1')::int, null) is not null, '21. o Administrador (Cadastros) corrige o cadastro do CR');
reset role;
select is((pg_temp.vinculo('c2', 'X2-115')).inicio, '2026-11-02 00:00-03'::timestamptz, '22. o acionista novo abre na data');

-- ---- placa sem CR ganha CR e fecha a exceção, uma vez ----
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(nucleo.trocar_cr(pg_temp.id('c4'), pg_temp.cr('F5-115'), '2026-07-01 00:00-03', 'Vincular CR', 'informada', null, null) is not null,
  '23. placa sem CR: abre o vínculo (sem antigo para fechar)');
reset role;
select is((select count(*) from nucleo.fila_de_excecoes where ativo_id = pg_temp.id('c4') and assunto = 'placa_sem_cr' and resolvida_em is null),
  0::bigint, '24. a exceção placa_sem_cr fechou');
select is((select count(*) from nucleo.fila_de_excecoes where ativo_id = pg_temp.id('c4') and assunto = 'placa_sem_cr'),
  1::bigint, '25. fechar não apaga');

-- ---- leituras ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is((select count(*) from nucleo.crs_da_placa(pg_temp.id('c1'), true)), 2::bigint, '26. crs_da_placa com histórico: 2');
select is((select codigo from nucleo.crs_da_placa(pg_temp.id('c1'), false)), 'F9-115', '27. só vigentes: o F9');
select is((select count(*) from nucleo.troca_de_cr where ativo_id = pg_temp.id('c1')), 1::bigint, '28. troca_de_cr_ler: o gestor lê a troca da carteira');
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is((select count(*) from nucleo.crs_da_placa(pg_temp.id('c1'), true)), 0::bigint, '29. outro gestor não lê os CRs de c1');
select is((select count(*) from nucleo.troca_de_cr where ativo_id = pg_temp.id('c1')), 0::bigint, '30. nem a troca');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is((select count(*) from nucleo.troca_de_cr where ativo_id = pg_temp.id('c1')), 1::bigint, '31. a Diretoria lê a troca');
select is(jsonb_array_length(nucleo.historia_do_cr(pg_temp.cr('F9-115'))->'placas'), 1, '32. a história do CR: a placa que ele teve');
select is(jsonb_array_length(nucleo.historia_do_cr(pg_temp.cr('F9-115'))->'operacoes'), 1, '33. e a operação');
select ok(exists (select 1 from jsonb_array_elements(nucleo.placas_e_crs_da_operacao(pg_temp.op('Op A 115'), true)->'placas') p
                   where (p->>'ativo_id')::uuid = pg_temp.id('c1') and not (p->>'vigente')::boolean),
  '34. a operação A guarda c1, encerrada');
select ok(not exists (select 1 from jsonb_array_elements(nucleo.placas_e_crs_da_operacao(pg_temp.op('Op A 115'), false)->'placas') p
                       where (p->>'ativo_id')::uuid = pg_temp.id('c1')),
  '35. "só vigentes" não traz c1 na operação A');
select ok(exists (select 1 from nucleo.divergencias_de_operacao() d where d.ativo_id = pg_temp.id('c5')),
  '36. divergência: c5 está na operação A e o CR de frota dele é da B');
select ok(not exists (select 1 from nucleo.divergencias_de_operacao() d where d.ativo_id = pg_temp.id('c1')),
  '37. c1, trocado, não diverge');
reset role;

-- ---- o vínculo CR-operação vale para todo CR ----
select lives_ok($$insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem)
  values ((select id from nucleo.cr where codigo = 'F8-115'), (select id from nucleo.operacao where nome = 'Op B 115'), '2026-12-01 00:00-03', 'informada')$$,
  '38. CR de frota entra no vínculo CR-operação');

select ok(has_function_privilege('authenticated', 'nucleo.trocar_cr(uuid,uuid,timestamptz,text,config.origem_da_data,integer,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'nucleo.trocar_cr(uuid,uuid,timestamptz,text,config.origem_da_data,integer,uuid)', 'EXECUTE'),
  '39. authenticated executa, anon não');
select ok(exists (select 1 from config.funcao_executavel where assinatura like 'nucleo.trocar_cr(%'), '40. está na lista de executáveis');

select * from finish();
rollback;
