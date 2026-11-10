-- Parceiros (primeira versão): cadastro, lista, ficha, conciliação e locação. Só dados fictícios
-- (apoio/parceiros_ficticios.psql), com o usuário de cada perfil.
--  * Cadastrar parceiro: CPF ou CNPJ válido, sem duplicata; a pessoa que já existe (o mesmo documento)
--    é reaproveitada; o agrupador do Sankhya (CR pai dos CRs de acionista) é de um parceiro só.
--  * Lista e ficha: placas vinculadas agora e os totais do mês nos CRs do agrupador.
--  * Conciliação: por CR de acionista no mês, o que o Sankhya lançou × as placas que o Eixo espera
--    (confere, diferença, sem lançamento), e a justificativa que não edita o fato importado.
--  * Locação: vigência [início, fim) sem sobreposição por placa (EXCLUDE), valor numeric(15,2).
--  * Políticas parceiro_ler, locacao_ler e justificativa_da_conciliacao_ler: Parceiros ou Resultados.
begin;
\ir apoio/como_usuario.psql
\ir apoio/parceiros_ficticios.psql

-- Os documentos fictícios, calculados antes de agir como usuário (a conta do dígito não é do app).
create temp table docs as
  select b as base, pg_temp.documento(b) as doc
    from unnest(array['991000001', '991000002', '991000003', '991000004', '991000005', '112223330001', '990000001']) b;
grant select on docs to authenticated;
create function pg_temp.doc(p_base text) returns text language sql as $$ select doc from docs where base = p_base $$;
grant execute on function pg_temp.doc(text) to authenticated;

select plan(60);

-- ---- Estrutura ----
select has_table('parceiros', 'parceiro', 'existe parceiros.parceiro');
select has_table('parceiros', 'locacao', 'existe parceiros.locacao');
select has_table('parceiros', 'justificativa_da_conciliacao', 'existe parceiros.justificativa_da_conciliacao');
select col_type_is('parceiros', 'locacao', 'valor_mensal', 'numeric(15,2)', 'o valor mensal da locação é numeric(15,2)');
select ok(exists (select 1 from pg_constraint where conrelid = 'parceiros.locacao'::regclass and contype = 'x'),
  'a vigência da locação tem EXCLUDE (sem sobreposição por placa)');
select ok(
  not (select prosecdef from pg_proc where oid = 'nucleo.parceiros_do_mes(date,text,text[],integer,integer)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'nucleo.conciliacao_do_mes(date,uuid,text)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'nucleo.locacoes(text)'::regprocedure),
  'as leituras rodam com a permissão de quem chama (security invoker)');
select ok(
  (select prosecdef from pg_proc where oid = 'nucleo.cadastrar_parceiro(text,text,text[],bigint,uuid,uuid)'::regprocedure)
  and (select prosecdef from pg_proc where oid = 'nucleo.cadastrar_locacao(uuid,text,date,numeric,date,uuid)'::regprocedure),
  'as gravações rodam pela função (sem escrita direta nas tabelas)');
select ok(not has_table_privilege('authenticated', 'parceiros.parceiro', 'insert')
  and not has_table_privilege('authenticated', 'parceiros.locacao', 'update')
  and not has_table_privilege('authenticated', 'parceiros.justificativa_da_conciliacao', 'insert'),
  'authenticated não grava direto nas tabelas de Parceiros');
select ok(not has_function_privilege('anon', 'nucleo.parceiros_do_mes(date,text,text[],integer,integer)', 'execute'),
  'anon não executa a lista');

-- ---- Cadastrar parceiro (Diretoria) ----
select tests.como(pg_temp.id('auth_Dir'));
create temp table cad as select nucleo.cadastrar_parceiro(
  pg_temp.doc('991000001'), 'Acionista Fictício 99', array['acionista'], 990099, pg_temp.id('agrupador_p'),
  '9e0b1f6e-1111-4c1a-8a1a-000000000099') as j;
