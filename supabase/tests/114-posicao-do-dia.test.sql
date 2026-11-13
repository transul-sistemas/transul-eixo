-- M2, Posição do dia (docs/posicao-do-dia.md): a porta obrigatória do gestor de frota.
--  * config.cidade (a tabela de cidades) e nucleo.buscar_cidades (busca, nunca texto livre).
--  * nucleo.posicao_do_conjunto: uma posição por conjunto, dia e origem (entre as não excluídas); corrigir é
--    excluir logicamente e gravar a nova; DELETE recusado. Política posicao_do_conjunto_ler (ve_ativo).
--  * nucleo.registrar_posicao_do_dia: só o gestor vigente da carteira (o Administrador e a Diretoria não
--    agem em nome dele, H5 e H6); "Sem sinal" exige motivo e abre a pendência posicao_pendente UMA vez; a
--    resposta com cidade FECHA a pendência que o "Sem sinal" abriu (idempotente, duas rodadas).
--  * nucleo.liberar_posicao_do_dia: só o líder da operação (vínculo vigente de função lider), com motivo;
--    o que ficou sem resposta vira pendência, uma vez. Política liberacao_da_posicao_ler.
--  * nucleo.distancia_improvavel: reta × fator contra o limite por dia; sem coordenada não alerta.
--  * Políticas da cidade: cidade_ler, cidade_criar, cidade_alterar.
-- Sempre com a chave do usuário de cada perfil, nunca com a chave mestra.
begin;
\ir apoio/como_usuario.psql
\ir apoio/transferencia.psql

select plan(52);

-- ---- dados ----
select pg_temp.pessoa('Gestor A', 114000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 114000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Lider L', 114000003, 'operacional', false);
select pg_temp.pessoa('Oper O', 114000004, 'operacional', false);
select pg_temp.pessoa('Adm', 114000005, 'administrador', false);
select pg_temp.pessoa('Dir', 114000006, 'diretoria', false);
insert into nucleo.operacao (nome) values ('Op 114');
insert into pessoas.vinculo (pessoa_id, operacao_id, funcao, inicio)
values (pg_temp.id('Lider L'), (select id from nucleo.operacao where nome = 'Op 114'), 'lider', '2026-01-01');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (11401, 'K114A', true, true), (11402, 'K114B', true, true), (11403, 'K114C', true, true), (11404, 'K114D', true, true);
select pg_temp.guardar('c1', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(11401), p_placa => 'FFF1141', p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K114A'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Op 114'), p_em => '2026-01-10 08:00-03'));
select pg_temp.guardar('c2', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(11402), p_placa => 'FFF1142', p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K114B'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Op 114'), p_em => '2026-01-10 08:00-03'));
select pg_temp.guardar('c3', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(11403), p_placa => 'FFF1143', p_gestor_id => pg_temp.id('Gestor B'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K114C'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Op 114'), p_em => '2026-01-10 08:00-03'));
select pg_temp.guardar('i1', nucleo.cadastrar_ativo(
  p_tipo => 'implemento', p_funcao => 'semirreboque', p_eixos => 2::smallint,
  p_carroceria_id => (select id from config.carroceria where nome = 'Graneleira'), p_renavam => pg_temp.renavam(11404), p_placa => 'FFF1144', p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K114D'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Op 114'), p_em => '2026-01-10 08:00-03'));
select pg_temp.disparar();

insert into config.cidade (id, nome, uf, latitude, longitude) values
  (990001, 'Cidade Um', 'MA', -2.53, -44.30),
  (990003, 'Cidade Tres', 'SP', -22.50, -47.40),
  (990004, 'Cidade Quatro', 'MA', -2.60, -44.20),
  (990005, 'Cidade Cinco', 'MA', null, null);

-- O dia da posição de hoje (D) e o anterior; a v1 deixou a posição de c1 em D-1.
select set_config('t.d', nucleo.dia_da_posicao(now())::text, true);
create function pg_temp.d() returns date language sql as $$ select current_setting('t.d')::date $$;
insert into nucleo.posicao_do_conjunto (ativo_id, dia, cidade_id, origem)
values (pg_temp.id('c1'), pg_temp.d() - 1, 990001, 'v1');

create function pg_temp.pendentes(p_nome text, p_abertas boolean) returns bigint language sql as $$
  select count(*) from nucleo.fila_de_excecoes
   where ativo_id = pg_temp.id(p_nome) and assunto = 'posicao_pendente'
     and (not p_abertas or resolvida_em is null)
