-- P0 S1 (homologação de 09/11/2026): só o gestor de destino recebe e conclui a transferência.
-- A regra (docs/decisoes.md, fatia 3.6, item 7): "o destino altera, recebe e conclui". O gestor de origem
-- continua com a placa na carteira até a conclusão (frota.editar), e isso não pode deixá-lo receber nem
-- concluir o próprio pedido; terceiros e o Administrador também não (não há exceção documentada).
-- Cobre "Receber placa" e "Concluir recebimento" e também as funções internas receber_transferencia e
-- concluir_transferencia, que o app pode executar. Sempre com a chave do usuário de cada perfil.
-- Sem sessão de usuário (o dono do banco, nos testes 30, 31 e 81) as internas seguem aceitas; uma sessão
-- da API (authenticated ou anon) sem o usuário no token não: o EXECUTE e a falta de auth.uid() não abrem
-- caminho.
begin;
\ir apoio/como_usuario.psql

select plan(26);

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
create function pg_temp.respostas(p_pedido uuid, p_resolvida boolean, p_nota text) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'resolvida', p_resolvida, 'nota', p_nota)), '[]'::jsonb)
    from (select id from nucleo.transferencia_pendencia where transferencia_id = p_pedido order by criado_em, id) p
$$;
-- Roda a tentativa num bloco que é sempre desfeito e devolve o SQLSTATE do erro, ou 'executou' se ela
-- passou. Assim uma tentativa indevida que passa (o defeito) não muda o pedido para os cenários seguintes.
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

-- ---- dados: A tem duas placas e as envia a B; C é outro gestor; Adm é o Administrador ----
select pg_temp.pessoa('Gestor A', 830000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 830000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor C', 830000003, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 830000004, 'administrador', false);
insert into nucleo.operacao (nome) values ('Grãos 83');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (8301, 'K83A', true, true), (8302, 'K83B', true, true);
select pg_temp.guardar('k1', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8301), p_placa => 'FFF8F31',
  p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K83A'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 83'),
  p_em => '2026-01-10 08:00-03'
));
select pg_temp.guardar('k2', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8302), p_placa => 'FFF8F32',
  p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K83B'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 83'),
  p_em => '2026-01-10 08:00-03'
));
select pg_temp.disparar();

-- ped1 (com uma pendência) passa pelas funções do app; ped2 (sem pendência) pelas funções internas.
select tests.como(pg_temp.id('auth_Gestor A'));
select pg_temp.guardar('ped1', nucleo.disponibilizar_placa(
  pg_temp.id('k1'), pg_temp.id('Gestor B'), 'Troca de carteira', array['CRLV vence em breve'],
  (select versao from nucleo.ativo where id = pg_temp.id('k1'))));
select pg_temp.guardar('ped2', nucleo.disponibilizar_placa(
  pg_temp.id('k2'), pg_temp.id('Gestor B'), 'Troca de carteira', '{}',
  (select versao from nucleo.ativo where id = pg_temp.id('k2'))));
reset role;

-- ---- Privilégios: authenticated executa; anon e PUBLIC não ----
select ok(
  (select bool_and(not has_function_privilege('anon', f, 'EXECUTE')) from unnest(array[
    'nucleo.receber_transferencia(uuid,timestamptz)', 'nucleo.concluir_transferencia(uuid,timestamptz)',
    'nucleo.pedido_para_agir(uuid,text)']::regprocedure[]) f),
  'anon não executa as funções que conferem quem recebe'
);
select ok(
  not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               where p.oid = any (array['nucleo.receber_transferencia(uuid,timestamptz)',
                 'nucleo.concluir_transferencia(uuid,timestamptz)', 'nucleo.pedido_para_agir(uuid,text)']::regprocedure[])
                 and a.grantee = 0),
  'PUBLIC não executa as funções que conferem quem recebe'
);
select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE')) from unnest(array[
    'nucleo.receber_transferencia(uuid,timestamptz)', 'nucleo.concluir_transferencia(uuid,timestamptz)',
    'nucleo.pedido_para_agir(uuid,text)']::regprocedure[]) f),
  'authenticated executa as três (a conferência de quem age é por dentro)'
);
select tests.como_anonimo();
select is(
  pg_temp.erro_de(format($$select nucleo.receber_transferencia(%L, now())$$, pg_temp.id('ped2'))),
  '42501', 'anon não recebe pela função interna'
);
select is(
  pg_temp.erro_de(format($$select nucleo.concluir_transferencia(%L, now())$$, pg_temp.id('ped2'))),
  '42501', 'anon não conclui pela função interna'
);
reset role;

