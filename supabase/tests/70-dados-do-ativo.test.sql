-- Fatia 3.7: os dados do ativo com origem por campo e as gravações atômicas.
--  * O Eixo é o dono de carroceria, eixos, tara, PBT, CMT, anos e valores: o valor vale no ativo, com a
--    origem de cada campo (sankhya, derivada, informada, correcao_local). O Sankhya é só sinal: o valor
--    dele fica em sinal_do_sankhya, entra no ativo só onde ninguém corrigiu, e a diferença vira relatório.
--  * Correção local com motivo (quem, quando, por quê); a próxima sincronização não a apaga; chave
--    (placa, RENAVAM, CPF, CNPJ, série, chassi) não aceita correção. Faltando dado, o campo fica pendente.
--  * Funções atômicas com chave de envio e versão: cadastrar o ativo (com CR e operação obrigatórios),
--    o "+" de CR (código do Sankhya obrigatório, nasce "a conferir") e entregar ao Operacional.
begin;
\ir apoio/como_usuario.psql

select plan(82);

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

create function pg_temp.pessoa(p_nome text, p_n bigint, p_perfil text) returns uuid language plpgsql as $$
declare
  v_pessoa uuid;
  v_auth uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_pessoa;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, pg_temp.cpf(p_n));
  insert into nucleo.papel_da_pessoa (pessoa_id, papel) values (v_pessoa, 'gestor_de_frota');
  if p_perfil is not null then
    v_auth := tests.criar_usuario(p_nome || '@exemplo.local');
    insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (v_pessoa, v_auth, p_perfil);
    perform pg_temp.guardar('auth_' || p_nome, v_auth);
  end if;
  return pg_temp.guardar(p_nome, v_pessoa);
end;
$$;

create function pg_temp.ativo(p_nome text, p_tipo nucleo.tipo_de_ativo, p_n bigint) returns uuid language plpgsql as $$
declare v uuid;
begin
  if p_tipo = 'implemento' then
    insert into nucleo.ativo (tipo, funcao, renavam, carroceria_id)
      values ('implemento', 'semirreboque', pg_temp.renavam(p_n), (select id from config.carroceria where nome = 'Graneleira'))
      returning id into v;
  else
    insert into nucleo.ativo (tipo, renavam) values (p_tipo, pg_temp.renavam(p_n)) returning id into v;
  end if;
  insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem) values (v, 'propria', '2026-01-10 00:00-03', 'informada');
  insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem) values (v, pg_temp.id('ga'), '2026-01-10 00:00-03', 'informada');
  insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem) values (v, 'PÁT', '2026-01-10 00:00-03', 'informada', 'manual');
  return pg_temp.guardar(p_nome, v);
end;
$$;

-- ---- estrutura ----
select has_table('nucleo', 'correcao_de_campo', 'existe a correção local por campo');
select has_table('nucleo', 'sinal_do_sankhya', 'existe o sinal do Sankhya por campo');
select has_table('nucleo', 'fila_de_excecoes', 'existe a fila de exceções');
select has_table('config', 'campo_corrigivel', 'existe a lista de campos corrigíveis');
select has_view('nucleo', 'divergencia_de_campo', 'existe o relatório de divergência');
select has_view('nucleo', 'campo_pendente', 'existe a lista de campos pendentes');
select has_function('nucleo', 'cadastrar_ativo', 'existe a função atômica de cadastro do ativo');
select enum_has_labels('config', 'origem_do_campo', array['sankhya', 'derivada', 'informada', 'correcao_local'], 'a origem do campo ganha a correção local');
select set_eq(
  $$select campo from config.campo_corrigivel$$,
  array['modelo_id', 'carroceria_id', 'eixos', 'tara_kg', 'pbt_kg', 'cmt_kg', 'ano_fabricacao', 'ano_modelo', 'valor_fipe', 'codigo_fipe', 'valor_manual'],
  'os campos corrigíveis são os do espelho em TypeScript (nenhuma chave)'
);

-- ---- dados ----
select pg_temp.pessoa('ga', 700000001, 'gestor_de_frota');
select pg_temp.pessoa('gb', 700000002, 'gestor_de_frota');
select pg_temp.pessoa('adm', 700000003, 'administrador');
select pg_temp.pessoa('opa', 700000004, 'operacional');
insert into nucleo.operacao (nome) values ('Grãos');
insert into config.filial (nome) values ('Filial A');
insert into nucleo.usuario_filial (usuario_id, filial_id) values (pg_temp.id('opa'), (select id from config.filial where nome = 'Filial A'));
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (7101, 'X1', true, true), (7102, 'X2', true, true), (7103, 'X3', true, true);
select pg_temp.ativo(n, t::nucleo.tipo_de_ativo, k) from (values
  ('k1', 'cavalo', 71), ('k2', 'cavalo', 72), ('i1', 'implemento', 73), ('a1', 'apoio', 74), ('cm1', 'caminhao', 75)) as v (n, t, k);