$$;
create function pg_temp.versao_de(p_nome text) returns integer language sql as $$
  select versao from nucleo.posicao_do_conjunto
   where ativo_id = pg_temp.id(p_nome) and dia = pg_temp.d() and origem = 'gestor' and excluido_em is null
$$;

-- ---- 1. a regra das 5h ----
select is(nucleo.dia_da_posicao('2026-11-13 04:59-03'), '2026-11-12'::date, '1. antes das 5h vale o dia anterior');
select is(nucleo.dia_da_posicao('2026-11-13 05:00-03'), '2026-11-13'::date, '2. a partir das 5h vale o dia');

-- ---- 2. a leitura da porta: os conjuntos da carteira de quem chama ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is((nucleo.posicoes_do_dia(pg_temp.d())->>'total')::int, 2, '3. o gestor A tem 2 conjuntos (o implemento e a placa de B ficam fora)');
select is((nucleo.posicoes_do_dia(pg_temp.d())->>'respondidos')::int, 0, '4. nenhum respondido ainda');
select is((nucleo.porta_da_posicao()->>'abrir')::boolean, true, '5. a porta abre: há conjunto sem resposta');
select is(
  (select (c->'ontem'->>'cidade_id')::int from jsonb_array_elements(nucleo.posicoes_do_dia(pg_temp.d())->'conjuntos') c
    where (c->>'ativo_id')::uuid = pg_temp.id('c1')),
  990001, '6. a posição de ontem de c1 (da v1) vem pronta para "Continua em"');

-- ---- 3. registrar ----
select ok(nucleo.registrar_posicao_do_dia(pg_temp.id('c1'), pg_temp.d(), 990001, false, null, null, false, null,
  '11400000-0000-4000-8000-000000000001') is not null, '7. "Continua em" grava a posição de c1');
select is(
  nucleo.registrar_posicao_do_dia(pg_temp.id('c1'), pg_temp.d(), 990001, false, null, null, false, null,
    '11400000-0000-4000-8000-000000000001'),
  (select id from nucleo.posicao_do_conjunto where ativo_id = pg_temp.id('c1') and dia = pg_temp.d() and excluido_em is null),
  '8. a mesma chave de envio devolve a mesma posição (sem duplicar)');
select is(pg_temp.erro_de(format($$select nucleo.registrar_posicao_do_dia(%L, %L, null, true, '  ', null, false, null, null)$$,
  pg_temp.id('c2'), pg_temp.d())), '23514', '9. "Sem sinal" sem motivo é recusado');
select is(pg_temp.erro_de(format($$select nucleo.registrar_posicao_do_dia(%L, %L, null, false, null, null, false, null, null)$$,
  pg_temp.id('c2'), pg_temp.d())), '23514', '10. sem cidade e sem "Sem sinal" é recusado');
select is(pg_temp.erro_de(format($$select nucleo.registrar_posicao_do_dia(%L, %L, 990001, false, null, null, false, null, null)$$,
  pg_temp.id('c1'), pg_temp.d() + 1)), '22023', '11. dia que ainda não chegou é recusado');
select is(pg_temp.erro_de(format($$select nucleo.registrar_posicao_do_dia(%L, %L, 990001, false, null, null, false, null, null)$$,
  pg_temp.id('i1'), pg_temp.d())), '23514', '12. implemento não tem posição do dia (é do conjunto)');
select ok(nucleo.registrar_posicao_do_dia(pg_temp.id('c2'), pg_temp.d(), null, true, 'Rastreador desligado', null, false, null, null) is not null,
  '13. "Sem sinal" com motivo vale como resposta');
reset role;
select is(pg_temp.pendentes('c2', true), 1::bigint, '14. "Sem sinal" abriu UMA pendência de posição');

-- correção: excluir logicamente e gravar a nova, com a versão
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.registrar_posicao_do_dia(%L, %L, null, true, 'Outro motivo', null, false, 99, null)$$,
  pg_temp.id('c2'), pg_temp.d())), '40001', '15. versão velha: "este registro mudou"');
select ok(nucleo.registrar_posicao_do_dia(pg_temp.id('c2'), pg_temp.d(), null, true, 'Ainda sem sinal', null, false,
  pg_temp.versao_de('c2'), null) is not null, '16. corrigir com a versão certa grava a nova');
reset role;
select is(pg_temp.pendentes('c2', true), 1::bigint, '17. o segundo "Sem sinal" não duplica a pendência');
select is((select count(*) from nucleo.posicao_do_conjunto where ativo_id = pg_temp.id('c2') and dia = pg_temp.d()),
  2::bigint, '18. a correção não apaga: 2 linhas no dia (1 excluída com motivo, 1 vigente)');
