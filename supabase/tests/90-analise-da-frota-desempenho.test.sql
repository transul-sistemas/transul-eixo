-- Frota › Análise: desempenho e visibilidade do cálculo em lote.
--  * A situação no fim de cada dia sai de uma vez para todas as placas e dias do mês
--    (nucleo.situacao_dos_dias_visiveis), sem chamar nucleo.situacao_no_dia por placa-dia e sem a RLS
--    avaliar config.ve_ativo em cada linha de estado: o mês inteiro com 200 cavalos fica bem abaixo do
--    limite de tempo de consulta do Supabase (8 s para authenticated).
--  * A função em lote é SECURITY DEFINER e só devolve as placas que quem consulta vê
--    (config.ve_ativo); a de dentro (nucleo.situacao_no_fim_dos_dias) não é executável por authenticated.
--  Sempre com a chave do usuário de cada perfil (armadilha 9).
begin;
\ir apoio/como_usuario.psql

select plan(9);

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
    v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '.90@exemplo.local');
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

-- ---- dados: 200 cavalos sintéticos (150 do Gestor A, 50 do Gestor B), em janeiro de 2026 ----
-- Cada um entra no PÁT no dia 2, vai para MAN no dia 10, sai da MAN no dia 15 e fica em DOp do dia 15
-- em diante: 17 dias em atividade de 30 na frota, por placa.
select pg_temp.pessoa('Gestor A', 900000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 900000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 900000003, 'administrador', false);
select pg_temp.guardar('auth_sem_vinculo', tests.criar_usuario('sem.vinculo.90@exemplo.local'));
insert into nucleo.operacao (nome) values ('Carga 90');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio)
  select 90000 + n, 'K90-' || n, true, true from generate_series(1, 200) n;
select count(*) from (
  select nucleo.cadastrar_ativo(
    p_tipo => 'cavalo', p_renavam => pg_temp.renavam(90000 + n),
    p_placa => 'GZ' || chr(65 + n / 100) || (n / 10 % 10)::text || chr(65 + n % 10) || lpad((n % 100)::text, 2, '0'),
    p_gestor_id => case when n <= 150 then pg_temp.id('Gestor A') else pg_temp.id('Gestor B') end,
    p_cr_id => (select id from nucleo.cr where codigo = 'K90-' || n),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Carga 90'),
    p_em => '2026-01-02 08:00-03')
  from generate_series(1, 200) n
) x;
select count(*) from (
  select nucleo.registrar_evento(a.id, 'MAN', '2026-01-10 10:00-03'),
         nucleo.registrar_evento(a.id, null, '2026-01-15 10:00-03', p_camada => 'impedida'),
         nucleo.registrar_evento(a.id, 'DOp', '2026-01-15 10:00-03')
    from nucleo.ativo a join nucleo.cr_do_ativo c on c.ativo_id = a.id
    join nucleo.cr on cr.id = c.cr_id and cr.codigo like 'K90-%'
) x;
select pg_temp.disparar();

-- ---- Privilégios ----
select ok(
  has_function_privilege('authenticated', 'nucleo.situacao_dos_dias_visiveis(uuid[],date,date)', 'EXECUTE')
  and not has_function_privilege('anon', 'nucleo.situacao_dos_dias_visiveis(uuid[],date,date)', 'EXECUTE'),
  'authenticated executa a situação em lote das placas visíveis; anon não'
);
select ok(
  not has_function_privilege('authenticated', 'nucleo.situacao_no_fim_dos_dias(uuid[],date,date)', 'EXECUTE'),
  'o cálculo sem filtro de visibilidade não é executável por authenticated'
);

-- ---- Desempenho: o mês inteiro, 200 placas, como Administrador ----
select tests.como(pg_temp.id('auth_Adm'));
select set_config('t.inicio', clock_timestamp()::text, true);
select set_config('t.a', nucleo.analise_da_frota('2026-01-01')::text, true);
select set_config('t.fim', clock_timestamp()::text, true);
select is((current_setting('t.a')::jsonb->'retrato'->>'total')::int, 200, 'desempenho: o Administrador vê as 200 placas');
select is((current_setting('t.a')::jsonb->>'placa_dias')::int, 6000, 'desempenho: 200 placas × 30 dias na frota (do dia 2 ao 31)');
select is((current_setting('t.a')::jsonb->>'disponibilidade')::numeric, 56.7, 'desempenho: 17 dias em atividade de 30 (56,7%)');
select cmp_ok(
  current_setting('t.fim')::timestamptz - current_setting('t.inicio')::timestamptz, '<', interval '3 seconds',
  'desempenho: a Análise do mês inteiro com 200 placas sai em menos de 3 s (o Supabase corta em 8 s)'
);
reset role;

-- ---- Visibilidade da situação em lote ----
select set_config('t.todas', (
  select array_agg(a.id)::text from nucleo.ativo a join nucleo.cr_do_ativo c on c.ativo_id = a.id
    join nucleo.cr on cr.id = c.cr_id and cr.codigo like 'K90-%'), true);
select tests.como(pg_temp.id('auth_Gestor B'));
select is(
  (select count(distinct s.ativo_id)::int
     from nucleo.situacao_dos_dias_visiveis(current_setting('t.todas')::uuid[], '2026-01-01', '2026-01-31') s),
  50, 'visibilidade: o Gestor B recebe só as 50 placas da carteira dele, mesmo pedindo as 200'
);
reset role;
select tests.como(pg_temp.id('auth_sem_vinculo'));
select is(
  (select count(*)::int
     from nucleo.situacao_dos_dias_visiveis(current_setting('t.todas')::uuid[], '2026-01-01', '2026-01-31') s),
  0, 'visibilidade: sem vínculo, nada'
);
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select throws_ok(
  $$select count(*) from nucleo.situacao_dos_dias_visiveis('{}'::uuid[], '2025-01-01', '2026-01-31')$$,
  '22023', null, 'recusa: período maior que um ano'
);
reset role;

select * from finish();
rollback;