insert into nucleo.operacao (nome) values ('Arquivada');
update nucleo.operacao set excluido_em = now(), motivo_da_exclusao = 'Encerrada' where nome = 'Arquivada';
set constraints all immediate;
set constraints all deferred;

-- ---- os dados do ativo: kg inteiros, anos, valor FIPE ou manual, cada um com origem ----
select throws_ok($$update nucleo.ativo set tara_kg = 0 where id = pg_temp.id('k1')$$, '23514', null, 'massa em kg é maior que zero');
select lives_ok(
  $$update nucleo.ativo set tara_kg = 8500, pbt_kg = 23000, cmt_kg = 57000 where id = pg_temp.id('k1')$$,
  'tara, PBT e CMT em kg inteiros'
);
select is((select tara_kg_origem::text from nucleo.ativo where id = pg_temp.id('k1')), 'informada', 'a origem acompanha o valor (informada, quando ninguém disse outra)');
select throws_ok($$update nucleo.ativo set tara_kg = 30000 where id = pg_temp.id('k1')$$, '23514', null, 'a tara é menor que o PBT');
select throws_ok($$update nucleo.ativo set cmt_kg = 40000 where id = pg_temp.id('i1')$$, '23514', null, 'CMT só no cavalo e no caminhão');
select throws_ok(
  $$update nucleo.ativo set ano_fabricacao = 2022, ano_modelo = 2021 where id = pg_temp.id('k1')$$,
  '23514', null, 'o ano do modelo não é anterior ao de fabricação'
);
select throws_ok($$update nucleo.ativo set valor_fipe = 450000.00, valor_fipe_referencia = '2026-01-01' where id = pg_temp.id('i1')$$, '23514', null, 'valor FIPE só para cavalo e caminhão');
select throws_ok(
  $$update nucleo.ativo set valor_manual = 90000.00, valor_manual_fonte = 'Nota', valor_manual_em = '2026-01-10' where id = pg_temp.id('k1')$$,
  '23514', null, 'cavalo e caminhão usam o valor FIPE, não o manual'
);
select throws_ok($$update nucleo.ativo set valor_manual = 90000.00 where id = pg_temp.id('a1')$$, '23514', null, 'o valor manual exige a fonte e a data');
select lives_ok(
  $$update nucleo.ativo set valor_manual = 90000.00, valor_manual_fonte = 'Nota fiscal de compra', valor_manual_em = '2026-01-10' where id = pg_temp.id('a1')$$,
  'o valor manual do apoio, com fonte e data'
);
select ok(
  exists (select 1 from nucleo.campo_pendente where ativo_id = pg_temp.id('i1') and campo = 'eixos')
  and exists (select 1 from nucleo.campo_pendente where ativo_id = pg_temp.id('i1') and campo = 'tara_kg'),
  'faltando dado, o campo fica pendente (nunca presumido)'
);
select ok(
  not exists (select 1 from nucleo.campo_pendente where ativo_id = pg_temp.id('k1') and campo in ('tara_kg', 'pbt_kg', 'cmt_kg')),
  'informado, deixa de ser pendente'
);
select ok(
  exists (select 1 from nucleo.campo_pendente where ativo_id = pg_temp.id('cm1') and campo = 'carroceria_id'),
  'caminhão sem carroceria fica pendente'
);
select throws_ok($$update nucleo.ativo set codigo_fipe = '004278-1' where id = pg_temp.id('i1')$$, '23514', null, 'código FIPE só para cavalo e caminhão');
select throws_ok($$update nucleo.ativo set codigo_fipe = '4278' where id = pg_temp.id('k1')$$, '23514', null, 'código FIPE no formato 000000-0');
select lives_ok(
  $$update nucleo.ativo set valor_fipe = 450000.00, valor_fipe_referencia = '2026-10-01' where id = pg_temp.id('k1')$$,
  'o valor FIPE do cavalo, com o mês de referência'
);
select ok(
  exists (select 1 from nucleo.campo_pendente where ativo_id = pg_temp.id('k1') and campo = 'codigo_fipe')
  and not exists (select 1 from nucleo.campo_pendente where ativo_id = pg_temp.id('k2') and campo = 'codigo_fipe'),
  'com valor FIPE e sem o código, o código FIPE fica pendente (sem valor, não)'
);
select lives_ok($$update nucleo.ativo set codigo_fipe = '004278-1' where id = pg_temp.id('k1')$$, 'o código FIPE do cavalo');
select ok(
  (select codigo_fipe_origem = 'informada' from nucleo.ativo where id = pg_temp.id('k1'))
  and not exists (select 1 from nucleo.campo_pendente where ativo_id = pg_temp.id('k1') and campo = 'codigo_fipe'),
  'o código FIPE tem origem e deixa de ser pendente'
);