select is((select count(*) from nucleo.posicao_do_conjunto where ativo_id = pg_temp.id('c2') and dia = pg_temp.d()
            and excluido_em is not null and length(btrim(motivo_da_exclusao)) > 0), 1::bigint,
  '19. a excluída guarda o motivo da exclusão');
select isnt(pg_temp.erro_de(format($$delete from nucleo.posicao_do_conjunto where ativo_id = %L$$, pg_temp.id('c2'))),
  'executou', '20. DELETE é recusado (a posição nunca se apaga)');
select is(pg_temp.erro_de(format($$insert into nucleo.posicao_do_conjunto (ativo_id, dia, cidade_id, origem) values (%L, %L, 990001, 'gestor')$$,
  pg_temp.id('c2'), pg_temp.d())), '23505', '21. chave única por conjunto, dia e origem');

-- a resposta com cidade fecha a pendência que o "Sem sinal" abriu; duas rodadas, mesmas contagens
select tests.como(pg_temp.id('auth_Gestor A'));
select nucleo.registrar_posicao_do_dia(pg_temp.id('c2'), pg_temp.d(), 990004, false, null, null, false, pg_temp.versao_de('c2'), null);
reset role;
select is(pg_temp.pendentes('c2', true), 0::bigint, '22. a cidade informada fecha a pendência aberta');
select is(pg_temp.pendentes('c2', false), 1::bigint, '23. fechar não apaga: a pendência fica resolvida');
select tests.como(pg_temp.id('auth_Gestor A'));
select nucleo.registrar_posicao_do_dia(pg_temp.id('c2'), pg_temp.d(), 990004, false, null, null, false, pg_temp.versao_de('c2'), null);
reset role;
select is(pg_temp.pendentes('c2', true) + pg_temp.pendentes('c2', false), 1::bigint, '24. a segunda rodada não muda as contagens');

select tests.como(pg_temp.id('auth_Gestor A'));
select is((nucleo.posicoes_do_dia(pg_temp.d())->>'respondidos')::int, 2, '25. 2 de 2 respondidos');
select is((nucleo.porta_da_posicao()->>'abrir')::boolean, false, '26. com tudo respondido, a porta não abre');

-- a situação do dia no mesmo passo: grava o evento só quando muda
select nucleo.registrar_posicao_do_dia(pg_temp.id('c1'), pg_temp.d(), 990001, false, null, 'PÁT', false, pg_temp.versao_de('c1'), null);
reset role;
select is(nucleo.situacao_no_dia(pg_temp.id('c1'), pg_temp.d()), 'PÁT', '27. a situação do dia gravou o evento (PÁT)');
select set_config('t.eventos', (select count(*) from nucleo.evento_de_status where ativo_id = pg_temp.id('c1'))::text, true);
select tests.como(pg_temp.id('auth_Gestor A'));
select nucleo.registrar_posicao_do_dia(pg_temp.id('c1'), pg_temp.d(), 990001, false, null, 'PÁT', true, pg_temp.versao_de('c1'), null);
reset role;
select is((select count(*) from nucleo.evento_de_status where ativo_id = pg_temp.id('c1'))::text, current_setting('t.eventos'),
  '28. a mesma situação de novo não grava outro evento');
select is((select confirmou_alerta from nucleo.posicao_do_conjunto where ativo_id = pg_temp.id('c1') and dia = pg_temp.d()
            and origem = 'gestor' and excluido_em is null), true, '29. "Está certo" fica gravado (confirmou o alerta)');

-- ---- 4. quem não pode registrar ----
select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.erro_de(format($$select nucleo.registrar_posicao_do_dia(%L, %L, 990001, false, null, null, false, null, null)$$,
  pg_temp.id('c1'), pg_temp.d())), '42501', '30. outro gestor não registra a posição de c1');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.erro_de(format($$select nucleo.registrar_posicao_do_dia(%L, %L, 990001, false, null, null, false, null, null)$$,
  pg_temp.id('c1'), pg_temp.d())), '42501', '31. o Administrador não registra em nome do gestor (H5)');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is(pg_temp.erro_de(format($$select nucleo.registrar_posicao_do_dia(%L, %L, 990001, false, null, null, false, null, null)$$,
  pg_temp.id('c1'), pg_temp.d())), '42501', '32. a Diretoria não registra (H6)');
reset role;
select tests.como_anonimo();
select is(pg_temp.erro_de(format($$select nucleo.registrar_posicao_do_dia(%L, %L, 990001, false, null, null, false, null, null)$$,
  pg_temp.id('c1'), pg_temp.d())), '42501', '33. anon não executa');
