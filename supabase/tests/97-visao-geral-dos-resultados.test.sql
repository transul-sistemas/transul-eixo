-- Resultados › Visão geral. Só dados fictícios.
--  * nucleo.visao_geral_dos_resultados(p_mes, p_garagem_id, p_operacao_id, p_agrupamento, p_top):
--    receita (CT-e e NFS-e válidos, frete da empresa), custo (despesas pela competência gerencial,
--    provisão e invalidadas fora, rateio já dividido por CR), resultado = receita − custo, margem =
--    resultado ÷ receita; série dos 12 meses até o mês; por operação, unidade ou filial com a linha de
--    total pronta; as naturezas de maior custo (top N) e as outras somadas.
--  * Permissão: Resultados (administrador e diretoria); gestor de frota e Operacional são recusados
--    (42501); anon não executa. SECURITY INVOKER (a RLS do staging vale).
begin;
\ir apoio/como_usuario.psql

select plan(42);

create function pg_temp.id(p_nome text) returns uuid language sql as $$
  select nullif(current_setting('t.' || lower(regexp_replace(p_nome, '[^A-Za-z0-9]', '_', 'g')), true), '')::uuid
$$;
create function pg_temp.guardar(p_nome text, p_id uuid) returns uuid language sql as $$
  select set_config('t.' || lower(regexp_replace(p_nome, '[^A-Za-z0-9]', '_', 'g')), p_id::text, true)::uuid
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
create function pg_temp.usuario(p_nome text, p_n bigint, p_perfil text) returns uuid language plpgsql as $$
declare
  v_pessoa uuid;
  v_auth uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_pessoa;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, pg_temp.cpf(p_n));
  if p_perfil = 'gestor_de_frota' then
    insert into nucleo.papel_da_pessoa (pessoa_id, papel) values (v_pessoa, 'gestor_de_frota');
  end if;
  v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '.97@exemplo.local');
  insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (v_pessoa, v_auth, p_perfil);
  return pg_temp.guardar('auth_' || p_nome, v_auth);
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

-- ---- dados fictícios ----
select pg_temp.usuario('Adm', 970000001, 'administrador');
select pg_temp.usuario('Dir', 970000002, 'diretoria');
select pg_temp.usuario('Gestor', 970000003, 'gestor_de_frota');
select pg_temp.usuario('Oper', 970000004, 'operacional');
insert into nucleo.operacao (nome) values ('Grãos 97'), ('Minério 97');
select pg_temp.guardar('graos', (select id from nucleo.operacao where nome = 'Grãos 97'));
select pg_temp.guardar('minerio', (select id from nucleo.operacao where nome = 'Minério 97'));
select pg_temp.guardar('cor', (select id from config.garagem where codigo = 'cordeiropolis'));
select pg_temp.guardar('par', (select id from config.garagem where codigo = 'parauapebas'));
-- CR A (Grãos, Cordeirópolis, Frota) e CR B (Minério, Parauapebas, Serviço); o 9999997 não está no Eixo.
insert into nucleo.cr (codcencus, codigo, operacao_id, garagem_id, garagem_origem, unidade_gerencial, unidade_gerencial_origem) values
  (4970001, 'K97A', pg_temp.id('graos'), pg_temp.id('cor'), 'informada', 'frota', 'informada'),
  (6970001, 'K97B', pg_temp.id('minerio'), pg_temp.id('par'), 'informada', 'servico', 'informada');

-- Receita (frete da empresa) de março de 2026: 10.000 (A) + 5.000 (B, NFS-e sem status) = 15.000.
-- Fora: CT-e rejeitado, CT-e que sumiu do Sankhya; fevereiro e abril em outros meses.
insert into staging.viagem (nunota, tipo_documento, status_cte, dt_negociacao, codcencus, frete_empresa, sumiu_do_sankhya_em) values
  (9701, 'CTE', 'A', '2026-03-05', '4970001', 10000.00, null),
  (9702, 'NFSE', null, '2026-03-20', '6970001', 5000.00, null),
  (9703, 'CTE', 'R', '2026-03-10', '4970001', 999.00, null),
  (9704, 'CTE', 'A', '2026-03-11', '4970001', 888.00, now()),
  (9705, 'CTE', 'A', '2026-02-10', '4970001', 4000.00, null),
  (9706, 'CTE', 'A', '2026-04-01', '4970001', 7777.00, null);

insert into staging.natureza (codnat, descricao) values
  ('97001', 'Combustível 97'), ('97002', 'Pneus 97'), ('97003', 'Manutenção 97');