select ok((select (j->>'parceiro_id') is not null and not (j->>'pessoa_existente')::boolean from cad),
  'cadastra o parceiro com a pessoa nova');
select pg_temp.guardar('parceiro_p', (select (j->>'parceiro_id')::uuid from cad));
select is(
  (select nucleo.cadastrar_parceiro(pg_temp.doc('991000001'), 'Acionista Fictício 99', array['acionista'], 990099,
     pg_temp.id('agrupador_p'), '9e0b1f6e-1111-4c1a-8a1a-000000000099')->>'parceiro_id')::uuid,
  pg_temp.id('parceiro_p'), 'a mesma chave de envio devolve o mesmo parceiro (clique duplo não duplica)');
select is(pg_temp.erro_de(format('select nucleo.cadastrar_parceiro(%L, %L, %L)', pg_temp.doc('991000001'), 'Outro nome', '{agregado}')),
  '23505', 'o mesmo CPF não vira parceiro duas vezes');
select is(pg_temp.erro_de($$select nucleo.cadastrar_parceiro('12345678900', 'Inválido', '{acionista}')$$),
  '23514', 'CPF com dígito errado é recusado');
select is(pg_temp.erro_de(format('select nucleo.cadastrar_parceiro(%L, %L, %L)', pg_temp.doc('991000002'), 'Sem tipo', '{}')),
  '23514', 'sem tipo é recusado');
select is(pg_temp.erro_de(format('select nucleo.cadastrar_parceiro(%L, %L, %L, null, %L)', pg_temp.doc('991000003'),
    'Outro acionista', '{acionista}', pg_temp.id('agrupador_p'))),
  '23505', 'o agrupador do Sankhya é de um parceiro só');
select is(pg_temp.erro_de(format('select nucleo.cadastrar_parceiro(%L, %L, %L, null, %L)', pg_temp.doc('991000004'),
    'Agrupador errado', '{acionista}', pg_temp.id('cr_frota'))),
  '23514', 'o agrupador precisa ser o CR pai dos CRs de acionista');
select ok((select (nucleo.cadastrar_parceiro(pg_temp.doc('112223330001'), 'Locadora Fictícia 99 Ltda',
    array['locador'])->>'parceiro_id') is not null),
  'cadastra o parceiro com CNPJ, sem agrupador');
select pg_temp.guardar('locadora', (select p.id from parceiros.parceiro p join nucleo.pessoa s on s.id = p.pessoa_id
  where s.nome = 'Locadora Fictícia 99 Ltda'));
create temp table reaproveitada as select nucleo.cadastrar_parceiro(
  pg_temp.doc('990000001'), 'Nome que não vale', array['agregado'], null, pg_temp.id('agrupador_q')) as j;
select ok((select (j->>'pessoa_existente')::boolean from reaproveitada)
    and (select pessoa_id from parceiros.parceiro where id = (select (j->>'parceiro_id')::uuid from reaproveitada)) = pg_temp.id('Gestor A'),
  'o CPF que já é de uma pessoa reaproveita a pessoa (uma pessoa existe uma vez só)');

-- ---- Lista do mês ----
create temp table lista as select nucleo.parceiros_do_mes('2026-03-01', null, null) as j;
select is((select jsonb_array_length(j->'linhas') from lista), 3, 'a lista traz os três parceiros');
create temp table linha_p as
  select x from lista, jsonb_array_elements(lista.j->'linhas') x where x->>'id' = pg_temp.id('parceiro_p')::text;