-- ---- o sinal do Sankhya e a correção local ----
select is(nucleo.receber_sinal_do_sankhya(pg_temp.id('i1'), 'eixos', to_jsonb(2), 'NUMEIXOS = 2'), 'aplicado', 'o sinal entra onde ninguém corrigiu');
select ok(
  (select eixos = 2 and eixos_origem = 'sankhya' from nucleo.ativo where id = pg_temp.id('i1')),
  'o valor vem do Sankhya, com a origem sankhya'
);
select tests.como(pg_temp.id('auth_ga'));
select throws_ok(
  $$update nucleo.ativo set eixos = 3 where id = pg_temp.id('i1')$$,
  '23514', 'O campo eixos veio do Sankhya: para mudar, registre uma correção local com o motivo.',
  'o valor do Sankhya não se edita direto'
);
select throws_ok(
  $$select nucleo.corrigir_campo(pg_temp.id('k1'), 'renavam', to_jsonb('00000000000'::text), 'Digitado errado')$$,
  '23514', 'O campo renavam não aceita correção local (é chave, ou não está entre os campos corrigíveis).',
  'chave não aceita correção local'
);
select throws_ok(
  $$select nucleo.corrigir_campo(pg_temp.id('i1'), 'eixos', to_jsonb(3), '  ')$$,
  '23514', 'A correção local exige o motivo.', 'a correção exige o motivo'
);
select lives_ok(
  $$select nucleo.corrigir_campo(pg_temp.id('i1'), 'eixos', to_jsonb(3), 'Conferido no pátio: 3 eixos')$$,
  'corrigir os eixos do implemento, com motivo'
);
select ok(
  (select eixos = 3 and eixos_origem = 'correcao_local' from nucleo.ativo where id = pg_temp.id('i1')),
  'o valor do ativo é o corrigido, com a origem correção local'
);
select ok(
  (select corrigido_por = pg_temp.id('ga') and motivo = 'Conferido no pátio: 3 eixos' and valor_anterior = to_jsonb(2)
     from nucleo.correcao_de_campo where ativo_id = pg_temp.id('i1') and campo = 'eixos' and revogada_em is null),
  'a correção guarda quem, quando, por quê e o valor anterior'
);
reset role;
select is(nucleo.receber_sinal_do_sankhya(pg_temp.id('i1'), 'eixos', to_jsonb(2), 'NUMEIXOS = 2'), 'mantido', 'a próxima sincronização mantém a correção');
select is((select eixos::int from nucleo.ativo where id = pg_temp.id('i1')), 3, 'e o valor continua o corrigido');
select ok(
  exists (select 1 from nucleo.divergencia_de_campo
           where ativo_id = pg_temp.id('i1') and campo = 'eixos' and valor_no_sankhya = to_jsonb(2) and valor_no_eixo = to_jsonb(3)),
  'a diferença entre o Sankhya e o Eixo vira relatório'
);
select throws_ok(
  $$update nucleo.ativo set eixos = 2, eixos_origem = 'sankhya' where id = pg_temp.id('i1')$$,
  '23514', null, 'nenhuma gravação direta apaga a correção (nem a do dono do banco)'
);
select throws_ok(
  $$insert into nucleo.correcao_de_campo (ativo_id, campo, valor_local, motivo) values (pg_temp.id('i1'), 'eixos', to_jsonb(2), 'Outra')$$,
  '23505', null, 'só uma correção ativa por campo'
);
select lives_ok(
  $$select nucleo.corrigir_campo(pg_temp.id('i1'), 'eixos', to_jsonb(3), 'Reconferido: 3 eixos')$$,
  'corrigir de novo substitui a correção anterior'
);
select is(
  (select count(*) from nucleo.correcao_de_campo where ativo_id = pg_temp.id('i1') and campo = 'eixos' and revogada_em is null),
  1::bigint, 'fica uma correção ativa (a anterior foi revogada)'
);
select lives_ok(
  $$select nucleo.revogar_correcao(
      (select id from nucleo.correcao_de_campo where ativo_id = pg_temp.id('i1') and campo = 'eixos' and revogada_em is null),
      'O Sankhya foi corrigido na origem')$$,
  'revogar a correção'
);
select ok(
  (select eixos = 2 and eixos_origem = 'sankhya' from nucleo.ativo where id = pg_temp.id('i1')),
  'revogada, o ativo volta ao valor do Sankhya'
);
select ok(
  not exists (select 1 from nucleo.divergencia_de_campo where ativo_id = pg_temp.id('i1') and campo = 'eixos'),
  'e a divergência some do relatório'
);
select ok(
  exists (select 1 from auditoria.evento where tabela = 'nucleo.correcao_de_campo' and operacao = 'INSERT'),
  'a correção fica na auditoria'
);

