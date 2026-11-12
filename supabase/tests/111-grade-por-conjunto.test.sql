-- Frota › Acompanhamento v2, fatia A1: a grade por conjunto e a medida "X de Y conjuntos com lançamento hoje".
--  * Uma linha por conjunto (o cavalo com os implementos engatados no mês); o implemento herda a situação
--    do cavalo; engatar e desatrelar no meio do mês muda a linha no dia certo (o dia vale pelo fim do dia).
--  * "Fora de conjunto": o que não esteve em conjunto no mês (cavalo sem implemento, caminhão, apoio,
--    implemento solto), em seção própria, paginada no banco.
--  * Contagem dos chips, total, X e Y vêm do banco (nunca somados no navegador).
--  * RLS por perfil, sempre com a chave do usuário (armadilha 9); nenhuma função é SECURITY DEFINER.
--  * Sem motorista: a fatia A6 trata disso.
-- Dados fictícios, em janeiro de 2026 (todo o mês é passado).
begin;
\ir apoio/como_usuario.psql

select plan(57);

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
-- A linha do conjunto pela placa do cavalo.
create function pg_temp.linha(p_grade jsonb, p_placa text) returns jsonb language sql as $$
  select l from jsonb_array_elements(p_grade->'linhas') l where l->>'placa' = p_placa
$$;
-- A célula (1 a 31) do cavalo.
create function pg_temp.celula(p_grade jsonb, p_placa text, p_dia int) returns jsonb language sql as $$
  select pg_temp.linha(p_grade, p_placa)->'dias'->(p_dia - 1)
$$;
-- A célula (1 a 31) de um implemento, pela placa do implemento (em qualquer conjunto da grade).
create function pg_temp.celula_do_implemento(p_grade jsonb, p_placa text, p_dia int) returns jsonb language sql as $$
  select i->'dias'->(p_dia - 1)
    from jsonb_array_elements(p_grade->'linhas') l, jsonb_array_elements(l->'implementos') i
   where i->>'placa' = p_placa
$$;
create function pg_temp.completar(p_nome text, p_n bigint, p_placa text, p_gestor text, p_cr text, p_operacao text,
                                  p_tipo nucleo.tipo_de_ativo default 'cavalo') returns uuid language plpgsql as $$
begin
  -- Cada ativo tem o seu CR (o CR de frota é de um ativo só); p_cr diz o tipo: 'F' frota, 'X' acionista.
  insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio, tipo, tipo_origem)
    values (11100 + p_n % 1000, 'C111-' || p_nome, true, true,
            case p_cr when 'X' then 'acionista'::nucleo.tipo_de_cr else 'frota_de_ativo'::nucleo.tipo_de_cr end, 'informada');
  return pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => p_tipo, p_renavam => pg_temp.renavam(p_n), p_placa => p_placa,
    p_gestor_id => pg_temp.id(p_gestor), p_cr_id => (select id from nucleo.cr where codigo = 'C111-' || p_nome),
    p_operacao_id => (select id from nucleo.operacao where nome = p_operacao),
    p_em => '2026-01-02 08:00-03',
    p_funcao => case when p_tipo = 'implemento' then 'semirreboque'::nucleo.funcao_do_implemento end,
    p_carroceria_id => case when p_tipo = 'implemento' then (select id from config.carroceria where nome = 'Graneleira') end,
    p_eixos => case when p_tipo = 'implemento' then 2::smallint end));
end;
$$;