select is((select (x->>'placas')::int from linha_p), 3, 'o parceiro tem três placas vinculadas agora (CRs de acionista do agrupador)');
select is((select (x->>'despesa')::numeric from linha_p), 1150.00, 'a despesa do mês nos CRs do parceiro');
select is((select (x->>'receita')::numeric from linha_p), 1000.00, 'a receita do mês nos CRs do parceiro');
select is((select x->'tipos' from linha_p), '["acionista"]'::jsonb, 'o tipo do parceiro');
select is((select (j->'totais'->>'parceiros')::int from lista), 3, 'o total de parceiros');
select is((select (j->'chips'->>'acionista')::int from lista), 1, 'a contagem do chip acionista');
select is((select jsonb_array_length(j->'agrupadores_livres') from lista), 0, 'os dois agrupadores fictícios já têm parceiro');
select is((select jsonb_array_length(nucleo.parceiros_do_mes('2026-03-01', null, array['locador'])->'linhas')), 1,
  'o chip locador filtra a lista');

-- ---- Ficha ----
create temp table ficha as select nucleo.ficha_do_parceiro(pg_temp.id('parceiro_p'), '2026-03-01') as j;
select is((select j->'parceiro'->>'nome' from ficha), 'Acionista Fictício 99', 'a ficha traz o parceiro');
select is((select (j->'parceiro'->>'versao')::int from ficha), 1, 'com a versão');
select is((select jsonb_path_query_array(j, '$.placas[*].placa') from ficha), '["PPP9A01", "PPP9A02", "PPP9A03"]'::jsonb,
  'as placas vinculadas agora');
select is(nucleo.ficha_do_parceiro('00000000-0000-0000-0000-000000000000', '2026-03-01'), null, 'parceiro inexistente volta nulo');
select is(nucleo.ficha_do_parceiro(pg_temp.id('locadora'), '2026-03-01')->'totais', 'null'::jsonb,
  'sem agrupador, a ficha não tem conciliação (totais nulos)');

-- ---- Conciliação ----
create temp table conc as select nucleo.conciliacao_do_mes('2026-03-01', pg_temp.id('agrupador_p'), null) as j;
create temp table conc_linha as
  select x->>'cr_codigo' as cr, x from conc, jsonb_array_elements(conc.j->'linhas') x;
select is((select count(*)::int from conc_linha), 4, 'quatro CRs do agrupador entram na conciliação do mês');
select is((select x->>'situacao' from conc_linha where cr = 'K99A'), 'confere', 'placa esperada e lançamento com ela: confere');
select is((select (x->>'despesa')::numeric from conc_linha where cr = 'K99A'), 700.00, 'a despesa lançada no CR (sem provisão nem fora do mês)');
select is((select x->>'situacao' from conc_linha where cr = 'K99B'), 'sem_lancamento', 'placa esperada sem nada lançado: sem lançamento');
select is((select (x->>'dias')::int from conc_linha where cr = 'K99B'), 17, 'os dias da vigência no mês ([15/03, 01/04))');
select is((select x->'placas' from conc_linha where cr = 'K99B'), '["PPP9A02"]'::jsonb, 'a placa que o Eixo espera');
select is((select x->>'situacao' from conc_linha where cr = 'K99C'), 'diferenca', 'lançado onde o Eixo não espera placa: diferença');
select is((select (x->>'fora_da_placa')::numeric from conc_linha where cr = 'K99D'), 50.00, 'o valor lançado com outra placa');
select is((select x->>'situacao' from conc_linha where cr = 'K99D'), 'diferenca', 'lançamento com outra placa: diferença');
select is((select j->'contagens' from conc), '{"todas": 4, "confere": 1, "diferenca": 2, "justificada": 0, "sem_lancamento": 1}'::jsonb,
  'as contagens por situação');

-- Justificar a diferença: registra a explicação, não mexe no fato importado.
select ok((select (nucleo.justificar_diferenca(pg_temp.id('cr_9903'), '2026-03-01',
    'Despesa do acionista lançada antes de a placa entrar no Eixo.')->>'justificativa_id') is not null),
  'justifica a diferença com o motivo');
select is((select x->>'situacao' from jsonb_array_elements(
    nucleo.conciliacao_do_mes('2026-03-01', pg_temp.id('agrupador_p'), null)->'linhas') x where x->>'cr_codigo' = 'K99C'),
  'justificada', 'a linha justificada muda de situação');
