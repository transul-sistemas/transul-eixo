-- A6, status do dia do motorista e Indicar substituto (inventário 11).
--  * pessoas.codigo_do_motorista: os códigos da v1 (TBV, TBE, TBX, FOL, FÉR, ATS, FRD, FLT).
--  * pessoas.motorista_do_conjunto: UM motorista por conjunto (dois motoristas por conjunto FORA) e um
--    conjunto por motorista, com vigência [início, fim) sem sobreposição (EXCLUDE). nucleo.vincular_motorista
--    fecha o vínculo anterior na data; nucleo.encerrar_motorista_do_conjunto encerra (não exclui).
--  * pessoas.status_do_motorista: o realizado do dia (um por pessoa e dia), com correção por versão e motivo
--    (exclusão lógica). nucleo.lancar_status_do_motorista. A escala (T, F, FE, AT) só SUGERE.
--  * pessoas.substituicao_do_motorista: [início, fim), sem sobreposição no conjunto nem no substituto.
--    nucleo.indicar_substituto e nucleo.encerrar_substituicao (fim antes do início = cancelada).
--  * Leituras com recorte (nome e código, nunca CPF): Pessoas › ver, ou o gestor da carteira do conjunto.
--    nucleo.linha_do_motorista, nucleo.motoristas_no_dia, nucleo.motorista_do_conjunto_no_mes,
--    nucleo.ferias_sem_substituto. Políticas de leitura (Pessoas › ver), com usuário de cada perfil.
begin;
\ir apoio/como_usuario.psql
\ir apoio/transferencia.psql

select plan(44);

select pg_temp.pessoa('Gestor A', 119000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 119000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm 119', 119000003, 'administrador', false);
select pg_temp.pessoa('Op 119 usuario', 119000004, 'operacional', false);
select pg_temp.pessoa('Moto Um', 119000011, null, false);
select pg_temp.pessoa('Moto Dois', 119000012, null, false);
select pg_temp.pessoa('Moto Tres', 119000013, null, false);
select pg_temp.pessoa('Mecanico', 119000014, null, false);
insert into nucleo.operacao (nome) values ('Op 119');
insert into pessoas.vinculo (pessoa_id, operacao_id, funcao, inicio)
select pg_temp.id(x.nome), (select id from nucleo.operacao where nome = 'Op 119'), x.funcao, '2026-01-01'
  from (values ('Moto Um', 'motorista'), ('Moto Dois', 'motorista'), ('Moto Tres', 'motorista'), ('Mecanico', 'mecanico')) x (nome, funcao);
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (11901, 'K119A', true, true), (11902, 'K119B', true, true), (11903, 'K119C', true, true);
create function pg_temp.cavalo(p_nome text, p_n bigint, p_placa text, p_gestor text, p_cr text) returns uuid language sql as $$
  select pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => 'cavalo', p_renavam => pg_temp.renavam(p_n), p_placa => p_placa, p_gestor_id => pg_temp.id(p_gestor),
    p_cr_id => (select id from nucleo.cr where codigo = p_cr),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Op 119'), p_em => '2026-01-10 08:00-03'))
$$;
select pg_temp.cavalo('k1', 11901, 'FFF1191', 'Gestor A', 'K119A');
select pg_temp.cavalo('k2', 11902, 'FFF1192', 'Gestor A', 'K119B');
select pg_temp.cavalo('k3', 11903, 'FFF1193', 'Gestor B', 'K119C');
select pg_temp.disparar();
select set_config('t.hoje', nucleo.hoje_em_sao_paulo()::text, true);
create function pg_temp.hoje() returns date language sql as $$ select current_setting('t.hoje')::date $$;

-- ---- catálogo ----
select set_eq($$select codigo from pessoas.codigo_do_motorista$$,
  array['TBV', 'TBE', 'TBX', 'FOL', 'FÉR', 'ATS', 'FRD', 'FLT'], '1. os oito códigos do motorista da v1');

-- ---- vínculo motorista × conjunto ----
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(nucleo.vincular_motorista(pg_temp.id('k1'), pg_temp.id('Moto Um'), pg_temp.hoje() - 30, null) is not null,
  '2. o gestor da carteira vincula o motorista ao conjunto');
select ok(nucleo.vincular_motorista(pg_temp.id('k1'), pg_temp.id('Moto Dois'), pg_temp.hoje() - 10, null) is not null,
  '3. vincular outro motorista ao mesmo conjunto troca o motorista na data');
select is(pg_temp.erro_de(format($$select nucleo.vincular_motorista(%L, %L, %L, null)$$,
  pg_temp.id('k2'), pg_temp.id('Mecanico'), pg_temp.hoje() - 10)), '23514', '4. quem não é motorista não se vincula');
select ok(nucleo.vincular_motorista(pg_temp.id('k2'), pg_temp.id('Moto Tres'), pg_temp.hoje() - 10, null) is not null,
  '5. o segundo conjunto ganha o seu motorista');
reset role;
select is((select fim from pessoas.motorista_do_conjunto where pessoa_id = pg_temp.id('Moto Um') and excluido_em is null),
  pg_temp.hoje() - 10, '6. o vínculo anterior foi ENCERRADO na data (não excluído)');
select is((select count(*) from pessoas.motorista_do_conjunto where ativo_id = pg_temp.id('k1') and excluido_em is null and fim is null),
  1::bigint, '7. um motorista vigente por conjunto');
select is(pg_temp.erro_de(format($$insert into pessoas.motorista_do_conjunto (pessoa_id, ativo_id, inicio) values (%L, %L, %L)$$,
  pg_temp.id('Moto Um'), pg_temp.id('k1'), pg_temp.hoje() - 5)), '23P01', '8. dois motoristas no mesmo conjunto: o banco recusa (EXCLUDE)');
select is(pg_temp.erro_de(format($$insert into pessoas.motorista_do_conjunto (pessoa_id, ativo_id, inicio) values (%L, %L, %L)$$,
  pg_temp.id('Moto Tres'), pg_temp.id('k3'), pg_temp.hoje() - 5)), '23P01', '9. o mesmo motorista em dois conjuntos: o banco recusa (EXCLUDE)');
select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.vincular_motorista(%L, %L, %L, null)$$,
  pg_temp.id('k1'), pg_temp.id('Moto Um'), pg_temp.hoje())), '42501', '10. outro gestor não vincula motorista no conjunto alheio');
