-- Fatia 3.9a, parte 2: a leitura das placas mantida por gatilho (nucleo.leitura_da_placa).
--  * Equivalência de SEGURANÇA: para cada perfil e cada ativo, ver a linha na tabela (política
--    leitura_da_placa_ler) é o mesmo que config.ve_ativo(ativo, {frota, operacional}, ver).
--  * Equivalência de DADOS: depois do cadastro e de cada tipo de mudança (engatar, evento, desatrelar,
--    baixa, troca de CR, transferência, entrega ao Operacional, dado do ativo, placa nova, operação,
--    nomes de pessoa, operação e CR), cada linha é igual à calculada agora pelas funções
--    (nucleo.linhas_divergentes() vazia). Sem o gatilho de uma tabela fonte, a mudança dela diverge.
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
create function pg_temp.placa(p_nome text, p_tipo nucleo.tipo_de_ativo, p_placa text, p_n bigint, p_gestor text) returns uuid language plpgsql as $$
begin
  insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio)
    values (8100 + p_n, 'M' || p_n, true, true);
  return pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => p_tipo, p_renavam => pg_temp.renavam(8100 + p_n), p_placa => p_placa,
    p_gestor_id => pg_temp.id(p_gestor),
    p_cr_id => (select id from nucleo.cr where codcencus = 8100 + p_n),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos'),
    p_em => '2026-01-10 08:00-03',
    p_funcao => case when p_tipo = 'implemento' then 'semirreboque'::nucleo.funcao_do_implemento end,
    p_carroceria_id => case when p_tipo = 'implemento' then (select id from config.carroceria where nome = 'Graneleira') end,
    p_eixos => case when p_nome = 'i1' then 3::smallint end
  ));
end;
$$;
-- Dispara os gatilhos adiados até aqui e volta ao modo adiado.
create function pg_temp.disparar() returns void language plpgsql as $$
begin
  set constraints all immediate;
  set constraints all deferred;
end;
$$;
create function pg_temp.divergentes() returns bigint language sql as $$
  select count(*) from nucleo.linhas_divergentes()
$$;

