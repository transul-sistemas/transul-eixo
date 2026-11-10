-- Operacional › Pátio e Totem (primeira versão): a fila por ordem de chegada (operacional.chegada) e o
-- avanço da placa sob custódia do Operacional da filial (aceitar DOp → ACe; devolver ao gestor).
--  * Escopo por filial (config.ve_filial): o Operacional vê e age só nas placas sob custódia da sua
--    filial; Administrador e Diretoria, em todas; o Gestor de frota e o usuário sem vínculo, em nenhuma.
--  * Políticas: chegada_ler (leitura pela filial). Sem INSERT nem UPDATE diretos: só as funções gravam.
--  * Sempre com a chave do usuário de cada perfil (armadilha 9).
begin;
\ir apoio/como_usuario.psql

select plan(39);

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
    v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '.91@exemplo.local');
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
    p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 91'), p_em => '2026-01-10 08:00-03'));
end;
$$;
create function pg_temp.entregar(p_nome text, p_filial text) returns uuid language sql as $$
  select nucleo.entregar_ao_operacional(pg_temp.id(p_nome), (select id from config.filial where nome = p_filial),
    '2026-03-01 08:00-03', (select versao from nucleo.ativo where id = pg_temp.id(p_nome)))
$$;
create function pg_temp.patio(p_situacao text default 'todas') returns jsonb language sql as $$
  select nucleo.patio_da_filial(p_situacao)
$$;

-- ---- dados: dois pátios (Norte e Sul); três caminhões do Gestor A, dois no Norte e um no Sul ----
select pg_temp.pessoa('Gestor A', 910000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 910000002, 'administrador', false);
select pg_temp.pessoa('Dir', 910000003, 'diretoria', false);
select pg_temp.pessoa('Oper N', 910000004, 'operacional', false);
select pg_temp.pessoa('Oper S', 910000005, 'operacional', false);
select pg_temp.guardar('auth_sem_vinculo', tests.criar_usuario('sem.vinculo.91@exemplo.local'));
insert into config.filial (nome) values ('Norte 91'), ('Sul 91');
insert into nucleo.usuario_filial (usuario_id, filial_id) values
  (pg_temp.id('Oper N'), (select id from config.filial where nome = 'Norte 91')),
  (pg_temp.id('Oper S'), (select id from config.filial where nome = 'Sul 91'));
insert into nucleo.operacao (nome) values ('Grãos 91');
select pg_temp.caminhao('T1', 9101, 'GGG9A11');
select pg_temp.caminhao('T2', 9102, 'GGG9A12');
select pg_temp.caminhao('T3', 9103, 'GGG9A13');
select pg_temp.disparar();
select pg_temp.entregar('T1', 'Norte 91');
select pg_temp.entregar('T2', 'Norte 91');
select pg_temp.entregar('T3', 'Sul 91');
select pg_temp.disparar();

