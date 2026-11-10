-- Operacional › Ordens de carregamento (primeira versão): a ordem nasce da placa aceita no pátio (ACe) e
-- registra o CAr na mesma transação; concluir o carregamento leva a CAn (ordem carregada); liberar a
-- viagem leva a ETc (ordem em viagem) e devolve a custódia ao gestor.
--  * Escopo por filial (config.ve_filial): a política ordem_de_carregamento_ler mostra as ordens da filial
--    do Operacional mesmo depois que a placa volta ao gestor; Administrador e Diretoria veem todas.
--  * Sem INSERT nem UPDATE diretos: só as funções gravam. Sempre com a chave de cada perfil (armadilha 9).
begin;
\ir apoio/como_usuario.psql

select plan(33);

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
    v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '.92@exemplo.local');
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
create function pg_temp.caminhao(p_nome text, p_n bigint, p_placa text) returns uuid language plpgsql as $$
begin
  insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values (p_n, 'K' || p_n, true, true);
  return pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => 'caminhao', p_renavam => pg_temp.renavam(p_n), p_placa => p_placa,
    p_gestor_id => pg_temp.id('Gestor A'), p_cr_id => (select id from nucleo.cr where codigo = 'K' || p_n),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 92'), p_em => '2026-01-10 08:00-03'));
end;
$$;
create function pg_temp.entregar(p_nome text, p_filial text) returns uuid language sql as $$
  select nucleo.entregar_ao_operacional(pg_temp.id(p_nome), (select id from config.filial where nome = p_filial),
    '2026-03-01 08:00-03', (select versao from nucleo.ativo where id = pg_temp.id(p_nome)))
$$;
create function pg_temp.patio(p_situacao text default 'todas') returns jsonb language sql as $$
  select nucleo.patio_da_filial(p_situacao)
$$;

create function pg_temp.ordens(p_situacao text default 'todas') returns jsonb language sql as $$
  select nucleo.ordens_de_carregamento(p_situacao)
$$;
create function pg_temp.operacao() returns uuid language sql as $$
  select id from nucleo.operacao where nome = 'Grãos 92'
$$;

-- ---- dados: dois pátios; T1 e T2 no Norte (T1 aceito e na fila), T3 no Sul ----
select pg_temp.pessoa('Gestor A', 920000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 920000002, 'administrador', false);
select pg_temp.pessoa('Dir', 920000003, 'diretoria', false);
select pg_temp.pessoa('Oper N', 920000004, 'operacional', false);
select pg_temp.pessoa('Oper S', 920000005, 'operacional', false);
insert into config.filial (nome) values ('Norte 92'), ('Sul 92');
insert into nucleo.usuario_filial (usuario_id, filial_id) values
  (pg_temp.id('Oper N'), (select id from config.filial where nome = 'Norte 92')),
  (pg_temp.id('Oper S'), (select id from config.filial where nome = 'Sul 92'));
insert into nucleo.operacao (nome) values ('Grãos 92');
select pg_temp.caminhao('T1', 9201, 'HHH9A21');
select pg_temp.caminhao('T2', 9202, 'HHH9A22');
select pg_temp.caminhao('T3', 9203, 'HHH9A23');
select pg_temp.disparar();
select pg_temp.entregar('T1', 'Norte 92');
select pg_temp.entregar('T2', 'Norte 92');
select pg_temp.entregar('T3', 'Sul 92');
select pg_temp.disparar();
reset role;
select tests.como(pg_temp.id('auth_Oper N'));
select nucleo.registrar_chegada('HHH9A21', '2026-03-01 09:00-03');
select nucleo.avancar_no_patio(pg_temp.id('T1'), 'aceitar', null, '2026-03-01 09:10-03');
reset role;