-- Custo de março de 2026 = 3.000 + 700 + 1.000 + 400 + 600 = 5.700.
--  d1: no mês. d2: base em fevereiro lançada em 10/03 → fevereiro. d3: base em fevereiro lançada em
--  11/03 → março (mudou de mês). d4: provisão (fora). d5: CR fora do Eixo e sem DTENTSAI → março.
--  d6: invalidada (fora). d7: rateio do mesmo título entre os CRs A e B. d8: abril.
insert into staging.despesa (origem_id, nufin, desdobramento, codcencus, codnat, dt_competencia, dtentsai, provisao, valor_liquido, invalidado_em) values
  ('t97-1', '971', '0', '4970001', '97001', '2026-03-02', '2026-03-05', 'REAL', 3000.00, null),
  ('t97-2', '972', '0', '4970001', '97002', '2026-02-15', '2026-03-10', 'REAL', 500.00, null),
  ('t97-3', '973', '0', '6970001', '97002', '2026-02-15', '2026-03-11', 'REAL', 700.00, null),
  ('t97-4', '974', '0', '6970001', '97001', '2026-03-10', '2026-03-10', 'PROVISAO', 9999.00, null),
  ('t97-5', '975', '0', '9999997', '97003', '2026-03-31', null, null, 1000.00, null),
  ('t97-6', '976', '0', '4970001', '97001', '2026-03-03', '2026-03-03', 'REAL', 8888.00, now()),
  ('t97-7a', '977', '0', '4970001', '97003', '2026-03-04', '2026-03-04', 'REAL', 400.00, null),
  ('t97-7b', '977', '0', '6970001', '97003', '2026-03-04', '2026-03-04', 'REAL', 600.00, null),
  ('t97-8', '978', '0', '4970001', '97001', '2026-04-01', '2026-04-01', 'REAL', 50.00, null);

-- ---- Estrutura e privilégios ----
select ok(
  has_function_privilege('authenticated', 'nucleo.visao_geral_dos_resultados(date,uuid,uuid,text,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'nucleo.visao_geral_dos_resultados(date,uuid,uuid,text,integer)', 'EXECUTE'),
  'authenticated executa a visão geral; anon não');
select ok(
  not (select prosecdef from pg_proc where oid = 'nucleo.visao_geral_dos_resultados(date,uuid,uuid,text,integer)'::regprocedure),
  'a visão geral roda com a RLS de quem chama (SECURITY INVOKER)');

-- ---- Permissão por perfil ----
select tests.como(pg_temp.id('auth_Gestor'));
select is(pg_temp.erro_de($$select nucleo.visao_geral_dos_resultados('2026-03-01')$$), '42501',
  'o gestor de frota (sem Resultados) é recusado');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.erro_de($$select nucleo.visao_geral_dos_resultados('2026-03-01')$$), '42501',
  'o Operacional (sem Resultados) é recusado');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is((nucleo.visao_geral_dos_resultados('2026-03-01')->'kpis'->>'receita')::numeric, 15000.00::numeric,
  'o administrador vê os resultados');
reset role;

-- ---- O mês (diretoria) ----
select tests.como(pg_temp.id('auth_Dir'));
select set_config('t.r', nucleo.visao_geral_dos_resultados('2026-03-15', null, null, 'operacao', 2)::text, true);
select is(current_setting('t.r')::jsonb->>'mes', '2026-03-01', 'qualquer dia vale o mês');
select is((current_setting('t.r')::jsonb->'kpis'->>'receita')::numeric, 15000.00::numeric,
  'receita: CT-e e NFS-e válidos do mês (rejeitado e sumido do Sankhya fora)');
select is((current_setting('t.r')::jsonb->'kpis'->>'custo')::numeric, 5700.00::numeric,
  'custo: competência gerencial (dia 10 fica, dia 11 muda), provisão e invalidada fora, rateio somado');
select is((current_setting('t.r')::jsonb->'kpis'->>'resultado')::numeric, 9300.00::numeric, 'resultado = receita − custo');
select is((current_setting('t.r')::jsonb->'kpis'->>'margem')::numeric, 62.0::numeric, 'margem = resultado ÷ receita, uma casa');
select is((current_setting('t.r')::jsonb->'kpis'->'mudaram_de_mes'->>'lancamentos')::int, 1,
  'um lançamento mudou de mês pelo corte');
select is((current_setting('t.r')::jsonb->'kpis'->'mudaram_de_mes'->>'valor')::numeric, 700.00::numeric,
  'o valor que mudou de mês');
select is((current_setting('t.r')::jsonb->'kpis'->'sem_dtentsai'->>'lancamentos')::int, 1,
  'um lançamento sem data de lançamento (DTENTSAI)');
select is((current_setting('t.r')::jsonb->'kpis'->'sem_cr'->>'valor')::numeric, 1000.00::numeric,
  'o custo de CR fora do Eixo aparece à parte');

-- Série: 12 meses até o mês, do mais antigo ao mais novo.
select is(jsonb_array_length(current_setting('t.r')::jsonb->'serie'), 12, 'a série tem 12 meses');
select is(current_setting('t.r')::jsonb->'serie'->0->>'mes', '2025-04-01', 'a série começa 11 meses antes');
select is(current_setting('t.r')::jsonb->'serie'->11->>'mes', '2026-03-01', 'a série termina no mês');
select is((current_setting('t.r')::jsonb->'serie'->10->>'receita')::numeric, 4000.00::numeric, 'fevereiro: receita');
select is((current_setting('t.r')::jsonb->'serie'->10->>'custo')::numeric, 500.00::numeric,
  'fevereiro: o lançado em 10/03 ficou em fevereiro');
