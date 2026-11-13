-- Frota › Acompanhamento v2, fatia A1: desempenho da grade por conjunto com o volume real (928 placas).
--  * No CI, `/frota/acompanhamento?tam=100` estourou o limite de tempo (57014): a grade refazia, por dia e por
--    conjunto, a situação do cavalo e dos implementos. O teste fixa um limite: 100 linhas de 31 dias (janeiro)
--    com as 928 placas da frota, vistas pela Diretoria (todas as linhas, com a RLS), em menos de 1,5 s.
--  * Também confere que cada linha da grade traz os mesmos dias de `nucleo.dias_do_conjunto` (a definição da
--    situação do conjunto, dia a dia) e que a página 2 não repete a 1.
-- Dados fictícios, em janeiro de 2026 (todo o mês é passado).
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
    v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '@exemplo.local');
    insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (v_pessoa, v_auth, p_perfil);
    perform pg_temp.guardar('auth_' || p_nome, v_auth);
  end if;
  return pg_temp.guardar(p_nome, v_pessoa);
end;
$$;
create function pg_temp.ativo(p_n bigint, p_tipo nucleo.tipo_de_ativo) returns uuid language plpgsql as $$
begin
  insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio, tipo, tipo_origem)
    values (120000 + p_n, 'C112-' || p_n, true, true, 'frota_de_ativo'::nucleo.tipo_de_cr, 'informada');
  return nucleo.cadastrar_ativo(
    p_tipo => p_tipo, p_renavam => pg_temp.renavam(p_n),
    p_placa => 'GDP' || (1 + p_n / 1000)::text || chr(65 + (p_n / 100 % 10)::int) || lpad((p_n % 100)::text, 2, '0'),
    p_gestor_id => pg_temp.id('Gestor P'), p_cr_id => (select id from nucleo.cr where codigo = 'C112-' || p_n),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 112'),
    p_em => '2026-01-02 08:00-03',
    p_funcao => case when p_tipo = 'implemento' then 'semirreboque'::nucleo.funcao_do_implemento end,
    p_carroceria_id => case when p_tipo = 'implemento' then (select id from config.carroceria where nome = 'Graneleira') end,
    p_eixos => case when p_tipo = 'implemento' then 2::smallint end);
end;
$$;

