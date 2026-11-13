-- CR1, Saúde do CR (ficha docs/fichas-de-tela/cadastros-saude-do-cr-quadro.md; inventário 25 a 29).
--  * Leituras do quadro: nucleo.resumo_da_saude_do_cr() (cartões e "o que fazer, por dono e prazo") e
--    nucleo.problemas_da_saude_do_cr(problema, página, tamanho): placa sem CR, CR sem operação, dois CRs do
--    mesmo tipo, lançamento sem CR conhecido. Com a RLS de quem consulta (o gestor vê a carteira).
--  * Ações (forma mais simples): 25 Escolher o CR = nucleo.trocar_cr (pgTAP 115); 26 nucleo.ligar_cr_a_operacao;
--    27 nucleo.encerrar_vinculo_de_cr (fecha a exceção placa_com_dois_cr_do_mesmo_tipo que deixou de valer,
--    idempotente: duas rodadas, mesmas contagens); 28 nucleo.classificar_centro_sem_cr; 29 nucleo.atribuir_dono.
--  * Políticas classificacao_de_centro_ler e dono_de_problema_ler, com usuário de cada perfil.
begin;
\ir apoio/como_usuario.psql
\ir apoio/transferencia.psql

select plan(36);

select pg_temp.pessoa('Gestor A', 117000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 117000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 117000003, 'administrador', false);
select pg_temp.pessoa('Dir', 117000004, 'diretoria', false);
insert into nucleo.operacao (nome) values ('Op 117');
create function pg_temp.cr(p text) returns uuid language sql as $$ select id from nucleo.cr where codigo = p $$;
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (11701, 'F1-117', true, true), (11702, 'F2-117', true, true), (11703, 'F3-117', true, true),
  (11709, 'S1-117', false, false);
create function pg_temp.cavalo(p_nome text, p_n bigint, p_placa text, p_cr text) returns uuid language sql as $$
  select pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => 'cavalo', p_renavam => pg_temp.renavam(p_n), p_placa => p_placa, p_gestor_id => pg_temp.id('Gestor A'),
    p_cr_id => pg_temp.cr(p_cr), p_operacao_id => (select id from nucleo.operacao where nome = 'Op 117'),
    p_em => '2026-01-10 08:00-03'))
$$;
select pg_temp.cavalo('s1', 11701, 'FFF1171', 'F1-117');
select pg_temp.cavalo('d1', 11702, 'FFF1172', 'F2-117');
select pg_temp.disparar();
update nucleo.cr_do_ativo set fim = '2026-06-01 00:00-03', fim_origem = 'informada' where ativo_id = pg_temp.id('s1');
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
values (pg_temp.id('d1'), pg_temp.cr('F3-117'), '2026-02-01 00:00-03', 'informada');
insert into nucleo.fila_de_excecoes (cr_id, assunto, descricao) values (pg_temp.cr('S1-117'), 'cr_sem_operacao', 'CR sem operação (teste).');
insert into staging.despesa (origem_id, nufin, codcencus, dt_competencia, valor_liquido) values
  ('T117-1', '1', '999117', '2026-10-01', 100.00), ('T117-2', '2', '999117', '2026-10-02', 50.00),
  ('T117-3', '3', '11701', '2026-10-03', 10.00);
select pg_temp.disparar();

create function pg_temp.linhas(p_problema text) returns jsonb language sql as $$
  select nucleo.problemas_da_saude_do_cr(p_problema, 1, 100)->'linhas'
$$;
create function pg_temp.tem(p_problema text, p_campo text, p_valor text) returns boolean language sql as $$
  select exists (select 1 from jsonb_array_elements(pg_temp.linhas(p_problema)) l where l->>p_campo = p_valor)
$$;
create function pg_temp.abertas_dois() returns bigint language sql as $$
  select count(*) from nucleo.fila_de_excecoes where ativo_id = pg_temp.id('d1') and assunto = 'placa_com_dois_cr_do_mesmo_tipo' and resolvida_em is null
$$;
create function pg_temp.todas_dois() returns bigint language sql as $$
  select count(*) from nucleo.fila_de_excecoes where ativo_id = pg_temp.id('d1') and assunto = 'placa_com_dois_cr_do_mesmo_tipo'
