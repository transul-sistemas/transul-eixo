-- Meu dia, rodada 2: a placa aceita sem CR vigente vira a exceção "placa_sem_cr" na fila.
-- nucleo.registrar_placa_aceita_sem_cr(pedido, chave): só o gestor de destino, só com o pedido
-- concluído; abre a exceção (uma aberta por placa) quando a placa não tem CR vigente e FECHA a aberta
-- quando passou a ter (nada se apaga: a exceção resolvida fica com a resolução). Idempotente: rodar
-- duas vezes não muda as contagens; a mesma chave de envio devolve o mesmo resultado. Sempre com a
-- chave do usuário de cada perfil, nunca com a service_role.
begin;
\ir apoio/como_usuario.psql
\ir apoio/transferencia.psql

select plan(34);

create function pg_temp.abertas(p_nome text) returns bigint language sql as $$
  select count(*) from nucleo.fila_de_excecoes
   where ativo_id = pg_temp.id(p_nome) and assunto = 'placa_sem_cr' and resolvida_em is null
$$;
create function pg_temp.todas(p_nome text) returns bigint language sql as $$
  select count(*) from nucleo.fila_de_excecoes
   where ativo_id = pg_temp.id(p_nome) and assunto = 'placa_sem_cr'
$$;

-- ---- dados: A envia duas placas a B; k1 está sem CR vigente, k2 tem ----
select pg_temp.pessoa('Gestor A', 113000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 113000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor C', 113000003, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 113000004, 'administrador', false);
insert into nucleo.operacao (nome) values ('Grãos 113');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (11301, 'K113A', true, true), (11302, 'K113B', true, true);
select pg_temp.guardar('k1', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(11301), p_placa => 'FFF1131',
  p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K113A'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 113'),
  p_em => '2026-01-10 08:00-03'
));
select pg_temp.guardar('k2', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(11302), p_placa => 'FFF1132',
  p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K113B'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 113'),
  p_em => '2026-01-10 08:00-03'
));
select pg_temp.disparar();
-- k1 perde o CR vigente (o CR encerra em 2026-06-01); k2 segue com o CR.
update nucleo.cr_do_ativo set fim = '2026-06-01 00:00-03', fim_origem = 'informada' where ativo_id = pg_temp.id('k1');
select tests.como(pg_temp.id('auth_Gestor A'));
select pg_temp.guardar('ped1', nucleo.disponibilizar_placa(
  pg_temp.id('k1'), pg_temp.id('Gestor B'), 'Troca de carteira', '{}',
  (select versao from nucleo.ativo where id = pg_temp.id('k1'))));
select pg_temp.guardar('ped2', nucleo.disponibilizar_placa(
  pg_temp.id('k2'), pg_temp.id('Gestor B'), 'Troca de carteira', '{}',
  (select versao from nucleo.ativo where id = pg_temp.id('k2'))));
reset role;

-- ---- antes de aceitar, não registra ----
select tests.como(pg_temp.id('auth_Gestor B'));
select is(
  pg_temp.erro_de(format($$select nucleo.registrar_placa_aceita_sem_cr(%L)$$, pg_temp.id('ped1'))),
  '23514', '1. com o pedido ainda pendente, não registra (aceite a placa antes)'
);
select nucleo.receber_placa(pg_temp.id('ped1'), 1);
select is(
  pg_temp.erro_de(format($$select nucleo.registrar_placa_aceita_sem_cr(%L)$$, pg_temp.id('ped1'))),
  '23514', '2. em conferência também não: só depois de concluído'
);
select nucleo.concluir_recebimento(pg_temp.id('ped1'), 2, '[]'::jsonb);
select nucleo.receber_placa(pg_temp.id('ped2'), 1);
select nucleo.concluir_recebimento(pg_temp.id('ped2'), 2, '[]'::jsonb);
reset role;
select is(pg_temp.abertas('k1') + pg_temp.abertas('k2'), 0::bigint, '3. nada foi aberto até aqui');

-- ---- só o gestor de destino ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  pg_temp.erro_de(format($$select nucleo.registrar_placa_aceita_sem_cr(%L)$$, pg_temp.id('ped1'))),
  '42501', '4. a origem não registra'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor C'));
