-- Fatia 3.9b-1: gravar pelo banco. "Disponibilizar placa" (o envio a outro gestor de frota, com motivo e
-- pendências), "Receber placa" (registra a chegada) e "Concluir recebimento" (responde cada pendência e
-- troca o gestor), com chave de envio e versão; o destinatário vê a placa enquanto o pedido está aberto
-- ("Para receber"); as leituras dos assistentes. Sempre com a chave do usuário de cada perfil.
begin;
\ir apoio/como_usuario.psql

select plan(69);

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
create function pg_temp.lista_para_receber() returns int language sql as $$
  select (nucleo.listar_placas('', '{}', '{}', '{}', false, 'placa', false, 1, 25, true) ->> 'total')::int
$$;
create function pg_temp.chip(p_chip text) returns bigint language sql as $$
  select coalesce((select quantidade from nucleo.contar_chips_de_placas('', '{}', '{}', '{}', false) where chip = p_chip), 0)
$$;
create function pg_temp.respostas(p_pedido uuid, p_resolvida boolean, p_nota text, p_quantas int default 99) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'resolvida', p_resolvida, 'nota', p_nota)), '[]'::jsonb)
    from (select id from nucleo.transferencia_pendencia where transferencia_id = p_pedido order by criado_em, id limit p_quantas) p
$$;

-- ---- estrutura ----
select has_function('config', 'minhas_placas_para_receber', array[]::text[], 'existe o ajudante das placas para receber');
select has_function('nucleo', 'contar_para_receber', array[]::text[], 'existe a contagem do "Para receber"');
select has_function('nucleo', 'pedido_aberto_da_placa', array['text'], 'existe o pedido aberto da placa');
select has_function('nucleo', 'pedidos_para_receber', array[]::text[], 'existe a lista dos pedidos para receber');
select has_function('nucleo', 'placa_para_assistente', array['text'], 'existe a placa para o assistente');
select has_function('nucleo', 'catalogos_dos_assistentes', array[]::text[], 'existem os catálogos dos assistentes');
select has_function('nucleo', 'disponibilizar_placa',
  array['uuid', 'uuid', 'text', 'text[]', 'integer', 'timestamp with time zone', 'uuid'], 'existe o "Disponibilizar placa"');
select has_function('nucleo', 'receber_placa', array['uuid', 'integer', 'timestamp with time zone', 'uuid'], 'existe o "Receber placa"');
select has_function('nucleo', 'concluir_recebimento',
  array['uuid', 'integer', 'jsonb', 'timestamp with time zone', 'uuid'], 'existe o "Concluir recebimento"');
select has_function('nucleo', 'listar_placas',
  array['text', 'text[]', 'text[]', 'text[]', 'boolean', 'text', 'boolean', 'integer', 'integer', 'boolean'],
  'a lista de placas ganhou o filtro "Para receber"');
select ok(
  (select bool_and(not p.prosecdef) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'nucleo' and p.proname in ('contar_para_receber', 'pedido_aberto_da_placa', 'pedidos_para_receber',
      'placa_para_assistente', 'catalogos_dos_assistentes', 'disponibilizar_placa', 'receber_placa', 'concluir_recebimento',
      'placas_filtradas', 'listar_placas', 'contar_chips_de_placas')),
  'as funções novas rodam com a RLS de quem chama (SECURITY INVOKER)'
);
select set_eq(
  $$select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('nucleo', 'config')
       and p.proname in ('minhas_placas_para_receber', 'contar_para_receber', 'pedido_aberto_da_placa', 'pedidos_para_receber',
                         'placa_para_assistente', 'catalogos_dos_assistentes', 'disponibilizar_placa', 'receber_placa',
                         'concluir_recebimento', 'placas_filtradas', 'listar_placas', 'contar_chips_de_placas',
                         'pedido_em_json', 'pedido_para_agir')
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')$$,
  array['config.minhas_placas_para_receber()', 'nucleo.contar_para_receber()', 'nucleo.pedido_aberto_da_placa(text)',
        'nucleo.pedidos_para_receber()', 'nucleo.placa_para_assistente(text)', 'nucleo.catalogos_dos_assistentes()',
        'nucleo.disponibilizar_placa(uuid,uuid,text,text[],integer,timestamp with time zone,uuid)',
        'nucleo.receber_placa(uuid,integer,timestamp with time zone,uuid)',
        'nucleo.concluir_recebimento(uuid,integer,jsonb,timestamp with time zone,uuid)',
        'nucleo.placas_filtradas(text,text[],text[],text[],boolean,boolean)',
        'nucleo.listar_placas(text,text[],text[],text[],boolean,text,boolean,integer,integer,boolean)',
        'nucleo.contar_chips_de_placas(text,text[],text[],text[],boolean,boolean)', 'nucleo.pedido_em_json(uuid)',
        'nucleo.pedido_para_agir(uuid,text)'],
  'authenticated executa só as funções novas desta fatia (e nenhuma assinatura antiga da lista)'
);

