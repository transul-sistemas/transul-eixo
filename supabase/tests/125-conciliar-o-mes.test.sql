-- Conciliar o mês (decisão de Alexandre, 17/11/2026): wizard em dois passos.
--  (1) Justificar em lote as diferenças sem justificativa do acionista no mês (tudo ou nada).
--  (2) Só com zero pendências, marcar o mês do acionista como conferido: o mês trava. Depois de travado,
--      nenhuma justificativa nova entra (nem uma a uma, nem em lote); correção só como ajuste de período
--      anterior, registrado (Resultados › Ajustes).
-- Só dados fictícios (apoio/parceiros_ficticios.psql): agrupador P em 03/2026 tem K99A (confere),
-- K99B (sem lançamento), K99C e K99D (diferença).
begin;
\ir apoio/como_usuario.psql
\ir apoio/parceiros_ficticios.psql

select plan(30);

-- ---- Estrutura ----
select has_table('parceiros', 'conferencia_do_mes', 'existe parceiros.conferencia_do_mes');
select ok(exists (select 1 from pg_indexes where schemaname = 'parceiros' and tablename = 'conferencia_do_mes'
    and indexdef ilike '%unique%(agrupador_id, mes)%excluido_em is null%'),
  'uma conferência por acionista e mês (índice único parcial)');
select ok(exists (select 1 from pg_indexes where schemaname = 'parceiros' and tablename = 'conferencia_do_mes'
    and indexname = 'conferencia_do_mes_agrupador_id_idx'), 'a chave estrangeira do agrupador tem índice');
select ok(not has_table_privilege('authenticated', 'parceiros.conferencia_do_mes', 'insert')
  and not has_table_privilege('authenticated', 'parceiros.conferencia_do_mes', 'update'),
  'authenticated não grava direto na conferência (só pela função)');
select ok((select prosecdef from pg_proc where oid = 'nucleo.conferir_mes_do_acionista(uuid,date,uuid)'::regprocedure),
  'conferir roda pela função (security definer)');
