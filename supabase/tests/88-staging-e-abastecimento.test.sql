-- Dados provisórios da v1 (staging) e Frota › Abastecimento. Só dados fictícios.
--  * O schema staging existe, é provisório (comentário), só estrutura; anon não tem nada e
--    authenticated só lê (sem INSERT, UPDATE nem DELETE).
--  * Políticas, com a chave do usuário de cada perfil (armadilha 9):
--      staging_abastecimento_ler: Frota inteira vê tudo; o gestor de frota, só as placas que vê agora;
--        o Operacional (sem Frota) nada;
--      staging_natureza_ler, staging_despesa_ler, staging_viagem_ler, staging_folha_ler,
--      staging_evento_da_folha_ler: quem tem Resultados (administrador, diretoria);
--      staging_operacao_ler, staging_roster_ler: quem tem Operações (administrador, diretoria).
--  * nucleo.abastecimento_do_mes: litros de todos os abastecimentos; km e km/l só com hodômetro
--    válido (final maior que o inicial); intervalo do mês [início, fim); paginação no banco com
--    desempate pela placa; totais prontos.
begin;
\ir apoio/como_usuario.psql

select plan(40);

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
    v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '.88@exemplo.local');
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
-- Quantas linhas de uma tabela do staging o usuário vê.
create function pg_temp.ve(p_tabela text) returns bigint language plpgsql as $$
declare
  v bigint;
begin
  execute format('select count(*) from staging.%I', p_tabela) into v;
  return v;
end;
$$;

-- ---- dados fictícios: Gestor A tem a placa FFF8B81; Gestor C, a FFF8B82; ZZZ8Z99 não está no Eixo ----
select pg_temp.pessoa('Gestor A', 880000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor C', 880000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 880000003, 'administrador', false);
select pg_temp.pessoa('Dir', 880000004, 'diretoria', false);
select pg_temp.pessoa('Oper', 880000005, 'operacional', false);
insert into nucleo.operacao (nome) values ('Grãos 88');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (8801, 'K88A', true, true), (8802, 'K88B', true, true);
select pg_temp.guardar('k1', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8801), p_placa => 'FFF8B81',
  p_gestor_id => pg_temp.id('Gestor A'), p_cr_id => (select id from nucleo.cr where codigo = 'K88A'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 88'), p_em => '2026-01-10 08:00-03'));
select pg_temp.guardar('k2', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8802), p_placa => 'FFF8B82',
  p_gestor_id => pg_temp.id('Gestor C'), p_cr_id => (select id from nucleo.cr where codigo = 'K88B'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 88'), p_em => '2026-01-10 08:00-03'));
select pg_temp.disparar();

-- Abastecimentos de março de 2026 (e um em 01/04, fora do mês, para o limite do intervalo).
--  FFF8B81: 100→600 (500 km, 200 l) e 600→1000 (400 km, 100 l): 900 km / 300 l = 3,00 km/l
--  FFF8B82: 0→800 (800 km, 200 l) e um sem hodômetro (50 l): litros 250; km/l = 800/200 = 4,00
--  ZZZ8Z99: 10→20 (10 km, 10 l), placa fora do Eixo: só quem vê a frota inteira
insert into staging.abastecimento (origem_id, placa, data, km_inicial, km_final, litros, valor_total) values
  ('t1', 'FFF8B81', '2026-03-01', 100, 600, 200, 1200.00),
  ('t2', 'FFF8B81', '2026-03-31', 600, 1000, 100, 600.00),
  ('t3', 'FFF8B82', '2026-03-15', 0, 800, 200, 1100.00),
  ('t4', 'FFF8B82', '2026-03-20', null, null, 50, 300.00),
  ('t5', 'ZZZ8Z99', '2026-03-10', 10, 20, 10, 60.00),
  ('t6', 'FFF8B81', '2026-04-01', 1000, 1500, 100, 600.00);
insert into staging.natureza (codnat, descricao) values ('9001', 'Natureza fictícia');
insert into staging.despesa (origem_id, nufin, codnat, dt_competencia, valor_baixa) values ('d1', '1', '9001', '2026-03-01', 10.00);
insert into staging.viagem (nunota, dt_negociacao, frete_empresa) values (1, '2026-03-01', 100.00);
insert into staging.folha (chave_folha, referencia, codfunc, salario_bruto) values ('f1', '2026-03-01', 1, 100.00);
insert into staging.evento_da_folha (referencia, tipfolha, codemp, codcencus, codevento, funcionarios, valor)
  values ('03/2026', 'N', 1, '1', 1, 1, 100.00);
insert into staging.operacao (id, nome, ativa) values ('00000000-0000-0000-0000-000000000088', 'Operação fictícia', true);
insert into staging.roster (id, operacao_id, mes, ativo) values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000088', '2026-03-01', true);

-- ---- Estrutura e privilégios ----
select has_schema('staging', 'o schema staging existe');
select ok(obj_description('staging'::regnamespace, 'pg_namespace') ilike '%provisório até a ponte do Sankhya%',
  'o comentário diz que o staging é provisório até a ponte do Sankhya');
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'staging' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint, 'toda tabela do staging tem RLS ligado');
select is(
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'staging' and grantee in ('anon', 'PUBLIC')),
  0::bigint, 'anon e PUBLIC não têm grant em nenhuma tabela do staging');
select is(
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'staging' and grantee = 'authenticated' and privilege_type <> 'SELECT'),
  0::bigint, 'authenticated só lê o staging (sem INSERT, UPDATE nem DELETE)');