-- ---- Privilégios e forma ----
select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
     from unnest(array[
       'nucleo.criar_ordem_de_carregamento(uuid,uuid,text,date,timestamptz,uuid)',
       'nucleo.ordens_de_carregamento(text,integer,integer)']::regprocedure[]) f),
  'authenticated executa as funções das ordens; anon não'
);
select ok(
  (select prosecdef from pg_proc where oid = 'nucleo.criar_ordem_de_carregamento(uuid,uuid,text,date,timestamptz,uuid)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'nucleo.ordens_de_carregamento(text,integer,integer)'::regprocedure),
  'criar a ordem roda como dono (sem escrita direta); a lista roda com a RLS de quem consulta'
);
select ok(
  not has_table_privilege('authenticated', 'operacional.ordem_de_carregamento', 'INSERT')
  and not has_table_privilege('authenticated', 'operacional.ordem_de_carregamento', 'UPDATE')
  and has_table_privilege('authenticated', 'operacional.ordem_de_carregamento', 'SELECT'),
  'a ordem só se lê: sem INSERT nem UPDATE diretos'
);

-- ---- Criar a ordem ----
reset role;
select tests.como(pg_temp.id('auth_Oper N'));
select is(pg_temp.erro_de($$select nucleo.criar_ordem_de_carregamento('$$ || pg_temp.id('T2') || $$', '$$ || pg_temp.operacao() || $$', 'Porto 92', '2026-03-02', '2026-03-01 09:20-03')$$), '23514',
  'criar ordem: a placa ainda em DOp (não aceita) é recusada');
select is(pg_temp.erro_de($$select nucleo.criar_ordem_de_carregamento('$$ || pg_temp.id('T1') || $$', '$$ || pg_temp.operacao() || $$', '   ', '2026-03-02', '2026-03-01 09:20-03')$$), '23514',
  'criar ordem: sem destino é recusada');
select is(pg_temp.erro_de($$select nucleo.criar_ordem_de_carregamento('$$ || pg_temp.id('T1') || $$', '$$ || pg_temp.operacao() || $$', 'Porto 92', '2026-02-28', '2026-03-01 09:20-03')$$), '22023',
  'criar ordem: data prevista antes de hoje é recusada');
select is(pg_temp.erro_de($$select nucleo.criar_ordem_de_carregamento('$$ || pg_temp.id('T1') || $$', gen_random_uuid(), 'Porto 92', '2026-03-02', '2026-03-01 09:20-03')$$), '23503',
  'criar ordem: operação inexistente é recusada');
select is(pg_temp.erro_de($$select nucleo.criar_ordem_de_carregamento('$$ || pg_temp.id('T3') || $$', '$$ || pg_temp.operacao() || $$', 'Porto 92', '2026-03-02', '2026-03-01 09:20-03')$$), '23514',
  'criar ordem: a placa de outro pátio é recusada');
select set_config('t.chave', gen_random_uuid()::text, true);
select set_config('t.ordem', nucleo.criar_ordem_de_carregamento(pg_temp.id('T1'), pg_temp.operacao(), ' Porto 92 ', '2026-03-02',
  '2026-03-01 09:20-03', current_setting('t.chave')::uuid)::text, true);
select is(current_setting('t.ordem')::jsonb->>'situacao', 'carregando', 'criar ordem: a ordem nasce carregando');
select is(current_setting('t.ordem')::jsonb->>'placa', 'HHH9A21', 'criar ordem: com a placa do momento');
select is(nucleo.criar_ordem_de_carregamento(pg_temp.id('T1'), pg_temp.operacao(), 'Porto 92', '2026-03-02',
  '2026-03-01 09:20-03', current_setting('t.chave')::uuid)->>'numero', current_setting('t.ordem')::jsonb->>'numero',
  'criar ordem: o envio repetido (mesma chave) devolve a mesma ordem');
select is(pg_temp.erro_de($$select nucleo.criar_ordem_de_carregamento('$$ || pg_temp.id('T1') || $$', '$$ || pg_temp.operacao() || $$', 'Porto 92', '2026-03-02', '2026-03-01 09:25-03')$$), '23514',
  'criar ordem: a placa já carregando não ganha outra ordem');
select pg_temp.disparar();
select is((pg_temp.patio()->'linhas'->0->>'sigla'), 'CAr', 'criar ordem: a placa passa a carregando (CAr) no pátio');
select is((pg_temp.patio()->'contagens'->>'fila')::int, 0, 'criar ordem: a placa sai da fila');
select is(pg_temp.patio()->'linhas'->0->>'ordem_destino', 'Porto 92', 'pátio: mostra o destino da ordem aberta (sem espaços nas pontas)');

-- ---- Lista de ordens: o escopo de cada perfil ----
select is((pg_temp.ordens()->>'total')::int, 1, 'ordens: o Operacional do Norte vê a ordem do Norte');
select is((pg_temp.ordens()->'contagens'->>'carregando')::int, 1, 'ordens: a contagem por situação vem pronta');
select is((pg_temp.ordens('em_viagem')->>'total')::int, 0, 'ordens: o filtro por situação vale no banco');
reset role;
select tests.como(pg_temp.id('auth_Oper S'));
select is((pg_temp.ordens()->>'total')::int, 0, 'ordens: o Operacional do Sul não vê a ordem do Norte');
select is((select count(*)::int from operacional.ordem_de_carregamento), 0, 'ordem_de_carregamento_ler: o Sul não lê a ordem do Norte');
select is(pg_temp.erro_de($$update operacional.ordem_de_carregamento set destino = 'x'$$), '42501',
  'ordem: o Operacional não altera a ordem direto');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select ok((pg_temp.ordens()->>'total')::int >= 1, 'ordens: o Administrador vê todas');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select ok((select count(*)::int from operacional.ordem_de_carregamento) >= 1, 'ordem_de_carregamento_ler: a Diretoria lê todas');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.ordens_de_carregamento()$$), '42501', 'ordens: o Gestor de frota não tem o módulo Operacional');