-- ---- dados ----
select pg_temp.pessoa('Gestor A', 820000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 820000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor C', 820000003, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 820000004, 'administrador', false);
select pg_temp.pessoa('Op', 820000005, 'operacional', false);
insert into nucleo.operacao (nome) values ('Grãos 82');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (8201, 'K82', true, true), (8202, 'LIVRE82', true, true);
select pg_temp.guardar('k1', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8201), p_placa => 'EEE8E21',
  p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K82'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 82'),
  p_em => '2026-01-10 08:00-03'
));
select pg_temp.disparar();

-- ---- Disponibilizar placa ----
select tests.como(pg_temp.id('auth_Gestor C'));
select throws_ok(
  format($$select nucleo.disponibilizar_placa(%L, %L, 'troca', '{}', 1)$$, pg_temp.id('k1'), pg_temp.id('Gestor B')),
  '42501', null, 'o gestor de outra carteira não disponibiliza a placa'
);
reset role;
select tests.como(pg_temp.id('auth_Op'));
select throws_ok(
  format($$select nucleo.disponibilizar_placa(%L, %L, 'troca', '{}', 1)$$, pg_temp.id('k1'), pg_temp.id('Gestor B')),
  '42501', null, 'o Operacional não disponibiliza placa'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select throws_ok(
  format($$select nucleo.disponibilizar_placa(%L, %L, 'troca', '{}', (select versao + 1 from nucleo.ativo where id = %L))$$,
         pg_temp.id('k1'), pg_temp.id('Gestor B'), pg_temp.id('k1')),
  '40001', null, 'versão velha da placa: "este registro mudou"'
);
select throws_ok(
  format($$select nucleo.disponibilizar_placa(%L, %L, '  ', '{}', (select versao from nucleo.ativo where id = %L))$$,
         pg_temp.id('k1'), pg_temp.id('Gestor B'), pg_temp.id('k1')),
  '23514', null, 'o motivo é obrigatório'
);
select throws_ok(
  format($$select nucleo.disponibilizar_placa(%L, %L, 'troca', '{}', (select versao from nucleo.ativo where id = %L))$$,
         pg_temp.id('k1'), pg_temp.id('Gestor A'), pg_temp.id('k1')),
  '23514', 'A placa já está na carteira deste gestor.', 'não se disponibiliza a placa ao próprio gestor'
);
select pg_temp.guardar('ped', nucleo.disponibilizar_placa(
  pg_temp.id('k1'), pg_temp.id('Gestor B'), 'Troca de carteira', array['CRLV vence em breve', '  ', 'Revisão em aberto'],
  (select versao from nucleo.ativo where id = pg_temp.id('k1')), now(), 'aaaaaaaa-0000-4000-8000-000000000001'));
select ok(pg_temp.id('ped') is not null, 'o gestor A disponibiliza a placa ao gestor B');
select is(
  nucleo.disponibilizar_placa(pg_temp.id('k1'), pg_temp.id('Gestor B'), 'Troca de carteira', array['outra'],
    (select versao from nucleo.ativo where id = pg_temp.id('k1')), now(), 'aaaaaaaa-0000-4000-8000-000000000001'),
  pg_temp.id('ped'), 'a mesma chave de envio devolve o mesmo pedido'
);
select is((select count(*) from nucleo.transferencia where ativo_id = pg_temp.id('k1')), 1::bigint, 'e não duplica o pedido');
select is(
  (select array_agg(texto order by criado_em, texto) from nucleo.transferencia_pendencia where transferencia_id = pg_temp.id('ped')),
  array['CRLV vence em breve', 'Revisão em aberto'], 'uma pendência por texto não vazio'
);
select ok(
  (select situacao = 'pendente' and de_gestor_id = pg_temp.id('Gestor A') and para_gestor_id = pg_temp.id('Gestor B')
     from nucleo.transferencia where id = pg_temp.id('ped')),
  'o pedido nasce pendente, do gestor vigente para o destino'
);
select throws_ok(
  format($$select nucleo.disponibilizar_placa(%L, %L, 'de novo', '{}', (select versao from nucleo.ativo where id = %L))$$,
         pg_temp.id('k1'), pg_temp.id('Gestor C'), pg_temp.id('k1')),
  '23514', null, 'um pedido aberto por placa'
);
select is(nucleo.contar_para_receber(), 0, 'quem envia não tem nada para receber');
select ok(
  nucleo.pedido_aberto_da_placa('eee-8e21') ->> 'para_gestor' = 'Gestor B',
  'quem envia vê o pedido aberto da placa'
);
select ok((nucleo.placa_para_assistente('EEE8E21') ->> 'versao')::int >= 1, 'quem envia vê a placa com a versão');
select ok(
  (select bool_or((g ->> 'id')::uuid = pg_temp.id('Gestor A')) and bool_or((g ->> 'id')::uuid = pg_temp.id('Gestor B'))
     from jsonb_array_elements(nucleo.catalogos_dos_assistentes() -> 'gestores') g),
  'o gestor lê os gestores de frota no catálogo'
);
select ok(
  (select bool_or(c ->> 'codigo' = 'LIVRE82') and not bool_or(c ->> 'codigo' = 'K82')
     from jsonb_array_elements(nucleo.catalogos_dos_assistentes() -> 'crs') c),
  'o catálogo oferece o CR de frota livre e não o que já tem placa'
);
select ok(
  (select jsonb_typeof(c -> 'marcas') = 'array' and jsonb_typeof(c -> 'modelos') = 'array' and jsonb_typeof(c -> 'carrocerias') = 'array'
      and jsonb_typeof(c -> 'operacoes') = 'array' and jsonb_typeof(c -> 'filiais') = 'array'
      and jsonb_array_length(c -> 'filiais') >= 3
     from (select nucleo.catalogos_dos_assistentes() as c) x),
  'os catálogos vêm todos (as 3 filiais inclusive)'
);
reset role;

-- ---- Para receber ----
select tests.como(pg_temp.id('auth_Gestor B'));
select is(nucleo.contar_para_receber(), 1, 'o destino tem uma placa para receber');
select ok(exists (select 1 from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k1')), 'o destino vê a linha da placa enquanto o pedido está aberto');
select is(pg_temp.lista_para_receber(), 1, 'a lista filtrada por "Para receber" traz a placa');
select is(pg_temp.chip('para_receber'), 1::bigint, 'o chip "Para receber" conta a placa');
select ok(
  (select p ->> 'de_gestor' = 'Gestor A' and p ->> 'situacao' = 'pendente' and jsonb_array_length(p -> 'pendencias') = 2
          and p ->> 'placa' = 'EEE8E21' and (p ->> 'versao')::int = 1
     from (select nucleo.pedido_aberto_da_placa('EEE8E21') as p) x),
  'o destino vê o pedido, o remetente e as pendências'
);
select is(jsonb_array_length(nucleo.pedidos_para_receber()), 1, 'a lista dos pedidos para receber');
select ok(
  (select a ->> 'placa' = 'EEE8E21' and a ->> 'tipo' = 'cavalo' and a ->> 'gestor' = 'Gestor A' and a -> 'versao' = 'null'::jsonb
     from (select nucleo.placa_para_assistente('EEE8E21') as a) x),
  'o destino vê a placa no assistente, sem a versão do ativo (que não enxerga)'
);
select ok(nucleo.detalhe_da_placa('EEE8E21') is not null, 'o destino abre o detalhe da placa');
reset role;

select tests.como(pg_temp.id('auth_Gestor C'));
select is(nucleo.contar_para_receber(), 0, 'um terceiro gestor não tem nada para receber');
select ok(not exists (select 1 from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k1')), 'e não vê a linha da placa');
select is(pg_temp.lista_para_receber(), 0, 'nem pelo filtro "Para receber"');
select ok(nucleo.pedido_aberto_da_placa('EEE8E21') is null, 'nem o pedido');
select ok(nucleo.placa_para_assistente('EEE8E21') is null, 'nem a placa no assistente');
select is(jsonb_array_length(nucleo.pedidos_para_receber()), 0, 'a lista dele é vazia');
select throws_ok(
  format($$select nucleo.receber_placa(%L, 1)$$, pg_temp.id('ped')),
  '42501', null, 'um terceiro gestor não recebe a placa'
);
reset role;

-- ---- Receber placa ----
select tests.como(pg_temp.id('auth_Gestor B'));
select throws_ok(
  format($$select nucleo.concluir_recebimento(%L, 1, %L::jsonb)$$, pg_temp.id('ped'), pg_temp.respostas(pg_temp.id('ped'), true, null)),
  '23514', 'Receba a placa antes de concluir o recebimento.', 'não se conclui antes de receber'
);
select throws_ok(
  format($$select nucleo.receber_placa(%L, 2)$$, pg_temp.id('ped')),
  '40001', null, 'versão velha do pedido: "este registro mudou"'
);
select is(
  nucleo.receber_placa(pg_temp.id('ped'), 1, now(), 'aaaaaaaa-0000-4000-8000-000000000002'),
  pg_temp.id('ped'), 'o destino recebe a placa'
);
select is(
  nucleo.receber_placa(pg_temp.id('ped'), 1, now(), 'aaaaaaaa-0000-4000-8000-000000000002'),
  pg_temp.id('ped'), 'a mesma chave de envio devolve o mesmo pedido, sem erro'
);
select ok(
  (select situacao = 'em_conferencia' and versao = 2 from nucleo.transferencia where id = pg_temp.id('ped')),
  'o pedido passa a em conferência'
);
select is(nucleo.pedido_aberto_da_placa('EEE8E21') ->> 'situacao', 'em_conferencia', 'o pedido em conferência continua aberto');
select is(nucleo.contar_para_receber(), 1, 'e continua no "Para receber" até concluir');
select throws_ok(
  format($$select nucleo.receber_placa(%L, 2)$$, pg_temp.id('ped')),
  'P0001', null, 'receber de novo (outra chave) é recusado'
);
reset role;
select is(
  (select gestor_id from nucleo.gestor_da_carteira where ativo_id = pg_temp.id('k1') and fim is null and excluido_em is null),
  pg_temp.id('Gestor A'), 'receber não troca o gestor'
);

-- ---- Concluir recebimento ----
select tests.como(pg_temp.id('auth_Gestor C'));
select throws_ok(
  format($$select nucleo.concluir_recebimento(%L, 2, %L::jsonb)$$, pg_temp.id('ped'), pg_temp.respostas(pg_temp.id('ped'), true, null)),
  '42501', null, 'um terceiro gestor não conclui'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select throws_ok(
  format($$select nucleo.concluir_recebimento(%L, 2, %L::jsonb)$$, pg_temp.id('ped'), pg_temp.respostas(pg_temp.id('ped'), true, null, 1)),
  '23514', 'Responda cada pendência do pedido, uma vez.', 'faltando resposta, não conclui'
);
select throws_ok(
  format($$select nucleo.concluir_recebimento(%L, 2, %L::jsonb)$$, pg_temp.id('ped'),
         pg_temp.respostas(pg_temp.id('ped'), true, null) || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'resolvida', true))),
  '23514', 'Responda cada pendência do pedido, uma vez.', 'resposta de pendência de fora é recusada'
);
select throws_ok(
  format($$select nucleo.concluir_recebimento(%L, 2, %L::jsonb)$$, pg_temp.id('ped'), pg_temp.respostas(pg_temp.id('ped'), false, ' ')),
  '23514', 'Diga na nota o que ficou pendente.', 'não resolvida exige a nota'
);
select throws_ok(
  format($$select nucleo.concluir_recebimento(%L, 1, %L::jsonb)$$, pg_temp.id('ped'), pg_temp.respostas(pg_temp.id('ped'), true, null)),
  '40001', null, 'versão velha do pedido no concluir: "este registro mudou"'
);
select is(
  nucleo.concluir_recebimento(pg_temp.id('ped'), 2,
    (select jsonb_agg(jsonb_build_object('id', id, 'resolvida', texto like 'CRLV%', 'nota', case when texto like 'Revisão%' then 'Fica para a próxima semana' end))
       from nucleo.transferencia_pendencia where transferencia_id = pg_temp.id('ped')),
    now(), 'aaaaaaaa-0000-4000-8000-000000000003'),
  pg_temp.id('ped'), 'o destino conclui o recebimento'
);
select is(
  nucleo.concluir_recebimento(pg_temp.id('ped'), 2, '[]'::jsonb, now(), 'aaaaaaaa-0000-4000-8000-000000000003'),
  pg_temp.id('ped'), 'a mesma chave de envio devolve o mesmo pedido, sem erro'
);
select is(nucleo.contar_para_receber(), 0, 'o "Para receber" volta a zero');
reset role;
select ok(
  (select situacao = 'concluida' from nucleo.transferencia where id = pg_temp.id('ped'))
  and (select gestor_id from nucleo.gestor_da_carteira where ativo_id = pg_temp.id('k1') and fim is null and excluido_em is null) = pg_temp.id('Gestor B'),
  'concluído: o gestor passa a ser o B'
);
select set_eq(
  $$select texto, resposta, respondida_por, nota from nucleo.transferencia_pendencia where transferencia_id = pg_temp.id('ped')$$,
  format($$values ('CRLV vence em breve', 'resolvida', %L::uuid, null::text), ('Revisão em aberto', 'aceita_com_nota', %L::uuid, 'Fica para a próxima semana')$$,
         pg_temp.id('Gestor B'), pg_temp.id('Gestor B')),
  'cada pendência respondida pelo B (resolvida, ou aceita com a nota)'
);
select pg_temp.disparar();
select tests.como(pg_temp.id('auth_Gestor B'));
select ok(
  exists (select 1 from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k1'))
  and (nucleo.placa_para_assistente('EEE8E21') ->> 'versao') is not null,
  'depois de concluir, o B vê a placa pela carteira (com a versão)'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(not exists (select 1 from nucleo.leitura_da_placa where ativo_id = pg_temp.id('k1')), 'e o A deixa de ver');
select ok(nucleo.pedido_aberto_da_placa('EEE8E21') is null, 'sem pedido aberto');
reset role;

-- ---- Administrador ----
select tests.como(pg_temp.id('auth_Adm'));
select is(nucleo.contar_para_receber(), 0, 'o Administrador não é destino de pedido');
select ok(nucleo.placa_para_assistente('EEE8E21') ->> 'gestor' = 'Gestor B', 'o Administrador vê a placa no assistente');
reset role;

select tests.como_anonimo();
select throws_ok($$select nucleo.contar_para_receber()$$, '42501', null, 'sem login não conta');
reset role;

select * from finish();
rollback;