-- ---- dados -------------------------------------------------------------------------------------
-- Gestor A: conjunto kA (iA1 desde 02/01 12h; iA2 de 10/01 09h a 20/01 15h), conjunto kB (iB1 desde 15/01),
--   fora de conjunto: kS (cavalo sem implemento), cam (caminhão), iL (implemento solto).
-- Gestor C: conjunto kC (iC desde 05/01).
select pg_temp.pessoa('Gestor A', 111000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor C', 111000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 111000003, 'administrador', false);
select pg_temp.pessoa('Dir', 111000004, 'diretoria', false);
select pg_temp.pessoa('Oper', 111000005, 'operacional', false);
select pg_temp.guardar('auth_sem_vinculo', tests.criar_usuario('sem.vinculo.111@exemplo.local'));
insert into nucleo.operacao (nome) values ('Grãos 111'), ('Cimento 111');
select pg_temp.completar('kA', 11101, 'GCJ1A01', 'Gestor A', 'F', 'Grãos 111');
select pg_temp.completar('kB', 11102, 'GCJ1A02', 'Gestor A', 'X', 'Grãos 111');
select pg_temp.completar('kC', 11103, 'GCJ1A03', 'Gestor C', 'F', 'Cimento 111');
select pg_temp.completar('kS', 11104, 'GCJ1A04', 'Gestor A', 'F', 'Grãos 111');
select pg_temp.completar('cam', 11105, 'GCJ1A05', 'Gestor A', 'F', 'Grãos 111', 'caminhao');
select pg_temp.completar('iA1', 11111, 'GCJ1B01', 'Gestor A', 'F', 'Grãos 111', 'implemento');
select pg_temp.completar('iA2', 11112, 'GCJ1B02', 'Gestor A', 'F', 'Grãos 111', 'implemento');
select pg_temp.completar('iB1', 11113, 'GCJ1B03', 'Gestor A', 'X', 'Grãos 111', 'implemento');
select pg_temp.completar('iC', 11114, 'GCJ1B04', 'Gestor C', 'F', 'Cimento 111', 'implemento');
select pg_temp.completar('iL', 11115, 'GCJ1B05', 'Gestor A', 'F', 'Grãos 111', 'implemento');
select nucleo.engatar(pg_temp.id('kA'), pg_temp.id('iA1'), 1::smallint, '2026-01-02 12:00-03');
select nucleo.engatar(pg_temp.id('kA'), pg_temp.id('iA2'), 2::smallint, '2026-01-10 09:00-03');
select nucleo.engatar(pg_temp.id('kB'), pg_temp.id('iB1'), 1::smallint, '2026-01-15 09:00-03');
select nucleo.engatar(pg_temp.id('kC'), pg_temp.id('iC'), 1::smallint, '2026-01-05 09:00-03');
select nucleo.registrar_evento(pg_temp.id('kA'), 'ETc', '2026-01-03 10:00-03');
select nucleo.desatrelar(pg_temp.id('kA'), '2026-01-20 15:00-03', array[pg_temp.id('iA2')]);
select nucleo.registrar_evento(pg_temp.id('kA'), 'MAc', '2026-01-25 10:00-03');
select nucleo.registrar_evento(pg_temp.id('kB'), 'ETc', '2026-01-16 10:00-03');
select pg_temp.disparar();

-- ---- privilégios e segurança ---------------------------------------------------------------------
select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
     from unnest(array[
       'nucleo.grade_por_conjunto(date,jsonb,integer,integer)',
       'nucleo.conjuntos_com_lancamento_no_dia(date)',
       'nucleo.conjuntos_da_grade(date,text,text)',
       'nucleo.dias_do_ativo(uuid,date,date)',
       'nucleo.dias_do_implemento(uuid,uuid,date,date)']::regprocedure[]) f),
  'authenticated executa as funções da grade por conjunto; anon não'
);
select ok(
  (select bool_and(not p.prosecdef) from pg_proc p where p.oid = any (array[
       'nucleo.grade_por_conjunto(date,jsonb,integer,integer)',
       'nucleo.conjuntos_com_lancamento_no_dia(date)',
       'nucleo.conjuntos_da_grade(date,text,text)',
       'nucleo.dias_do_ativo(uuid,date,date)',
       'nucleo.dias_do_implemento(uuid,uuid,date,date)']::regprocedure[])),
  'todas rodam com a RLS de quem chama (nenhuma é SECURITY DEFINER)'
);

