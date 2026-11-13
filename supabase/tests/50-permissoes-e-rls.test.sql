-- Fatia 3.6: permissões (módulo × ação × escopo) e RLS em todas as tabelas, provadas com a chave de
-- cada usuário (`authenticated` com as claims dele), nunca com a chave mestra.
--
-- Escopos: tudo, minha_carteira (gestor vigente), operacao (operação do CR vigente) e filial (custódia
-- vigente do Operacional). Placas do teste:
--   pa: gestor A, CR de Grãos, no pátio do Operacional da filial A
--   pb: gestor B, CR de Cimento, no pátio do Operacional da filial B
--   pc: gestor A, sem CR e sem custódia do Operacional
begin;
\ir apoio/como_usuario.psql

select plan(76);

-- Os ids ficam em configurações da transação (o papel authenticated não lê tabela temporária).
create function pg_temp.id(p_nome text) returns uuid language sql as $$
  select nullif(current_setting('t.' || p_nome, true), '')::uuid
$$;
create function pg_temp.guardar(p_nome text, p_id uuid) returns uuid language sql as $$
  select set_config('t.' || p_nome, p_id::text, true)::uuid
$$;

create function pg_temp.renavam(p_n bigint) returns text language plpgsql as $$
declare
  v_prefixo text := lpad(p_n::text, 10, '0');
  v_dv int;
begin
  for v_dv in 0..9 loop
    if nucleo.renavam_valido(v_prefixo || v_dv::text) then
      return v_prefixo || v_dv::text;
    end if;
  end loop;
  raise exception 'sem dígito verificador para %', v_prefixo;
end;
$$;

-- Altera o chassi com a chave de quem chama e devolve quantas linhas mudaram (0 quando a RLS esconde).
create function pg_temp.alterar_chassi(p_ativo uuid, p_chassi text) returns int language plpgsql as $$
declare v int;
begin
  update nucleo.ativo set chassi = p_chassi where id = p_ativo;
  get diagnostics v = row_count;
  return v;
end;
$$;

-- Age como authenticated com as claims dadas (para testar token sem `sub` ou com metadados forjados).
create function pg_temp.como_claims(p_claims jsonb) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', p_claims::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_claims ->> 'sub', ''), true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end;
$$;

-- Um CPF válido a partir de um número de 9 dígitos.
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

-- Pessoa com documento, usuário no Auth local e o vínculo com o perfil.
create function pg_temp.usuario(p_nome text, p_n bigint, p_perfil text) returns uuid language plpgsql as $$
declare
  v_pessoa uuid;
  v_auth uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_pessoa;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, pg_temp.cpf(p_n));
  v_auth := tests.criar_usuario(p_nome || '@exemplo.local');
  if p_perfil is not null then
    insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (v_pessoa, v_auth, p_perfil);
  end if;
  perform pg_temp.guardar('pessoa_' || p_nome, v_pessoa);
  return pg_temp.guardar(p_nome, v_auth);
end;
$$;

create function pg_temp.placa(p_nome text, p_n bigint, p_gestor text, p_cr text, p_filial text) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(p_n)) returning id into v;
  insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem)
    values (v, 'propria', '2026-01-10 00:00-03', 'informada');
  insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
    values (v, pg_temp.id('pessoa_' || p_gestor), '2026-01-10 00:00-03', 'informada');
  insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem)
    values (v, 'PÁT', '2026-01-10 00:00-03', 'informada', 'manual');
  if p_cr is not null then
    insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
      values (v, (select id from nucleo.cr where codigo = p_cr), '2026-01-10 00:00-03', 'informada');
  end if;
  if p_filial is not null then
    insert into nucleo.custodia (ativo_id, com_quem, filial_id, inicio, inicio_origem)
      values (v, 'operacional', (select id from config.filial where nome = p_filial), '2026-01-10 00:00-03', 'informada');
  end if;
  return pg_temp.guardar(p_nome, v);
end;
$$;