select is(
  pg_temp.erro_de(format($$select nucleo.registrar_placa_aceita_sem_cr(%L)$$, pg_temp.id('ped1'))),
  '42501', '5. um terceiro gestor não registra'
);
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(
  pg_temp.erro_de(format($$select nucleo.registrar_placa_aceita_sem_cr(%L)$$, pg_temp.id('ped1'))),
  '42501', '6. o Administrador não registra em nome do destino'
);
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select is(
  pg_temp.erro_de(format($$select nucleo.registrar_placa_aceita_sem_cr(%L)$$, pg_temp.id('ped1'))),
  '42501', '7. sessão authenticated sem usuário não registra'
);
reset role;
select tests.como_anonimo();
select is(
  pg_temp.erro_de(format($$select nucleo.registrar_placa_aceita_sem_cr(%L)$$, pg_temp.id('ped1'))),
  '42501', '8. anon não registra (sem o EXECUTE)'
);
reset role;
select is(pg_temp.todas('k1') + pg_temp.todas('k2'), 0::bigint, '9. as tentativas recusadas não gravam nada');

-- ---- o destino registra: placa sem CR abre a exceção, placa com CR não ----
select tests.como(pg_temp.id('auth_Gestor B'));
select is(
  nucleo.registrar_placa_aceita_sem_cr(pg_temp.id('ped1'), '11300000-0000-4000-8000-000000000001'),
  pg_temp.id('ped1'), '10. o destino registra a placa aceita (devolve o pedido)'
);
select is(
  nucleo.registrar_placa_aceita_sem_cr(pg_temp.id('ped2'), '11300000-0000-4000-8000-000000000002'),
  pg_temp.id('ped2'), '11. registra também a placa com CR (e nada abre)'
);
reset role;
select is(pg_temp.abertas('k1'), 1::bigint, '12. a placa sem CR vigente ganhou UMA exceção aberta');
select is(pg_temp.abertas('k2'), 0::bigint, '13. a placa com CR vigente não ganhou exceção');
select ok(
  (select resultado = pg_temp.id('ped1') and usuario_id = pg_temp.id('auth_Gestor B') and acao = 'registrar_placa_aceita_sem_cr'
     from auditoria.envio where chave = '11300000-0000-4000-8000-000000000001'),
  '13b. a chave de envio fica registrada, com o resultado e quem enviou'
);
select ok(
  (select length(btrim(descricao)) > 0 and descricao !~ '[0-9]{7}' from nucleo.fila_de_excecoes
    where ativo_id = pg_temp.id('k1') and assunto = 'placa_sem_cr'),
  '14. a exceção tem texto e não traz documento nem placa'
);
select ok(
  exists (select 1 from auditoria.evento e join nucleo.fila_de_excecoes f on f.id::text = e.registro_id
           where f.ativo_id = pg_temp.id('k1') and f.assunto = 'placa_sem_cr'
             and e.tabela like '%fila_de_excecoes' and e.operacao = 'INSERT' and e.usuario_id is not null),
  '15. a abertura fica na auditoria, com quem a fez'
);

-- ---- idempotência: a segunda rodada não muda as contagens ----
select tests.como(pg_temp.id('auth_Gestor B'));
select is(
  nucleo.registrar_placa_aceita_sem_cr(pg_temp.id('ped1'), '11300000-0000-4000-8000-000000000001'),
  pg_temp.id('ped1'), '16. repetir com a mesma chave devolve o mesmo resultado'
);
select is(
  nucleo.registrar_placa_aceita_sem_cr(pg_temp.id('ped1'), '11300000-0000-4000-8000-000000000003'),
  pg_temp.id('ped1'), '17. rodar de novo com outra chave também funciona'
);
reset role;
select is(pg_temp.abertas('k1'), 1::bigint, '18. depois da segunda rodada, continua UMA aberta');
select is(pg_temp.todas('k1'), 1::bigint, '19. e continua UMA no total (nada duplicou)');