-- ---- Gestor A: o escopo e a forma da linha ---------------------------------------------------------
select tests.como(pg_temp.id('auth_Gestor A'));
select set_config('t.grade', nucleo.grade_por_conjunto('2026-01-01')::text, true);
select is((current_setting('t.grade')::jsonb->>'total')::int, 2, 'grade: o Gestor A vê os dois conjuntos da carteira dele');
select is(
  (select array_agg(l->>'placa' order by l->>'placa') from jsonb_array_elements(current_setting('t.grade')::jsonb->'linhas') l),
  array['GCJ1A01', 'GCJ1A02'], 'grade: a linha é o cavalo do conjunto, ordenada pela placa'
);
select is(jsonb_array_length(pg_temp.linha(current_setting('t.grade')::jsonb, 'GCJ1A01')->'dias'), 31, 'grade: janeiro tem 31 colunas de dia');
select is(
  (select array_agg(i->>'placa' order by i->>'placa') from jsonb_array_elements(pg_temp.linha(current_setting('t.grade')::jsonb, 'GCJ1A01')->'implementos') i),
  array['GCJ1B01', 'GCJ1B02'], 'grade: os implementos que estiveram engatados no mês ficam sob o cavalo'
);
select is(
  pg_temp.linha(current_setting('t.grade')::jsonb, 'GCJ1A01')->>'nome_do_conjunto',
  nucleo.nome_do_conjunto(pg_temp.id('kA'), now()),
  'grade: o nome do conjunto vem da nomenclatura, calculado e nunca gravado na placa'
);
select is(
  pg_temp.linha(current_setting('t.grade')::jsonb, 'GCJ1A01')->'tipos_de_cr', '["frota"]'::jsonb,
  'grade: o tipo do CR vigente do cavalo A é Frota'
);
select is(
  pg_temp.linha(current_setting('t.grade')::jsonb, 'GCJ1A02')->'tipos_de_cr', '["acionista"]'::jsonb,
  'grade: o tipo do CR vigente do cavalo B é Acionista'
);

-- ---- herança, engate e desengate no meio do mês --------------------------------------------------
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 4)->>'sigla', 'ETc',
  'herança: o cavalo está em ETc no dia 4'
);
select is(
  pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B01', 4)->>'sigla', 'ETc',
  'herança: o implemento engatado herda a sigla do cavalo (ETc no dia 4)'
);
select is(
  pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B01', 2)->>'sigla',
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 2)->>'sigla',
  'herança: no dia do engate (02/01, 12h) o implemento já tem a sigla do cavalo (PÁT)'
);
select is(
  (pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B01', 1)->>'engatado')::boolean, false,
  'engate: antes do dia do engate o implemento não está no conjunto'
);
select is(pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B01', 1)->>'sigla', null,
  'engate: antes do engate o implemento não herda sigla nenhuma');
select is(
  (pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B02', 9)->>'engatado')::boolean, false,
  'engate no meio do mês: o dia 9 ainda fica fora do conjunto'
);
select is(
  pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B02', 10)->>'sigla', 'ETc',
  'engate no meio do mês: a linha muda no dia 10, o do engate'
);
select is(
  pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B02', 19)->>'sigla', 'ETc',
  'desengate: o dia 19 ainda é do conjunto'
);
select is(
  (pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B02', 20)->>'engatado')::boolean, false,
  'desengate no meio do mês: a linha muda no dia 20, o do desengate (o dia vale pelo fim do dia)'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 26)->>'sigla', 'MAc',
  'situação: o cavalo em MAc (impedida) no dia 26'
);
select is(
  pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B01', 26)->>'sigla', 'MAc',
  'herança: o conjunto inteiro fica impedido, e o implemento engatado mostra MAc'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 26)->>'grupo', 'impedida',
  'situação: o grupo da célula MAc é impedida (o tom sai do grupo e da sigla)'
);

-- ---- selo de lançamentos por célula ------------------------------------------------------------------
select is(
  (pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 3)->>'eventos')::int, 1,
  'selo: o dia 3 teve um lançamento (ETc)'
);
select is(
  (pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 4)->>'eventos')::int, 0,
  'selo: o dia 4 não teve lançamento'
);
select is(
  (pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 4)->>'tardia')::boolean, false,
  'selo: dia sem lançamento não leva marca de correção tardia'
);

