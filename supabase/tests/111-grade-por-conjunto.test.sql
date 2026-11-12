-- Frota › Acompanhamento v2, fatia A1: a grade por conjunto e a medida "X de Y conjuntos com lançamento hoje".
--  * Uma linha por conjunto, UMA PEÇA SÓ (12/11/2026): o cavalo (ou o caminhão) é a cara; os implementos
--    engatados no mês vêm como chips (placa, engatado de/até), sem células próprias. A situação do dia é a do
--    cavalo, exceto quando um implemento engatado NAQUELE dia está impedido: aí o conjunto fica impedido e
--    a célula traz a causa (a placa do implemento). O dia vale pelo fim do dia.
--  * Aba "Soltas": implemento sem cavalo engatado no mês, apoio e equipamento, com a própria grade, chips
--    e a medida "X de Y soltas com situação hoje".
--  * Contagem dos chips, total, X e Y vêm do banco (nunca somados no navegador).
--  * RLS por perfil, sempre com a chave do usuário (armadilha 9); nenhuma função é SECURITY DEFINER.
--  * Sem motorista: a fatia A6 trata disso.
-- Dados fictícios, em janeiro de 2026 (todo o mês é passado).
begin;
\ir apoio/como_usuario.psql

select plan(83);

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
-- O chip de um implemento, pela placa do implemento (em qualquer conjunto da grade).
create function pg_temp.chip(p_grade jsonb, p_placa text) returns jsonb language sql as $$
  select i
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
--   conjunto kD (iD de 03/01 a 12/01: solto no fim do mês), conjunto 'Caminhão' kS (cavalo que nunca engatou) e
--   cam (caminhão); soltas: iL (implemento solto) e ap (apoio).
--   iB1 fica impedido (MAc) em 20/01 estando engatado: o conjunto B fica impedido, com a causa.
--   iA2 entra em MAN em 22/01, já desatrelado: NÃO impede o conjunto A.
-- Gestor C: conjunto kC (iC desde 05/01).
-- Regra de 12/11/2026: cavalo sem implemento é o conjunto 'Caminhão'; só implemento solto, apoio e
-- equipamento ficam em 'Fora de conjunto'.
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
select pg_temp.completar('kD', 11106, 'GCJ1A07', 'Gestor A', 'F', 'Grãos 111');
select pg_temp.completar('iD', 11116, 'GCJ1B06', 'Gestor A', 'F', 'Grãos 111', 'implemento');
select pg_temp.completar('ap', 11107, 'GCJ1A06', 'Gestor A', 'F', 'Grãos 111', 'apoio');
select nucleo.engatar(pg_temp.id('kA'), pg_temp.id('iA1'), 1::smallint, '2026-01-02 12:00-03');
select nucleo.engatar(pg_temp.id('kA'), pg_temp.id('iA2'), 2::smallint, '2026-01-10 09:00-03');
select nucleo.engatar(pg_temp.id('kB'), pg_temp.id('iB1'), 1::smallint, '2026-01-15 09:00-03');
select nucleo.engatar(pg_temp.id('kC'), pg_temp.id('iC'), 1::smallint, '2026-01-05 09:00-03');
select nucleo.engatar(pg_temp.id('kD'), pg_temp.id('iD'), 1::smallint, '2026-01-03 09:00-03');
select nucleo.desatrelar(pg_temp.id('kD'), '2026-01-12 15:00-03');
select nucleo.registrar_evento(pg_temp.id('kA'), 'ETc', '2026-01-03 10:00-03');
select nucleo.desatrelar(pg_temp.id('kA'), '2026-01-20 15:00-03', array[pg_temp.id('iA2')]);
select nucleo.registrar_evento(pg_temp.id('kA'), 'MAc', '2026-01-25 10:00-03');
select nucleo.registrar_evento(pg_temp.id('kB'), 'ETc', '2026-01-16 10:00-03');
select nucleo.registrar_evento(pg_temp.id('iB1'), 'MAc', '2026-01-20 10:00-03');
select nucleo.registrar_evento(pg_temp.id('iA2'), 'MAN', '2026-01-22 10:00-03');
select pg_temp.disparar();