-- ---- catálogo de acesso ----
select has_table('nucleo', 'usuario', 'existe nucleo.usuario');
select has_table('nucleo', 'usuario_operacao', 'existe nucleo.usuario_operacao');
select has_table('nucleo', 'usuario_filial', 'existe nucleo.usuario_filial');
select has_table('nucleo', 'papel_da_pessoa', 'existe nucleo.papel_da_pessoa');
select has_table('config', 'permissao_do_perfil', 'existe config.permissao_do_perfil');
select has_view('nucleo', 'pessoa_para_leitura', 'existe a visão nucleo.pessoa_para_leitura');
select has_function('config', 'pode', array['text', 'text'], 'existe config.pode(módulo, ação)');
select set_eq(
  $$select nome from config.perfil$$,
  array['Administrador', 'Diretoria', 'Gestor de frota', 'Operacional'],
  'os quatro perfis provisórios'
);
select is(
  (select md5(string_agg(perfil || '|' || modulo || '|' || acao || '|' || escopo, ',' order by perfil || '|' || modulo || '|' || acao || '|' || escopo collate "C"))
     from config.permissao_do_perfil),
  'd343d54d27c68753725c5309d7f09da1',
  'as permissões do seed são as mesmas do espelho em TypeScript (mesma assinatura)'
);