select is((current_setting('t.r')::jsonb->'serie'->11->>'resultado')::numeric, 9300.00::numeric, 'março na série = o mês');
select is((current_setting('t.r')::jsonb->'serie'->0->>'receita')::numeric, 0::numeric, 'mês sem lançamento vem com zero');
select ok((current_setting('t.r')::jsonb->'serie'->0->>'margem') is null, 'mês sem receita vem sem margem');

-- Por operação, com a linha de total.
select is(
  (select jsonb_agg(g.e->>'rotulo' order by g.i) from jsonb_array_elements(current_setting('t.r')::jsonb->'grupos') with ordinality g (e, i)),
  '["Grãos 97", "Minério 97", "Sem operação"]'::jsonb, 'por operação, pelo nome; sem operação no fim');
select is((current_setting('t.r')::jsonb->'grupos'->0->>'custo')::numeric, 3400.00::numeric, 'Grãos 97: custo com o rateio');
select is((current_setting('t.r')::jsonb->'grupos'->0->>'margem')::numeric, 66.0::numeric, 'Grãos 97: margem');
select is((current_setting('t.r')::jsonb->'grupos'->1->>'resultado')::numeric, 3700.00::numeric, 'Minério 97: resultado');
select is((current_setting('t.r')::jsonb->'grupos'->2->>'resultado')::numeric, -1000.00::numeric, 'sem operação: só custo');
select ok((current_setting('t.r')::jsonb->'grupos'->2->>'margem') is null, 'sem receita, sem margem');
select is((current_setting('t.r')::jsonb->'total'->>'resultado')::numeric, 9300.00::numeric, 'a linha de total vem pronta');

-- Naturezas: top 2 e as outras somadas.
select is(
  (select jsonb_agg(n.e->>'descricao' order by n.i) from jsonb_array_elements(current_setting('t.r')::jsonb->'naturezas') with ordinality n (e, i)),
  '["Combustível 97", "Manutenção 97"]'::jsonb, 'as naturezas de maior custo, da maior para a menor');
select is((current_setting('t.r')::jsonb->'naturezas'->1->>'valor')::numeric, 2000.00::numeric, 'Manutenção 97 soma o rateio e o CR fora do Eixo');
select is((current_setting('t.r')::jsonb->'naturezas'->0->>'participacao')::numeric, 52.6::numeric, 'participação no custo, uma casa');
select is((current_setting('t.r')::jsonb->'outras'->>'valor')::numeric, 700.00::numeric, 'as outras naturezas somadas');
select is((current_setting('t.r')::jsonb->'outras'->>'naturezas')::int, 1, 'quantas naturezas ficaram em outras');

-- Agrupamentos e contexto (filial = garagem; operação).
select is(
  (select jsonb_agg(g.e->>'rotulo' order by g.i) from jsonb_array_elements(
     nucleo.visao_geral_dos_resultados('2026-03-01', null, null, 'unidade')->'grupos') with ordinality g (e, i)),
  '["Frota", "Serviço", "Sem unidade"]'::jsonb, 'por unidade gerencial, na ordem do catálogo');
select is(
  (select jsonb_agg(g.e->>'rotulo' order by g.i) from jsonb_array_elements(
     nucleo.visao_geral_dos_resultados('2026-03-01', null, null, 'filial')->'grupos') with ordinality g (e, i)),
  '["Cordeirópolis", "Parauapebas", "Sem filial"]'::jsonb, 'por filial (a garagem do CR)');
select is((nucleo.visao_geral_dos_resultados('2026-03-01', pg_temp.id('par'))->'kpis'->>'custo')::numeric, 1300.00::numeric,
  'filtrar a filial: só os CRs dela');
select is((nucleo.visao_geral_dos_resultados('2026-03-01', null, pg_temp.id('graos'))->'kpis'->>'receita')::numeric, 10000.00::numeric,
  'filtrar a operação: só os CRs dela');
select is((nucleo.visao_geral_dos_resultados('2026-03-01', null, pg_temp.id('graos'))->'serie'->10->>'receita')::numeric, 4000.00::numeric,
  'o filtro vale também para a série');
select ok(nucleo.visao_geral_dos_resultados('2026-03-01')->'meses' @> '["2026-04-01", "2026-03-01", "2026-02-01"]'::jsonb,
  'os meses com lançamento, para o seletor');
select ok(
  nucleo.visao_geral_dos_resultados('2026-03-01')->'opcoes'->'operacoes' @> jsonb_build_array(jsonb_build_object('id', pg_temp.id('graos'), 'nome', 'Grãos 97'))
  and jsonb_array_length(nucleo.visao_geral_dos_resultados('2026-03-01')->'opcoes'->'filiais') = 3,
  'as opções do contexto: operações e as 3 filiais');
select is(pg_temp.erro_de($$select nucleo.visao_geral_dos_resultados('2026-03-01', null, null, 'placa')$$), '22023',
  'agrupamento desconhecido é recusado');
reset role;

select * from finish();
rollback;