-- ---- privilégios e segurança ---------------------------------------------------------------------
select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
     from unnest(array[
       'nucleo.grade_por_conjunto(date,jsonb,integer,integer)',
       'nucleo.conjuntos_com_lancamento_no_dia(date)',
       'nucleo.conjuntos_da_grade(date,text,text)',
       'nucleo.dias_do_ativo(uuid,date,date)',
       'nucleo.dias_do_conjunto(uuid,date,date)',
       'nucleo.soltas_da_grade(date,text,text)',
       'nucleo.grade_de_soltas(date,jsonb,integer,integer)',
       'nucleo.soltas_com_situacao_no_dia(date)']::regprocedure[]) f),
  'authenticated executa as funções da grade por conjunto; anon não'
);
select ok(
  (select bool_and(not p.prosecdef) from pg_proc p where p.oid = any (array[
       'nucleo.grade_por_conjunto(date,jsonb,integer,integer)',
       'nucleo.conjuntos_com_lancamento_no_dia(date)',
       'nucleo.conjuntos_da_grade(date,text,text)',
       'nucleo.dias_do_ativo(uuid,date,date)',
       'nucleo.dias_do_conjunto(uuid,date,date)',
       'nucleo.soltas_da_grade(date,text,text)',
       'nucleo.grade_de_soltas(date,jsonb,integer,integer)',
       'nucleo.soltas_com_situacao_no_dia(date)']::regprocedure[])),
  'todas rodam com a RLS de quem chama (nenhuma é SECURITY DEFINER)'
);