-- ---- RLS, políticas e grants ----
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and not c.relrowsecurity and n.nspname in ('nucleo', 'config', 'auditoria')),
  0::bigint,
  'toda tabela de nucleo, config e auditoria tem RLS ligado'
);
select set_eq(
  $$select n.nspname || '.' || c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p') and n.nspname in ('nucleo', 'config', 'auditoria')
       and not exists (select 1 from pg_policies p where p.schemaname = n.nspname and p.tablename = c.relname)$$,
  array['auditoria.envio'],
  'toda tabela tem política, menos auditoria.envio (só a função de idempotência grava nela)'
);
select set_eq(
  $$select schemaname || '.' || tablename || '.' || policyname from pg_policies where schemaname in ('nucleo', 'config', 'auditoria')$$,
  array[
    'nucleo.ativo.ativo_ler', 'nucleo.ativo.ativo_criar', 'nucleo.ativo.ativo_alterar',
    'nucleo.placa_do_ativo.placa_do_ativo_ler', 'nucleo.placa_do_ativo.placa_do_ativo_criar', 'nucleo.placa_do_ativo.placa_do_ativo_alterar',
    'nucleo.cr_do_ativo.cr_do_ativo_ler', 'nucleo.cr_do_ativo.cr_do_ativo_criar', 'nucleo.cr_do_ativo.cr_do_ativo_alterar',
    'nucleo.posse_do_ativo.posse_do_ativo_ler', 'nucleo.posse_do_ativo.posse_do_ativo_criar', 'nucleo.posse_do_ativo.posse_do_ativo_alterar',
    -- S2 (pgTAP 84): saíram gestor_da_carteira_criar e as de criar e alterar do pedido e das pendências.
    'nucleo.gestor_da_carteira.gestor_da_carteira_ler', 'nucleo.gestor_da_carteira.gestor_da_carteira_alterar',
    'nucleo.baixa_do_ativo.baixa_do_ativo_ler', 'nucleo.baixa_do_ativo.baixa_do_ativo_criar', 'nucleo.baixa_do_ativo.baixa_do_ativo_alterar',
    'nucleo.custodia.custodia_ler', 'nucleo.custodia.custodia_criar', 'nucleo.custodia.custodia_alterar',
    'nucleo.composicao.composicao_ler', 'nucleo.composicao.composicao_criar', 'nucleo.composicao.composicao_alterar',
    'nucleo.meta_do_conjunto.meta_do_conjunto_ler', 'nucleo.meta_do_conjunto.meta_do_conjunto_criar', 'nucleo.meta_do_conjunto.meta_do_conjunto_alterar',
    'nucleo.evento_de_status.evento_de_status_ler', 'nucleo.evento_de_status.evento_de_status_criar', 'nucleo.evento_de_status.evento_de_status_alterar',
    'nucleo.estado_de_status.estado_de_status_ler',
    'nucleo.transferencia.transferencia_ler',
    'nucleo.transferencia_pendencia.transferencia_pendencia_ler',
    'nucleo.pessoa.pessoa_ler', 'nucleo.pessoa.pessoa_criar', 'nucleo.pessoa.pessoa_alterar',
    'nucleo.pessoa_documento.pessoa_documento_ler', 'nucleo.pessoa_documento.pessoa_documento_criar',
    'nucleo.papel_da_pessoa.papel_da_pessoa_ler', 'nucleo.papel_da_pessoa.papel_da_pessoa_criar', 'nucleo.papel_da_pessoa.papel_da_pessoa_alterar',
    'nucleo.operacao.operacao_ler', 'nucleo.operacao.operacao_criar', 'nucleo.operacao.operacao_alterar',
    'nucleo.cr.cr_ler', 'nucleo.cr.cr_criar', 'nucleo.cr.cr_alterar',
    'nucleo.usuario.usuario_ler', 'nucleo.usuario.usuario_criar', 'nucleo.usuario.usuario_alterar',
    'nucleo.usuario_operacao.usuario_operacao_ler', 'nucleo.usuario_operacao.usuario_operacao_criar', 'nucleo.usuario_operacao.usuario_operacao_alterar',
    'nucleo.usuario_filial.usuario_filial_ler', 'nucleo.usuario_filial.usuario_filial_criar', 'nucleo.usuario_filial.usuario_filial_alterar',
    'nucleo.placa_na_operacao.placa_na_operacao_ler', 'nucleo.placa_na_operacao.placa_na_operacao_criar', 'nucleo.placa_na_operacao.placa_na_operacao_alterar',
    'nucleo.cr_de_servico_na_operacao.cr_de_servico_na_operacao_ler', 'nucleo.cr_de_servico_na_operacao.cr_de_servico_na_operacao_criar', 'nucleo.cr_de_servico_na_operacao.cr_de_servico_na_operacao_alterar',
    'config.carroceria.carroceria_ler', 'config.carroceria.carroceria_criar', 'config.carroceria.carroceria_alterar',
    'config.marca.marca_ler', 'config.marca.marca_criar', 'config.marca.marca_alterar',
    'config.modelo.modelo_ler', 'config.modelo.modelo_criar', 'config.modelo.modelo_alterar',
    'config.filial.filial_ler', 'config.filial.filial_criar', 'config.filial.filial_alterar',
    'config.garagem.garagem_ler', 'config.garagem.garagem_criar', 'config.garagem.garagem_alterar',
    'config.filial_do_cr.filial_do_cr_ler', 'config.filial_do_cr.filial_do_cr_criar', 'config.filial_do_cr.filial_do_cr_alterar',
    'config.unidade_gerencial.unidade_gerencial_ler',
    'config.nomenclatura_de_conjunto.nomenclatura_de_conjunto_ler', 'config.nomenclatura_de_conjunto.nomenclatura_de_conjunto_criar', 'config.nomenclatura_de_conjunto.nomenclatura_de_conjunto_alterar',
    'config.configuracao_de_conjunto.configuracao_de_conjunto_ler', 'config.configuracao_de_conjunto.configuracao_de_conjunto_criar', 'config.configuracao_de_conjunto.configuracao_de_conjunto_alterar',
    'config.camada_de_status.camada_de_status_ler', 'config.camada_de_status.camada_de_status_criar', 'config.camada_de_status.camada_de_status_alterar',
    'config.status.status_ler', 'config.status.status_criar', 'config.status.status_alterar',
    'config.modulo.modulo_ler', 'config.modulo.modulo_criar', 'config.modulo.modulo_alterar',
    'config.acao.acao_ler', 'config.acao.acao_criar', 'config.acao.acao_alterar',
    'config.escopo.escopo_ler', 'config.escopo.escopo_criar', 'config.escopo.escopo_alterar',
    'config.perfil.perfil_ler', 'config.perfil.perfil_criar', 'config.perfil.perfil_alterar',
    'config.permissao_do_perfil.permissao_do_perfil_ler', 'config.permissao_do_perfil.permissao_do_perfil_criar', 'config.permissao_do_perfil.permissao_do_perfil_alterar',
    'config.papel.papel_ler', 'config.papel.papel_criar', 'config.papel.papel_alterar',
    'config.parametro.parametro_ler', 'config.parametro.parametro_criar', 'config.parametro.parametro_alterar',
    'config.funcao_executavel.funcao_executavel_ler', 'config.funcao_executavel.funcao_executavel_criar', 'config.funcao_executavel.funcao_executavel_alterar',
    'auditoria.evento.auditoria_evento_ler',
    -- 3.7 (testadas em 70-dados-do-ativo.test.sql)
    'config.campo_corrigivel.campo_corrigivel_ler', 'nucleo.sinal_do_sankhya.sinal_do_sankhya_ler',
    'nucleo.correcao_de_campo.correcao_de_campo_ler',
    'nucleo.fila_de_excecoes.fila_de_excecoes_ler', 'nucleo.fila_de_excecoes.fila_de_excecoes_alterar',
    -- Parte B (11/11/2026): o Gestor de frota lê as exceções das placas da carteira (pgTAP 104).
    'nucleo.fila_de_excecoes.fila_de_excecoes_ler_da_carteira',
    -- Receita por tipo de documento (testadas em 107-receita-por-tipo-de-documento.test.sql).
    'config.receita_top.receita_top_ler', 'config.receita_top.receita_top_criar', 'config.receita_top.receita_top_alterar',
    -- 3.9a: a leitura mantida das placas (equivalência com ve_ativo no pgTAP 81).
    'nucleo.leitura_da_placa.leitura_da_placa_ler',
    -- Carteira mensal (testada em 86-carteira-mensal.test.sql).
    'nucleo.confirmacao_da_carteira.confirmacao_da_carteira_ler',
    -- Posição do dia, M2 (testadas em 114-posicao-do-dia.test.sql).
    'config.cidade.cidade_ler', 'config.cidade.cidade_criar', 'config.cidade.cidade_alterar',
    'nucleo.posicao_do_conjunto.posicao_do_conjunto_ler', 'nucleo.liberacao_da_posicao.liberacao_da_posicao_ler',
    -- Trocar CR, V0 (testada em 115-trocar-cr.test.sql).
    'nucleo.troca_de_cr.troca_de_cr_ler',
    -- Baixa com quatro olhos, S4 (testada em 116-baixa-com-quatro-olhos.test.sql).
    'nucleo.pedido_de_baixa.pedido_de_baixa_ler',
    -- Saúde do CR, CR1 (testadas em 117-saude-do-cr.test.sql).
    'nucleo.classificacao_de_centro.classificacao_de_centro_ler', 'nucleo.dono_de_problema.dono_de_problema_ler',
    -- Programado, A2 (testada em 118-lancar-o-dia.test.sql).
    'nucleo.situacao_programada.situacao_programada_ler'
  ],
  'as políticas de cada tabela, com o nome de cada uma (todas testadas abaixo ou na matriz)'
);
select is(
  (select count(*) from information_schema.role_table_grants
    where table_schema in ('nucleo', 'config', 'auditoria') and grantee in ('anon', 'PUBLIC')),
  0::bigint,
  'anon e PUBLIC não têm grant em nenhuma tabela'
);
select is(
  (select count(*) from information_schema.role_table_grants
    where table_schema in ('nucleo', 'config', 'auditoria') and grantee = 'authenticated' and privilege_type = 'DELETE'),
  0::bigint,
  'ninguém apaga de verdade: authenticated não tem DELETE em nenhuma tabela'
);
select ok(
  not has_column_privilege('authenticated', 'nucleo.ativo', 'tipo', 'UPDATE')
  and has_column_privilege('authenticated', 'nucleo.ativo', 'eixos', 'UPDATE'),
  'o UPDATE de nucleo.ativo deixa a coluna tipo de fora (o tipo só muda pela função)'
);
select set_eq(
  $$select p.oid::regprocedure::text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('nucleo', 'config', 'auditoria', 'operacional', 'pessoas', 'rh_clinico', 'parceiros', 'financeiro', 'sync')
       and has_function_privilege('authenticated', p.oid, 'execute')$$,
  $$select assinatura from config.funcao_executavel$$,
  'authenticated executa exatamente as funções da lista de exceções (config.funcao_executavel)'
);
select is(
  (select count(*) from config.funcao_executavel where nullif(btrim(justificativa), '') is null),
  0::bigint,
  'cada função liberada tem a justificativa registrada'
);
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('nucleo', 'config', 'auditoria') and has_function_privilege('anon', p.oid, 'execute')),
  0::bigint,
  'anon não executa nenhuma função'
);