reset role;

-- ---- status do dia (realizado) ----
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(nucleo.lancar_status_do_motorista(pg_temp.id('Moto Dois'), pg_temp.hoje() - 1, 'TBV', null, null, null) is not null,
  '11. o gestor lança o status do dia do motorista do seu conjunto');
select is(pg_temp.erro_de(format($$select nucleo.lancar_status_do_motorista(%L, %L, 'TBV', null, null, null)$$,
  pg_temp.id('Moto Dois'), pg_temp.hoje() + 1)), '22023', '12. dia futuro não se lança (a escala é o programado)');
select is(pg_temp.erro_de(format($$select nucleo.lancar_status_do_motorista(%L, %L, 'T', null, null, null)$$,
  pg_temp.id('Moto Dois'), pg_temp.hoje() - 2)), '22023', '13. código fora da lista é recusado (T é da escala)');
select is(pg_temp.erro_de(format($$select nucleo.lancar_status_do_motorista(%L, %L, 'TBE', null, null, null)$$,
  pg_temp.id('Moto Dois'), pg_temp.hoje() - 1)), '40001', '14. relançar sem a versão vista: "este registro mudou"');
select is(pg_temp.erro_de(format($$select nucleo.lancar_status_do_motorista(%L, %L, 'TBE', 1, ' ', null)$$,
  pg_temp.id('Moto Dois'), pg_temp.hoje() - 1)), '23514', '15. corrigir o dia pede o motivo');
select ok(nucleo.lancar_status_do_motorista(pg_temp.id('Moto Dois'), pg_temp.hoje() - 1, 'TBE', 1, 'Ficou em casa', null) is not null,
  '16. corrige com a versão e o motivo');
select ok(nucleo.lancar_status_do_motorista(pg_temp.id('Moto Dois'), pg_temp.hoje() - 1, 'TBE', 1, 'Ficou em casa', null) is not null,
  '17. lançar de novo o mesmo código não duplica (roda duas vezes)');
