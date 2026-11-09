-- Frota › Carteira (primeira versão): a confirmação mensal das placas pelo gestor de frota.
--  * Uma confirmação por gestor × placa × mês (chave única no banco). "Não confere" exige observação.
--    Confirmar de novo no mesmo mês troca a resposta (a versão sobe), nunca duplica.
--  * A carteira do mês é a das vigências de nucleo.gestor_da_carteira que tocam o mês, só do próprio
--    usuário (config.usuario_atual()); mês que ainda não começou é recusado.
--  * Lê-se pela RLS da tabela (o gestor, as próprias; quem vê a Frota inteira, todas); grava-se só pela
--    função, que confere quem é o gestor. Sempre com a chave do usuário de cada perfil (armadilha 9).
begin;
\ir apoio/como_usuario.psql

select plan(35);

create function pg_temp.id(p_nome text) returns uuid language sql as $$
  select nullif(current_setting('t.' || lower(regexp_replace(p_nome, '[^A-Za-z0-9]', '_', 'g')), true), '')::uuid
$$;
create function pg_temp.guardar(p_nome text, p_id uuid) returns uuid language sql as $$
  select set_config('t.' || lower(regexp_replace(p_nome, '[^A-Za-z0-9]', '_', 'g')), p_id::text, true)::uuid
$$;
create function pg_temp.renavam(p_n bigint) returns text language plpgsql as $$
declare
  v_prefixo text := lpad(p_n::text, 10, '0');
begin
  for v_dv in 0..9 loop
    if nucleo.renavam_valido(v_prefixo || v_dv::text) then
      return v_prefixo || v_dv::text;
    end if;
  end loop;
  raise exception 'sem dígito verificador para %', v_prefixo;
end;
$$;
create function pg_temp.cpf(p_n bigint) returns text language plpgsql as $$
declare
  v_base text := lpad(p_n::text, 9, '0');
begin
  for v_a in 0..9 loop
    for v_b in 0..9 loop
      if nucleo.documento_valido(v_base || v_a::text || v_b::text) then
        return v_base || v_a::text || v_b::text;
      end if;
    end loop;
  end loop;
  raise exception 'sem CPF para %', v_base;
end;
$$;
create function pg_temp.pessoa(p_nome text, p_n bigint, p_perfil text, p_gestor boolean) returns uuid language plpgsql as $$
declare
  v_pessoa uuid;
  v_auth uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_pessoa;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, pg_temp.cpf(p_n));
  if p_gestor then
    insert into nucleo.papel_da_pessoa (pessoa_id, papel) values (v_pessoa, 'gestor_de_frota');
  end if;
  if p_perfil is not null then
    v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '@exemplo.local');
    insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (v_pessoa, v_auth, p_perfil);
    perform pg_temp.guardar('auth_' || p_nome, v_auth);
  end if;
  return pg_temp.guardar(p_nome, v_pessoa);
end;
$$;
create function pg_temp.disparar() returns void language plpgsql as $$
begin
  set constraints all immediate;
  set constraints all deferred;