-- ---- dados (como dono do banco) ----
insert into config.filial (nome) values ('Filial A'), ('Filial B');
insert into nucleo.operacao (nome) values ('Grãos'), ('Cimento');
insert into nucleo.cr (codcencus, codigo, operacao_id) values
  (5001, 'CR-G', (select id from nucleo.operacao where nome = 'Grãos')),
  (5002, 'CR-C', (select id from nucleo.operacao where nome = 'Cimento'));
insert into config.perfil (codigo, nome) values ('teste_operacao', 'Teste por operação');
insert into config.permissao_do_perfil (perfil, modulo, acao, escopo) values ('teste_operacao', 'frota', 'ver', 'operacao');

select pg_temp.usuario('adm', 100000001, 'administrador');
select pg_temp.usuario('dir', 100000002, 'diretoria');
select pg_temp.usuario('ga', 100000003, 'gestor_de_frota');
select pg_temp.usuario('gb', 100000004, 'gestor_de_frota');
select pg_temp.usuario('opa', 100000005, 'operacional');
select pg_temp.usuario('opb', 100000006, 'operacional');
select pg_temp.usuario('uop', 100000007, 'teste_operacao');
select pg_temp.usuario('inativo', 100000008, 'administrador');
select pg_temp.usuario('estranho', 100000009, null);
update nucleo.usuario set ativo = false where pessoa_id = pg_temp.id('pessoa_inativo');
insert into nucleo.papel_da_pessoa (pessoa_id, papel) values
  (pg_temp.id('pessoa_ga'), 'gestor_de_frota'), (pg_temp.id('pessoa_gb'), 'gestor_de_frota');
