-- Fatia 3.0: o alicerce do banco (extensão, tipo da origem da data, gatilhos reutilizáveis, auditoria,
-- chave de envio e o que NÃO é acessível por padrão). Os testes agem como usuário comum quando
-- provam permissão; a chave mestra não aparece em lugar nenhum.
begin;

\ir apoio/como_usuario.psql

select plan(21);

-- ---- extensão e tipo ----
select has_extension('extensions', 'btree_gist', 'btree_gist está instalada no schema extensions');

select enum_has_labels(
  'config',
  'origem_da_data',
  array['derivada', 'observada', 'informada'],
  'origem_da_data tem exatamente derivada, observada e informada'
);

-- ---- versão por registro ----
create temp table t_versao (id int primary key, valor text, versao int not null default 1);
create trigger t_versao_gatilho before update on t_versao
  for each row execute function nucleo.incrementar_versao();
insert into t_versao (id, valor) values (1, 'a');
update t_versao set valor = 'b' where id = 1;
select is((select versao from t_versao where id = 1), 2, 'a versão sobe a cada UPDATE que muda dado');
update t_versao set valor = 'b' where id = 1;
select is((select versao from t_versao where id = 1), 2, 'UPDATE que não muda nada não sobe a versão');

-- ---- exclusão lógica: nada de DELETE físico ----
create temp table t_exclusao (id int primary key, excluido_em timestamptz);
create trigger t_exclusao_gatilho before delete on t_exclusao
  for each row execute function nucleo.bloquear_exclusao_fisica();
insert into t_exclusao (id) values (1);
select throws_ok(
  'delete from t_exclusao where id = 1',
  '23000',
  null,
  'DELETE físico é barrado (a exclusão é lógica)'
);
select is((select count(*) from t_exclusao), 1::bigint, 'a linha continua lá depois do DELETE barrado');

-- ---- auditoria: quem, o quê, quando, antes e depois ----
select set_config('tests.u1', tests.criar_usuario('um@exemplo.local')::text, true);
select set_config('request.jwt.claim.sub', current_setting('tests.u1'), true);

create temp table t_auditada (id int primary key, valor text, segredo text);
create trigger t_auditada_gatilho after insert or update or delete on t_auditada
  for each row execute function auditoria.registrar_mudanca('id', 'segredo');
insert into t_auditada (id, valor, segredo) values (1, 'a', 'valor-secreto');
update t_auditada set valor = 'b' where id = 1;
delete from t_auditada where id = 1;

select is(
  (select count(*) from auditoria.evento where tabela like '%t_auditada'),
  3::bigint,
  'inserção, alteração e exclusão geram um evento cada'
);
select ok(
  exists (
    select 1 from auditoria.evento
    where tabela like '%t_auditada'
      and operacao = 'UPDATE'
      and registro_id = '1'
      and antes ->> 'valor' = 'a'
      and depois ->> 'valor' = 'b'
      and usuario_id = current_setting('tests.u1')::uuid
      and em is not null
  ),
  'o evento de alteração guarda antes, depois, quem e quando'
);
select ok(
  not exists (
    select 1 from auditoria.evento
    where tabela like '%t_auditada' and (antes::text like '%valor-secreto%' or depois::text like '%valor-secreto%')
  ),
  'a coluna oculta nunca vai para a auditoria'
);

-- ---- chave de envio (idempotência) ----
select is(
  auditoria.consumir_envio('11111111-1111-1111-1111-111111111111', 'teste'),
  true,
  'a primeira vez que a chave de envio aparece, ela é consumida'
);
select is(
  auditoria.consumir_envio('11111111-1111-1111-1111-111111111111', 'teste'),
  false,
  'a mesma chave de novo avisa que é repetida'
);
savepoint antes_do_envio;
do $$
begin
  perform auditoria.consumir_envio('22222222-2222-2222-2222-222222222222', 'teste');
end;
$$;
rollback to savepoint antes_do_envio;
select is(
  auditoria.consumir_envio('22222222-2222-2222-2222-222222222222', 'teste'),
  true,
  'desfazer a transação libera a chave: só gravação com sucesso consome'
);

-- ---- como usuário comum: nada do alicerce é acessível ----
select tests.como(current_setting('tests.u1')::uuid);
select is(auth.uid(), current_setting('tests.u1')::uuid, 'como_usuario: auth.uid() devolve o usuário de teste');
select is(current_user::text, 'authenticated', 'como_usuario: age como authenticated');
select is((select count(*) from auditoria.evento), 0::bigint, 'usuário sem vínculo no Eixo não lê a auditoria (0 linhas)');
select throws_ok('select count(*) from auditoria.envio', '42501', null, 'authenticated não lê as chaves de envio');
select lives_ok(
  $$select auditoria.consumir_envio('33333333-3333-3333-3333-333333333333', 'x')$$,
  'authenticated executa consumir_envio (idempotência das gravações, liberada na 3.6)'
);
reset role;
select tests.como_anonimo();
select throws_ok('select count(*) from auditoria.evento', '42501', null, 'anon não lê a auditoria');
reset role;

-- ---- o que não é acessível por padrão (catálogo) ----
select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and not c.relrowsecurity
      and n.nspname = any (array[
        'nucleo', 'operacional', 'pessoas', 'rh_clinico', 'parceiros',
        'financeiro', 'sync', 'config', 'auditoria'
      ])
  ),
  0::bigint,
  'toda tabela dos nove schemas tem RLS ligado'
);
select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = any (array[
        'nucleo', 'operacional', 'pessoas', 'rh_clinico', 'parceiros',
        'financeiro', 'sync', 'config', 'auditoria'
      ])
      and grantee in ('anon', 'PUBLIC')
  ),
  0::bigint,
  'nenhuma tabela dos nove schemas dá acesso a anon ou PUBLIC (authenticated recebe grants explícitos na 3.6)'
);
select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = any (array[
        'nucleo', 'operacional', 'pessoas', 'rh_clinico', 'parceiros',
        'financeiro', 'sync', 'config', 'auditoria'
      ])
      and (
        has_function_privilege('anon', p.oid, 'execute')
      )
  ),
  0::bigint,
  'nenhuma função dos nove schemas é executável por anon (authenticated: só a lista de exceções, no 50)'
);

select * from finish();

rollback;