-- ---- Gestor A: o escopo e a forma da linha ---------------------------------------------------------
select tests.como(pg_temp.id('auth_Gestor A'));
select set_config('t.grade', nucleo.grade_por_conjunto('2026-01-01')::text, true);
select is((current_setting('t.grade')::jsonb->>'total')::int, 5, 'grade: o Gestor A vê os cinco conjuntos da carteira dele (o cavalo sem implemento e o caminhão são conjuntos)');
select is(
  (select array_agg(l->>'placa' order by l->>'placa') from jsonb_array_elements(current_setting('t.grade')::jsonb->'linhas') l),
  array['GCJ1A01', 'GCJ1A02', 'GCJ1A04', 'GCJ1A05', 'GCJ1A07'], 'grade: a linha é o cavalo (ou o caminhão) do conjunto, ordenada pela placa'
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
  pg_temp.linha(current_setting('t.grade')::jsonb, 'GCJ1A04')->>'nome_do_conjunto', 'Caminhão',
  'nome: cavalo que nunca engatou no mês é o conjunto Caminhão'
);
select is(
  pg_temp.linha(current_setting('t.grade')::jsonb, 'GCJ1A05')->>'nome_do_conjunto', 'Caminhão',
  'nome: o caminhão também é o conjunto Caminhão'
);
select is(
  pg_temp.linha(current_setting('t.grade')::jsonb, 'GCJ1A07')->>'nome_do_conjunto', 'Sem implemento',
  'nome: cavalo que teve implemento no mês e acabou sem nenhum é Sem implemento'
);
select is(
  (pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B06', 11)->>'engatado')::boolean, true,
  'desengate: o dia 11 ainda é do conjunto do cavalo D'
);
select is(
  (pg_temp.celula_do_implemento(current_setting('t.grade')::jsonb, 'GCJ1B06', 12)->>'engatado')::boolean, false,
  'desengate: no dia 12, o do desengate à tarde, o implemento já saiu'
);
select is(
  pg_temp.linha(current_setting('t.grade')::jsonb, 'GCJ1A01')->'tipos_de_cr', '["frota"]'::jsonb,
  'grade: o tipo do CR vigente do cavalo A é Frota'
);
select is(
  pg_temp.linha(current_setting('t.grade')::jsonb, 'GCJ1A02')->'tipos_de_cr', '["acionista"]'::jsonb,
  'grade: o tipo do CR vigente do cavalo B é Acionista'
);

-- ---- a situação do conjunto, os chips dos implementos e a causa ----------------------------------------
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 4)->>'sigla', 'ETc',
  'conjunto: a célula do dia mostra a situação do cavalo (ETc no dia 4)'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 2)->>'sigla', 'PÁT',
  'conjunto: no dia do engate (02/01, 12h) o conjunto mostra a situação do cavalo (PÁT)'
);
select is(
  (pg_temp.chip(current_setting('t.grade')::jsonb, 'GCJ1B01') ? 'dias'), false,
  'peça só: o implemento não tem células próprias, só o chip'
);
select is(
  pg_temp.chip(current_setting('t.grade')::jsonb, 'GCJ1B01')->>'engatado_de', '2026-01-02',
  'chip: o implemento A1 está engatado desde o dia 2'
);
select is(
  pg_temp.chip(current_setting('t.grade')::jsonb, 'GCJ1B01')->>'engatado_ate', null,
  'chip: sem desengate, o engatado até fica em aberto'
);
select is(
  pg_temp.chip(current_setting('t.grade')::jsonb, 'GCJ1B02')->>'engatado_de', '2026-01-10',
  'engate no meio do mês: o implemento A2 entra no dia 10, o do engate'
);
select is(
  pg_temp.chip(current_setting('t.grade')::jsonb, 'GCJ1B02')->>'engatado_ate', '2026-01-19',
  'desengate no meio do mês: o último dia dele no conjunto é o 19 (o dia vale pelo fim do dia)'
);
select is(
  pg_temp.chip(current_setting('t.grade')::jsonb, 'GCJ1B06')->>'engatado_ate', '2026-01-11',
  'desengate à tarde de 12/01: o último dia no conjunto D é o 11'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 26)->>'sigla', 'MAc',
  'situação: o cavalo em MAc (impedida) no dia 26'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 26)->'causa', 'null'::jsonb,
  'causa: cavalo impedido por si mesmo não tem causa de implemento'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 26)->>'grupo', 'impedida',
  'situação: o grupo da célula MAc é impedida (o tom sai do grupo e da sigla)'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A02', 19)->>'sigla', 'ETc',
  'conjunto B: no dia 19 o implemento ainda está bem e vale a situação do cavalo (ETc)'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A02', 20)->>'sigla', 'MAc',
  'conjunto B: no dia 20 o implemento engatado impede o conjunto (MAc)'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A02', 20)->'causa'->>'placa', 'GCJ1B03',
  'causa: o conjunto B está impedido pelo implemento GCJ1B03'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A02', 20)->>'grupo', 'impedida',
  'conjunto B: o grupo da célula é impedida'
);
select is(
  pg_temp.celula(current_setting('t.grade')::jsonb, 'GCJ1A01', 22)->>'sigla', 'ETc',
  'conjunto A: o implemento A2 em MAN no dia 22 já está desatrelado e NÃO impede o conjunto'
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

-- ---- chips e paginação dos conjuntos -----------------------------------------------------------------
select is(
  current_setting('t.grade')::jsonb->'chips', '{"todos": 5, "em-atividade": 0, "atencao": 0, "impedida": 2, "patio": 3, "fora": 0}'::jsonb,
  'chips: a contagem por grupo vem do banco (kA e kB impedidos, três no pátio)'
);
select is(
  (current_setting('t.grade')::jsonb ? 'fora'), false,
  'conjuntos: a seção fora de conjunto saiu da grade (virou a aba Soltas)'
);
select is(
  (nucleo.grade_por_conjunto('2026-01-01', '{"grupo": "impedida"}')->>'total')::int, 2,
  'chips: filtrar pelo grupo impedida deixa os dois conjuntos impedidos'
);
select is(
  (nucleo.grade_por_conjunto('2026-01-01', '{"grupo": "impedida"}')->'chips'->>'patio')::int, 3,
  'chips: a contagem de cada grupo ignora a seleção do próprio filtro de grupo'
);
select is(
  (select array_agg(l->>'placa' order by l->>'placa')
     from jsonb_array_elements(nucleo.grade_por_conjunto('2026-01-01', '{"grupo": "impedida"}')->'linhas') l),
  array['GCJ1A01', 'GCJ1A02'], 'chips: as linhas devolvidas pelo filtro são só as do grupo impedida (a página, não só a contagem)'
);
select is(
  (select array_agg(l->>'placa' order by l->>'placa')
     from jsonb_array_elements(nucleo.grade_por_conjunto('2026-01-01', '{"grupo": "patio"}')->'linhas') l),
  array['GCJ1A04', 'GCJ1A05', 'GCJ1A07'], 'chips: o filtro de pátio traz os três conjuntos no pátio'
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
  nucleo.grade_por_conjunto('2026-01-01', '{}', 1, 1)->>'paginas', '5',
  'paginação: cinco páginas de um conjunto'
);
select is(
  nucleo.grade_por_conjunto('2026-01-01', '{}', 1, 2)->>'paginas', '3',
  'paginação: cinco conjuntos em páginas de dois dão três páginas'
);
select is(
  pg_temp.erro_de($$select nucleo.grade_por_conjunto('2026-01-01', '{"grupo": "azul"}')$$), '22023',
  'filtro: grupo desconhecido é recusado'
);
reset role;

-- ---- X de Y conjuntos com lançamento --------------------------------------------------------------------
select tests.como(pg_temp.id('auth_Gestor A'));
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-02')$$, $$values (5::bigint, 5::bigint)$$,
  'X de Y no dia 2: os cinco conjuntos do Gestor A nasceram nesse dia, com o lançamento inicial: 5 de 5'
);
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-04')$$, $$values (0::bigint, 5::bigint)$$,
  'X de Y no dia 4: 0 de 5 (sem lançamento)'
);
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-15')$$, $$values (0::bigint, 5::bigint)$$,
  'X de Y no dia 15: 0 de 5'
);
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-16')$$, $$values (1::bigint, 5::bigint)$$,
  'X de Y no dia 16: o lançamento do conjunto B conta: 1 de 5'
);
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-20')$$, $$values (0::bigint, 5::bigint)$$,
  'X de Y no dia 20: o evento do implemento (MAc em B1) não conta, só o do cavalo: 0 de 5'
);
select is(
  pg_temp.erro_de(format('select * from nucleo.conjuntos_com_lancamento_no_dia(%L)', ((now() at time zone 'America/Sao_Paulo')::date + 1)::text)),
  '22023', 'X de Y: dia que ainda não chegou é recusado'
);
reset role;