$$;

-- ---- leituras ----
select tests.como(pg_temp.id('auth_Adm'));
select ok((nucleo.resumo_da_saude_do_cr()->'cartoes'->>'placas_sem_cr')::int >= 1, '1. cartão: placas sem CR');
select ok(jsonb_array_length(nucleo.resumo_da_saude_do_cr()->'problemas') = 4, '2. a tabela "o que fazer": os 4 problemas, com dono e prazo');
select ok(pg_temp.tem('placa_sem_cr', 'ativo_id', pg_temp.id('s1')::text), '3. placa sem CR vigente: s1');
select ok(pg_temp.tem('cr_sem_operacao', 'cr_id', pg_temp.cr('S1-117')::text), '4. CR sem operação: S1');
select ok(not pg_temp.tem('cr_sem_operacao', 'cr_id', pg_temp.cr('F2-117')::text), '5. CR de frota cuja placa tem operação não entra');
select ok(pg_temp.tem('dois_do_mesmo_tipo', 'ativo_id', pg_temp.id('d1')::text), '6. dois CRs de frota vigentes: d1');
select is((select jsonb_array_length(l->'crs') from jsonb_array_elements(pg_temp.linhas('dois_do_mesmo_tipo')) l
            where l->>'ativo_id' = pg_temp.id('d1')::text), 2, '7. com os dois CRs para escolher');
select is((select (l->>'lancamentos')::int from jsonb_array_elements(pg_temp.linhas('lancamento_sem_cr')) l where l->>'codcencus' = '999117'),
  2, '8. lançamento sem CR conhecido: o centro 999117, 2 lançamentos');
select ok(not pg_temp.tem('lancamento_sem_cr', 'codcencus', '11701'), '9. centro conhecido não entra');
select is(pg_temp.erro_de($$select nucleo.problemas_da_saude_do_cr('outro', 1, 10)$$), '22023', '10. problema desconhecido é recusado');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(pg_temp.tem('placa_sem_cr', 'ativo_id', pg_temp.id('s1')::text), '11. o gestor vê a placa sem CR da carteira');
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select ok(not pg_temp.tem('placa_sem_cr', 'ativo_id', pg_temp.id('s1')::text), '12. outro gestor não vê');
reset role;

-- ---- 26. ligar CR à operação ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.ligar_cr_a_operacao(%L, %L, '2026-11-01 00:00-03', 'x', null)$$,
  pg_temp.cr('S1-117'), (select id from nucleo.operacao where nome = 'Op 117'))), '42501', '13. o gestor não liga CR à operação');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is(pg_temp.erro_de(format($$select nucleo.ligar_cr_a_operacao(%L, %L, '2026-11-01 00:00-03', 'x', null)$$,
  pg_temp.cr('S1-117'), (select id from nucleo.operacao where nome = 'Op 117'))), '42501', '14. a Diretoria não grava direto (H6)');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.erro_de(format($$select nucleo.ligar_cr_a_operacao(%L, %L, '2026-11-01 00:00-03', ' ', null)$$,
  pg_temp.cr('S1-117'), (select id from nucleo.operacao where nome = 'Op 117'))), '23514', '15. sem motivo é recusado');
select set_config('t.lig', nucleo.ligar_cr_a_operacao(pg_temp.cr('S1-117'), (select id from nucleo.operacao where nome = 'Op 117'),
  '2026-11-01 00:00-03', 'Contrato novo', null)::text, true);
select is(nucleo.ligar_cr_a_operacao(pg_temp.cr('S1-117'), (select id from nucleo.operacao where nome = 'Op 117'),
  '2026-11-02 00:00-03', 'De novo', null)::text, current_setting('t.lig'), '16. ligar de novo à mesma operação não abre outro vínculo');
select ok(not pg_temp.tem('cr_sem_operacao', 'cr_id', pg_temp.cr('S1-117')::text), '17. S1 sai da lista');
reset role;
select is((select count(*) from nucleo.cr_de_servico_na_operacao where cr_id = pg_temp.cr('S1-117')), 1::bigint, '18. um vínculo CR-operação');
select is((select count(*) from nucleo.fila_de_excecoes where cr_id = pg_temp.cr('S1-117') and assunto = 'cr_sem_operacao' and resolvida_em is null),
  0::bigint, '19. a exceção cr_sem_operacao fechou');

