-- Frota › Análise (primeira versão), em quatro camadas:
--  1. Retrato (agora): quantas placas em cada grupo de situação e por tipo, e o tempo parado no PÁT.
--  2. Disponibilidade no mês: placas em atividade ÷ placas na frota (sem as de fora), dia a dia, pela
--     situação calculada no fim de cada dia (nucleo.situacao_no_dia); a do mês pondera placa-dia.
--  3. Onde: o mesmo por operação, filial ou gestor (o agrupamento atual da placa).
--  4. Custo e consumo: próxima versão (só a tela; nada no banco).
--  * Uma função de leitura (nucleo.analise_da_frota) entrega os totais prontos; nenhuma é SECURITY
--    DEFINER: o universo é o que a RLS de quem consulta deixa ver. Sempre com a chave do usuário de cada
--    perfil (armadilha 9).
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
    v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '.89@exemplo.local');
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
create function pg_temp.dia(p_analise jsonb, p_dia int) returns jsonb language sql as $$
  select d from jsonb_array_elements(p_analise->'dias') d where (d->>'dia')::date = make_date(2026, 1, p_dia)
$$;
create function pg_temp.grupo(p_analise jsonb, p_rotulo text) returns jsonb language sql as $$
  select g from jsonb_array_elements(p_analise->'grupos') g where g->>'rotulo' = p_rotulo
$$;