reset role;
select is((select count(*) from pessoas.status_do_motorista where pessoa_id = pg_temp.id('Moto Dois') and dia = pg_temp.hoje() - 1 and excluido_em is null),
  1::bigint, '18. um status vigente por pessoa e dia');
select is((select count(*) from pessoas.status_do_motorista where pessoa_id = pg_temp.id('Moto Dois') and dia = pg_temp.hoje() - 1 and excluido_em is not null and motivo_da_exclusao = 'Ficou em casa'),
  1::bigint, '19. o anterior fica no histórico, excluído com o motivo');
select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.lancar_status_do_motorista(%L, %L, 'FOL', null, null, null)$$,
  pg_temp.id('Moto Tres'), pg_temp.hoje() - 1)), '42501', '20. outro gestor não lança o motorista alheio');
reset role;

-- ---- férias sem substituto e Indicar substituto ----
insert into pessoas.marcacao_da_escala (pessoa_id, operacao_id, dia, sigla)
select pg_temp.id('Moto Dois'), (select id from nucleo.operacao where nome = 'Op 119'), pg_temp.hoje() + g, 'FE'
  from generate_series(3, 5) g;
select tests.como(pg_temp.id('auth_Gestor A'));
select is((select primeiro_dia from nucleo.ferias_sem_substituto() where titular_id = pg_temp.id('Moto Dois')),
  pg_temp.hoje() + 3, '21. férias programadas sem substituto aparecem com o primeiro dia sem motorista');
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is((select count(*) from nucleo.ferias_sem_substituto()), 0::bigint, '22. o outro gestor não vê as férias da carteira alheia');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.indicar_substituto(%L, %L, %L, %L, 'Férias', null)$$,
  pg_temp.id('Moto Dois'), pg_temp.id('Moto Dois'), pg_temp.hoje() + 3, pg_temp.hoje() + 6)), '23514', '23. o titular não substitui a si mesmo');
select is(pg_temp.erro_de(format($$select nucleo.indicar_substituto(%L, %L, %L, %L, 'Férias', null)$$,
  pg_temp.id('Moto Dois'), pg_temp.id('Moto Tres'), pg_temp.hoje() + 3, pg_temp.hoje() + 6)), '23514', '24. quem já dirige outro conjunto no período não substitui');
select is(pg_temp.erro_de(format($$select nucleo.indicar_substituto(%L, %L, %L, %L, 'Férias', null)$$,
  pg_temp.id('Moto Dois'), pg_temp.id('Mecanico'), pg_temp.hoje() + 3, pg_temp.hoje() + 6)), '23514', '25. o substituto precisa ser motorista');
select set_config('t.subst', nucleo.indicar_substituto(pg_temp.id('Moto Dois'), pg_temp.id('Moto Um'), pg_temp.hoje() + 3, pg_temp.hoje() + 6,
  'Férias', '11900000-0000-4000-8000-000000000001')::text, true);
select is(nucleo.indicar_substituto(pg_temp.id('Moto Dois'), pg_temp.id('Moto Um'), pg_temp.hoje() + 3, pg_temp.hoje() + 6,
  'Férias', '11900000-0000-4000-8000-000000000001')::text, current_setting('t.subst'), '26. a mesma chave não indica duas vezes');
select is((select count(*) from nucleo.ferias_sem_substituto() where titular_id = pg_temp.id('Moto Dois')), 0::bigint,
  '27. com o substituto, a tarefa some');
select is(pg_temp.erro_de(format($$select nucleo.indicar_substituto(%L, %L, %L, %L, 'De novo', null)$$,
  pg_temp.id('Moto Dois'), pg_temp.id('Moto Um'), pg_temp.hoje() + 4, pg_temp.hoje() + 8)), '23P01', '28. substituição sobreposta no conjunto: o banco recusa');

-- ---- leituras ----
select is((select pessoa_id from nucleo.linha_do_motorista(pg_temp.hoje() - 1, pg_temp.hoje() + 5) where ativo_id = pg_temp.id('k1') and dia = pg_temp.hoje() + 4),
  pg_temp.id('Moto Um'), '29. no período da substituição, a linha mostra o substituto');