-- ---- dados: 480 cavalos (1 a 480), 440 implementos (1001 a 1440) e 8 apoios (2001 a 2008) -----------
select pg_temp.pessoa('Gestor P', 112000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Dir P', 112000002, 'diretoria', false);
insert into nucleo.operacao (nome) values ('Grãos 112');
create temp table cav as select n, pg_temp.ativo(n, 'cavalo') as id from generate_series(1, 480) n;
create temp table imp as select n, pg_temp.ativo(n, 'implemento') as id from generate_series(1001, 1440) n;
select pg_temp.ativo(n, 'apoio') from generate_series(2001, 2008) n;
-- 400 cavalos com um implemento (40 deles com dois), 80 sem (o conjunto Caminhão).
select nucleo.engatar(c.id, i.id, 1::smallint, '2026-01-02 12:00-03')
  from cav c join imp i on i.n = c.n + 1000 where c.n <= 400;
select nucleo.engatar(c.id, i.id, 2::smallint, '2026-01-03 12:00-03')
  from cav c join imp i on i.n = c.n + 1000 + 400 where c.n <= 40;
-- Cada cavalo ganha cinco lançamentos no mês; cada décimo implemento fica impedido por um período.
select nucleo.registrar_evento(c.id, e.sigla, e.em)
  from cav c
  cross join (values ('ETc', '2026-01-03 10:00-03'::timestamptz), ('ETv', '2026-01-08 10:00-03'),
                     ('CAr', '2026-01-13 10:00-03'), ('DEs', '2026-01-19 10:00-03'),
                     ('ETc', '2026-01-24 10:00-03')) e (sigla, em)
 where c.n <= 400;
-- Os cavalos sem implemento só aceitam situações válidas para solo.
select nucleo.registrar_evento(c.id, e.sigla, e.em)
  from cav c
  cross join (values ('ETv', '2026-01-04 10:00-03'::timestamptz), ('PÁT', '2026-01-12 10:00-03'),
                     ('ETv', '2026-01-21 10:00-03')) e (sigla, em)
 where c.n > 400;
select nucleo.registrar_evento(i.id, 'MAc', '2026-01-15 10:00-03') from imp i where i.n % 10 = 0 and i.n <= 1440;
-- A leitura mantida é reconstruída uma vez (os gatilhos adiados dispararam 1 vez por linha: minutos).
select nucleo.reconstruir_leitura_das_placas();
-- Como no banco de verdade (o autovacuum analisa): sem estatística das linhas recém-inseridas o planejador erra.
analyze nucleo.ativo, nucleo.cr, nucleo.cr_do_ativo, nucleo.composicao, nucleo.estado_de_status,
        nucleo.evento_de_status, nucleo.leitura_da_placa, nucleo.gestor_da_carteira, nucleo.placa_do_ativo;

-- ---- a grade, como a Diretoria ---------------------------------------------------------------------
select tests.como(pg_temp.id('auth_Dir P'));
select set_config('t.antes', clock_timestamp()::text, true);
select set_config('t.grade', nucleo.grade_por_conjunto('2026-01-01', '{}'::jsonb, 1, 100)::text, true);
select set_config('t.ms', (extract(epoch from clock_timestamp() - current_setting('t.antes')::timestamptz) * 1000)::int::text, true);

select diag('grade de 100 linhas: ' || current_setting('t.ms') || ' ms');
select is((current_setting('t.grade')::jsonb->>'total')::int, 480, 'volume: a Diretoria vê os 480 conjuntos');
select is(jsonb_array_length(current_setting('t.grade')::jsonb->'linhas'), 100, 'volume: a página traz 100 linhas');
select is(
  (select min(jsonb_array_length(l->'dias')) from jsonb_array_elements(current_setting('t.grade')::jsonb->'linhas') l), 31,
  'volume: cada linha traz as 31 colunas de dia de janeiro');
select ok(current_setting('t.ms')::int < 1500,
  'desempenho: 100 linhas de 31 dias com 928 placas em menos de 1,5 s (levou ' || current_setting('t.ms') || ' ms)');

-- A linha traz os mesmos dias da definição por conjunto (dias_do_conjunto), nas 100 linhas.
select is(
  (select count(*)::int from jsonb_array_elements(current_setting('t.grade')::jsonb->'linhas') l
    where l->'dias' is distinct from nucleo.dias_do_conjunto((l->>'ativo_id')::uuid, '2026-01-01', '2026-02-01')),
  0, 'dias: as 100 linhas trazem os mesmos dias de dias_do_conjunto');
select ok(
  (select bool_or(d->>'sigla' = 'ETv') and bool_or(jsonb_array_length(d->'causas') > 0)
     from jsonb_array_elements(current_setting('t.grade')::jsonb->'linhas') l, jsonb_array_elements(l->'dias') d),
  'dias: há dias com situação e dias de conjunto impedido por um implemento, com as causas');

select set_config('t.grade2', nucleo.grade_por_conjunto('2026-01-01', '{}'::jsonb, 2, 100)::text, true);
select is(
  (select count(*)::int from jsonb_array_elements(current_setting('t.grade2')::jsonb->'linhas') l
    where l->>'ativo_id' in (select x->>'ativo_id' from jsonb_array_elements(current_setting('t.grade')::jsonb->'linhas') x)),
  0, 'página: a página 2 não repete linhas da página 1');
select is(
  (select count(*)::int from jsonb_array_elements(current_setting('t.grade2')::jsonb->'linhas')), 100, 'página: a página 2 traz 100 linhas');
select is(
  (current_setting('t.grade')::jsonb->'chips'->>'todos')::int, 480, 'chips: a contagem de todos bate com o total');
reset role;

select * from finish();
rollback;