select is((select count(*)::int from operacional.ordem_de_carregamento), 0, 'ordem_de_carregamento_ler: o Gestor de frota não lê ordens');

-- ---- Concluir o carregamento e liberar a viagem ----
reset role;
select tests.como(pg_temp.id('auth_Oper N'));
select is(pg_temp.erro_de($$select nucleo.avancar_no_patio('$$ || pg_temp.id('T1') || $$', 'liberar', null, '2026-03-01 10:00-03')$$), '23514',
  'liberar a viagem antes de concluir o carregamento é recusado');
select is(nucleo.avancar_no_patio(pg_temp.id('T1'), 'concluir', null, '2026-03-01 11:00-03')->>'sigla', 'CAn',
  'concluir o carregamento: a placa passa a carregado aguardando nota (CAn)');
select is((select situacao from operacional.ordem_de_carregamento where ativo_id = pg_temp.id('T1')), 'carregada',
  'concluir o carregamento: a ordem fica carregada');
select is(pg_temp.erro_de($$select nucleo.avancar_no_patio('$$ || pg_temp.id('T1') || $$', 'devolver', 'x', '2026-03-01 11:10-03')$$), '23514',
  'devolver ao gestor depois de carregar é recusado');
select is(nucleo.avancar_no_patio(pg_temp.id('T1'), 'liberar', null, '2026-03-01 12:00-03')->>'sigla', 'ETc',
  'liberar a viagem: a placa passa a em trânsito carregado (ETc)');
select pg_temp.disparar();
select is((pg_temp.ordens('em_viagem')->>'total')::int, 1,
  'liberar a viagem: a ordem fica em viagem e o Operacional continua vendo a ordem da filial');
select is((pg_temp.patio()->>'total')::int, 1, 'liberar a viagem: a placa sai do pátio (fica só T2)');
reset role;
select is((select com_quem::text from nucleo.custodia where ativo_id = pg_temp.id('T1') and fim is null and excluido_em is null), 'gestor',
  'liberar a viagem: a custódia vigente volta ao gestor');

select * from finish();
rollback;