end;
$$;
create function pg_temp.erro_de(p_sql text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception 'a tentativa executou' using errcode = 'ZZ999';
  exception when others then
    return case when sqlstate = 'ZZ999' then 'executou' else sqlstate end;
  end;
end;
$$;
create function pg_temp.item(p_ativo text, p_confere boolean, p_obs text default null) returns jsonb language sql as $$
  select jsonb_build_object('ativo_id', pg_temp.id(p_ativo), 'confere', p_confere, 'observacao', p_obs)
$$;

-- ---- dados: A tem dois cavalos (desde 10/01/2026); C tem um ----
select pg_temp.pessoa('Gestor A', 860000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor C', 860000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 860000003, 'administrador', false);
select pg_temp.pessoa('Dir', 860000004, 'diretoria', false);
select pg_temp.pessoa('Oper', 860000005, 'operacional', false);
select pg_temp.guardar('auth_sem_vinculo', tests.criar_usuario('sem.vinculo.86@exemplo.local'));
insert into nucleo.operacao (nome) values ('Grãos 86');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (8601, 'K86A', true, true), (8602, 'K86B', true, true), (8603, 'K86C', true, true);
select pg_temp.guardar('k1', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8601), p_placa => 'FFF8B61',
  p_gestor_id => pg_temp.id('Gestor A'), p_cr_id => (select id from nucleo.cr where codigo = 'K86A'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 86'), p_em => '2026-01-10 08:00-03'));
select pg_temp.guardar('k2', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8602), p_placa => 'FFF8B62',
  p_gestor_id => pg_temp.id('Gestor A'), p_cr_id => (select id from nucleo.cr where codigo = 'K86B'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 86'), p_em => '2026-01-10 08:00-03'));
select pg_temp.guardar('k3', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8603), p_placa => 'FFF8B63',
  p_gestor_id => pg_temp.id('Gestor C'), p_cr_id => (select id from nucleo.cr where codigo = 'K86C'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 86'), p_em => '2026-01-10 08:00-03'));
select pg_temp.disparar();

-- ---- Estrutura e privilégios ----
select has_table('nucleo', 'confirmacao_da_carteira', 'a tabela da confirmação mensal existe');
select ok((select relrowsecurity from pg_class where oid = 'nucleo.confirmacao_da_carteira'::regclass), 'RLS ligado');
select ok(
  has_table_privilege('authenticated', 'nucleo.confirmacao_da_carteira', 'SELECT')
  and not has_table_privilege('authenticated', 'nucleo.confirmacao_da_carteira', 'INSERT')
  and not has_table_privilege('authenticated', 'nucleo.confirmacao_da_carteira', 'UPDATE')
  and not has_table_privilege('authenticated', 'nucleo.confirmacao_da_carteira', 'DELETE')
  and not has_table_privilege('anon', 'nucleo.confirmacao_da_carteira', 'SELECT'),
  'authenticated só lê; grava-se só pela função; anon nada'
);
select col_is_unique('nucleo', 'confirmacao_da_carteira', array['gestor_id', 'ativo_id', 'mes'],
  'uma confirmação por gestor × placa × mês (chave única no banco)');
select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
     from unnest(array['nucleo.carteira_do_mes(date,text,integer,integer)',
                       'nucleo.confirmar_carteira(date,jsonb,uuid)']::regprocedure[]) f),
  'authenticated executa as funções da carteira; anon não'
);
select ok(
  (select p.prosecdef and exists (select 1 from config.funcao_executavel e where e.assinatura = 'nucleo.confirmar_carteira(date,jsonb,uuid)')
     from pg_proc p where p.oid = 'nucleo.confirmar_carteira(date,jsonb,uuid)'::regprocedure),
  'confirmar_carteira é SECURITY DEFINER e está na lista de exceções'
);

-- ---- A carteira do mês: só a do próprio gestor ----
select tests.como(pg_temp.id('auth_Gestor A'));
select set_config('t.cart', nucleo.carteira_do_mes('2026-01-01')::text, true);
select is((current_setting('t.cart')::jsonb->>'total')::int, 2, 'carteira: o Gestor A tem duas placas em janeiro');
select is((current_setting('t.cart')::jsonb->>'pendentes')::int, 2, 'carteira: as duas pendentes');
select is(current_setting('t.cart')::jsonb->'linhas'->0->>'placa', 'FFF8B61', 'carteira: ordenada pela placa');
select is((nucleo.carteira_do_mes('2025-12-01')->>'total')::int, 0, 'carteira: em dezembro de 2025 ainda não havia placa');
select is((nucleo.carteira_do_mes('2026-01-20')->>'mes'), '2026-01-01', 'carteira: qualquer dia do mês vale o mês');

-- ---- Confirmar ----
select is(
  (nucleo.confirmar_carteira('2026-01-01', jsonb_build_array(pg_temp.item('k1', true)))->>'gravadas')::int, 1,
  'confirmar: o Gestor A confirma uma placa'
);
select set_config('t.cart', nucleo.carteira_do_mes('2026-01-01')::text, true);
select is((current_setting('t.cart')::jsonb->>'conferem')::int, 1, 'confirmar: uma confere');
select is((current_setting('t.cart')::jsonb->>'pendentes')::int, 1, 'confirmar: uma continua pendente');
select is(
  (nucleo.carteira_do_mes('2026-01-01', 'pendentes')->'linhas'->0->>'placa'), 'FFF8B62',
  'carteira: o filtro "pendentes" traz só a que falta'
);
select is(
  pg_temp.erro_de(format('select nucleo.confirmar_carteira(%L, %L)', '2026-01-01', jsonb_build_array(pg_temp.item('k2', false)))),
  '23514', 'confirmar: "não confere" sem observação é recusado'
);
select is(
  (nucleo.confirmar_carteira('2026-01-01', jsonb_build_array(pg_temp.item('k2', false, 'Placa está com outro gestor')))->>'gravadas')::int, 1,
  'confirmar: "não confere" com observação grava'
);
select is((nucleo.carteira_do_mes('2026-01-01')->>'nao_conferem')::int, 1, 'confirmar: uma não confere');
select lives_ok(
  format('select nucleo.confirmar_carteira(%L, %L)', '2026-01-01', jsonb_build_array(pg_temp.item('k2', true))),
  'confirmar de novo troca a resposta'
);
select is((nucleo.carteira_do_mes('2026-01-01')->>'conferem')::int, 2, 'confirmar de novo: as duas conferem');
select is(
  (select count(*) from nucleo.confirmacao_da_carteira where ativo_id = pg_temp.id('k2')), 1::bigint,
  'confirmar de novo não duplica'
);
select is(
  (select versao from nucleo.confirmacao_da_carteira where ativo_id = pg_temp.id('k2')), 2,
  'confirmar de novo sobe a versão'
);
select is(
  pg_temp.erro_de(format('select nucleo.confirmar_carteira(%L, %L)', '2026-01-01', jsonb_build_array(pg_temp.item('k3', true)))),
  '42501', 'confirmar: a placa de outra carteira é recusada'
);
select is(
  pg_temp.erro_de(format('select nucleo.confirmar_carteira(%L, %L)', '2025-12-01', jsonb_build_array(pg_temp.item('k1', true)))),
  '42501', 'confirmar: a placa que não estava na carteira naquele mês é recusada'
);
select is(
  pg_temp.erro_de(format('select nucleo.confirmar_carteira(%L, %L)',
    (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month')::date::text,
    jsonb_build_array(pg_temp.item('k1', true)))),
  '22023', 'confirmar: mês que ainda não começou é recusado'
);
select is(
  pg_temp.erro_de(format($$insert into nucleo.confirmacao_da_carteira (gestor_id, ativo_id, mes, confere) values (%L, %L, '2026-02-01', true)$$,
    pg_temp.id('Gestor A'), pg_temp.id('k1'))),
  '42501', 'o gestor não grava direto na tabela'
);
-- A mesma chave de envio grava uma vez só.
select is(
  (nucleo.confirmar_carteira('2026-02-01', jsonb_build_array(pg_temp.item('k1', true)), '8a6e0000-0000-4000-8000-000000000001')->>'gravadas')::int, 1,
  'chave de envio: primeiro envio grava'
);
select is(
  (nucleo.confirmar_carteira('2026-02-01', jsonb_build_array(pg_temp.item('k1', true)), '8a6e0000-0000-4000-8000-000000000001')->>'repetido')::boolean, true,
  'chave de envio: o envio repetido devolve "repetido" e não grava de novo'
);
reset role;

-- ---- Quem lê o quê ----
select tests.como(pg_temp.id('auth_Gestor C'));
select is((nucleo.carteira_do_mes('2026-01-01')->>'total')::int, 1, 'Gestor C: a carteira dele tem uma placa');
select is((select count(*) from nucleo.confirmacao_da_carteira), 0::bigint, 'Gestor C: não lê as confirmações do Gestor A');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is((select count(*) from nucleo.confirmacao_da_carteira), 3::bigint, 'Administrador: lê todas as confirmações');
select is(
  pg_temp.erro_de(format('select nucleo.confirmar_carteira(%L, %L)', '2026-01-01', jsonb_build_array(pg_temp.item('k3', true)))),
  '42501', 'Administrador: não confirma a carteira de um gestor'
);
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is((select count(*) from nucleo.confirmacao_da_carteira), 3::bigint, 'Diretoria: lê todas as confirmações');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is((select count(*) from nucleo.confirmacao_da_carteira), 0::bigint, 'Operacional: não lê confirmações');
reset role;
select tests.como(pg_temp.id('auth_sem_vinculo'));
select is((nucleo.carteira_do_mes('2026-01-01')->>'total')::int, 0, 'sem vínculo: carteira vazia');
reset role;

select * from finish();
rollback;