insert into nucleo.usuario_filial (usuario_id, filial_id) values
  (pg_temp.id('pessoa_opa'), (select id from config.filial where nome = 'Filial A')),
  (pg_temp.id('pessoa_opb'), (select id from config.filial where nome = 'Filial B'));
insert into nucleo.usuario_operacao (usuario_id, operacao_id) values
  (pg_temp.id('pessoa_uop'), (select id from nucleo.operacao where nome = 'Grãos'));
select pg_temp.placa('pa', 501, 'ga', 'CR-G', 'Filial A');
select pg_temp.placa('pb', 502, 'gb', 'CR-C', 'Filial B');
select pg_temp.placa('pc', 503, 'ga', null, null);
-- A operação é montada (3.6c): o escopo "operação" lê o vínculo placa-operação.
insert into nucleo.placa_na_operacao (ativo_id, operacao_id, inicio, inicio_origem) values
  (pg_temp.id('pa'), (select id from nucleo.operacao where nome = 'Grãos'), '2026-01-10 00:00-03', 'informada'),
  (pg_temp.id('pb'), (select id from nucleo.operacao where nome = 'Cimento'), '2026-01-10 00:00-03', 'informada');
set constraints all immediate;
set constraints all deferred;

-- ---- papel de gestor de frota (pendência da 3.4) ----
select throws_ok(
  $$insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
    values (pg_temp.id('pc'), pg_temp.id('pessoa_opa'), '2026-01-09 00:00-03', 'informada')$$,
  '23514', 'Esta pessoa não tem o papel de gestor de frota: dê o papel antes de pô-la como gestora.',
  'gestor da carteira exige o papel de gestor de frota'
);
select throws_ok(
  $$insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo)
    values (pg_temp.id('pa'), pg_temp.id('pessoa_ga'), pg_temp.id('pessoa_opa'), 'Teste')$$,
  '23514', 'Esta pessoa não tem o papel de gestor de frota: dê o papel antes de pô-la como gestora.',
  'transferência para quem não é gestor de frota é recusada'
);

-- ---- Administrador ----
select tests.como(pg_temp.id('adm'));
select is((select count(*) from nucleo.ativo where id in (pg_temp.id('pa'), pg_temp.id('pb'), pg_temp.id('pc'))), 3::bigint, 'ativo_ler: o Administrador vê todas as placas (escopo tudo)');
select ok((select count(*) from nucleo.pessoa_documento) > 0, 'pessoa_documento_ler: o Administrador lê o documento completo (pessoas.ver_documento)');
select is(
  pg_temp.alterar_chassi(pg_temp.id('pb'), 'CHASSI-PB'),
  1, 'ativo_alterar: o Administrador altera qualquer placa'
);
select lives_ok($$insert into config.carroceria (nome) values ('Caçamba de teste')$$, 'carroceria_criar: o Administrador cadastra no catálogo');
select ok((select count(*) from auditoria.evento) > 0, 'auditoria_evento_ler: o Administrador lê a auditoria');
reset role;