select ok(not (select prosecdef from pg_proc where oid = 'nucleo.justificar_diferencas_em_lote(date,jsonb,uuid)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'nucleo.conferencias_da_conciliacao(date)'::regprocedure),
  'o lote e a leitura rodam com a permissão de quem chama');
select ok(not has_function_privilege('anon', 'nucleo.conferir_mes_do_acionista(uuid,date,uuid)', 'execute')
  and not has_function_privilege('anon', 'nucleo.justificar_diferencas_em_lote(date,jsonb,uuid)', 'execute'),
  'anon não confere nem justifica');

-- ---- Diretoria: o mês com pendências não trava ----
select tests.como(pg_temp.id('auth_Dir'));
select is(pg_temp.erro_de(format('select nucleo.conferir_mes_do_acionista(%L, %L)', pg_temp.id('agrupador_p'), '2026-03-01')),
  '23514', 'com diferenças sem justificativa, o mês não é marcado como conferido');

-- ---- Passo 1: justificar em lote (tudo ou nada) ----
create temp table lote_ruim as select nucleo.justificar_diferencas_em_lote('2026-03-01', jsonb_build_array(
    jsonb_build_object('cr_id', pg_temp.id('cr_9902'), 'motivo', 'Placa parada no pátio o mês inteiro, sem lançamento.'),
    jsonb_build_object('cr_id', pg_temp.id('cr_9901'), 'motivo', 'Esta linha confere e não tem o que justificar.'))) as j;
select is((select (j->>'gravadas')::int from lote_ruim), 0, 'com uma linha recusada, o lote não grava nada');
select is((select jsonb_array_length(j->'recusadas') from lote_ruim), 1, 'o lote devolve a recusada com o motivo');
select is((select j->'recusadas'->0->>'cr_id' from lote_ruim), pg_temp.id('cr_9901')::text, 'a recusada é a linha que confere');
select is((select count(*)::int from parceiros.justificativa_da_conciliacao where mes = '2026-03-01'), 0,
  'nada foi gravado pelo lote recusado');

create temp table lote_bom as select nucleo.justificar_diferencas_em_lote('2026-03-01', jsonb_build_array(
    jsonb_build_object('cr_id', pg_temp.id('cr_9902'), 'motivo', 'Placa parada no pátio o mês inteiro, sem lançamento.'),
    jsonb_build_object('cr_id', pg_temp.id('cr_9903'), 'motivo', 'Despesa lançada antes de a placa entrar no Eixo.')),
  '9e0b1f6e-1111-4c1a-8a1a-000000000125') as j;
select is((select (j->>'gravadas')::int from lote_bom), 2, 'o lote grava as duas justificativas ("2 de 2")');
select is((select (j->>'total')::int from lote_bom), 2, 'o total do lote');
select is((select (nucleo.justificar_diferencas_em_lote('2026-03-01', jsonb_build_array(
    jsonb_build_object('cr_id', pg_temp.id('cr_9902'), 'motivo', 'Placa parada no pátio o mês inteiro, sem lançamento.'),
    jsonb_build_object('cr_id', pg_temp.id('cr_9903'), 'motivo', 'Despesa lançada antes de a placa entrar no Eixo.')),
  '9e0b1f6e-1111-4c1a-8a1a-000000000125')->>'repetido')::boolean), true,
  'a mesma chave de envio não grava de novo (clique duplo)');
select is((select count(*)::int from parceiros.justificativa_da_conciliacao where mes = '2026-03-01'), 2,
  'duas justificativas gravadas, nenhuma duplicada');
select is(pg_temp.erro_de($$select nucleo.justificar_diferencas_em_lote('2026-03-01', '[]'::jsonb)$$), '22023',
  'lote vazio é recusado');

-- Ainda falta K99D: continua sem travar.
select is(pg_temp.erro_de(format('select nucleo.conferir_mes_do_acionista(%L, %L)', pg_temp.id('agrupador_p'), '2026-03-01')),
  '23514', 'com uma diferença ainda sem justificativa, o mês não trava');

-- ---- Passo 2: zero pendências, o mês trava ----
select ok((select (nucleo.justificar_diferenca(pg_temp.id('cr_9904'), '2026-03-01',
    'Lançamento com outra placa, corrigido no mês seguinte no Sankhya.')->>'justificativa_id') is not null),
  'justifica a última diferença');
create temp table conf as select nucleo.conferir_mes_do_acionista(pg_temp.id('agrupador_p'), '2026-03-01',
  '9e0b1f6e-1111-4c1a-8a1a-000000000126') as j;
select ok((select (j->>'conferencia_id') is not null from conf), 'com zero pendências, marca o mês do acionista como conferido');
select is((select (nucleo.conferir_mes_do_acionista(pg_temp.id('agrupador_p'), '2026-03-01',
    '9e0b1f6e-1111-4c1a-8a1a-000000000126')->>'conferencia_id')::uuid),
  (select (j->>'conferencia_id')::uuid from conf), 'a mesma chave devolve a mesma conferência (idempotente)');
select is(pg_temp.erro_de(format('select nucleo.conferir_mes_do_acionista(%L, %L)', pg_temp.id('agrupador_p'), '2026-03-01')),
  '23505', 'o mesmo mês do mesmo acionista não é conferido duas vezes');
select is((select count(*)::int from parceiros.conferencia_do_mes where mes = '2026-03-01'), 1,
  'uma conferência só, depois de pedir três vezes');
select is((select count(*)::int from nucleo.conferencias_da_conciliacao('2026-03-01') c
    where c.agrupador_id = pg_temp.id('agrupador_p') and c.conferida_em is not null), 1,
  'a leitura diz que o mês do acionista está conferido');
select is((select count(*)::int from nucleo.conferencias_da_conciliacao('2026-04-01')), 0,
  'o mês seguinte não está conferido');

-- Travado: nenhuma justificativa nova (o lote passa pela mesma conferência).
select is(pg_temp.erro_de(format('select nucleo.justificar_diferenca(%L, %L, %L)', pg_temp.id('cr_9904'), '2026-03-01',
    'Tentativa depois da conferência do mês.')),
  '55000', 'mês conferido: a justificativa é recusada (correção só por ajuste de período anterior)');

-- ---- Outros perfis ----
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format('select nucleo.conferir_mes_do_acionista(%L, %L)', pg_temp.id('agrupador_q'), '2026-03-01')),
  '42501', 'o gestor de frota (sem Parceiros › editar) não confere o mês');
select is((select count(*)::int from parceiros.conferencia_do_mes), 0,
  'conferencia_do_mes_ler: o gestor de frota não vê nenhuma linha');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is((select count(*)::int from parceiros.conferencia_do_mes), 0,
  'conferencia_do_mes_ler: o Operacional não vê nenhuma linha');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is((select count(*)::int from parceiros.conferencia_do_mes), 1,
  'conferencia_do_mes_ler: o Administrador vê a conferência');

reset role;
select * from finish();
rollback;