select is((select sum(valor_desdobramento) from staging.despesa where codcencus = '9903'), 300.00, 'o fato importado continua igual');
select is(pg_temp.erro_de(format('select nucleo.justificar_diferenca(%L, %L, %L)', pg_temp.id('cr_9903'), '2026-03-01', 'De novo, com outro motivo.')),
  '23505', 'a mesma linha não é justificada duas vezes');
select is(pg_temp.erro_de(format('select nucleo.justificar_diferenca(%L, %L, %L)', pg_temp.id('cr_9901'), '2026-03-01', 'Não há o que justificar.')),
  '23514', 'linha que confere não precisa de justificativa');
select is(pg_temp.erro_de(format('select nucleo.justificar_diferenca(%L, %L, %L)', pg_temp.id('cr_9904'), '2026-03-01', 'curto')),
  '23514', 'o motivo precisa explicar (10 caracteres ou mais)');

-- ---- Locação ----
create temp table loc as select nucleo.cadastrar_locacao(pg_temp.id('locadora'), 'ppp-9a01', '2026-03-01', 4500.00) as j;
select is((select j->>'placa' from loc), 'PPP9A01', 'cadastra a locação da placa (a placa digitada é normalizada)');
select is(pg_temp.erro_de(format('select nucleo.cadastrar_locacao(%L, %L, %L, %s)', pg_temp.id('locadora'), 'PPP9A01', '2026-06-01', 3000)),
  '23P01', 'a mesma placa não tem duas locações ao mesmo tempo (EXCLUDE)');
select is(pg_temp.erro_de(format('select nucleo.cadastrar_locacao(%L, %L, %L, %s)', pg_temp.id('locadora'), 'QQQ9Q99', '2026-06-01', 3000)),
  '23514', 'placa que não está na frota é recusada');
select is(pg_temp.erro_de(format('select nucleo.cadastrar_locacao(%L, %L, %L, %s)', pg_temp.id('locadora'), 'PPP9A02', '2026-06-01', 0)),
  '23514', 'valor mensal zero é recusado');
select is(pg_temp.erro_de(format('select nucleo.encerrar_locacao(%L, %L, %L, %s)', (select (j->>'locacao_id')::uuid from loc),
    '2026-06-01', 'Contrato encerrado pelo locador.', 7)),
  '40001', 'encerrar com a versão velha avisa que o registro mudou');
select ok((select (nucleo.encerrar_locacao((select (j->>'locacao_id')::uuid from loc), '2026-06-01',
    'Contrato encerrado pelo locador.', 1)->>'locacao_id') is not null), 'encerra a locação em 01/06/2026');
select ok((select (nucleo.cadastrar_locacao(pg_temp.id('locadora'), 'PPP9A01', '2026-06-01', 4800.00)->>'locacao_id') is not null),
  'a nova locação começa no dia em que a anterior termina ([início, fim))');
select is((select (nucleo.locacoes(null)->'totais'->>'valor_mensal_vigente')::numeric), 4800.00, 'o valor mensal das locações vigentes');

-- ---- Outros perfis ----
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.parceiros_do_mes('2026-03-01', null, null)$$), '42501',
  'o gestor de frota (sem Parceiros nem Resultados) não lê a lista');
select is((select count(*)::int from parceiros.parceiro) + (select count(*)::int from parceiros.locacao)
    + (select count(*)::int from parceiros.justificativa_da_conciliacao), 0,
  'parceiro_ler, locacao_ler e justificativa_da_conciliacao_ler: o gestor não vê nenhuma linha');
reset role;
select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.erro_de(format('select nucleo.cadastrar_parceiro(%L, %L, %L)', pg_temp.doc('991000005'), 'Pelo Operacional', '{agregado}')),
  '42501', 'o Operacional não cadastra parceiro');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is((select count(*)::int from parceiros.parceiro), 3, 'o Administrador vê os parceiros (parceiro_ler)');

reset role;
select * from finish();
rollback;