-- ---- dados: A tem dois cavalos (Grãos); C tem um (Cimento); Adm, Diretoria, Operacional e um sem vínculo ----
select pg_temp.pessoa('Gestor A', 890000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor C', 890000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 890000003, 'administrador', false);
select pg_temp.pessoa('Dir', 890000004, 'diretoria', false);
select pg_temp.pessoa('Oper', 890000005, 'operacional', false);
select pg_temp.guardar('auth_sem_vinculo', tests.criar_usuario('sem.vinculo.89@exemplo.local'));
insert into nucleo.operacao (nome) values ('Grãos 89'), ('Cimento 89');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (8901, 'K89A', true, true), (8902, 'K89B', true, true), (8903, 'K89C', true, true);
select pg_temp.guardar('k1', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8901), p_placa => 'GGG8A91',
  p_gestor_id => pg_temp.id('Gestor A'), p_cr_id => (select id from nucleo.cr where codigo = 'K89A'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 89'), p_em => '2026-01-10 08:00-03'));
select pg_temp.guardar('k2', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8902), p_placa => 'GGG8A92',
  p_gestor_id => pg_temp.id('Gestor A'), p_cr_id => (select id from nucleo.cr where codigo = 'K89B'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 89'), p_em => '2026-01-10 08:00-03'));
select pg_temp.guardar('k3', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8903), p_placa => 'GGG8A93',
  p_gestor_id => pg_temp.id('Gestor C'), p_cr_id => (select id from nucleo.cr where codigo = 'K89C'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Cimento 89'), p_em => '2026-01-10 08:00-03'));
-- k1: PÁT de 10 a 14, MAN de 15 a 19, DOp de 20 a 31 (12 dias em atividade). k2 e k3 ficam no PÁT.
select nucleo.registrar_evento(pg_temp.id('k1'), 'MAN', '2026-01-15 10:00-03');
select nucleo.registrar_evento(pg_temp.id('k1'), null, '2026-01-20 10:00-03', p_camada => 'impedida');
select nucleo.registrar_evento(pg_temp.id('k1'), 'DOp', '2026-01-20 10:00-03');
select pg_temp.disparar();

-- ---- Privilégios ----
select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
     from unnest(array[
       'nucleo.analise_da_frota(date,text,uuid,text)',
       'nucleo.opcoes_da_analise()']::regprocedure[]) f),
  'authenticated executa as funções da Análise; anon não'
);
select ok(
  (select bool_and(not p.prosecdef) from pg_proc p where p.oid = any (array[
       'nucleo.analise_da_frota(date,text,uuid,text)',
       'nucleo.opcoes_da_analise()']::regprocedure[])),
  'as funções da Análise rodam com a RLS de quem chama (nenhuma é SECURITY DEFINER)'
);

-- ---- Administrador: tudo ----
select tests.como(pg_temp.id('auth_Adm'));
select set_config('t.a', nucleo.analise_da_frota('2026-01-01')::text, true);
-- Camada 1: retrato
select is((current_setting('t.a')::jsonb->'retrato'->>'total')::int, 3, 'retrato: o Administrador vê as três placas');
select is((current_setting('t.a')::jsonb->'retrato'->>'em_atividade')::int, 1, 'retrato: uma em atividade agora (k1, DOp)');
select is((current_setting('t.a')::jsonb->'retrato'->>'patio')::int, 2, 'retrato: duas no pátio');
select is((current_setting('t.a')::jsonb->'retrato'->>'parados_no_pat')::int, 2, 'retrato: as duas do pátio passaram do limite de dias parado');
select ok((current_setting('t.a')::jsonb->'retrato'->>'dias_medio_no_pat')::numeric > 300, 'retrato: o tempo médio parado no PÁT vem pronto, em dias');
select is(
  current_setting('t.a')::jsonb->'tipos',
  '[{"tipo": "cavalo", "total": 3, "em_atividade": 1}]'::jsonb,
  'retrato: a frota por tipo'
);
select is(
  (select array_agg(p->>'placa' order by o) from jsonb_array_elements(current_setting('t.a')::jsonb->'mais_tempo_no_pat') with ordinality x(p, o)),
  array['GGG8A92', 'GGG8A93'], 'retrato: as placas há mais tempo no PÁT, da mais antiga (desempate pela placa)'
);
-- Camada 2: disponibilidade no mês
select is(jsonb_array_length(current_setting('t.a')::jsonb->'dias'), 31, 'disponibilidade: janeiro tem 31 dias');
select is(pg_temp.dia(current_setting('t.a')::jsonb, 9)->>'na_frota', '0', 'disponibilidade: antes do cadastro, ninguém na frota');
select is(pg_temp.dia(current_setting('t.a')::jsonb, 9)->'disponibilidade', 'null'::jsonb, 'disponibilidade: sem placa na frota, o dia fica sem número');
select is(pg_temp.dia(current_setting('t.a')::jsonb, 16)->>'impedida', '1', 'disponibilidade: no dia 16, k1 impedida');
select is((pg_temp.dia(current_setting('t.a')::jsonb, 20)->>'disponibilidade')::numeric, 33.3, 'disponibilidade: no dia 20, uma de três (33,3%)');
select is((current_setting('t.a')::jsonb->>'disponibilidade')::numeric, 18.2, 'disponibilidade do mês: 12 placa-dias em atividade de 66 (18,2%)');
select is((current_setting('t.a')::jsonb->>'placa_dias')::int, 66, 'disponibilidade do mês: a base em placa-dias');
-- Camada 3: onde (por operação)
select is((pg_temp.grupo(current_setting('t.a')::jsonb, 'Grãos 89')->>'disponibilidade')::numeric, 27.3, 'onde: Grãos 89 tem 12 de 44 placa-dias (27,3%)');
select is((pg_temp.grupo(current_setting('t.a')::jsonb, 'Cimento 89')->>'disponibilidade')::numeric, 0.0, 'onde: Cimento 89, nenhum dia em atividade');
select is(
  (select array_agg(g->>'rotulo' order by o) from jsonb_array_elements(current_setting('t.a')::jsonb->'grupos') with ordinality x(g, o)),
  array['Cimento 89', 'Grãos 89'], 'onde: os grupos em ordem pelo nome'
);
select is(
  (pg_temp.grupo(nucleo.analise_da_frota('2026-01-01', p_agrupamento => 'gestor'), 'Gestor A')->>'total')::int, 2,
  'onde: por gestor, o Gestor A tem duas'
);
-- Filtros do contexto
select is(
  (nucleo.analise_da_frota('2026-01-01', p_operacao_id => (select id from nucleo.operacao where nome = 'Cimento 89'))->'retrato'->>'total')::int, 1,
  'filtro: a operação Cimento 89 tem uma placa'
);
select is(
  (nucleo.analise_da_frota('2026-01-01', p_filial => 'Filial que não existe')->'retrato'->>'total')::int, 0,
  'filtro: filial sem placa dá zero'
);
-- Opções do contexto
select is(
  (select array_agg(o->>'nome' order by o->>'nome') from jsonb_array_elements(nucleo.opcoes_da_analise()->'operacoes') o),
  array['Cimento 89', 'Grãos 89'], 'opções: as operações das placas visíveis'
);
-- Recusas
select is(pg_temp.erro_de($$select nucleo.analise_da_frota(null)$$), '22023', 'recusa: sem mês');
select is(
  pg_temp.erro_de(format('select nucleo.analise_da_frota(%L)', (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month')::date)),
  '22023', 'recusa: mês que ainda não começou'
);
select is(pg_temp.erro_de($$select nucleo.analise_da_frota('2026-01-01', p_agrupamento => 'cor')$$), '22023', 'recusa: agrupamento desconhecido');
reset role;

-- ---- Escopo dos outros perfis ----
select tests.como(pg_temp.id('auth_Gestor A'));
select set_config('t.a', nucleo.analise_da_frota('2026-01-01')::text, true);
select is((current_setting('t.a')::jsonb->'retrato'->>'total')::int, 2, 'gestor: o Gestor A vê só a carteira dele');
select is((current_setting('t.a')::jsonb->>'disponibilidade')::numeric, 27.3, 'gestor: a disponibilidade do mês só da carteira dele (12 de 44)');
reset role;
select tests.como(pg_temp.id('auth_Gestor C'));
select is((nucleo.analise_da_frota('2026-01-01')->'retrato'->>'total')::int, 1, 'gestor: o Gestor C vê a dele');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is((nucleo.analise_da_frota('2026-01-01')->'retrato'->>'total')::int, 3, 'diretoria: vê as três');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is((nucleo.analise_da_frota('2026-01-01')->>'placa_dias')::int, 0, 'operacional: sem custódia na filial, nada');
reset role;
select tests.como(pg_temp.id('auth_sem_vinculo'));
select is((nucleo.analise_da_frota('2026-01-01')->'retrato'->>'total')::int, 0, 'sem vínculo: nada');
reset role;
select tests.como_anonimo();
select is(pg_temp.erro_de($$select nucleo.analise_da_frota('2026-01-01')$$), '42501', 'anon: não executa');
reset role;

select * from finish();
rollback;
