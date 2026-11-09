-- S2 (auditoria de 09/11/2026): o pedido de transferência e a carteira só mudam pelas funções.
-- authenticated tinha INSERT e UPDATE em nucleo.transferencia e nucleo.transferencia_pendencia, e as
-- políticas conferiam quem age, não o que muda: origem e destino trocavam a situação direto (concluída
-- sem trocar a carteira, cancelada, devolvida), reescreviam o motivo, inseriam pedido com situação
-- qualquer, respondiam pendência com respondida_por forjado e excluíam o pedido. Na carteira, o gestor
-- "doava" a placa (gestor_id) e forjava vigência anterior (inicio).
-- Agora: sem INSERT/UPDATE diretos no pedido; as funções do pedido rodam como dono e conferem quem age
-- (D1: nem o Administrador mexe na carteira por fora do fluxo); a origem cancela o pedido pendente; o
-- destino devolve o pedido em conferência, com motivo; na carteira, só as funções inserem, e gestor,
-- início e placa da vigência não mudam.
-- Cada tentativa indevida roda num bloco sempre desfeito (pg_temp.erro_de), com a chave do usuário.
begin;
\ir apoio/como_usuario.psql

select plan(46);

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
create function pg_temp.cavalo(p_nome text, p_n bigint, p_placa text, p_cr text) returns uuid language sql as $$
  select pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => 'cavalo', p_renavam => pg_temp.renavam(p_n), p_placa => p_placa,
    p_gestor_id => pg_temp.id('Gestor A'),
    p_cr_id => (select id from nucleo.cr where codigo = p_cr),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 84'),
    p_em => '2026-01-10 08:00-03'))