-- ---- aba Soltas: implemento sem cavalo engatado no mês, apoio e equipamento ----------------------------------
select tests.como(pg_temp.id('auth_Gestor A'));
select set_config('t.soltas', nucleo.grade_de_soltas('2026-01-01')::text, true);
select is((current_setting('t.soltas')::jsonb->>'total')::int, 2, 'soltas: o apoio e o implemento solto do Gestor A');
select is(
  (select array_agg(l->>'placa' order by l->>'placa') from jsonb_array_elements(current_setting('t.soltas')::jsonb->'linhas') l),
  array['GCJ1A06', 'GCJ1B05'], 'soltas: uma linha por placa, ordenada'
);
select is(
  (select count(*) from jsonb_array_elements(current_setting('t.soltas')::jsonb->'linhas') l
    where l->>'placa' in ('GCJ1A01', 'GCJ1B01', 'GCJ1A04', 'GCJ1A05', 'GCJ1B06', 'GCJ1B02')),
  0::bigint, 'soltas: quem formou conjunto no mês (cavalo, caminhão e implemento engatado) não aparece aqui'
);
select is(jsonb_array_length(current_setting('t.soltas')::jsonb->'linhas'->0->'dias'), 31, 'soltas: janeiro tem 31 colunas');
select is(
  current_setting('t.soltas')::jsonb->'chips', '{"todos": 2, "em-atividade": 0, "atencao": 0, "impedida": 0, "patio": 2, "fora": 0}'::jsonb,
  'soltas: os chips contam por grupo no banco'
);
select is(
  (nucleo.grade_de_soltas('2026-01-01', '{"grupo": "patio"}')->>'total')::int, 2,
  'soltas: o filtro de pátio traz as duas'
);
select is(
  (nucleo.grade_de_soltas('2026-01-01', '{"grupo": "impedida"}')->>'total')::int, 0,
  'soltas: o filtro de impedida não traz nenhuma'
);
select is(
  nucleo.grade_de_soltas('2026-01-01', '{}', 2, 1)->'linhas'->0->>'placa', 'GCJ1B05',
  'soltas: a página 2 com uma linha por página traz a segunda'
);
select is(
  pg_temp.erro_de($$select nucleo.grade_de_soltas('2026-01-01', '{"grupo": "azul"}')$$), '22023',
  'soltas: grupo desconhecido é recusado'
);
select results_eq(
  $$select x, y from nucleo.soltas_com_situacao_no_dia('2026-01-02')$$, $$values (2::bigint, 2::bigint)$$,
  'X de Y soltas no dia 2: as duas nasceram nesse dia, com o lançamento inicial: 2 de 2'
);
select results_eq(
  $$select x, y from nucleo.soltas_com_situacao_no_dia('2026-01-04')$$, $$values (0::bigint, 2::bigint)$$,
  'X de Y soltas no dia 4: 0 de 2'
);
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(
  nucleo.lancar_situacao_do_dia(pg_temp.id('ap'), 'MAN', '2026-01-16')->>'sigla', 'MAN',
  'lançar: o Administrador lança MAN no apoio no dia 16'
);
select results_eq(
  $$select x, y from nucleo.soltas_com_situacao_no_dia('2026-01-16')$$, $$values (1::bigint, 2::bigint)$$,
  'X de Y soltas no dia 16: depois do lançamento no apoio, 1 de 2'
);
select is(
  pg_temp.erro_de(format('select * from nucleo.soltas_com_situacao_no_dia(%L)', ((now() at time zone 'America/Sao_Paulo')::date + 1)::text)),
  '22023', 'X de Y soltas: dia que ainda não chegou é recusado'
);
reset role;
select tests.como(pg_temp.id('auth_Gestor C'));
select is((nucleo.grade_de_soltas('2026-01-01')->>'total')::int, 0, 'RLS: o Gestor C não tem placa solta');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is((nucleo.grade_de_soltas('2026-01-01')->>'total')::int, 0, 'RLS: o Operacional sem custódia não vê solta');
reset role;

select tests.como(pg_temp.id('auth_Adm'));
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-16')$$, $$values (1::bigint, 6::bigint)$$,
  'X de Y no dia 16, para o Administrador (os seis conjuntos): 1 de 6, conferido com a contagem manual'
);
select is(
  nucleo.lancar_situacao_do_dia(pg_temp.id('kC'), 'ETc', '2026-01-16')->>'sigla', 'ETc',
  'lançar: o Administrador lança ETc no conjunto C no dia 16'
);
select results_eq(
  $$select x, y from nucleo.conjuntos_com_lancamento_no_dia('2026-01-16')$$, $$values (2::bigint, 6::bigint)$$,
  'X de Y: depois do lançamento do conjunto C, 2 de 6'
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
select is((nucleo.grade_por_conjunto('2026-01-01')->>'total')::int, 6, 'RLS: o Administrador vê os seis conjuntos');
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
select is((nucleo.grade_por_conjunto('2026-01-01')->>'total')::int, 6, 'RLS: a Diretoria vê os seis conjuntos');
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