-- ---- fora de conjunto, chips e paginação -----------------------------------------------------------------
select is(
  (current_setting('t.grade')::jsonb->'fora'->>'total')::int, 3,
  'fora de conjunto: o cavalo sem implemento, o caminhão e o implemento solto do Gestor A'
);
select is(
  (select array_agg(l->>'placa' order by l->>'placa') from jsonb_array_elements(current_setting('t.grade')::jsonb->'fora'->'linhas') l),
  array['GCJ1A04', 'GCJ1A05', 'GCJ1B05'], 'fora de conjunto: uma linha por placa, ordenada'
);
select is(
  (select count(*) from jsonb_array_elements(current_setting('t.grade')::jsonb->'fora'->'linhas') l
    where l->>'placa' in ('GCJ1A01', 'GCJ1B01')),
  0::bigint, 'fora de conjunto: quem está num conjunto não aparece aqui'
);
select is(
  current_setting('t.grade')::jsonb->'chips', '{"todos": 2, "em-atividade": 1, "atencao": 0, "impedida": 1, "patio": 0, "fora": 0}'::jsonb,
  'chips: a contagem por grupo vem do banco (kA impedido, kB em atividade)'
);
select is(
  (nucleo.grade_por_conjunto('2026-01-01', '{"grupo": "impedida"}')->>'total')::int, 1,
  'chips: filtrar pelo grupo impedida deixa só o conjunto impedido'
);
select is(
  (nucleo.grade_por_conjunto('2026-01-01', '{"grupo": "impedida"}')->'chips'->>'em-atividade')::int, 1,
  'chips: a contagem de cada grupo ignora a seleção do próprio filtro de grupo'
);
select is(
  (nucleo.grade_por_conjunto('2026-01-01', '{"busca": "gcj1b03"}')->>'total')::int, 1,
  'filtro: a busca pela placa de um implemento acha o conjunto dele'
);
select is(
  nucleo.grade_por_conjunto('2026-01-01', '{"busca": "gcj1b03"}')->'linhas'->0->>'placa', 'GCJ1A02',
  'filtro: e devolve a linha do cavalo (GCJ1A02)'
);
select is(
  (nucleo.grade_por_conjunto('2026-01-01', '{"tipo_de_cr": "acionista"}')->>'total')::int, 1,
  'filtro: o tipo Acionista deixa só o conjunto de CR acionista'
);
select is(
  nucleo.grade_por_conjunto('2026-01-01', '{}', 2, 1)->'linhas'->0->>'placa', 'GCJ1A02',
  'paginação: a página 2 com uma linha por página traz o segundo conjunto'
);
select is(
  nucleo.grade_por_conjunto('2026-01-01', '{}', 1, 1)->>'paginas', '2',
  'paginação: duas páginas de um conjunto'
);
select is(
  (nucleo.grade_por_conjunto('2026-01-01', '{"fora_pagina": 2}', 1, 2)->'fora'->'linhas'->0->>'placa'), 'GCJ1B05',
  'paginação: a seção "fora de conjunto" tem página própria'
);
select is(
  pg_temp.erro_de($$select nucleo.grade_por_conjunto('2026-01-01', '{"grupo": "azul"}')$$), '22023',
  'filtro: grupo desconhecido é recusado'
);
reset role;