-- ---- estrutura ----
select has_table('nucleo', 'leitura_da_placa', 'existe a leitura mantida das placas');
select policies_are('nucleo', 'leitura_da_placa', array['leitura_da_placa_ler'], 'a leitura mantida só tem a política de ler (só a função de recálculo grava)');
select set_eq(
  $$select c.relname::text from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
     where t.tgname = 't99_leitura_da_placa' and n.nspname = 'nucleo'$$,
  array['ativo', 'placa_do_ativo', 'gestor_da_carteira', 'cr_do_ativo', 'placa_na_operacao', 'custodia',
        'estado_de_status', 'composicao', 'cr', 'pessoa', 'operacao'],
  'toda tabela fonte da linha tem o gatilho de recálculo'
);
select ok(
  not exists (select 1 from information_schema.role_table_grants
               where table_schema = 'nucleo' and table_name = 'leitura_da_placa' and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  'quem entrou só lê a leitura mantida (nada de gravar)'
);

-- ---- dados ----
select pg_temp.pessoa('Gestor A', 810000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 810000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 810000003, 'administrador', false);
select pg_temp.pessoa('Opa', 810000004, 'operacional', false);
select pg_temp.pessoa('Opb', 810000005, 'operacional', false);
select pg_temp.pessoa('Dir', 810000006, 'diretoria', false);
insert into nucleo.operacao (nome) values ('Grãos'), ('Celulose');
insert into config.filial (nome) values ('Filial A'), ('Filial B');
insert into nucleo.usuario_filial (usuario_id, filial_id) values
  (pg_temp.id('Opa'), (select id from config.filial where nome = 'Filial A')),
  (pg_temp.id('Opb'), (select id from config.filial where nome = 'Filial B'));
select pg_temp.placa('k1', 'cavalo', 'CCC1C11', 1, 'Gestor A');
select pg_temp.placa('i1', 'implemento', 'CCC1C12', 2, 'Gestor A');
select pg_temp.placa('i2', 'implemento', 'CCC1C13', 3, 'Gestor A');
select pg_temp.placa('ap1', 'apoio', 'CCC1C14', 4, 'Gestor A');
select pg_temp.placa('cm1', 'caminhao', 'CCC1C15', 5, 'Gestor A');
select pg_temp.placa('k2', 'cavalo', 'DDD2D22', 6, 'Gestor B');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values (8199, 'M99', true, true);
select pg_temp.disparar();

select is(pg_temp.divergentes(), 0::bigint, 'depois do cadastro, cada linha é igual à calculada');
select is((select count(*) from nucleo.leitura_da_placa), 6::bigint, 'uma linha por ativo');

-- ---- mudanças, uma de cada tabela fonte, cada uma conferida ----
select nucleo.engatar(pg_temp.id('k1'), pg_temp.id('i1'), 1::smallint, '2026-01-11 08:00-03');
select pg_temp.disparar();
select is(pg_temp.divergentes(), 0::bigint, 'engatar (composição): o cavalo e o implemento ficam iguais ao calculado');

select nucleo.registrar_evento(pg_temp.id('k1'), 'ETv', '2026-01-12 08:00-03');
select pg_temp.disparar();
select ok(
  pg_temp.divergentes() = 0 and (select sigla from nucleo.leitura_da_placa where ativo_id = pg_temp.id('i1')) = 'ETv',
  'evento do cavalo (estado de status): o implemento engatado herda a situação'
);

select nucleo.desatrelar(pg_temp.id('k1'), '2026-01-13 08:00-03');
select pg_temp.disparar();
select is(pg_temp.divergentes(), 0::bigint, 'desatrelar (composição que termina)');

select nucleo.registrar_baixa(pg_temp.id('ap1'), 'VND', '2026-01-14 08:00-03', 'Vendido');
select pg_temp.disparar();
select is(pg_temp.divergentes(), 0::bigint, 'baixa (baixa do ativo, gestor e posse)');

select nucleo.registrar_evento(pg_temp.id('k2'), 'ETv', '2026-01-14 09:00-03');
update nucleo.evento_de_status set excluido_em = now(), motivo_da_exclusao = 'Registrado por engano'
 where id = (select id from nucleo.evento_de_status
              where ativo_id = pg_temp.id('k2') and camada = 'atividade' and excluido_em is null
              order by em desc limit 1);
select pg_temp.disparar();
select ok(
  pg_temp.divergentes() = 0
  and (select sigla from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k2')) = 'PÁT'
  and (select ultima_correcao_tardia_em from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k2')) is not null,
  'correção de evento: a situação volta e a correção tardia fica guardada'
);

update nucleo.cr_do_ativo set fim = '2026-01-15 08:00-03', fim_origem = 'informada'
 where ativo_id = pg_temp.id('k2') and fim is null;
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
  values (pg_temp.id('k2'), (select id from nucleo.cr where codigo = 'M99'), '2026-01-15 08:00-03', 'informada');
select pg_temp.disparar();
select ok(
  pg_temp.divergentes() = 0 and (select cr from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k2')) = 'M99',
  'troca de CR (CR do ativo)'
);

insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo, situacao)
  values (pg_temp.id('k2'), pg_temp.id('Gestor B'), pg_temp.id('Gestor A'), 'Teste', 'pendente');
select nucleo.receber_transferencia((select id from nucleo.transferencia where ativo_id = pg_temp.id('k2')), '2026-01-16 08:00-03');
select nucleo.concluir_transferencia((select id from nucleo.transferencia where ativo_id = pg_temp.id('k2')), '2026-01-16 09:00-03');
select pg_temp.disparar();
select ok(
  pg_temp.divergentes() = 0 and (select gestor_id from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k2')) = pg_temp.id('Gestor A'),
  'transferência (gestor da carteira)'
);

select nucleo.entregar_ao_operacional(pg_temp.id('cm1'), (select id from config.filial where nome = 'Filial A'),
  '2026-01-17 08:00-03', (select versao from nucleo.ativo where id = pg_temp.id('cm1')));
select pg_temp.disparar();
select ok(
  pg_temp.divergentes() = 0
  and (select filial_da_custodia_id from nucleo.leitura_da_placa where ativo_id = pg_temp.id('cm1')) = (select id from config.filial where nome = 'Filial A'),
  'entrega ao Operacional (custódia)'
);

update nucleo.custodia set filial_id = (select id from config.filial where nome = 'Filial B')
 where ativo_id = pg_temp.id('cm1') and com_quem = 'operacional' and fim is null;
select pg_temp.disparar();
select ok(
  pg_temp.divergentes() = 0
  and (select filial_da_custodia_id from nucleo.leitura_da_placa where ativo_id = pg_temp.id('cm1')) = (select id from config.filial where nome = 'Filial B'),
  'só a custódia muda (outra filial)'
);

update nucleo.ativo set eixos = 3, ano_fabricacao = 2020, ano_modelo = 2021
 where id = pg_temp.id('i2');
select pg_temp.disparar();
select ok(
  pg_temp.divergentes() = 0 and not (select 'implemento_sem_eixos' = any (alertas_vigentes) from nucleo.leitura_da_placa where ativo_id = pg_temp.id('i2')),
  'dado do ativo (eixos): o alerta some'
);
select ok(
  current_user = 'postgres' and (select ano from nucleo.leitura_da_placa where ativo_id = pg_temp.id('i2')) = 2021,
  'a gravação direta pelo dono do banco (sem login) também dispara os gatilhos'
);

update nucleo.placa_do_ativo set fim = '2026-01-18 08:00-03', fim_origem = 'informada'
 where ativo_id = pg_temp.id('i2') and fim is null;
insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
  values (pg_temp.id('i2'), 'EEE3E33', '2026-01-18 08:00-03', 'informada');
select pg_temp.disparar();
select ok(
  pg_temp.divergentes() = 0 and (select placa from nucleo.leitura_da_placa where ativo_id = pg_temp.id('i2')) = 'EEE3E33',
  'placa nova (placa do ativo)'
);

update nucleo.placa_na_operacao set fim = '2026-01-19 08:00-03', fim_origem = 'informada'
 where ativo_id = pg_temp.id('k1') and fim is null;
insert into nucleo.placa_na_operacao (ativo_id, operacao_id, inicio, inicio_origem)
  values (pg_temp.id('k1'), (select id from nucleo.operacao where nome = 'Celulose'), '2026-01-19 08:00-03', 'informada');
select pg_temp.disparar();
select ok(
  pg_temp.divergentes() = 0 and (select operacao from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k1')) = 'Celulose',
  'operação nova (placa na operação)'
);

update nucleo.pessoa set nome = 'Gestor A Renomeado' where id = pg_temp.id('Gestor A');
update nucleo.operacao set nome = 'Grãos MT' where nome = 'Grãos';
update nucleo.cr set codigo = 'M99X' where codigo = 'M99';
select pg_temp.disparar();
select ok(
  pg_temp.divergentes() = 0
  and (select gestor from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k1')) = 'Gestor A Renomeado'
  and (select operacao from nucleo.leitura_da_placa where ativo_id = pg_temp.id('i2')) = 'Grãos MT'
  and (select cr from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k2')) = 'M99X',
  'nomes de pessoa, operação e CR'
);

-- ---- equivalência de segurança: cada perfil, cada ativo ----
create temp table todos_os_ativos as select id from nucleo.ativo where excluido_em is null;
grant select on todos_os_ativos to authenticated;
create function pg_temp.visibilidade_diverge() returns bigint language sql as $$
  select count(*) from pg_temp.todos_os_ativos t
   where config.ve_ativo(t.id, array['frota', 'operacional'], 'ver')
         is distinct from exists (select 1 from nucleo.leitura_da_placa l where l.ativo_id = t.id)
$$;
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.visibilidade_diverge(), 0::bigint, 'Administrador: a tabela mostra exatamente o que ve_ativo deixa');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is(pg_temp.visibilidade_diverge(), 0::bigint, 'Diretoria: igual a ve_ativo');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(
  pg_temp.visibilidade_diverge() = 0 and (select count(*) from nucleo.leitura_da_placa) between 1 and 5,
  'Gestor A: igual a ve_ativo (só a carteira dele)'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select ok(
  pg_temp.visibilidade_diverge() = 0 and not exists (select 1 from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k1')),
  'Gestor B: igual a ve_ativo (não vê a placa do gestor A)'
);
reset role;
select tests.como(pg_temp.id('auth_Opa'));
select ok(
  pg_temp.visibilidade_diverge() = 0 and not exists (select 1 from nucleo.leitura_da_placa),
  'Operacional da filial A: igual a ve_ativo (a custódia passou à filial B)'
);
reset role;
select tests.como(pg_temp.id('auth_Opb'));
select ok(
  pg_temp.visibilidade_diverge() = 0 and exists (select 1 from nucleo.leitura_da_placa where ativo_id = pg_temp.id('cm1')),
  'Operacional da filial B: igual a ve_ativo (vê o que está com a filial dele)'
);
reset role;
select tests.como_anonimo();
select throws_ok($$select count(*) from nucleo.leitura_da_placa$$, '42501', null, 'sem login não lê');
reset role;

-- ---- reconstrução e recálculo agendado ----
create temp table pelos_gatilhos as select to_jsonb(l) - 'recalculado_em' as linha from nucleo.leitura_da_placa l;
select is(nucleo.reconstruir_leitura_das_placas(), 6, 'a reconstrução total refaz uma linha por ativo');
select set_eq(
  $$select to_jsonb(l) - 'recalculado_em' from nucleo.leitura_da_placa l$$,
  $$select linha from pelos_gatilhos$$,
  'a reconstrução total produz a mesma tabela que os gatilhos, linha a linha'
);
select is(pg_temp.divergentes(), 0::bigint, 'e continua igual ao calculado');

-- ---- segurança: o que authenticated executa entre as funções da 3.9a (nada a mais) ----
select set_eq(
  $$select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('nucleo', 'config')
       and p.proname in ('texto_simples', 'placas_filtradas', 'listar_placas', 'contar_chips_de_placas', 'ativo_da_placa',
                         'detalhe_da_placa', 'historia_da_placa', 'alertas_vigentes_do_ativo', 'inicio_do_pat',
                         'ultima_correcao_tardia_em', 'alerta_parado_em_patio', 'alerta_correcao_tardia', 'alertas_com_prazos',
                         'alertas_do_ativo', 've_todas_as_placas', 'minha_carteira_de_placas', 'minhas_operacoes_de_placas',
                         'minhas_filiais_de_placas', 'atualizar_leitura_vencida', 'linha_calculada_da_placa',
                         'proximo_recalculo_do_ativo', 'recalcular_so_a_linha', 'recalcular_linha_da_placa',
                         'recalcular_pela_mudanca', 'reconstruir_leitura_das_placas', 'recalcular_linhas_vencidas', 'linhas_divergentes')
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')$$,
  array['nucleo.texto_simples(text)', 'nucleo.placas_filtradas(text,text[],text[],text[],boolean)',
        'nucleo.listar_placas(text,text[],text[],text[],boolean,text,boolean,integer,integer)',
        'nucleo.contar_chips_de_placas(text,text[],text[],text[],boolean)', 'nucleo.ativo_da_placa(text)',
        'nucleo.detalhe_da_placa(text)', 'nucleo.historia_da_placa(text)',
        'nucleo.alertas_vigentes_do_ativo(uuid,timestamp with time zone)', 'nucleo.inicio_do_pat(uuid)',
        'nucleo.ultima_correcao_tardia_em(uuid)', 'nucleo.alerta_parado_em_patio(timestamp with time zone,timestamp with time zone)',
        'nucleo.alerta_correcao_tardia(timestamp with time zone,timestamp with time zone)',
        'nucleo.alertas_com_prazos(text[],timestamp with time zone,timestamp with time zone,boolean,timestamp with time zone)',
        'nucleo.alertas_do_ativo(uuid,timestamp with time zone)', 'config.ve_todas_as_placas()',
        'config.minha_carteira_de_placas()', 'config.minhas_operacoes_de_placas()', 'config.minhas_filiais_de_placas()',
        'nucleo.atualizar_leitura_vencida()'],
  'authenticated executa só as leituras, os ajudantes que a política usa e a atualização das vencidas'
);

-- ---- vigência futura, com o relógio simulado por parâmetro (plano B: as vencidas antes da leitura) ----
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values (8198, 'M98', true, true);
update nucleo.cr_do_ativo set fim = date_trunc('second', now()) + interval '10 days', fim_origem = 'informada'
 where ativo_id = pg_temp.id('k1') and fim is null and excluido_em is null;
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
  values (pg_temp.id('k1'), (select id from nucleo.cr where codigo = 'M98'), date_trunc('second', now()) + interval '10 days', 'informada');
select pg_temp.disparar();
select ok(
  (select proximo_recalculo from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k1')) = date_trunc('second', now()) + interval '10 days'
  and (select cr from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k1')) = 'M1',
  'CR que começa no futuro: a linha ainda mostra o CR de agora e guarda o instante da troca'
);
select is(nucleo.recalcular_linhas_vencidas(500, now() + interval '9 days'), 0, 'antes do instante, nenhuma linha vence');
select ok(nucleo.recalcular_linhas_vencidas(500, date_trunc('second', now()) + interval '10 days 1 second') >= 1, 'chegado o instante, a linha vence e é recalculada');
select ok(
  (select cr from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k1')) = 'M98'
  and (select to_jsonb(l) - 'recalculado_em' from nucleo.leitura_da_placa l where l.ativo_id = pg_temp.id('k1'))
      = to_jsonb(nucleo.linha_calculada_da_placa(pg_temp.id('k1'), date_trunc('second', now()) + interval '10 days 1 second')) - 'recalculado_em',
  'e fica igual à calculada naquele instante'
);

select * from finish();
rollback;