-- ---- Receber ----
-- Sessão da API sem o usuário no token: auth.uid() é nulo, e isso não pode liberar a função interna.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select is(
  pg_temp.erro_de(format($$select nucleo.receber_transferencia(%L, now())$$, pg_temp.id('ped2'))),
  '42501', 'sessão authenticated sem usuário não recebe pela função interna'
);
select is(
  pg_temp.erro_de(format($$select nucleo.receber_placa(%L, 1)$$, pg_temp.id('ped1'))),
  '42501', 'sessão authenticated sem usuário não recebe pelo app'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  pg_temp.erro_de(format($$select nucleo.receber_placa(%L, 1)$$, pg_temp.id('ped1'))),
  '42501', '1. a origem não recebe a própria transferência'
);
select is(
  pg_temp.erro_de(format($$select nucleo.receber_transferencia(%L, now())$$, pg_temp.id('ped2'))),
  '42501', 'a origem não recebe nem pela função interna'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor C'));
select is(
  pg_temp.erro_de(format($$select nucleo.receber_placa(%L, 1)$$, pg_temp.id('ped1'))),
  '42501', '5. um terceiro gestor não recebe'
);
select is(
  pg_temp.erro_de(format($$select nucleo.receber_transferencia(%L, now())$$, pg_temp.id('ped2'))),
  '42501', 'um terceiro gestor não recebe nem pela função interna'
);
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(
  pg_temp.erro_de(format($$select nucleo.receber_placa(%L, 1)$$, pg_temp.id('ped1'))),
  '42501', 'o Administrador não recebe em nome do destino'
);
reset role;
select ok(
  (select bool_and(situacao = 'pendente' and versao = 1) from nucleo.transferencia
    where id in (pg_temp.id('ped1'), pg_temp.id('ped2'))),
  'as tentativas recusadas não mudam os pedidos'
);
select tests.como(pg_temp.id('auth_Gestor B'));
select is(nucleo.receber_placa(pg_temp.id('ped1'), 1), pg_temp.id('ped1'), '3. o destino recebe a transferência');
select is(nucleo.receber_placa(pg_temp.id('ped2'), 1), pg_temp.id('ped2'), 'o destino recebe o segundo pedido');
reset role;
select ok(
  (select bool_and(situacao = 'em_conferencia') from nucleo.transferencia
    where id in (pg_temp.id('ped1'), pg_temp.id('ped2'))),
  'os dois pedidos ficam em conferência'
);

-- ---- Concluir ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  pg_temp.erro_de(format($$select nucleo.concluir_recebimento(%L, 2, %L::jsonb)$$,
    pg_temp.id('ped1'), pg_temp.respostas(pg_temp.id('ped1'), true, null))),
  '42501', '2. a origem não conclui a própria transferência (nem responde a pendência pelo destino)'
);
select is(
  pg_temp.erro_de(format($$select nucleo.concluir_transferencia(%L, now())$$, pg_temp.id('ped2'))),
  '42501', 'a origem não conclui nem pela função interna'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor C'));
select is(
  pg_temp.erro_de(format($$select nucleo.concluir_recebimento(%L, 2, %L::jsonb)$$,
    pg_temp.id('ped1'), pg_temp.respostas(pg_temp.id('ped1'), true, null))),
  '42501', '6. um terceiro gestor não conclui'
);
select is(
  pg_temp.erro_de(format($$select nucleo.concluir_transferencia(%L, now())$$, pg_temp.id('ped2'))),
  '42501', 'um terceiro gestor não conclui nem pela função interna'
);
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(
  pg_temp.erro_de(format($$select nucleo.concluir_recebimento(%L, 2, %L::jsonb)$$,
    pg_temp.id('ped1'), pg_temp.respostas(pg_temp.id('ped1'), true, null))),
  '42501', 'o Administrador não conclui em nome do destino'
);
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select is(
  pg_temp.erro_de(format($$select nucleo.concluir_transferencia(%L, now())$$, pg_temp.id('ped2'))),
  '42501', 'sessão authenticated sem usuário não conclui pela função interna'
);
reset role;
select ok(
  (select count(*) = 2 from nucleo.gestor_da_carteira
    where ativo_id in (pg_temp.id('k1'), pg_temp.id('k2')) and gestor_id = pg_temp.id('Gestor A')
      and fim is null and excluido_em is null)
  and not exists (select 1 from nucleo.transferencia_pendencia
                   where transferencia_id = pg_temp.id('ped1') and resposta is not null),
  'as recusas não trocam o gestor nem respondem a pendência'
);
select tests.como(pg_temp.id('auth_Gestor B'));
select is(
  nucleo.concluir_recebimento(pg_temp.id('ped1'), 2, pg_temp.respostas(pg_temp.id('ped1'), true, null)),
  pg_temp.id('ped1'), '4. o destino conclui a transferência'
);
select is(
  nucleo.concluir_recebimento(pg_temp.id('ped2'), 2, '[]'::jsonb),
  pg_temp.id('ped2'), 'o destino conclui o segundo pedido'
);
reset role;
select ok(
  (select count(*) = 2 from nucleo.gestor_da_carteira
    where ativo_id in (pg_temp.id('k1'), pg_temp.id('k2')) and gestor_id = pg_temp.id('Gestor B')
      and fim is null and excluido_em is null)
  and (select respondida_por = pg_temp.id('Gestor B') from nucleo.transferencia_pendencia
        where transferencia_id = pg_temp.id('ped1')),
  'concluído pelo destino: as duas placas passam ao B, e a pendência foi respondida por ele'
);

select * from finish();
rollback;