-- ---- Diretoria ----
select tests.como(pg_temp.id('dir'));
select is((select count(*) from nucleo.ativo where id in (pg_temp.id('pa'), pg_temp.id('pb'), pg_temp.id('pc'))), 3::bigint, 'a Diretoria vê todas as placas');
select is((select count(*) from nucleo.pessoa_documento), 0::bigint, 'a Diretoria não lê o documento completo (sem ver_documento)');
select ok(
  (select documento_mascarado from nucleo.pessoa_para_leitura where id = pg_temp.id('pessoa_ga')) like '***.%-**',
  'pessoa_ler e a visão pessoa_para_leitura mostram o documento mascarado'
);
reset role;

-- ---- Gestor de frota A (minha carteira) ----
select tests.como(pg_temp.id('ga'));
select set_eq(
  $$select id from nucleo.ativo where id in (pg_temp.id('pa'), pg_temp.id('pb'), pg_temp.id('pc'))$$,
  $$values (pg_temp.id('pa')), (pg_temp.id('pc'))$$,
  'o Gestor de frota vê só a sua carteira (pa e pc)'
);
select is((select count(*) from nucleo.custodia where ativo_id = pg_temp.id('pb')), 0::bigint, 'custodia_ler: o gestor A não vê a custódia da placa do gestor B');
select is((select count(*) from nucleo.evento_de_status where ativo_id = pg_temp.id('pb')), 0::bigint, 'evento_de_status_ler: o gestor A não vê os eventos da placa do gestor B');
select is((select count(*) from nucleo.estado_de_status where ativo_id = pg_temp.id('pb')), 0::bigint, 'estado_de_status_ler: nem o estado');
select is(
  pg_temp.alterar_chassi(pg_temp.id('pb'), 'TENTATIVA'),
  0, 'ativo_alterar: o gestor A não altera a placa do gestor B'
);
select is(
  pg_temp.alterar_chassi(pg_temp.id('pa'), 'CHASSI-PA'),
  1, 'o gestor A altera a própria placa'
);
select lives_ok(
  $$select nucleo.registrar_evento(pg_temp.id('pa'), 'SMo', '2026-02-01 00:00-03')$$,
  'evento_de_status_criar: o gestor A registra evento na própria placa'
);
select throws_ok(
  $$select nucleo.registrar_evento(pg_temp.id('pb'), 'SMo', '2026-02-01 00:00-03')$$,
  '42501', null, 'o gestor A não registra evento na placa do gestor B'
);
select throws_ok(
  $$insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
    values (pg_temp.id('pb'), pg_temp.id('pessoa_ga'), '2026-03-01 00:00-03', 'informada')$$,
  '42501', null, 'gestor_da_carteira_criar: o gestor A não se põe na carteira da placa do gestor B'
);
select throws_ok($$insert into config.carroceria (nome) values ('Tentativa')$$, '42501', null, 'o Gestor de frota não cadastra no catálogo (sem cadastros)');
select is((select count(*) from nucleo.pessoa_documento), 0::bigint, 'o Gestor de frota não lê o documento completo');
select is((select count(*) from auditoria.evento), 0::bigint, 'o Gestor de frota não lê a auditoria');
select throws_ok(
  $$update nucleo.ativo set tipo = 'caminhao' where id = pg_temp.id('pa')$$,
  '42501', null, 'contornar: UPDATE direto do tipo é negado pela coluna'
);
select throws_ok(
  $$select nucleo.mudar_tipo_do_ativo(pg_temp.id('pb'), 'caminhao', 'Tentativa')$$,
  '42501', null, 'contornar: mudar o tipo da placa de outra carteira é negado'
);
select lives_ok(
  $$select nucleo.mudar_tipo_do_ativo(pg_temp.id('pc'), 'caminhao', 'Cadastrado errado')$$,
  'o gestor muda o tipo da própria placa pela função, com motivo'
);
select lives_ok(
  $$update nucleo.custodia set excluido_em = now(), motivo_da_exclusao = 'Lançada errada' where ativo_id = pg_temp.id('pa')$$,
  'custodia_alterar: o gestor (com frota.excluir) exclui logicamente na própria carteira'
);
reset role;
-- Repõe a custódia do Operacional em pa (o gestor a excluiu acima).
insert into nucleo.custodia (ativo_id, com_quem, filial_id, inicio, inicio_origem)
  values (pg_temp.id('pa'), 'operacional', (select id from config.filial where nome = 'Filial A'), '2026-02-02 00:00-03', 'informada');