$$;
-- Roda a tentativa num bloco que é sempre desfeito e devolve o SQLSTATE do erro, ou 'executou' se ela
-- passou (as restrições adiadas são conferidas antes de desfazer).
create function pg_temp.erro_de(p_sql text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
    set constraints all immediate;
    raise exception 'a tentativa executou' using errcode = 'ZZ999';
  exception when others then
    return case when sqlstate = 'ZZ999' then 'executou' else sqlstate end;
  end;
end;
$$;
create function pg_temp.versao(p_pedido text) returns integer language sql as $$
  select coalesce((select versao from nucleo.transferencia where id = pg_temp.id(p_pedido)), 1)
$$;

-- ---- dados: A tem quatro placas; B é o destino; C é outro gestor; Op tem a custódia de k1 ----
select pg_temp.pessoa('Gestor A', 840000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 840000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor C', 840000003, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 840000004, 'administrador', false);
select pg_temp.pessoa('Op', 840000005, 'operacional', false);
insert into config.filial (nome) values ('Filial 84');
insert into nucleo.usuario_filial (usuario_id, filial_id)
  values (pg_temp.id('Op'), (select id from config.filial where nome = 'Filial 84'));
insert into nucleo.operacao (nome) values ('Grãos 84');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (8401, 'K84A', true, true), (8402, 'K84B', true, true), (8403, 'K84C', true, true), (8404, 'K84D', true, true);
select pg_temp.cavalo('k1', 8401, 'FFF8F41', 'K84A');
select pg_temp.cavalo('k2', 8402, 'FFF8F42', 'K84B');
select pg_temp.cavalo('k3', 8403, 'FFF8F43', 'K84C');
select pg_temp.cavalo('k4', 8404, 'FFF8F44', 'K84D');
select pg_temp.disparar();
select nucleo.entregar_ao_operacional(
  pg_temp.id('k1'), (select id from config.filial where nome = 'Filial 84'), '2026-01-11 08:00-03',
  (select versao from nucleo.ativo where id = pg_temp.id('k1')));

-- p1 (com pendência), p2 e p4 (sem pendência): todos pelo app, de A para B.
select tests.como(pg_temp.id('auth_Gestor A'));
select pg_temp.guardar('p1', nucleo.disponibilizar_placa(
  pg_temp.id('k1'), pg_temp.id('Gestor B'), 'Troca de carteira', array['CRLV vence em breve'],
  (select versao from nucleo.ativo where id = pg_temp.id('k1'))));
select pg_temp.guardar('p2', nucleo.disponibilizar_placa(
  pg_temp.id('k2'), pg_temp.id('Gestor B'), 'Troca de carteira', '{}',
  (select versao from nucleo.ativo where id = pg_temp.id('k2'))));
select pg_temp.guardar('p4', nucleo.disponibilizar_placa(
  pg_temp.id('k4'), pg_temp.id('Gestor B'), 'Troca de carteira', '{}',
  (select versao from nucleo.ativo where id = pg_temp.id('k4'))));
reset role;

-- ---- Privilégios ----
select ok(
  not has_table_privilege('authenticated', 'nucleo.transferencia', 'INSERT')
  and not has_table_privilege('authenticated', 'nucleo.transferencia', 'UPDATE')
  and not has_table_privilege('authenticated', 'nucleo.transferencia_pendencia', 'INSERT')
  and not has_table_privilege('authenticated', 'nucleo.transferencia_pendencia', 'UPDATE'),
  'authenticated não grava direto no pedido nem nas pendências (só lê)'
);
select ok(
  has_table_privilege('authenticated', 'nucleo.transferencia', 'SELECT')
  and has_table_privilege('authenticated', 'nucleo.transferencia_pendencia', 'SELECT'),
  'authenticated segue lendo o pedido e as pendências pela RLS'
);
select ok(
  not exists (select 1 from pg_policies where schemaname = 'nucleo' and policyname in (
    'transferencia_criar', 'transferencia_alterar', 'transferencia_pendencia_criar',
    'transferencia_pendencia_alterar', 'gestor_da_carteira_criar')),
  'saem as políticas de criar e alterar do pedido e das pendências, e a de criar da carteira'
);
select ok(
  not has_table_privilege('authenticated', 'nucleo.gestor_da_carteira', 'INSERT'),
  'authenticated não insere vigência de gestor direto (só o cadastro e a conclusão inserem)'
);
select ok(
  (select bool_and(p.prosecdef and array_to_string(p.proconfig, ',') = 'search_path=""')
     from pg_proc p where p.oid = any (array[
       'nucleo.disponibilizar_placa(uuid,uuid,text,text[],integer,timestamptz,uuid)',
       'nucleo.pedido_para_agir(uuid,text)',
       'nucleo.receber_placa(uuid,integer,timestamptz,uuid)',
       'nucleo.concluir_recebimento(uuid,integer,jsonb,timestamptz,uuid)']::regprocedure[])),
  'as funções do pedido rodam como dono, com search_path vazio'
);
select ok(
  (select bool_and(p.prosecdef and array_to_string(p.proconfig, ',') = 'search_path=""'
                   and has_function_privilege('authenticated', p.oid, 'EXECUTE')
                   and not has_function_privilege('anon', p.oid, 'EXECUTE'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'nucleo' and p.proname in ('cancelar_pedido', 'devolver_placa'))
  and (select count(*) = 2 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'nucleo' and p.proname in ('cancelar_pedido', 'devolver_placa')),
  'cancelar_pedido e devolver_placa existem, rodam como dono e só authenticated as executa'
);

-- ---- O destino não muda a situação direto ----
select tests.como(pg_temp.id('auth_Gestor B'));
select is(
  pg_temp.erro_de(format($$update nucleo.transferencia
      set situacao = 'concluida', recebida_em = now(), concluida_em = now() where id = %L$$, pg_temp.id('p1'))),
  '42501', 'o destino não marca o pedido como concluído direto (sem trocar a carteira)'
);
select is(
  pg_temp.erro_de(format($$update nucleo.transferencia set situacao = 'cancelada' where id = %L$$, pg_temp.id('p1'))),
  '42501', 'o destino não cancela direto'
);
select is(
  pg_temp.erro_de(format($$update nucleo.transferencia_pendencia set texto = 'Outra coisa' where transferencia_id = %L$$,
    pg_temp.id('p1'))),
  '42501', 'o destino não reescreve o texto da pendência'
);
select is(
  pg_temp.erro_de(format($$update nucleo.transferencia
      set excluido_em = now(), excluido_por = %L, motivo_da_exclusao = 'Sumir' where id = %L$$,
    pg_temp.id('Gestor B'), pg_temp.id('p1'))),
  '42501', 'o destino não exclui o pedido (exclusão lógica)'
);
reset role;

-- ---- A origem não muda o pedido direto ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  pg_temp.erro_de(format($$update nucleo.transferencia set situacao = 'em_conferencia', recebida_em = now() where id = %L$$,
    pg_temp.id('p1'))),
  '42501', 'a origem não marca o pedido como recebido'
);
select is(
  pg_temp.erro_de(format($$update nucleo.transferencia set motivo = 'Outro motivo', criado_em = '2025-01-01' where id = %L$$,
    pg_temp.id('p1'))),
  '42501', 'a origem não reescreve o motivo nem a data do pedido'
);
select is(
  pg_temp.erro_de(format($$insert into nucleo.transferencia
      (ativo_id, de_gestor_id, para_gestor_id, motivo, situacao, recebida_em, concluida_em)
      values (%L, %L, %L, 'Direto', 'concluida', now(), now())$$,
    pg_temp.id('k3'), pg_temp.id('Gestor A'), pg_temp.id('Gestor B'))),
  '42501', 'a origem não insere pedido direto (com situação concluída)'
);
select is(
  pg_temp.erro_de(format($$insert into nucleo.transferencia_pendencia (transferencia_id, texto) values (%L, 'Nova')$$,
    pg_temp.id('p1'))),
  '42501', 'a origem não insere pendência direto'
);
reset role;

-- ---- O destino recebe p1 (pelo app) ----
select tests.como(pg_temp.id('auth_Gestor B'));
select is(nucleo.receber_placa(pg_temp.id('p1'), pg_temp.versao('p1')), pg_temp.id('p1'), 'o destino recebe p1 pelo app');
reset role;

-- ---- Respostas forjadas ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  pg_temp.erro_de(format($$update nucleo.transferencia_pendencia
      set resposta = 'resolvida', respondida_por = %L, respondida_em = now() where transferencia_id = %L$$,
    pg_temp.id('Gestor B'), pg_temp.id('p1'))),
  '42501', 'a origem não responde a pendência em nome do destino'
);
select is(
  pg_temp.erro_de(format($$update nucleo.transferencia_pendencia
      set resposta = 'contestada', nota = 'Forjada', respondida_por = %L, respondida_em = now() where transferencia_id = %L$$,
    pg_temp.id('Gestor A'), pg_temp.id('p1'))),
  '42501', 'a origem não contesta a pendência (o que devolveria o pedido)'
);
reset role;
select tests.como(pg_temp.id('auth_Op'));
select is(
  (select count(*)::integer from nucleo.transferencia where id = pg_temp.id('p1')),
  1, 'o Operacional com a custódia de k1 vê o pedido'
);
select is(
  pg_temp.erro_de(format($$update nucleo.transferencia_pendencia
      set resposta = 'resolvida', respondida_por = %L, respondida_em = now() where transferencia_id = %L$$,
    pg_temp.id('Gestor B'), pg_temp.id('p1'))),
  '42501', 'o Operacional com a custódia não responde a pendência'
);
reset role;
select ok(
  (select situacao = 'em_conferencia' from nucleo.transferencia where id = pg_temp.id('p1'))
  and not exists (select 1 from nucleo.transferencia_pendencia where transferencia_id = pg_temp.id('p1') and resposta is not null),
  'p1 segue em conferência, com a pendência sem resposta'
);

-- ---- Cancelar: só a origem, só pendente ----
select tests.como(pg_temp.id('auth_Gestor C'));
select is(
  pg_temp.erro_de(format($$select nucleo.cancelar_pedido(%L, %s)$$, pg_temp.id('p2'), pg_temp.versao('p2'))),
  '42501', 'um terceiro gestor não cancela o pedido'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is(
  pg_temp.erro_de(format($$select nucleo.cancelar_pedido(%L, %s)$$, pg_temp.id('p2'), pg_temp.versao('p2'))),
  '42501', 'o destino não cancela o pedido (ele devolve, depois de receber)'
);
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(
  pg_temp.erro_de(format($$select nucleo.cancelar_pedido(%L, %s)$$, pg_temp.id('p2'), pg_temp.versao('p2'))),
  '42501', 'o Administrador não cancela em nome da origem'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  pg_temp.erro_de(format($$select nucleo.cancelar_pedido(%L, %s)$$, pg_temp.id('p1'), pg_temp.versao('p1'))),
  '23514', 'a origem não cancela depois que o destino recebeu'
);
select is(
  pg_temp.erro_de(format($$select nucleo.cancelar_pedido(%L, %s)$$, pg_temp.id('p2'), pg_temp.versao('p2') + 1)),
  '40001', 'cancelar confere a versão do pedido'
);
select is(
  nucleo.cancelar_pedido(pg_temp.id('p2'), pg_temp.versao('p2')),
  pg_temp.id('p2'), 'a origem cancela o próprio pedido pendente'
);
reset role;
select ok(
  (select situacao = 'cancelada' and cancelada_em is not null from nucleo.transferencia where id = pg_temp.id('p2'))
  and (select gestor_id = pg_temp.id('Gestor A') from nucleo.gestor_da_carteira
        where ativo_id = pg_temp.id('k2') and fim is null and excluido_em is null),
  'cancelado com a data, e a placa segue com a origem'
);
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  pg_temp.erro_de(format($$select nucleo.cancelar_pedido(%L, %s)$$, pg_temp.id('p2'), pg_temp.versao('p2'))),
  '23514', 'pedido cancelado não se cancela de novo'
);
select ok(
  nucleo.disponibilizar_placa(pg_temp.id('k2'), pg_temp.id('Gestor C'), 'Outro destino', '{}',
    (select versao from nucleo.ativo where id = pg_temp.id('k2'))) is not null,
  'depois de cancelar, a placa aceita um pedido novo'
);
reset role;

-- ---- Devolver: só o destino, só em conferência, com motivo ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  pg_temp.erro_de(format($$select nucleo.devolver_placa(%L, %s, 'Não quero')$$, pg_temp.id('p4'), pg_temp.versao('p4'))),
  '42501', 'a origem não devolve o pedido'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor C'));
select is(
  pg_temp.erro_de(format($$select nucleo.devolver_placa(%L, %s, 'Não quero')$$, pg_temp.id('p4'), pg_temp.versao('p4'))),
  '42501', 'um terceiro gestor não devolve o pedido'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is(
  pg_temp.erro_de(format($$select nucleo.devolver_placa(%L, %s, 'Não quero')$$, pg_temp.id('p4'), pg_temp.versao('p4'))),
  '23514', 'o destino só devolve depois de receber (pendente: recuse falando com a origem)'
);
select is(nucleo.receber_placa(pg_temp.id('p4'), pg_temp.versao('p4')), pg_temp.id('p4'), 'o destino recebe p4');
select is(
  pg_temp.erro_de(format($$select nucleo.devolver_placa(%L, %s, '   ')$$, pg_temp.id('p4'), pg_temp.versao('p4'))),
  '23514', 'devolver exige o motivo'
);
select is(
  nucleo.devolver_placa(pg_temp.id('p4'), pg_temp.versao('p4'), 'Placa com avaria não informada'),
  pg_temp.id('p4'), 'o destino devolve o pedido em conferência'
);
reset role;
select ok(
  (select situacao = 'devolvida' and devolvida_em is not null
          and motivo_da_devolucao = 'Placa com avaria não informada'
     from nucleo.transferencia where id = pg_temp.id('p4'))
  and (select gestor_id = pg_temp.id('Gestor A') from nucleo.gestor_da_carteira
        where ativo_id = pg_temp.id('k4') and fim is null and excluido_em is null),
  'devolvido com a data e o motivo, e a placa fica com a origem'
);

-- ---- Pela função, a resposta sai com quem de fato respondeu ----
select tests.como(pg_temp.id('auth_Gestor B'));
select is(
  nucleo.concluir_recebimento(pg_temp.id('p1'), pg_temp.versao('p1'),
    (select jsonb_agg(jsonb_build_object('id', id, 'resolvida', true)) from nucleo.transferencia_pendencia
      where transferencia_id = pg_temp.id('p1'))),
  pg_temp.id('p1'), 'o destino conclui p1 pelo app'
);
reset role;
select ok(
  (select bool_and(respondida_por = pg_temp.id('Gestor B')) from nucleo.transferencia_pendencia
    where transferencia_id = pg_temp.id('p1')),
  'a pendência sai com respondida_por = o usuário que concluiu'
);

-- ---- Carteira: o gestor não doa a placa nem forja vigência ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  pg_temp.erro_de(format($$update nucleo.gestor_da_carteira set gestor_id = %L
      where ativo_id = %L and fim is null$$, pg_temp.id('Gestor C'), pg_temp.id('k3'))),
  '23000', 'o gestor não troca o gestor_id da vigência (doar a placa)'
);
select is(
  pg_temp.erro_de(format($$select set_config('eixo.motivo', 'Correção', true);
      update nucleo.gestor_da_carteira set inicio = '2025-01-01 00:00-03'
      where ativo_id = %L and fim is null$$, pg_temp.id('k3'))),
  '23000', 'o gestor não forja vigência anterior (inicio)'
);
select is(
  pg_temp.erro_de(format($$
      update nucleo.gestor_da_carteira set fim = '2030-01-01 00:00-03', fim_origem = 'informada'
       where ativo_id = %1$L and fim is null;
      insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
      values (%1$L, %2$L, '2030-01-01 00:00-03', 'informada')$$, pg_temp.id('k3'), pg_temp.id('Gestor C'))),
  '42501', 'o gestor não fecha a vigência e insere a de outro gestor'
);
select is(
  pg_temp.erro_de(format($$insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, fim, inicio_origem, fim_origem)
      values (%L, %L, '2025-01-01 00:00-03', '2026-01-10 08:00-03', 'informada', 'informada')$$,
    pg_temp.id('k3'), pg_temp.id('Gestor A'))),
  '42501', 'o gestor não insere uma vigência anterior para si'
);
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(
  pg_temp.erro_de(format($$update nucleo.gestor_da_carteira set gestor_id = %L
      where ativo_id = %L and fim is null$$, pg_temp.id('Gestor C'), pg_temp.id('k3'))),
  '23000', 'D1: nem o Administrador troca o gestor por fora do fluxo'
);
select is(
  pg_temp.erro_de(format($$insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, fim, inicio_origem, fim_origem)
      values (%L, %L, '2025-01-01 00:00-03', '2026-01-10 08:00-03', 'informada', 'informada')$$,
    pg_temp.id('k3'), pg_temp.id('Gestor C'))),
  '42501', 'D1: nem o Administrador insere vigência direto'
);
reset role;

-- ---- O cadastro segue criando a primeira vigência (e a cobertura segue valendo) ----
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values (8405, 'K84E', true, true);
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(
  nucleo.cadastrar_ativo(
    p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8405), p_placa => 'FFF8F45',
    p_gestor_id => pg_temp.id('Gestor A'),
    p_cr_id => (select id from nucleo.cr where codigo = 'K84E'),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 84')) is not null,
  'o gestor cadastra placa na própria carteira (a primeira vigência nasce pela função)'
);
select is(pg_temp.erro_de('select 1'), 'executou', 'a cobertura da carteira confere o cadastro sem erro');
reset role;

select * from finish();
rollback;