-- ---- a placa passou a ter CR vigente: a função FECHA a exceção que abriu ----
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
values (pg_temp.id('k1'), (select id from nucleo.cr where codigo = 'K113A'), '2026-06-01 00:00-03', 'informada');
insert into nucleo.fila_de_excecoes (ativo_id, assunto, descricao)
values (pg_temp.id('k1'), 'outro_assunto_de_teste', 'Exceção de outro assunto, que o fechamento não pode tocar.');
select tests.como(pg_temp.id('auth_Gestor B'));
select nucleo.registrar_placa_aceita_sem_cr(pg_temp.id('ped1'), '11300000-0000-4000-8000-000000000004');
reset role;
select is(pg_temp.abertas('k1'), 0::bigint, '20. com CR vigente, a exceção aberta é fechada');
select is(pg_temp.todas('k1'), 1::bigint, '21. fechar não apaga: a exceção continua na fila, resolvida');
select ok(
  (select resolvida_em is not null and length(btrim(resolucao)) > 0 from nucleo.fila_de_excecoes
    where ativo_id = pg_temp.id('k1') and assunto = 'placa_sem_cr'),
  '22. a exceção fechada guarda a resolução'
);
select tests.como(pg_temp.id('auth_Gestor B'));
select nucleo.registrar_placa_aceita_sem_cr(pg_temp.id('ped1'), '11300000-0000-4000-8000-000000000005');
reset role;
select is(pg_temp.abertas('k1'), 0::bigint, '23. a segunda rodada do fechamento não muda nada (abertas)');
select is(pg_temp.todas('k1'), 1::bigint, '24. nem o total');
select is(
  (select count(*) from nucleo.fila_de_excecoes
    where ativo_id = pg_temp.id('k1') and assunto = 'outro_assunto_de_teste' and resolvida_em is null),
  1::bigint, '24b. fechar mexe só na exceção placa_sem_cr: a de outro assunto da mesma placa segue aberta'
);

-- ---- o CR acaba de novo: reabre, uma vez só ----
update nucleo.cr_do_ativo set fim = '2026-07-01 00:00-03', fim_origem = 'informada'
 where ativo_id = pg_temp.id('k1') and fim is null;
select tests.como(pg_temp.id('auth_Gestor B'));
select nucleo.registrar_placa_aceita_sem_cr(pg_temp.id('ped1'), '11300000-0000-4000-8000-000000000006');
select nucleo.registrar_placa_aceita_sem_cr(pg_temp.id('ped1'), '11300000-0000-4000-8000-000000000007');
reset role;
select is(pg_temp.abertas('k1'), 1::bigint, '25. sem CR de novo, reabre uma exceção (duas rodadas, uma aberta)');
select is(pg_temp.todas('k1'), 2::bigint, '26. a antiga fica resolvida e a nova aberta: dois registros');

-- ---- pedido que não existe ----
select tests.como(pg_temp.id('auth_Gestor B'));
select is(
  pg_temp.erro_de($$select nucleo.registrar_placa_aceita_sem_cr('11300000-0000-4000-8000-0000000000ff')$$),
  '42501', '27. pedido que não existe (ou que não se enxerga) é recusado'
);
reset role;

-- ---- privilégios e tipo da função ----
select ok(
  (select prosecdef from pg_proc where oid = 'nucleo.registrar_placa_aceita_sem_cr(uuid,uuid)'::regprocedure),
  '28. é security definer (quem aceita não escreve na fila), com a conferência por dentro'
);
select ok(has_function_privilege('authenticated', 'nucleo.registrar_placa_aceita_sem_cr(uuid,uuid)', 'EXECUTE'), '29. authenticated executa');
select ok(not has_function_privilege('anon', 'nucleo.registrar_placa_aceita_sem_cr(uuid,uuid)', 'EXECUTE'), '30. anon não executa');
select ok(
  not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               where p.oid = 'nucleo.registrar_placa_aceita_sem_cr(uuid,uuid)'::regprocedure and a.grantee = 0),
  '31. PUBLIC não executa'
);
select ok(
  exists (select 1 from config.funcao_executavel where assinatura = 'nucleo.registrar_placa_aceita_sem_cr(uuid,uuid)'),
  '32. está na lista de funções executáveis, com a justificativa'
);

select * from finish();
rollback;
