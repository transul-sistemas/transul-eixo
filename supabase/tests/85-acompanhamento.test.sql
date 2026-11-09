-- Frota › Acompanhamento (primeira versão): a grade do mês (placas × dias), o lançamento da situação
-- do dia, o modo Agora (situação atual agregada) e o Censo (contagem por situação num dia).
--  * A grade e o Censo leem a situação calculada (nucleo.situacao_com_causa), a definição única; o Agora
--    lê a linha mantida (nucleo.leitura_da_placa). O banco entrega os totais prontos.
--  * Lançar a situação do dia grava pelo evento de status (nucleo.registrar_evento), com a RLS de quem
--    lança, e fecha as camadas de prioridade maior que estejam abertas (o que se lança é o que se vê).
--  * Sempre com a chave do usuário de cada perfil (armadilha 9).
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
-- A sigla de um dia (1 a 31) de uma linha da grade, pela placa.
create function pg_temp.celula(p_grade jsonb, p_placa text, p_dia int) returns text language sql as $$
  select l->'dias'->(p_dia - 1)->>'sigla'
    from jsonb_array_elements(p_grade->'linhas') l where l->>'placa' = p_placa
$$;
create function pg_temp.lancado(p_grade jsonb, p_placa text, p_dia int) returns boolean language sql as $$
  select (l->'dias'->(p_dia - 1)->>'lancado')::boolean
    from jsonb_array_elements(p_grade->'linhas') l where l->>'placa' = p_placa
$$;