-- ---- 27. escolher o vigente: encerrar um dos dois ----
select is(pg_temp.abertas_dois(), 1::bigint, '20. a exceção de dois do mesmo tipo está aberta');
select set_config('t.vd', (select id::text || ',' || versao from nucleo.cr_do_ativo where ativo_id = pg_temp.id('d1') and cr_id = pg_temp.cr('F3-117')), true);
select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.encerrar_vinculo_de_cr(%L, '2026-11-01 00:00-03', 'x', %s, null)$$,
  split_part(current_setting('t.vd'), ',', 1), split_part(current_setting('t.vd'), ',', 2))), '42501', '21. outro gestor não encerra');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.encerrar_vinculo_de_cr(%L, '2026-11-01 00:00-03', 'x', 99, null)$$,
  split_part(current_setting('t.vd'), ',', 1))), '40001', '22. versão velha: "este registro mudou"');
select ok(nucleo.encerrar_vinculo_de_cr(split_part(current_setting('t.vd'), ',', 1)::uuid, '2026-11-01 00:00-03', 'O F3 foi engano',
  split_part(current_setting('t.vd'), ',', 2)::int, null) is not null, '23. o gestor encerra o F3 (encerrar não é excluir)');
reset role;
select is(pg_temp.abertas_dois(), 0::bigint, '24. a exceção que deixou de valer fechou');
select is(pg_temp.todas_dois(), 1::bigint, '25. fechar não apaga');
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(nucleo.encerrar_vinculo_de_cr(split_part(current_setting('t.vd'), ',', 1)::uuid, '2026-11-01 00:00-03', 'O F3 foi engano',
  null, null) is not null, '26. a segunda rodada não falha');
reset role;
select is(pg_temp.abertas_dois() + pg_temp.todas_dois(), 1::bigint, '27. e não muda as contagens');
select is((select fim from nucleo.cr_do_ativo where ativo_id = pg_temp.id('d1') and cr_id = pg_temp.cr('F3-117')),
  '2026-11-01 00:00-03'::timestamptz, '28. o vínculo ficou com data de fim');

-- ---- 28. classificar o lançamento sem CR ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de($$select nucleo.classificar_centro_sem_cr('999117', 'sem_destino', null, null, 'x', null)$$),
  '42501', '29. o gestor não classifica');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select set_config('t.cls', nucleo.classificar_centro_sem_cr('999117', 'sem_destino', null, null, 'Centro de teste do Sankhya', null)::text, true);
select is(nucleo.classificar_centro_sem_cr('999117', 'sem_destino', null, null, 'De novo', null)::text, current_setting('t.cls'),
  '30. classificar de novo devolve a mesma classificação');
select ok(not pg_temp.tem('lancamento_sem_cr', 'codcencus', '999117'), '31. o centro classificado sai da lista');
select is((select count(*) from nucleo.classificacao_de_centro), 1::bigint, '32. classificacao_de_centro_ler: o Administrador lê');
reset role;

-- ---- 29. atribuir dono ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.atribuir_dono('placa_sem_cr', %L, %L, '2026-11-20', null)$$, pg_temp.id('s1'), pg_temp.id('Gestor A'))),
  '42501', '33. só o Administrador distribui o dono');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select nucleo.atribuir_dono('placa_sem_cr', pg_temp.id('s1')::text, pg_temp.id('Gestor B'), '2026-11-20', null);
select nucleo.atribuir_dono('placa_sem_cr', pg_temp.id('s1')::text, pg_temp.id('Gestor A'), '2026-11-21', null);
select is((select l->>'dono' from jsonb_array_elements(pg_temp.linhas('placa_sem_cr')) l where l->>'ativo_id' = pg_temp.id('s1')::text),
  'Gestor A', '34. reatribuir: vale o último dono, na linha do problema');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is((select count(*) from nucleo.dono_de_problema), 1::bigint, '35. dono_de_problema_ler: o dono lê o que é dele');
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is((select count(*) from nucleo.dono_de_problema where excluido_em is null), 0::bigint, '36. quem deixou de ser dono não lê o vigente');
reset role;

select * from finish();
rollback;