-- ---- X de Y conjuntos com lançamento --------------------------------------------------------------------
select tests.como(pg_temp.id('auth_Gestor A'));
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-02')$$, $$values (1::bigint, 1::bigint)$$,
  'X de Y no dia 2: o conjunto A está montado (12h) e teve o lançamento inicial: 1 de 1'
);
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-04')$$, $$values (0::bigint, 1::bigint)$$,
  'X de Y no dia 4: 0 de 1 (sem lançamento)'
);
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-15')$$, $$values (0::bigint, 2::bigint)$$,
  'X de Y no dia 15: o conjunto B entra em Y no dia em que foi montado'
);
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-16')$$, $$values (1::bigint, 2::bigint)$$,
  'X de Y no dia 16: o lançamento do conjunto B conta: 1 de 2'
);
select is(
  pg_temp.erro_de(format('select * from nucleo.conjuntos_com_lancamento_no_dia(%L)', ((now() at time zone 'America/Sao_Paulo')::date + 1)::text)),
  '22023', 'X de Y: dia que ainda não chegou é recusado'
);
reset role;

select tests.como(pg_temp.id('auth_Adm'));
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-16')$$, $$values (1::bigint, 3::bigint)$$,
  'X de Y no dia 16, para o Administrador (os três conjuntos): 1 de 3, conferido com a contagem manual'
);
select is(
  nucleo.lancar_situacao_do_dia(pg_temp.id('kC'), 'ETc', '2026-01-16')->>'sigla', 'ETc',
  'lançar: o Administrador lança ETc no conjunto C no dia 16'
);
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-16')$$, $$values (2::bigint, 3::bigint)$$,
  'X de Y: depois do lançamento do conjunto C, 2 de 3'
);
select set_config('t.grade_adm', nucleo.grade_por_conjunto('2026-01-01')::text, true);
select is(
  (pg_temp.celula(current_setting('t.grade_adm')::jsonb, 'GCJ1A03', 16)->>'manual')::boolean, true,
  'selo: o lançamento manual do dia 16 leva a marca de manual'
);
select is(
  (pg_temp.celula(current_setting('t.grade_adm')::jsonb, 'GCJ1A03', 16)->>'tardia')::boolean, true,
  'selo: lançado depois do dia, leva a marca de correção tardia'
);
reset role;

-- ---- o mês, o escopo dos demais perfis -------------------------------------------------------------------------
select tests.como(pg_temp.id('auth_Adm'));
select is((nucleo.grade_por_conjunto('2026-01-01')->>'total')::int, 3, 'RLS: o Administrador vê os três conjuntos');
select is(
  jsonb_array_length(nucleo.grade_por_conjunto('2026-02-01')->'linhas'->0->'dias'), 28,
  'mês: fevereiro tem 28 colunas (as colunas seguem os dias do mês)'
);
select is(
  (nucleo.grade_por_conjunto('2025-12-01')->>'total')::int, 0,
  'mês: antes de qualquer conjunto, a grade vem vazia'
);
select is(
  pg_temp.erro_de($$select nucleo.grade_por_conjunto(((now() at time zone 'America/Sao_Paulo')::date + 62)::date)$$), '22023',
  'mês: mês futuro é recusado'
);
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is((nucleo.grade_por_conjunto('2026-01-01')->>'total')::int, 3, 'RLS: a Diretoria vê os três conjuntos');
reset role;
select tests.como(pg_temp.id('auth_Gestor C'));
select is(
  (nucleo.grade_por_conjunto('2026-01-01')->>'total')::int, 1,
  'RLS: o Gestor C vê só o conjunto dele'
);
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-16')$$, $$values (1::bigint, 1::bigint)$$,
  'RLS: X de Y do Gestor C conta só a carteira dele'
);
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is((nucleo.grade_por_conjunto('2026-01-01')->>'total')::int, 0, 'RLS: o Operacional sem custódia não vê conjunto');
reset role;
select tests.como(pg_temp.id('auth_sem_vinculo'));
select is((nucleo.grade_por_conjunto('2026-01-01')->>'total')::int, 0, 'RLS: o usuário sem vínculo não vê conjunto');
reset role;
select pg_temp.disparar();
select tests.como_anonimo();
select is(
  pg_temp.erro_de($$select nucleo.grade_por_conjunto('2026-01-01')$$), '42501',
  'RLS: anon não executa a grade'
);
reset role;

select * from finish();
rollback;