-- ---- Operacional da filial A ----
select tests.como(pg_temp.id('opa'));
select set_eq(
  $$select id from nucleo.ativo where id in (pg_temp.id('pa'), pg_temp.id('pb'), pg_temp.id('pc'))$$,
  $$values (pg_temp.id('pa'))$$,
  'o Operacional vê só as placas no pátio da sua filial'
);
select is(
  pg_temp.alterar_chassi(pg_temp.id('pa'), 'OPERACIONAL'),
  0, 'o Operacional não altera o cadastro da placa (só a Frota altera)'
);
select is((select count(*) from nucleo.pessoa_documento), 0::bigint, 'o Operacional não lê o documento completo');
select lives_ok(
  $$select nucleo.registrar_evento(pg_temp.id('pa'), 'DOp', '2026-02-03 00:00-03')$$,
  'o Operacional registra evento na placa do seu pátio'
);
select throws_ok(
  $$update nucleo.custodia set excluido_em = now(), motivo_da_exclusao = 'Tentativa' where ativo_id = pg_temp.id('pa') and excluido_em is null$$,
  '42501', null, 'o Operacional não exclui (sem a ação excluir)'
);
reset role;

-- ---- Operacional da filial B e o escopo por operação ----
select tests.como(pg_temp.id('opb'));
select set_eq(
  $$select id from nucleo.ativo where id in (pg_temp.id('pa'), pg_temp.id('pb'), pg_temp.id('pc'))$$,
  $$values (pg_temp.id('pb'))$$,
  'o Operacional da filial B não vê a placa da filial A'
);
reset role;
select tests.como(pg_temp.id('uop'));
select set_eq(
  $$select id from nucleo.ativo where id in (pg_temp.id('pa'), pg_temp.id('pb'), pg_temp.id('pc'))$$,
  $$values (pg_temp.id('pa'))$$,
  'escopo operacao: vê só as placas montadas na operação do usuário'
);
reset role;

-- ---- quem não deve ver nada ----
select tests.como(pg_temp.id('estranho'));
select is((select count(*) from nucleo.ativo), 0::bigint, 'usuário do Auth sem vínculo no Eixo não vê placas');
select is((select count(*) from config.status), 0::bigint, 'nem os catálogos');
reset role;
select tests.como(pg_temp.id('inativo'));
select is((select count(*) from nucleo.ativo), 0::bigint, 'usuário inativo não vê nada');
reset role;
select tests.como_anonimo();
select throws_ok('select 1 from nucleo.ativo', '42501', null, 'anon não lê placas');
select throws_ok('select 1 from config.status', '42501', null, 'anon não lê catálogos');
reset role;

-- ---- o token não concede nada sozinho: só o vínculo e a tabela de permissões ----
select tests.como(pg_temp.id('estranho'));
select throws_ok($$insert into config.carroceria (nome) values ('Sem vínculo')$$, '42501', null, 'JWT válido sem vínculo no Eixo não cria nada');
reset role;
select pg_temp.como_claims('{"role": "authenticated"}');
select is((select count(*) from nucleo.ativo), 0::bigint, 'token sem a claim sub não lê placas');
select is((select count(*) from config.status), 0::bigint, 'token sem a claim sub não lê catálogos');
select throws_ok($$insert into config.carroceria (nome) values ('Sem sub')$$, '42501', null, 'token sem a claim sub não cria nada');
reset role;
select pg_temp.como_claims(jsonb_build_object(
  'sub', pg_temp.id('estranho'), 'role', 'authenticated',
  'user_metadata', jsonb_build_object('perfil', 'administrador', 'escopo', 'tudo', 'papel', 'gestor_de_frota'),
  'app_metadata', jsonb_build_object('perfil', 'administrador')
));
select is((select count(*) from nucleo.ativo), 0::bigint, 'metadados forjados no token (perfil, escopo, papel) não dão acesso a placas');
select ok(not config.pode('frota', 'ver'), 'metadados forjados não dão permissão (config.pode lê a tabela, não o token)');
select is((select count(*) from nucleo.pessoa_documento), 0::bigint, 'metadados forjados não abrem o documento completo');
select throws_ok($$insert into config.carroceria (nome) values ('Forjado')$$, '42501', null, 'metadados forjados não deixam cadastrar');
reset role;