-- ---- dados: A tem dois cavalos; C tem um; Adm, Diretoria, Operacional e um usuário sem vínculo ----
select pg_temp.pessoa('Gestor A', 850000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor C', 850000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 850000003, 'administrador', false);
select pg_temp.pessoa('Dir', 850000004, 'diretoria', false);
select pg_temp.pessoa('Oper', 850000005, 'operacional', false);
select pg_temp.guardar('auth_sem_vinculo', tests.criar_usuario('sem.vinculo.85@exemplo.local'));
insert into nucleo.operacao (nome) values ('Grãos 85'), ('Cimento 85');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (8501, 'K85A', true, true), (8502, 'K85B', true, true), (8503, 'K85C', true, true);
select pg_temp.guardar('k1', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8501), p_placa => 'FFF8A51',
  p_gestor_id => pg_temp.id('Gestor A'), p_cr_id => (select id from nucleo.cr where codigo = 'K85A'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 85'), p_em => '2026-01-10 08:00-03'));
select pg_temp.guardar('k2', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8502), p_placa => 'FFF8A52',
  p_gestor_id => pg_temp.id('Gestor A'), p_cr_id => (select id from nucleo.cr where codigo = 'K85B'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 85'), p_em => '2026-01-10 08:00-03'));
select pg_temp.guardar('k3', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8503), p_placa => 'FFF8A53',
  p_gestor_id => pg_temp.id('Gestor C'), p_cr_id => (select id from nucleo.cr where codigo = 'K85C'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Cimento 85'), p_em => '2026-01-10 08:00-03'));
select pg_temp.disparar();

-- ---- Privilégios: authenticated executa; anon não ----
select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
     from unnest(array[
       'nucleo.grade_do_acompanhamento(date,text,text[],integer,integer)',
       'nucleo.lancar_situacao_do_dia(uuid,text,date,uuid)',
       'nucleo.agora_do_acompanhamento(text,text[])',
       'nucleo.censo_do_acompanhamento(date,text[])']::regprocedure[]) f),
  'authenticated executa as quatro funções do Acompanhamento; anon não'
);
select ok(
  (select bool_and(not p.prosecdef) from pg_proc p where p.oid = any (array[
       'nucleo.grade_do_acompanhamento(date,text,text[],integer,integer)',
       'nucleo.lancar_situacao_do_dia(uuid,text,date,uuid)',
       'nucleo.agora_do_acompanhamento(text,text[])',
       'nucleo.censo_do_acompanhamento(date,text[])']::regprocedure[])),
  'as quatro rodam com a RLS de quem chama (nenhuma é SECURITY DEFINER)'
);

-- ---- Grade: o escopo de cada perfil ----
select tests.como(pg_temp.id('auth_Gestor A'));
select set_config('t.grade', nucleo.grade_do_acompanhamento('2026-01-01')::text, true);
select is((current_setting('t.grade')::jsonb->>'total')::int, 2, 'grade: o Gestor A vê só as duas placas da carteira dele');
select is(jsonb_array_length(current_setting('t.grade')::jsonb->'linhas'->0->'dias'), 31, 'grade: janeiro tem 31 dias na linha');
select is(current_setting('t.grade')::jsonb->'linhas'->0->>'placa', 'FFF8A51', 'grade: ordenada pela placa');
select is(pg_temp.celula(current_setting('t.grade')::jsonb, 'FFF8A51', 9), null, 'grade: antes do cadastro a célula fica vazia');
select is(pg_temp.celula(current_setting('t.grade')::jsonb, 'FFF8A51', 10), 'PÁT', 'grade: no dia do cadastro, a situação inicial (PÁT)');
select is(pg_temp.celula(current_setting('t.grade')::jsonb, 'FFF8A51', 31), 'PÁT', 'grade: a situação segue até o fim do mês');
select is(pg_temp.lancado(current_setting('t.grade')::jsonb, 'FFF8A51', 10), true, 'grade: o dia com evento vem marcado como lançado');
select is(pg_temp.lancado(current_setting('t.grade')::jsonb, 'FFF8A51', 11), false, 'grade: o dia sem evento não');
select is(
  (nucleo.grade_do_acompanhamento('2026-01-01', 'a52')->>'total')::int, 1,
  'grade: a busca pela placa filtra no banco'
);
select is(
  (nucleo.grade_do_acompanhamento('2026-01-01', '', '{}', 2, 1)->'linhas'->0->>'placa'), 'FFF8A52',
  'grade: a página 2 com uma linha por página traz a segunda placa'
);
reset role;

select tests.como(pg_temp.id('auth_Adm'));
select is((nucleo.grade_do_acompanhamento('2026-01-01')->>'total')::int, 3, 'grade: o Administrador vê as três');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is((nucleo.grade_do_acompanhamento('2026-01-01')->>'total')::int, 3, 'grade: a Diretoria vê as três');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is((nucleo.grade_do_acompanhamento('2026-01-01')->>'total')::int, 0, 'grade: o Operacional sem custódia na filial não vê nenhuma');
reset role;
select tests.como(pg_temp.id('auth_sem_vinculo'));
select is((nucleo.grade_do_acompanhamento('2026-01-01')->>'total')::int, 0, 'grade: o usuário sem vínculo não vê nenhuma');
reset role;

-- ---- Lançar a situação do dia ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  nucleo.lancar_situacao_do_dia(pg_temp.id('k1'), 'MAN', '2026-01-15')->>'sigla', 'MAN',
  'lançar: o Gestor A lança MAN no dia 15 e o banco devolve a situação do dia'
);
select set_config('t.grade', nucleo.grade_do_acompanhamento('2026-01-01')::text, true);
select is(pg_temp.celula(current_setting('t.grade')::jsonb, 'FFF8A51', 15), 'MAN', 'lançar: a célula do dia 15 mostra MAN');
select is(pg_temp.celula(current_setting('t.grade')::jsonb, 'FFF8A51', 14), 'PÁT', 'lançar: o dia 14 continua PÁT');
select is(pg_temp.lancado(current_setting('t.grade')::jsonb, 'FFF8A51', 15), true, 'lançar: o dia 15 fica marcado como lançado');
select is(
  nucleo.lancar_situacao_do_dia(pg_temp.id('k1'), 'DOp', '2026-01-20')->>'sigla', 'DOp',
  'lançar: DOp (atividade) no dia 20 fecha a manutenção aberta: o que se lança é o que se vê'
);
select is(
  (select count(*) from nucleo.estado_de_status where ativo_id = pg_temp.id('k1') and camada = 'impedida' and fim is null and excluido_em is null),
  0::bigint,
  'lançar: a camada impedida ficou fechada'
);
select is(
  pg_temp.erro_de(format('select nucleo.lancar_situacao_do_dia(%L, %L, %L)', pg_temp.id('k1'), 'ETc', '2026-01-21')),
  '23514', 'lançar: ETc (só conjunto) num cavalo solto é recusado'
);
select is(
  pg_temp.erro_de(format('select nucleo.lancar_situacao_do_dia(%L, %L, %L)', pg_temp.id('k1'), 'PÁT', '2026-01-18')),
  '23514', 'lançar: dia anterior ao último evento é recusado (fora de ordem)'
);
select is(
  pg_temp.erro_de(format('select nucleo.lancar_situacao_do_dia(%L, %L, %L)', pg_temp.id('k1'), 'PÁT',
    ((now() at time zone 'America/Sao_Paulo')::date + 1)::text)),
  '22023', 'lançar: dia que ainda não chegou é recusado'
);
select is(
  pg_temp.erro_de(format('select nucleo.lancar_situacao_do_dia(%L, %L, %L)', pg_temp.id('k1'), 'VND', '2026-01-22')),
  '23514', 'lançar: a baixa (VND) não se lança pela grade'
);
select is(
  pg_temp.erro_de(format('select nucleo.lancar_situacao_do_dia(%L, %L, %L)', pg_temp.id('k3'), 'MAN', '2026-01-22')),
  '42501', 'lançar: o Gestor A não lança na placa da carteira do Gestor C'
);
-- A mesma chave de envio grava uma vez só.
select lives_ok(
  format('select nucleo.lancar_situacao_do_dia(%L, %L, %L, %L)', pg_temp.id('k2'), 'MAN', '2026-01-12', '8a5e0000-0000-4000-8000-000000000001'),
  'lançar: primeiro envio com a chave'
);
select lives_ok(
  format('select nucleo.lancar_situacao_do_dia(%L, %L, %L, %L)', pg_temp.id('k2'), 'MAN', '2026-01-12', '8a5e0000-0000-4000-8000-000000000001'),
  'lançar: o mesmo envio repetido não dá erro'
);
select is(
  (select count(*) from nucleo.evento_de_status where ativo_id = pg_temp.id('k2') and sigla = 'MAN' and excluido_em is null),
  1::bigint, 'lançar: a mesma chave de envio gravou um evento só'
);
reset role;

select tests.como(pg_temp.id('auth_Oper'));
select is(
  pg_temp.erro_de(format('select nucleo.lancar_situacao_do_dia(%L, %L, %L)', pg_temp.id('k1'), 'MAN', '2026-01-25')),
  '42501', 'lançar: o Operacional sem custódia não lança'
);
reset role;
select tests.como(pg_temp.id('auth_sem_vinculo'));
select is(
  pg_temp.erro_de(format('select nucleo.lancar_situacao_do_dia(%L, %L, %L)', pg_temp.id('k1'), 'MAN', '2026-01-25')),
  '42501', 'lançar: o usuário sem vínculo não lança'
);
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(
  nucleo.lancar_situacao_do_dia(pg_temp.id('k3'), 'MAN', '2026-01-12')->>'sigla', 'MAN',
  'lançar: o Administrador lança em qualquer placa'
);
reset role;
-- A leitura mantida se recalcula no fim da transação; aqui, antes de agir como anon.
select pg_temp.disparar();
select tests.como_anonimo();
select is(
  pg_temp.erro_de(format('select nucleo.lancar_situacao_do_dia(%L, %L, %L)', pg_temp.id('k1'), 'MAN', '2026-01-25')),
  '42501', 'lançar: anon não executa'
);
reset role;

-- ---- Agora: a situação atual agregada (k1 DOp, k2 MAN, k3 MAN) ----
select tests.como(pg_temp.id('auth_Adm'));
select results_eq(
  $$select rotulo, total, em_atividade, impedida from nucleo.agora_do_acompanhamento('gestor')$$,
  $$values ('Gestor A'::text, 2::bigint, 1::bigint, 1::bigint), ('Gestor C', 1, 0, 1), ('Total', 3, 1, 2)$$,
  'agora: por gestor, com a linha de total no fim (o banco soma)'
);
select results_eq(
  $$select rotulo, total from nucleo.agora_do_acompanhamento('operacao')$$,
  $$values ('Cimento 85'::text, 1::bigint), ('Grãos 85', 2), ('Total', 3)$$,
  'agora: por operação'
);
select is(
  pg_temp.erro_de($$select * from nucleo.agora_do_acompanhamento('cor')$$), '22023',
  'agora: agrupamento desconhecido é recusado'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select results_eq(
  $$select rotulo, total from nucleo.agora_do_acompanhamento('tipo')$$,
  $$values ('cavalo'::text, 2::bigint), ('Total', 2)$$,
  'agora: o Gestor A só conta as placas da carteira dele'
);
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is(
  (select total from nucleo.agora_do_acompanhamento('filial') where rotulo = 'Total'), 3::bigint,
  'agora: a Diretoria conta as três'
);
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(
  (select total from nucleo.agora_do_acompanhamento('gestor') where rotulo = 'Total'), 0::bigint,
  'agora: o Operacional sem custódia conta zero'
);
reset role;

-- ---- Censo: a contagem por situação num dia ----
select tests.como(pg_temp.id('auth_Adm'));
select results_eq(
  $$select sigla, quantidade from nucleo.censo_do_acompanhamento('2026-01-16')$$,
  $$values ('MAN'::text, 3::bigint), (null, 3)$$,
  'censo: no dia 16, as três em MAN, e o total no fim'
);
select results_eq(
  $$select sigla, quantidade from nucleo.censo_do_acompanhamento('2026-01-11')$$,
  $$values ('PÁT'::text, 3::bigint), (null, 3)$$,
  'censo: no dia 11, as três em PÁT'
);
select is(
  (select quantidade from nucleo.censo_do_acompanhamento('2026-01-09') where sigla is null), 0::bigint,
  'censo: antes do cadastro, ninguém é contado'
);
select is(
  pg_temp.erro_de(format('select * from nucleo.censo_do_acompanhamento(%L)', ((now() at time zone 'America/Sao_Paulo')::date + 1)::text)),
  '22023', 'censo: dia que ainda não chegou é recusado'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  (select quantidade from nucleo.censo_do_acompanhamento('2026-01-16') where sigla is null), 2::bigint,
  'censo: o Gestor A conta só a carteira dele'
);
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(
  (select quantidade from nucleo.censo_do_acompanhamento('2026-01-16') where sigla is null), 0::bigint,
  'censo: o Operacional sem custódia conta zero'
);
reset role;

select * from finish();
rollback;