reset role;

-- ---- 5. RLS (posicao_do_conjunto_ler): a carteira, nunca a de outro ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is((select count(*) from nucleo.posicao_do_conjunto where ativo_id = pg_temp.id('c1')), 3::bigint, '34. o gestor A lê as posições de c1');
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is((select count(*) from nucleo.posicao_do_conjunto where ativo_id = pg_temp.id('c1')), 0::bigint, '35. o gestor B não lê as de c1');
select is((nucleo.posicoes_do_dia(pg_temp.d())->>'total')::int, 1, '36. o gestor B tem 1 conjunto (c3)');
reset role;
select tests.como(pg_temp.id('auth_Dir'));
select is((select count(*) from nucleo.posicao_do_conjunto where ativo_id = pg_temp.id('c1')), 3::bigint, '37. a Diretoria lê tudo');
reset role;
select tests.como(pg_temp.id('auth_Oper O'));
select is((select count(*) from nucleo.posicao_do_conjunto where ativo_id = pg_temp.id('c1')), 0::bigint, '38. o Operacional sem a placa na filial não lê');
select is((select count(*) from nucleo.liberacao_da_posicao), 0::bigint, '39. liberacao_da_posicao_ler: o Operacional não lê liberações alheias');
reset role;

-- ---- 6. liberar: só o líder, com motivo ----
select tests.como(pg_temp.id('auth_Lider L'));
select is(pg_temp.erro_de(format($$select nucleo.liberar_posicao_do_dia(%L, %L, '', null)$$, pg_temp.id('Gestor B'), pg_temp.d())),
  '23514', '40. liberar sem motivo é recusado');
reset role;
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.erro_de(format($$select nucleo.liberar_posicao_do_dia(%L, %L, 'Queda do sistema', null)$$, pg_temp.id('Gestor B'), pg_temp.d())),
  '42501', '41. o Administrador não libera em nome do líder (H5)');
reset role;
select tests.como(pg_temp.id('auth_Oper O'));
select is(pg_temp.erro_de(format($$select nucleo.liberar_posicao_do_dia(%L, %L, 'Queda do sistema', null)$$, pg_temp.id('Gestor B'), pg_temp.d())),
  '42501', '42. quem não é líder não libera');
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.erro_de(format($$select nucleo.liberar_posicao_do_dia(%L, %L, 'Queda do sistema', null)$$, pg_temp.id('Gestor B'), pg_temp.d())),
  '42501', '43. o gestor não libera');
reset role;
select tests.como(pg_temp.id('auth_Lider L'));
select set_config('t.lib', nucleo.liberar_posicao_do_dia(pg_temp.id('Gestor B'), pg_temp.d(), 'Queda do sistema', null)::text, true);
select is(nucleo.liberar_posicao_do_dia(pg_temp.id('Gestor B'), pg_temp.d(), 'Queda do sistema', null)::text, current_setting('t.lib'),
  '44. liberar de novo devolve a mesma liberação');
reset role;
select is(pg_temp.pendentes('c3', true), 1::bigint, '45. o conjunto sem resposta virou UMA pendência (duas rodadas)');
select tests.como(pg_temp.id('auth_Gestor B'));
select is((nucleo.porta_da_posicao()->>'abrir')::boolean, false, '46. liberada, a porta não abre para o gestor B');
select is((select count(*) from nucleo.liberacao_da_posicao), 1::bigint, '47. o gestor B lê a própria liberação');
reset role;

-- ---- 7. distância improvável e busca de cidade ----
select is((nucleo.distancia_improvavel(990001, 990003, 1)->>'improvavel')::boolean, true, '48. 2.000 km em 1 dia é improvável');
select is((nucleo.distancia_improvavel(990001, 990004, 1)->>'improvavel')::boolean, false, '49. cidade vizinha não alerta');
select ok((nucleo.distancia_improvavel(990001, 990005, 1)->>'km') is null
          and not (nucleo.distancia_improvavel(990001, 990005, 1)->>'improvavel')::boolean, '50. sem coordenada não alerta (e não inventa km)');
select tests.como(pg_temp.id('auth_Gestor A'));
select is((select id from nucleo.buscar_cidades('cidade um', 10) limit 1), 990001, '51. a busca acha a cidade (sem acento e sem caixa)');
select is((select count(*) from nucleo.serie_de_posicoes(pg_temp.id('c1'), pg_temp.d() - 1, pg_temp.d())), 2::bigint,
  '52. a série da rota (A4): um ponto por dia');
reset role;

select * from finish();
rollback;