-- ---- perder o papel ou o vínculo tira o acesso na hora (sem sessão nova) ----
delete from nucleo.papel_da_pessoa where pessoa_id = pg_temp.id('pessoa_ga') and papel = 'gestor_de_frota';
select tests.como(pg_temp.id('ga'));
select is(
  (select count(*) from nucleo.ativo where id in (pg_temp.id('pa'), pg_temp.id('pc'))),
  0::bigint, 'o gestor sem o papel de gestor de frota deixa de ver a carteira na hora'
);
select is(pg_temp.alterar_chassi(pg_temp.id('pa'), 'SEM PAPEL'), 0, 'e não altera mais a placa');
select throws_ok(
  $$select nucleo.registrar_evento(pg_temp.id('pa'), 'DOp', '2026-03-01 00:00-03')$$,
  '42501', null, 'e não registra mais evento'
);
reset role;
update nucleo.usuario set ativo = false where pessoa_id = pg_temp.id('pessoa_gb');
select tests.como(pg_temp.id('gb'));
select is((select count(*) from nucleo.ativo where id = pg_temp.id('pb')), 0::bigint, 'o vínculo inativado tira a carteira na hora');
select is(pg_temp.alterar_chassi(pg_temp.id('pb'), 'INATIVO'), 0, 'e não altera mais a placa');
select throws_ok(
  $$select nucleo.registrar_evento(pg_temp.id('pb'), 'SMo', '2026-03-01 00:00-03')$$,
  '42501', null, 'e não registra mais evento'
);
reset role;

-- ---- vincular usuário (no Studio, como dono do banco) ----
select pg_temp.guardar('pessoa_nova', (select id from nucleo.pessoa where nome = 'estranho'));
select lives_ok(
  $$select nucleo.vincular_usuario('estranho@exemplo.local', pg_temp.id('pessoa_nova'), 'operacional')$$,
  'vincular_usuario liga o e-mail do Auth à Pessoa com o perfil'
);
select is(
  (select perfil from nucleo.usuario where pessoa_id = pg_temp.id('pessoa_nova')),
  'operacional', 'o vínculo fica com o perfil escolhido'
);
select throws_ok(
  $$select nucleo.vincular_usuario('ninguem@exemplo.local', pg_temp.id('pessoa_nova'), 'operacional')$$,
  'P0001', null, 'vincular com e-mail que não existe no Auth falha'
);
select tests.como(pg_temp.id('adm'));
select throws_ok(
  $$select nucleo.vincular_usuario('ga@exemplo.local', pg_temp.id('pessoa_ga'), 'administrador')$$,
  '42501', null, 'vincular_usuario não é executável pelo app (só no Studio)'
);
reset role;

-- ---- correção tardia de evento gera alerta ----
insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem)
  values (pg_temp.id('pb'), 'MAN', now() - interval '20 days', 'informada', 'manual');
update nucleo.evento_de_status set excluido_em = now(), motivo_da_exclusao = 'Lançado na placa errada'
 where ativo_id = pg_temp.id('pb') and sigla = 'MAN';
select ok(
  exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = pg_temp.id('pb') and alerta = 'correcao_tardia_de_status'),
  'excluir um evento muito depois do fato gera o alerta correcao_tardia_de_status'
);
insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem)
  values (pg_temp.id('pc'), 'MAN', now() - interval '1 day', 'informada', 'manual');
update nucleo.evento_de_status set excluido_em = now(), motivo_da_exclusao = 'Lançado errado'
 where ativo_id = pg_temp.id('pc') and sigla = 'MAN';
select ok(
  not exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = pg_temp.id('pc') and alerta = 'correcao_tardia_de_status'),
  'excluir dentro do prazo não gera alerta'
);

select * from finish();

rollback;