-- ---- cadastro atômico (ativo, placa, posse, gestor, evento inicial, CR e operação) ----
select tests.como(pg_temp.id('auth_ga'));
select lives_ok(
  $$select pg_temp.guardar('novo', nucleo.cadastrar_ativo(
      p_tipo => 'cavalo', p_renavam => pg_temp.renavam(80), p_placa => 'ABC1D23', p_gestor_id => pg_temp.id('ga'),
      p_cr_id => (select id from nucleo.cr where codigo = 'X1'), p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos'),
      p_chave => '11111111-1111-1111-1111-111111111111'))$$,
  'o gestor cadastra a placa na própria carteira, numa transação só'
);
select is((select count(*) from nucleo.ativo where id = pg_temp.id('novo')), 1::bigint, 'e enxerga a placa nova logo depois');
select is(
  nucleo.cadastrar_ativo(
    p_tipo => 'cavalo', p_renavam => pg_temp.renavam(80), p_placa => 'ABC1D23', p_gestor_id => pg_temp.id('ga'),
    p_cr_id => (select id from nucleo.cr where codigo = 'X1'), p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos'),
    p_chave => '11111111-1111-1111-1111-111111111111'),
  pg_temp.id('novo'), 'a mesma chave de envio devolve a placa já cadastrada (clique duplo não duplica)'
);
select throws_ok(
  $$select nucleo.cadastrar_ativo(
      p_tipo => 'cavalo', p_renavam => pg_temp.renavam(81), p_placa => 'ABC1D24', p_gestor_id => pg_temp.id('ga'),
      p_cr_id => (select id from nucleo.cr where codigo = 'X2'), p_operacao_id => null)$$,
  '23514', 'A operação é obrigatória no cadastro (se a placa está parada, use a operação "sem operação").',
  'a operação é obrigatória'
);
select throws_ok(
  $$select nucleo.cadastrar_ativo(
      p_tipo => 'cavalo', p_renavam => pg_temp.renavam(81), p_placa => 'ABC1D24', p_gestor_id => pg_temp.id('ga'),
      p_cr_id => null, p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos'))$$,
  '23514', 'O CR é obrigatório no cadastro (toda placa tem o seu CR).',
  'o CR é obrigatório'
);
select throws_ok(
  $$select nucleo.cadastrar_ativo(
      p_tipo => 'cavalo', p_renavam => pg_temp.renavam(81), p_placa => 'ABC1D24', p_gestor_id => pg_temp.id('ga'),
      p_cr_id => (select id from nucleo.cr where codigo = 'X2'), p_operacao_id => (select id from nucleo.operacao where nome = 'Arquivada'))$$,
  '23514', 'Escolha uma operação existente (a operação nova se cria no módulo Operações).',
  'o gestor escolhe uma operação existente, não arquivada'
);
select throws_ok(
  $$select nucleo.cadastrar_ativo(
      p_tipo => 'cavalo', p_renavam => pg_temp.renavam(81), p_placa => 'ABC1D24', p_gestor_id => pg_temp.id('gb'),
      p_cr_id => (select id from nucleo.cr where codigo = 'X2'), p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos'))$$,
  '42501', null, 'o gestor não cadastra placa na carteira de outro gestor'
);
select throws_ok(
  $$select nucleo.cadastrar_ativo(
      p_tipo => 'cavalo', p_renavam => pg_temp.renavam(82), p_placa => 'ABC1D25', p_gestor_id => pg_temp.id('ga'),
      p_cr_id => (select id from nucleo.cr where codigo = 'X3'), p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos'),
      p_situacao_inicial => 'ETc')$$,
  '23514', null, 'situação inicial inválida derruba o cadastro inteiro'
);
reset role;
select ok(
  exists (select 1 from nucleo.placa_do_ativo where ativo_id = pg_temp.id('novo') and placa = 'ABC1D23')
  and exists (select 1 from nucleo.posse_do_ativo where ativo_id = pg_temp.id('novo'))
  and exists (select 1 from nucleo.gestor_da_carteira where ativo_id = pg_temp.id('novo') and gestor_id = pg_temp.id('ga'))
  and exists (select 1 from nucleo.estado_de_status where ativo_id = pg_temp.id('novo') and sigla = 'PÁT')
  and exists (select 1 from nucleo.cr_do_ativo where ativo_id = pg_temp.id('novo') and cr_id = (select id from nucleo.cr where codigo = 'X1'))
  and exists (select 1 from nucleo.placa_na_operacao where ativo_id = pg_temp.id('novo') and montado_por = pg_temp.id('ga')),
  'o cadastro grava placa, posse, gestor, situação inicial, CR e operação juntos'
);
select is((select count(*) from nucleo.ativo where renavam = pg_temp.renavam(80)), 1::bigint, 'a chave repetida não duplicou a placa');
select is((select count(*) from nucleo.ativo where renavam = pg_temp.renavam(82)), 0::bigint, 'o cadastro que falhou não deixou nada pela metade');
select tests.como(pg_temp.id('auth_opa'));
select throws_ok(
  $$select nucleo.cadastrar_ativo(
      p_tipo => 'cavalo', p_renavam => pg_temp.renavam(83), p_placa => 'ABC1D26', p_gestor_id => pg_temp.id('ga'),
      p_cr_id => (select id from nucleo.cr where codigo = 'X3'), p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos'))$$,
  '42501', null, 'quem não cria na Frota não cadastra placa'
);
reset role;

-- ---- o "+" de CR: código do Sankhya obrigatório, nasce "a conferir" ----
select tests.como(pg_temp.id('auth_adm'));
select lives_ok(
  $$select pg_temp.guardar('crnovo', nucleo.criar_cr(7201, '07.201.001', 'CR novo', '22222222-2222-2222-2222-222222222222'))$$,
  'o "+" de CR cria o CR com o código do Sankhya'
);
select ok(
  (select conferencia = 'a_conferir' and codcencus = 7201 from nucleo.cr where id = pg_temp.id('crnovo')),
  'o CR do "+" nasce "a conferir"'
);
select is(
  nucleo.criar_cr(7201, '07.201.001', 'CR novo', '22222222-2222-2222-2222-222222222222'),
  pg_temp.id('crnovo'), 'a mesma chave de envio devolve o mesmo CR'
);
select throws_ok(
  $$select nucleo.criar_cr(null, '07.201.002', 'Sem código', null)$$,
  '23514', 'O código do Sankhya (CODCENCUS) é obrigatório: todo CR vem do Sankhya.',
  'o "+" de CR sem o código do Sankhya é recusado'
);
reset role;
select tests.como(pg_temp.id('auth_ga'));
select throws_ok($$select nucleo.criar_cr(7202, '07.202.001', 'Sem permissão', null)$$, '42501', null, 'quem não tem Cadastros não cria CR');
reset role;

-- ---- entregar ao Operacional: atômica, com versão e chave de envio ----
insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem) values (pg_temp.id('k2'), 'MAN', '2026-02-01 00:00-03', 'informada', 'manual');
select tests.como(pg_temp.id('auth_ga'));
select throws_ok(
  $$select nucleo.entregar_ao_operacional(pg_temp.id('k1'), (select id from config.filial where nome = 'Filial A'), now(),
      (select versao from nucleo.ativo where id = pg_temp.id('k1')) - 1)$$,
  '40001', 'Este registro mudou desde que você o abriu. Veja a versão atual e confira de novo.',
  'versão velha: o registro mudou'
);
select throws_ok(
  $$select nucleo.entregar_ao_operacional(pg_temp.id('i1'), (select id from config.filial where nome = 'Filial A'), now(),
      (select versao from nucleo.ativo where id = pg_temp.id('i1')))$$,
  '23514', 'Só cavalo ou caminhão podem ser entregues ao Operacional.', 'implemento não vai ao Operacional'
);
select throws_ok(
  $$select nucleo.entregar_ao_operacional(pg_temp.id('k2'), (select id from config.filial where nome = 'Filial A'), now(),
      (select versao from nucleo.ativo where id = pg_temp.id('k2')))$$,
  '23514', 'Só dá para entregar ao Operacional a placa em PÁT ou ETv.', 'fora de PÁT ou ETv não vai ao Operacional'
);
select lives_ok(
  $$select pg_temp.guardar('entrega', nucleo.entregar_ao_operacional(pg_temp.id('k1'), (select id from config.filial where nome = 'Filial A'), now(),
      (select versao from nucleo.ativo where id = pg_temp.id('k1')), '33333333-3333-3333-3333-333333333333'))$$,
  'entregar o cavalo em PÁT ao Operacional da filial'
);
select ok(
  nucleo.situacao_em(pg_temp.id('k1'), now()) = 'DOp'
  and exists (select 1 from nucleo.custodia where id = pg_temp.id('entrega') and com_quem = 'operacional' and fim is null),
  'a custódia vai ao Operacional e a situação vai a DOp, juntas'
);
select is(
  nucleo.entregar_ao_operacional(pg_temp.id('k1'), (select id from config.filial where nome = 'Filial A'), now(),
    1, '33333333-3333-3333-3333-333333333333'),
  pg_temp.id('entrega'), 'a mesma chave de envio devolve a mesma entrega (sem segundo DOp)'
);
reset role;

-- ---- quem corrige, quem vê e quem não grava direto ----
select tests.como(pg_temp.id('auth_gb'));
select throws_ok(
  $$select nucleo.corrigir_campo(pg_temp.id('k2'), 'tara_kg', to_jsonb(8400), 'Balança')$$,
  '42501', null, 'correcao_de_campo: o gestor B não corrige a placa do gestor A'
);
select is((select count(*) from nucleo.correcao_de_campo where ativo_id = pg_temp.id('i1')), 0::bigint, 'nem vê as correções dela');
select is((select count(*) from nucleo.sinal_do_sankhya where ativo_id = pg_temp.id('i1')), 0::bigint, 'sinal_do_sankhya: nem o sinal do Sankhya dela');
reset role;
select tests.como(pg_temp.id('auth_ga'));
select lives_ok(
  $$select nucleo.corrigir_campo(pg_temp.id('k2'), 'tara_kg', to_jsonb(8400), 'Pesado na balança')$$,
  'o gestor A corrige a própria placa'
);
select throws_ok(
  $$insert into nucleo.correcao_de_campo (ativo_id, campo, valor_local, motivo) values (pg_temp.id('k2'), 'pbt_kg', to_jsonb(20000), 'Direto')$$,
  '42501', null, 'a correção só entra pela função (sem gravação direta)'
);
select throws_ok(
  $$select nucleo.receber_sinal_do_sankhya(pg_temp.id('k2'), 'eixos', to_jsonb(3), 'NUMEIXOS = 3')$$,
  '42501', null, 'o sinal do Sankhya só entra pelos workers'
);
select is((select count(*) from nucleo.fila_de_excecoes), 0::bigint, 'fila_de_excecoes: o gestor não vê a fila');
reset role;
insert into nucleo.fila_de_excecoes (ativo_id, campo, descricao) values (pg_temp.id('i1'), 'eixos', 'Modelo "SR 3E1ED": eixos ambíguos');
select tests.como(pg_temp.id('auth_ga'));
update nucleo.fila_de_excecoes set resolvida_em = now(), resolucao = 'Tentativa do gestor';
reset role;
select is((select count(*) from nucleo.fila_de_excecoes where resolvida_em is not null), 0::bigint, 'fila_de_excecoes_alterar: o gestor não resolve a fila');
select tests.como(pg_temp.id('auth_adm'));
select is((select count(*) from nucleo.fila_de_excecoes), 1::bigint, 'quem edita Cadastros vê a fila de exceções');
select lives_ok(
  $$update nucleo.fila_de_excecoes set resolvida_em = now(), resolucao = 'Conferido na placa: 3 eixos'$$,
  'e resolve, com a resolução escrita'
);
select is((select count(*) from config.campo_corrigivel), 11::bigint, 'campo_corrigivel: todo usuário vinculado lê a lista');
reset role;
select is((select count(*) from nucleo.fila_de_excecoes where resolvida_em is not null), 1::bigint, 'a exceção ficou resolvida');

select * from finish();

rollback;