-- ---- Privilégios e forma ----
select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
     from unnest(array[
       'nucleo.registrar_chegada(text,timestamptz,uuid)',
       'nucleo.avancar_no_patio(uuid,text,text,timestamptz,uuid)',
       'nucleo.patio_da_filial(text,integer,integer)',
       'config.ve_filial(uuid,text,text)']::regprocedure[]) f),
  'authenticated executa as funções do Pátio e do Totem; anon não'
);
select ok(
  (select bool_and(p.prosecdef) from pg_proc p where p.oid = any (array[
       'nucleo.registrar_chegada(text,timestamptz,uuid)',
       'nucleo.avancar_no_patio(uuid,text,text,timestamptz,uuid)']::regprocedure[]))
  and not (select prosecdef from pg_proc where oid = 'nucleo.patio_da_filial(text,integer,integer)'::regprocedure),
  'as que gravam rodam como dono (sem escrita direta); a leitura roda com a RLS de quem consulta'
);
select ok(
  not has_table_privilege('authenticated', 'operacional.chegada', 'INSERT')
  and not has_table_privilege('authenticated', 'operacional.chegada', 'UPDATE')
  and not has_table_privilege('authenticated', 'operacional.chegada', 'DELETE')
  and has_table_privilege('authenticated', 'operacional.chegada', 'SELECT'),
  'a fila só se lê: sem INSERT, UPDATE nem DELETE diretos'
);
select ok(
  not has_function_privilege('authenticated', 'nucleo.placa_no_patio_para_agir(uuid,text,timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'nucleo.devolver_custodia_ao_gestor(uuid,uuid,timestamptz)', 'EXECUTE'),
  'o apoio das funções que gravam não é executável pelo app'
);

-- ---- Pátio: o escopo de cada perfil ----
reset role;
select tests.como(pg_temp.id('auth_Oper N'));
select is((pg_temp.patio()->>'total')::int, 2, 'pátio: o Operacional do Norte vê as duas placas do Norte');
select is((pg_temp.patio()->'contagens'->>'DOp')::int, 2, 'pátio: as duas em DOp (contagem pronta do banco)');
reset role;
select tests.como(pg_temp.id('auth_Oper S'));
select is((pg_temp.patio()->>'total')::int, 1, 'pátio: o Operacional do Sul vê só a placa do Sul');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select ok((pg_temp.patio()->>'total')::int >= 3, 'pátio: o Administrador vê os dois pátios');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select ok((pg_temp.patio()->>'total')::int >= 3, 'pátio: a Diretoria vê os dois pátios');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.patio_da_filial()$$), '42501', 'pátio: o Gestor de frota não tem o módulo Operacional');
reset role;
select tests.como(pg_temp.id('auth_sem_vinculo'));
select is(pg_temp.erro_de($$select nucleo.patio_da_filial()$$), '42501', 'pátio: o usuário sem vínculo não vê nada');

-- ---- Totem: a fila por ordem de chegada ----
reset role;
select tests.como(pg_temp.id('auth_Oper N'));
select is((nucleo.registrar_chegada('ggg-9a12', '2026-03-01 09:00-03')->>'posicao')::int, 1,
  'totem: a primeira chegada (placa digitada com traço e minúscula) fica na posição 1');
select is((nucleo.registrar_chegada('GGG9A11', '2026-03-01 09:10-03')->>'posicao')::int, 2,
  'totem: a segunda chegada fica na posição 2');
select is(nucleo.registrar_chegada('GGG9A12', '2026-03-01 09:20-03')->>'ja_estava', 'true',
  'totem: quem já está na fila não entra de novo');
select is((nucleo.registrar_chegada('GGG9A12', '2026-03-01 09:20-03')->>'posicao')::int, 1,
  'totem: e continua na mesma posição');
select is((select count(*)::int from operacional.chegada where saiu_em is null), 2,
  'totem: duas chegadas abertas no Norte (lidas pela política chegada_ler)');
select is(pg_temp.erro_de($$select nucleo.registrar_chegada('GGG9A13', '2026-03-01 09:30-03')$$), '23514',
  'totem: a placa de outro pátio não entra na fila desta filial');
select is(pg_temp.erro_de($$select nucleo.registrar_chegada('XYZ', '2026-03-01 09:30-03')$$), '23514',
  'totem: placa incompleta é recusada');
select is(pg_temp.erro_de($$select nucleo.registrar_chegada('GGG9A11', now() + interval '1 day')$$), '22023',
  'totem: chegada no futuro é recusada');
