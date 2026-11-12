-- Meu dia, rodada 2: a leitura do lote traz a data de envio do pedido e o prazo da transferência
-- (parâmetro prazo_da_transferencia_dias, hipótese H4: 5 dias). Função de leitura (security invoker):
-- a RLS de quem chama vale; o gestor vê só o que espera por ele; o Administrador pode ler todos os
-- abertos (modo leitura), nunca decidir. Sempre com a chave do usuário de cada perfil.
begin;
\ir apoio/como_usuario.psql
\ir apoio/transferencia.psql

select plan(22);

-- ---- dados: A tem duas placas e as envia a B; C é outro gestor; Adm é o Administrador ----
select pg_temp.pessoa('Gestor A', 112000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 112000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor C', 112000003, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 112000004, 'administrador', false);
insert into nucleo.operacao (nome) values ('Grãos 112');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (11201, 'K112A', true, true), (11202, 'K112B', true, true);
select pg_temp.guardar('k1', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(11201), p_placa => 'FFF1121',
  p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K112A'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 112'),
  p_em => '2026-01-10 08:00-03'
));
select pg_temp.guardar('k2', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(11202), p_placa => 'FFF1122',
  p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K112B'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 112'),
  p_em => '2026-01-10 08:00-03'
));
select pg_temp.disparar();
select tests.como(pg_temp.id('auth_Gestor A'));
select pg_temp.guardar('ped1', nucleo.disponibilizar_placa(
  pg_temp.id('k1'), pg_temp.id('Gestor B'), 'Troca de carteira', array['CRLV vence em breve'],
  (select versao from nucleo.ativo where id = pg_temp.id('k1'))));
select pg_temp.guardar('ped2', nucleo.disponibilizar_placa(
  pg_temp.id('k2'), pg_temp.id('Gestor B'), 'Troca de carteira', '{}',
  (select versao from nucleo.ativo where id = pg_temp.id('k2'))));
reset role;
-- ped1 foi enviado em instante fixo (para conferir o texto exato); ped2 segue com o instante de agora.
update nucleo.transferencia set criado_em = timestamptz '2026-11-04 15:30:00+00' where id = pg_temp.id('ped1');

-- ---- o parâmetro ----
select is(
  (select valor from config.parametro where chave = 'prazo_da_transferencia_dias'),
  '5', '1. o prazo da transferência é parâmetro, com o padrão de 5 dias (hipótese H4)'
);
select ok(
  (select length(btrim(descricao)) > 0 from config.parametro where chave = 'prazo_da_transferencia_dias'),
  '2. o parâmetro diz o que significa'
);

-- ---- o gestor de destino ----
select tests.como(pg_temp.id('auth_Gestor B'));
select is(jsonb_array_length(nucleo.pedidos_do_meu_dia()), 2, '3. o destino vê os dois pedidos abertos dele');
select is(
  (select jsonb_agg(t.p ->> 'id' order by t.n) from jsonb_array_elements(nucleo.pedidos_do_meu_dia()) with ordinality as t(p, n)),
  jsonb_build_array(pg_temp.id('ped1')::text, pg_temp.id('ped2')::text),
  '4. do mais antigo ao mais novo, como em pedidos_para_receber'
);
select is(
  (nucleo.pedidos_do_meu_dia() -> 0 ->> 'enviada_em'), '2026-11-04T15:30:00Z',
  '5. a data de envio vem em UTC, no formato fixo'
);
select is(
  (nucleo.pedidos_do_meu_dia() -> 0 ->> 'prazo_dias')::int, 5, '6. cada pedido traz o prazo vigente'
);
select is(
  (nucleo.pedidos_do_meu_dia() -> 0 ->> 'placa'), 'FFF1121',
  '7. a forma do pedido (placa, pendências) segue a de pedido_em_json'
);
select is(
  jsonb_array_length(nucleo.pedidos_do_meu_dia() -> 0 -> 'pendencias'), 1,
  '8. as pendências conhecidas vêm junto'
);
select ok(
  (nucleo.pedidos_do_meu_dia() -> 1 ->> 'enviada_em') is not null,
  '9. todo pedido tem data de envio'
);
reset role;
update config.parametro set valor = '7' where chave = 'prazo_da_transferencia_dias';
select tests.como(pg_temp.id('auth_Gestor B'));
select is((nucleo.pedidos_do_meu_dia() -> 0 ->> 'prazo_dias')::int, 7, '10. mudar o parâmetro muda o prazo');
reset role;
update config.parametro set valor = 'abc' where chave = 'prazo_da_transferencia_dias';
select tests.como(pg_temp.id('auth_Gestor B'));
select is((nucleo.pedidos_do_meu_dia() -> 0 ->> 'prazo_dias')::int, 5, '11. parâmetro inválido cai no padrão de 5 dias');
reset role;
update config.parametro set valor = '5' where chave = 'prazo_da_transferencia_dias';

-- ---- quem não é o destino ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(jsonb_array_length(nucleo.pedidos_do_meu_dia()), 0, '12. a origem não tem pedido esperando por ela');
select is(jsonb_array_length(nucleo.pedidos_do_meu_dia(true)), 2, '13. a origem lê os pedidos que enviou no modo "todos" (RLS)');
reset role;
select tests.como(pg_temp.id('auth_Gestor C'));
select is(jsonb_array_length(nucleo.pedidos_do_meu_dia(true)), 0, '14. um terceiro gestor não lê o pedido dos outros, nem no modo "todos"');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(jsonb_array_length(nucleo.pedidos_do_meu_dia()), 0, '15. o Administrador não tem pedido esperando por ele');
select is(jsonb_array_length(nucleo.pedidos_do_meu_dia(true)), 2, '16. o Administrador lê a fila toda no modo "todos" (só leitura)');
reset role;

-- ---- o que já foi decidido sai da fila ----
select tests.como(pg_temp.id('auth_Gestor B'));
select nucleo.receber_placa(pg_temp.id('ped2'), 1);
select nucleo.concluir_recebimento(pg_temp.id('ped2'), 2, '[]'::jsonb);
select is(jsonb_array_length(nucleo.pedidos_do_meu_dia()), 1, '17. o pedido concluído sai da fila');
reset role;

-- ---- privilégios e tipo da função ----
select ok(
  not (select prosecdef from pg_proc where oid = 'nucleo.pedidos_do_meu_dia(boolean)'::regprocedure),
  '18. a leitura é security invoker (a RLS de quem chama vale)'
);
select ok(has_function_privilege('authenticated', 'nucleo.pedidos_do_meu_dia(boolean)', 'EXECUTE'), '19. authenticated executa');
select ok(not has_function_privilege('anon', 'nucleo.pedidos_do_meu_dia(boolean)', 'EXECUTE'), '20. anon não executa');
select ok(
  not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               where p.oid = 'nucleo.pedidos_do_meu_dia(boolean)'::regprocedure and a.grantee = 0),
  '21. PUBLIC não executa'
);
select ok(
  exists (select 1 from config.funcao_executavel where assinatura = 'nucleo.pedidos_do_meu_dia(boolean)'),
  '22. está na lista de funções executáveis, com a justificativa'
);

select * from finish();
rollback;