select is((select realizado from nucleo.linha_do_motorista(pg_temp.hoje() - 1, pg_temp.hoje() + 5) where ativo_id = pg_temp.id('k1') and dia = pg_temp.hoje() - 1),
  'TBE', '30. o realizado do dia (liso)');
select is((select sugestao from nucleo.linha_do_motorista(pg_temp.hoje() - 1, pg_temp.hoje() + 5) where ativo_id = pg_temp.id('k1') and dia = pg_temp.hoje() + 3 and pessoa_id = pg_temp.id('Moto Um')),
  null, '31. o substituto sem escala não tem sugestão');
select is((select count(*) from nucleo.linha_do_motorista(pg_temp.hoje() - 1, pg_temp.hoje() + 5) where ativo_id = pg_temp.id('k3')), 0::bigint,
  '32. a linha só traz os conjuntos da carteira');
select is((nucleo.motoristas_no_dia(pg_temp.hoje() - 1)->'por_codigo'->>'TBE')::int, 1, '33. contagem do dia por código, pronta no banco');
select is((nucleo.motoristas_no_dia(pg_temp.hoje() - 1)->>'sem_lancamento')::int, 1, '34. e os sem lançamento (nunca presume TBV)');
select is(nucleo.motorista_do_conjunto_no_mes(pg_temp.id('k1'), pg_temp.hoje())->'vigente'->>'nome', 'Moto Dois', '35. a aba Motorista traz o vigente');
select ok(nucleo.motorista_do_conjunto_no_mes(pg_temp.id('k1'), pg_temp.hoje())::text not like '%' || pg_temp.cpf(119000012) || '%',
  '36. nada de CPF na leitura do gestor');
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.motorista_do_conjunto_no_mes(%L, %L)$$, pg_temp.id('k1'), pg_temp.hoje())), '42501',
  '37. o outro gestor não abre a aba Motorista do conjunto alheio');
reset role;

-- ---- encerrar (fecha o que abriu; roda duas vezes) ----
select tests.como(pg_temp.id('auth_Gestor A'));
select lives_ok(format($$select nucleo.encerrar_substituicao(%L, %L, 'Voltou antes', null)$$, current_setting('t.subst'), pg_temp.hoje() + 3),
  '38. encerrar a substituição na data do início a cancela');
select lives_ok(format($$select nucleo.encerrar_substituicao(%L, %L, 'Voltou antes', null)$$, current_setting('t.subst'), pg_temp.hoje() + 3),
  '39. encerrar de novo não muda nada (idempotente)');
select is((select count(*) from nucleo.ferias_sem_substituto() where titular_id = pg_temp.id('Moto Dois')), 1::bigint,
  '40. sem a substituição, as férias voltam a pedir substituto');
reset role;

-- ---- políticas (Pessoas › ver), com usuário de cada perfil ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is((select count(*) from pessoas.status_do_motorista) + (select count(*) from pessoas.motorista_do_conjunto)
        + (select count(*) from pessoas.substituicao_do_motorista), 0::bigint,
  '41. motorista_do_conjunto_ler, status_do_motorista_ler e substituicao_do_motorista_ler: o gestor não lê as tabelas de Pessoas direto (só pela leitura recortada)');
select is((select count(*) from pessoas.codigo_do_motorista), 8::bigint, '44. codigo_do_motorista_ler: todo usuário lê o catálogo dos códigos');
reset role;
select tests.como(pg_temp.id('auth_Adm 119'));
select ok((select count(*) from pessoas.status_do_motorista) > 0 and (select count(*) from pessoas.motorista_do_conjunto) > 0
       and (select count(*) from pessoas.substituicao_do_motorista) > 0,
  '42. o Administrador (Pessoas › ver) lê as tabelas');
reset role;
select tests.como(pg_temp.id('auth_Op 119 usuario'));
select is((select count(*) from pessoas.status_do_motorista) + (select count(*) from pessoas.motorista_do_conjunto), 0::bigint,
  '43. o Operacional (Pessoas › ver só da filial) não lê as tabelas do motorista');
reset role;

select * from finish();
rollback;