select ok(not has_schema_privilege('anon', 'staging', 'USAGE'), 'anon não usa o schema staging');
select ok(
  has_function_privilege('authenticated', 'nucleo.abastecimento_do_mes(date,text,text,integer,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'nucleo.abastecimento_do_mes(date,text,text,integer,integer)', 'EXECUTE'),
  'authenticated executa a leitura do abastecimento; anon não');
select ok(
  not (select prosecdef from pg_proc where oid = 'nucleo.abastecimento_do_mes(date,text,text,integer,integer)'::regprocedure),
  'a leitura do abastecimento roda com a RLS de quem chama (SECURITY INVOKER)');

-- ---- staging_abastecimento_ler ----
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.ve('abastecimento'), 6::bigint, 'staging_abastecimento_ler: o administrador vê todos');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is(pg_temp.ve('abastecimento'), 6::bigint, 'staging_abastecimento_ler: a diretoria vê todos');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.ve('abastecimento'), 3::bigint, 'staging_abastecimento_ler: o Gestor A vê só a placa da carteira dele');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.ve('abastecimento'), 0::bigint, 'staging_abastecimento_ler: o Operacional (sem Frota) não vê nada');
reset role;
select tests.como_anonimo();
select is(pg_temp.erro_de('select count(*) from staging.abastecimento'), '42501', 'anon não lê o staging');
reset role;

-- ---- Resultados e Operações: administrador e diretoria; gestor e Operacional não ----
select tests.como(pg_temp.id('auth_Dir'));
select is(
  array[pg_temp.ve('natureza'), pg_temp.ve('despesa'), pg_temp.ve('viagem'), pg_temp.ve('folha'), pg_temp.ve('evento_da_folha')],
  array[1, 1, 1, 1, 1]::bigint[],
  'staging_natureza_ler, staging_despesa_ler, staging_viagem_ler, staging_folha_ler, staging_evento_da_folha_ler: a diretoria vê');
select is(array[pg_temp.ve('operacao'), pg_temp.ve('roster')], array[1, 1]::bigint[],
  'staging_operacao_ler, staging_roster_ler: a diretoria vê');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(
  array[pg_temp.ve('natureza'), pg_temp.ve('despesa'), pg_temp.ve('viagem'), pg_temp.ve('folha'),
        pg_temp.ve('evento_da_folha'), pg_temp.ve('operacao'), pg_temp.ve('roster')],
  array[1, 1, 1, 1, 1, 1, 1]::bigint[], 'o administrador vê Resultados e Operações');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  array[pg_temp.ve('natureza'), pg_temp.ve('despesa'), pg_temp.ve('viagem'), pg_temp.ve('folha'),
        pg_temp.ve('evento_da_folha'), pg_temp.ve('operacao'), pg_temp.ve('roster')],
  array[0, 0, 0, 0, 0, 0, 0]::bigint[], 'o gestor de frota (sem Resultados nem Operações) não vê');