select pg_temp.disparar();
select is(pg_temp.patio()->'linhas'->0->>'placa', 'GGG9A12', 'pátio: a fila vem primeiro, pela ordem de chegada');
select is((pg_temp.patio()->'contagens'->>'fila')::int, 2, 'pátio: a contagem da fila vem pronta');
select is((pg_temp.patio('fila')->>'total')::int, 2, 'pátio: o filtro "fila" traz só quem está na fila');
reset role;
select tests.como(pg_temp.id('auth_Oper S'));
select is((select count(*)::int from operacional.chegada), 0, 'chegada_ler: o Sul não vê a fila do Norte');
select is(pg_temp.erro_de($$insert into operacional.chegada (ativo_id, filial_id, chegou_em)
  values ('$$ || pg_temp.id('T3') || $$', (select id from config.filial where nome = 'Sul 91'), now())$$), '42501',
  'chegada: o Operacional não grava direto na fila');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.registrar_chegada('GGG9A13')$$), '42501', 'totem: o Gestor de frota não registra chegada');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is((select count(*)::int from operacional.chegada where ativo_id in (pg_temp.id('T1'), pg_temp.id('T2'))), 2,
  'chegada_ler: o Administrador vê a fila do Norte');

-- ---- Pátio: aceitar e devolver ao gestor ----
reset role;
select tests.como(pg_temp.id('auth_Oper N'));
select is(nucleo.avancar_no_patio(pg_temp.id('T2'), 'aceitar', null, '2026-03-01 09:30-03')->>'sigla', 'ACe',
  'aceitar: a placa em DOp passa a aguardando carregamento (ACe)');
select is(pg_temp.erro_de($$select nucleo.avancar_no_patio('$$ || pg_temp.id('T2') || $$', 'aceitar', null, '2026-03-01 09:35-03')$$), '23514',
  'aceitar de novo é recusado (a placa já está em ACe)');
select is(pg_temp.erro_de($$select nucleo.avancar_no_patio('$$ || pg_temp.id('T1') || $$', 'concluir', null, '2026-03-01 09:35-03')$$), '23514',
  'concluir o carregamento de placa que não está carregando é recusado');
select is(pg_temp.erro_de($$select nucleo.avancar_no_patio('$$ || pg_temp.id('T1') || $$', 'pular', null, '2026-03-01 09:35-03')$$), '22023',
  'ação desconhecida é recusada');
select is(pg_temp.erro_de($$select nucleo.avancar_no_patio('$$ || pg_temp.id('T3') || $$', 'aceitar', null, '2026-03-01 09:35-03')$$), '23514',
  'o Operacional do Norte não age na placa do Sul');
select is(pg_temp.erro_de($$select nucleo.avancar_no_patio('$$ || pg_temp.id('T1') || $$', 'devolver', '  ', '2026-03-01 09:40-03')$$), '23514',
  'devolver ao gestor sem motivo é recusado');
select is(nucleo.avancar_no_patio(pg_temp.id('T1'), 'devolver', 'Motorista não apareceu', '2026-03-01 09:40-03')->>'sigla', 'PÁT',
  'devolver ao gestor: a placa volta a PÁT');
select pg_temp.disparar();
select is((pg_temp.patio()->>'total')::int, 1, 'devolver: a placa sai do pátio do Norte');
select is((pg_temp.patio()->'contagens'->>'fila')::int, 1, 'devolver: e sai da fila');
reset role;
select is((select com_quem::text from nucleo.custodia where ativo_id = pg_temp.id('T1') and fim is null and excluido_em is null), 'gestor',
  'devolver: a custódia vigente volta ao gestor');
select is((select motivo_da_saida from operacional.chegada where ativo_id = pg_temp.id('T1')), 'devolucao',
  'devolver: a chegada fecha com o motivo devolução');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.avancar_no_patio('$$ || pg_temp.id('T2') || $$', 'devolver', 'x', '2026-03-01 09:45-03')$$), '42501',
  'o Gestor de frota não age no pátio');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(nucleo.avancar_no_patio(pg_temp.id('T3'), 'aceitar', null, '2026-03-01 09:50-03')->>'sigla', 'ACe',
  'o Administrador (escopo tudo) aceita no pátio do Sul');

select * from finish();
rollback;