select is(pg_temp.erro_de($$insert into staging.abastecimento (origem_id, placa, data, litros) values ('x', 'FFF8B81', '2026-03-02', 1)$$),
  '42501', 'ninguém grava no staging pelo app');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(
  array[pg_temp.ve('natureza'), pg_temp.ve('despesa'), pg_temp.ve('viagem'), pg_temp.ve('folha'),
        pg_temp.ve('evento_da_folha'), pg_temp.ve('operacao'), pg_temp.ve('roster')],
  array[0, 0, 0, 0, 0, 0, 0]::bigint[], 'o Operacional não vê Resultados nem Operações');
reset role;

-- ---- nucleo.abastecimento_do_mes ----
select tests.como(pg_temp.id('auth_Dir'));
select set_config('t.r', nucleo.abastecimento_do_mes('2026-03-15')::text, true);
select is(current_setting('t.r')::jsonb->>'mes', '2026-03-01', 'qualquer dia vale o mês');
select is((current_setting('t.r')::jsonb->'totais'->>'placas')::int, 3, 'três placas em março (o 01/04 fica fora: [início, fim))');
select is((current_setting('t.r')::jsonb->'totais'->>'litros')::numeric, 560::numeric, 'litros do mês: todos os abastecimentos');
select is((current_setting('t.r')::jsonb->'totais'->>'km')::numeric, 1710::numeric, 'km do mês: só hodômetro válido');
select is((current_setting('t.r')::jsonb->'totais'->>'km_por_litro')::numeric, 3.35::numeric,
  'km/l da frota: km válido ÷ litros dos mesmos abastecimentos (1710 / 510)');
select is((current_setting('t.r')::jsonb->'totais'->>'valor')::numeric, 3260.00::numeric, 'valor do mês');
select is((current_setting('t.r')::jsonb->'totais'->>'sem_hodometro')::int, 1, 'um abastecimento sem hodômetro válido');
select is(current_setting('t.r')::jsonb->'linhas'->0->>'placa', 'FFF8B81', 'ordem padrão pela placa');
select is((current_setting('t.r')::jsonb->'linhas'->0->>'km_por_litro')::numeric, 3.00::numeric, 'FFF8B81: 900 km / 300 l');
select is((current_setting('t.r')::jsonb->'linhas'->1->>'litros')::numeric, 250::numeric, 'FFF8B82: litros com o sem hodômetro');
select is((current_setting('t.r')::jsonb->'linhas'->1->>'km_por_litro')::numeric, 4.00::numeric, 'FFF8B82: km/l só dos válidos (800 / 200)');
select is(current_setting('t.r')::jsonb->'linhas'->0->>'tipo', 'cavalo', 'a placa do Eixo traz o tipo');
select ok(current_setting('t.r')::jsonb->'linhas'->2->>'ativo_id' is null, 'a placa fora do Eixo vem sem ativo');
select is(nucleo.abastecimento_do_mes('2026-03-01', null, '-km_por_litro')->'linhas'->0->>'placa', 'FFF8B82',
  'ordem decrescente por km/l');
select is(
  (select jsonb_agg(x->>'placa') from jsonb_array_elements(
     nucleo.abastecimento_do_mes('2026-03-01', null, 'placa', 2, 2)->'linhas') x),
  '["ZZZ8Z99"]'::jsonb, 'paginação no banco: a página 2 de tamanho 2');
select is((nucleo.abastecimento_do_mes('2026-03-01', null, 'placa', 9, 2)->>'pagina')::int, 2,
  'página além do fim volta à última');
select is((nucleo.abastecimento_do_mes('2026-03-01', 'fff8b82')->>'filtradas')::int, 1, 'busca pela placa');
select is(nucleo.abastecimento_do_mes()->>'mes', '2026-04-01', 'sem mês, o mais recente com dados');
select is(pg_temp.erro_de($$select nucleo.abastecimento_do_mes('2026-03-01', null, 'nome')$$), '22023', 'ordem desconhecida é recusada');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is((nucleo.abastecimento_do_mes('2026-03-01')->'totais'->>'placas')::int, 1, 'o gestor de frota soma só a carteira dele');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is((nucleo.abastecimento_do_mes('2026-03-01')->>'filtradas')::int, 0, 'o Operacional não vê abastecimento');
reset role;

select * from finish();
rollback;
