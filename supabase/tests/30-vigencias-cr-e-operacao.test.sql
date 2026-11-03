-- Fatia 3.3: vigências (posse, gestor da carteira, CR do ativo, custódia), transferência, CR e operação.
-- Tudo com o dono do banco: o que se prova aqui são as regras de dados. A RLS por filial é provada em
-- 40-escopo-do-operacional-por-filial.test.sql, sempre com a chave do usuário.
--
-- Atenção à ordem: `set constraints all immediate` confere TODOS os ativos tocados até ali. Por isso as
-- regras de buraco vêm primeiro (só ativos completos) e os testes genéricos de sobreposição, que usam
-- ativos sem posse nem gestor de propósito, vêm por último.
begin;

select plan(91);

create temp table ids (nome text primary key, id uuid not null);

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

create function pg_temp.nova_pessoa(p_nome text, p_documento text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_id;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_id, p_documento);
  return v_id;
end;
$$;

-- Confere agora tudo o que está pendente e volta ao modo adiado.
create function pg_temp.conferir() returns void language plpgsql as $$
begin
  set constraints all immediate;
  set constraints all deferred;
end;
$$;

-- Um ativo completo: posse própria e gestor Ana, os dois desde 10/01/2026 e em aberto.
create function pg_temp.ativo_completo(p_n bigint) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(p_n)) returning id into v_id;
  insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem)
    values (v_id, 'propria', '2026-01-10 00:00-03', 'informada');
  insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
    values (v_id, (select id from ids where nome = 'ana'), '2026-01-10 00:00-03', 'informada');
  return v_id;
end;
$$;

-- Um ativo sem nada (só para os testes genéricos de sobreposição, no fim do arquivo).
create function pg_temp.ativo_nu(p_n bigint) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(p_n)) returning id into v_id;
  return v_id;
end;
$$;

-- Insere uma vigência numa das quatro tabelas, com a coluna própria de cada uma.
create function pg_temp.vig(p_tabela text, p_ativo uuid, p_inicio timestamptz, p_fim timestamptz default null)
returns void language plpgsql as $$
declare
  v_fim_origem text := case when p_fim is null then 'null' else '''informada''' end;
begin
  execute format(
    case p_tabela
      when 'posse_do_ativo' then
        'insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, fim, inicio_origem, fim_origem) values (%L, ''propria'', %L, %L, ''informada'', %s)'
      when 'gestor_da_carteira' then
        'insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, fim, inicio_origem, fim_origem) values (%L, (select id from ids where nome = ''ana''), %L, %L, ''informada'', %s)'
      when 'cr_do_ativo' then
        'insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, fim, inicio_origem, fim_origem) values (%L, (select id from nucleo.cr where codigo = ''CR-A''), %L, %L, ''informada'', %s)'
      when 'custodia' then
        'insert into nucleo.custodia (ativo_id, com_quem, inicio, fim, inicio_origem, fim_origem) values (%L, ''gestor'', %L, %L, ''informada'', %s)'
    end,
    p_ativo, p_inicio, p_fim, v_fim_origem
  );
end;
$$;

-- ---- estrutura ----
select has_table('nucleo', 'operacao', 'existe nucleo.operacao');
select has_table('nucleo', 'cr', 'existe nucleo.cr');
select has_table('nucleo', 'cr_do_ativo', 'existe nucleo.cr_do_ativo');
select has_table('nucleo', 'posse_do_ativo', 'existe nucleo.posse_do_ativo');
select has_table('nucleo', 'gestor_da_carteira', 'existe nucleo.gestor_da_carteira');
select has_table('nucleo', 'custodia', 'existe nucleo.custodia');
select has_table('nucleo', 'transferencia', 'existe nucleo.transferencia');
select has_table('nucleo', 'baixa_do_ativo', 'existe nucleo.baixa_do_ativo');
select has_view('nucleo', 'operacao_do_ativo', 'existe a visão nucleo.operacao_do_ativo');
select has_view('nucleo', 'alerta_de_vinculo', 'existe a visão nucleo.alerta_de_vinculo');
select enum_has_labels(
  'nucleo',
  'regime_de_posse',
  array['propria', 'acionista', 'agregado', 'terceiro', 'alugada'],
  'os cinco regimes de posse'
);

-- ---- pessoas, operação, CR e filial de apoio ----
insert into ids select 'ana', pg_temp.nova_pessoa('Ana', '529.982.247-25');
insert into ids select 'bia', pg_temp.nova_pessoa('Bia', '11144477735');
insert into ids select 'acme', pg_temp.nova_pessoa('Acme', '11.222.333/0001-81');
insert into nucleo.operacao (nome) values ('Grãos'), ('Cimento');
insert into nucleo.cr (codcencus, codigo, nome, operacao_id) values
  (1001, 'CR-A', 'Centro A', (select id from nucleo.operacao where nome = 'Grãos')),
  (1002, 'CR-B', 'Centro B', (select id from nucleo.operacao where nome = 'Cimento')),
  (1003, 'CR-S', 'Centro sem operação', null);
insert into config.filial (nome) values ('Filial A'), ('Filial B');

-- ---- CR: chave do Sankhya e código de exibição livre ----
select throws_ok(
  $$insert into nucleo.cr (codcencus, codigo) values (1001, 'OUTRO')$$,
  '23505', null, 'o CODCENCUS do Sankhya é único'
);
select throws_ok(
  $$insert into nucleo.cr (codcencus, codigo) values (1999, 'CR-A')$$,
  '23505', null, 'o código de exibição do CR é único'
);
select lives_ok(
  $$insert into nucleo.cr (codigo) values ('formato livre 9/Z')$$,
  'o código de exibição não tem formato imposto (fim do CR-0000), e o CODCENCUS pode faltar até a ponte'
);
select lives_ok(
  $$insert into nucleo.cr (codcencus, codigo, operacao_id) values (1004, 'CR-N', null)$$,
  'o CR pode não ter operação (vira alerta, não erro)'
);

-- ---- cadastro do ativo: posse e gestor juntos ----
select throws_ok(
  $q$do $b$ begin
      insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(101));
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'ativo sem posse nem gestor não passa no fim da transação'
);
select throws_ok(
  $q$do $b$ declare v uuid; begin
      insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(102)) returning id into v;
      insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem) values (v, 'propria', '2026-01-10 00:00-03', 'informada');
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'ativo com posse e sem gestor não passa'
);
select throws_ok(
  $q$do $b$ declare v uuid; begin
      insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(103)) returning id into v;
      insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
        values (v, (select id from ids where nome = 'ana'), '2026-01-10 00:00-03', 'informada');
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'ativo com gestor e sem posse não passa'
);
insert into ids select 'cav1', pg_temp.ativo_completo(1);
insert into ids select 'cav2', pg_temp.ativo_completo(2);
insert into ids select 'cav3', pg_temp.ativo_completo(3);
select lives_ok($$select pg_temp.conferir()$$, 'ativo com posse e gestor criados juntos passa');

-- ---- buraco proibido em posse e em gestor da carteira ----
select throws_ok(
  $q$do $b$ begin
      update nucleo.posse_do_ativo set fim = '2026-02-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav1');
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'fechar a posse sem sucessora e sem baixa falha (placa sem dono)'
);
select throws_ok(
  $q$do $b$ begin
      update nucleo.gestor_da_carteira set fim = '2026-02-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav1');
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'fechar o gestor sem sucessor e sem baixa falha (placa sem responsável)'
);
select throws_ok(
  $q$do $b$ begin
      update nucleo.posse_do_ativo set fim = '2026-02-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav1');
      insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem)
        values ((select id from ids where nome = 'cav1'), 'agregado', '2026-02-11 00:00-03', 'informada');
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'buraco entre duas posses falha'
);
select throws_ok(
  $q$do $b$ begin
      update nucleo.gestor_da_carteira set fim = '2026-02-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav1');
      insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
        values ((select id from ids where nome = 'cav1'), (select id from ids where nome = 'bia'), '2026-02-11 00:00-03', 'informada');
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'buraco entre dois gestores falha'
);
select lives_ok(
  $q$do $b$ begin
      update nucleo.posse_do_ativo set fim = '2026-02-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav1');
      insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem)
        values ((select id from ids where nome = 'cav1'), 'agregado', '2026-02-10 00:00-03', 'informada');
      set constraints all immediate;
      set constraints all deferred;
    end $b$$q$,
  'posse sucessora que começa exatamente no fim da anterior passa'
);
select lives_ok(
  $q$do $b$ begin
      update nucleo.gestor_da_carteira set fim = '2026-02-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav1');
      insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
        values ((select id from ids where nome = 'cav1'), (select id from ids where nome = 'bia'), '2026-02-10 00:00-03', 'informada');
      set constraints all immediate;
      set constraints all deferred;
    end $b$$q$,
  'gestor sucessor que começa exatamente no fim do anterior passa'
);

-- ---- baixa: só aí se fecha sem sucessora ----
select throws_ok(
  $$insert into nucleo.baixa_do_ativo (ativo_id, sigla, em) values ((select id from ids where nome = 'cav2'), 'ETc', '2026-03-10 00:00-03')$$,
  '23514', null, 'só VND ou SUC são baixa'
);
select lives_ok(
  $q$do $b$ begin
      update nucleo.posse_do_ativo set fim = '2026-03-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav2');
      update nucleo.gestor_da_carteira set fim = '2026-03-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav2');
      insert into nucleo.baixa_do_ativo (ativo_id, sigla, em) values ((select id from ids where nome = 'cav2'), 'VND', '2026-03-10 00:00-03');
      set constraints all immediate;
      set constraints all deferred;
    end $b$$q$,
  'posse e gestor se fecham sem sucessora junto da baixa (VND) na mesma transação'
);
select throws_ok(
  $q$do $b$ begin
      update nucleo.posse_do_ativo set fim = '2026-03-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav3');
      update nucleo.gestor_da_carteira set fim = '2026-03-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav3');
      insert into nucleo.baixa_do_ativo (ativo_id, sigla, em) values ((select id from ids where nome = 'cav3'), 'SUC', '2026-03-11 00:00-03');
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'a baixa em instante diferente do fim da vigência não vale'
);
select throws_ok(
  $q$do $b$ begin
      update nucleo.posse_do_ativo set fim = '2026-03-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav3');
      update nucleo.gestor_da_carteira set fim = '2026-03-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'cav3');
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'fechar posse e gestor sem a baixa na mesma transação falha'
);

-- ---- origem de cada data ----
select lives_ok(
  $q$do $b$ declare v uuid := pg_temp.ativo_completo(10); begin
      update nucleo.posse_do_ativo set fim = '2026-04-10 00:00-03', fim_origem = 'derivada' where ativo_id = v;
      insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem) values (v, 'terceiro', '2026-04-10 00:00-03', 'observada');
      set constraints all immediate;
      set constraints all deferred;
    end $b$$q$,
  'as três origens (derivada, observada, informada) são aceitas na data'
);
select throws_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, fim, inicio_origem)
    values ((select id from ids where nome = 'cav1'), (select id from nucleo.cr where codigo = 'CR-A'), '2026-01-10 00:00-03', '2026-02-10 00:00-03', 'informada')$$,
  '23514', null, 'fim sem origem é recusado'
);
select throws_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
    values ((select id from ids where nome = 'cav1'), (select id from nucleo.cr where codigo = 'CR-A'), '2026-01-10 00:00-03', 'chutada')$$,
  '22P02', null, 'origem fora das três é recusada'
);
select throws_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, fim, inicio_origem, fim_origem)
    values ((select id from ids where nome = 'cav1'), (select id from nucleo.cr where codigo = 'CR-A'), '2026-02-10 00:00-03', '2026-02-10 00:00-03', 'informada', 'informada')$$,
  '23514', null, 'vigência de duração zero (fim igual ao início) é recusada'
);


-- ---- regime da posse ----
select throws_ok(
  $$insert into nucleo.posse_do_ativo (ativo_id, regime, pessoa_dona_id, inicio, inicio_origem)
    values (pg_temp.ativo_nu(110), 'propria', (select id from ids where nome = 'acme'), '2026-01-10 00:00-03', 'informada')$$,
  '23514', null, 'posse própria não tem pessoa dona'
);

-- ---- correção de data vale na hora, com motivo ----
insert into ids select 'cav20', pg_temp.ativo_completo(20);
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
  values ((select id from ids where nome = 'cav20'), (select id from nucleo.cr where codigo = 'CR-A'), '2026-01-10 00:00-03', 'informada');
select pg_temp.conferir();

select throws_ok(
  $$update nucleo.cr_do_ativo set inicio = '2026-01-09 00:00-03' where ativo_id = (select id from ids where nome = 'cav20')$$,
  '23514', null, 'corrigir o início de uma vigência sem informar o motivo falha'
);
select lives_ok(
  $$update nucleo.cr_do_ativo set fim = '2026-02-10 00:00-03', fim_origem = 'informada'
     where ativo_id = (select id from ids where nome = 'cav20')$$,
  'fechar uma vigência em aberto não é correção e dispensa motivo'
);
select throws_ok(
  $$update nucleo.cr_do_ativo set fim = '2026-02-11 00:00-03' where ativo_id = (select id from ids where nome = 'cav20')$$,
  '23514', null, 'corrigir o fim já registrado sem informar o motivo falha'
);
select lives_ok(
  $q$do $b$ begin
      perform set_config('eixo.motivo', 'Início lançado um dia depois da entrega', true);
      update nucleo.cr_do_ativo set inicio = '2026-01-09 00:00-03' where ativo_id = (select id from ids where nome = 'cav20');
      perform set_config('eixo.motivo', '', true);
    end $b$$q$,
  'com o motivo, a correção vale na hora'
);
select ok(
  exists (
    select 1 from auditoria.evento
     where tabela = 'nucleo.cr_do_ativo' and operacao = 'UPDATE'
       and motivo = 'Início lançado um dia depois da entrega'
  ),
  'o motivo da correção fica na auditoria'
);

-- ---- transferência de gestor ----
insert into ids select 'cav30', pg_temp.ativo_completo(30);
insert into ids select 'cav31', pg_temp.ativo_completo(31);
select pg_temp.conferir();

select lives_ok(
  $$insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo)
    values ((select id from ids where nome = 'cav30'), (select id from ids where nome = 'ana'), (select id from ids where nome = 'bia'), 'Troca de carteira')$$,
  'pedido de transferência pendente'
);
select throws_ok(
  $$insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo)
    values ((select id from ids where nome = 'cav30'), (select id from ids where nome = 'ana'), (select id from ids where nome = 'bia'), 'De novo')$$,
  '23505', null, 'só um pedido pendente por ativo'
);
select throws_ok(
  $$insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo)
    values ((select id from ids where nome = 'cav31'), (select id from ids where nome = 'ana'), (select id from ids where nome = 'ana'), 'Mesmo gestor')$$,
  '23514', null, 'de e para têm de ser gestores diferentes'
);
select lives_ok(
  $$select nucleo.receber_transferencia(
      (select id from nucleo.transferencia where ativo_id = (select id from ids where nome = 'cav30') and situacao = 'pendente'),
      '2026-05-01 00:00-03')$$,
  'receber a placa registra a chegada e abre a conferência'
);
select is(
  (select gestor_id from nucleo.gestor_da_carteira
    where ativo_id = (select id from ids where nome = 'cav30') and fim is null),
  (select id from ids where nome = 'ana'),
  'receber não troca o gestor (a troca é na conclusão)'
);
select is(
  (select situacao from nucleo.transferencia where ativo_id = (select id from ids where nome = 'cav30')),
  'em_conferencia',
  'o pedido fica em conferência'
);
select throws_ok(
  $$insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo)
    values ((select id from ids where nome = 'cav30'), (select id from ids where nome = 'ana'), (select id from ids where nome = 'bia'), 'Outro durante a conferência')$$,
  '23505', null, 'pedido em conferência ainda está aberto: não cabe outro para o mesmo ativo'
);
select throws_ok(
  $$select nucleo.receber_transferencia(
      (select id from nucleo.transferencia where ativo_id = (select id from ids where nome = 'cav30')),
      '2026-05-02 00:00-03')$$,
  'P0001', null, 'receber de novo um pedido já recebido falha'
);
select lives_ok(
  $$select nucleo.concluir_transferencia(
      (select id from nucleo.transferencia where ativo_id = (select id from ids where nome = 'cav30') and situacao = 'em_conferencia'),
      '2026-05-02 00:00-03')$$,
  'concluir fecha o gestor antigo e abre o novo na mesma transação'
);
select is(
  (select fim from nucleo.gestor_da_carteira
    where ativo_id = (select id from ids where nome = 'cav30') and gestor_id = (select id from ids where nome = 'ana')),
  '2026-05-02 00:00-03'::timestamptz,
  'o gestor antigo termina no instante da conclusão'
);
select is(
  (select gestor_id from nucleo.gestor_da_carteira
    where ativo_id = (select id from ids where nome = 'cav30') and fim is null),
  (select id from ids where nome = 'bia'),
  'o novo gestor começa no mesmo instante, em aberto'
);
select is(
  (select situacao from nucleo.transferencia where ativo_id = (select id from ids where nome = 'cav30')),
  'concluida',
  'o pedido fica concluído'
);
select lives_ok($$select pg_temp.conferir()$$, 'depois da conclusão o gestor segue sem buraco');
select throws_ok(
  $$select nucleo.concluir_transferencia(
      (select id from nucleo.transferencia where ativo_id = (select id from ids where nome = 'cav30')),
      '2026-05-03 00:00-03')$$,
  'P0001', null, 'concluir de novo um pedido já concluído falha'
);
select lives_ok(
  $$insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo)
    values ((select id from ids where nome = 'cav30'), (select id from ids where nome = 'bia'), (select id from ids where nome = 'ana'), 'Volta')$$,
  'depois de concluído, pode haver novo pedido'
);
select lives_ok(
  $$insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo)
    values ((select id from ids where nome = 'cav31'), (select id from ids where nome = 'bia'), (select id from ids where nome = 'ana'), 'Pedido de quem não é o gestor')$$,
  'o pedido pode ser aberto por qualquer um (a conferência é no recebimento)'
);
select throws_ok(
  $$select nucleo.receber_transferencia(
      (select id from nucleo.transferencia where ativo_id = (select id from ids where nome = 'cav31') and situacao = 'pendente'),
      '2026-05-01 00:00-03')$$,
  'P0001', null, 'receber falha se o gestor vigente não é o gestor de origem do pedido'
);

-- ---- operação do ativo e alertas ----
insert into ids select 'cav40', pg_temp.ativo_completo(40);
insert into ids select 'cav41', pg_temp.ativo_completo(41);
insert into ids select 'cav42', pg_temp.ativo_completo(42);
insert into ids select 'cav43', pg_temp.ativo_completo(43);
insert into ids select 'cav44', pg_temp.ativo_completo(44);
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values
  ((select id from ids where nome = 'cav40'), (select id from nucleo.cr where codigo = 'CR-A'), now() - interval '60 days', 'informada'),
  ((select id from ids where nome = 'cav42'), (select id from nucleo.cr where codigo = 'CR-S'), now() - interval '60 days', 'informada'),
  ((select id from ids where nome = 'cav44'), (select id from nucleo.cr where codigo = 'CR-A'), now() - interval '60 days', 'informada');
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, fim, inicio_origem, fim_origem) values
  ((select id from ids where nome = 'cav43'), (select id from nucleo.cr where codigo = 'CR-A'), now() - interval '60 days', now() - interval '40 days', 'informada', 'informada');
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values
  ((select id from ids where nome = 'cav43'), (select id from nucleo.cr where codigo = 'CR-B'), now() - interval '20 days', 'informada');
insert into nucleo.custodia (ativo_id, com_quem, inicio, fim, inicio_origem, fim_origem) values
  ((select id from ids where nome = 'cav44'), 'gestor', now() - interval '60 days', now() - interval '40 days', 'informada', 'informada');
insert into nucleo.custodia (ativo_id, com_quem, inicio, inicio_origem) values
  ((select id from ids where nome = 'cav44'), 'gestor', now() - interval '20 days', 'informada');
select pg_temp.conferir();

select is(
  (select operacao_id from nucleo.operacao_do_ativo where ativo_id = (select id from ids where nome = 'cav40')),
  (select id from nucleo.operacao where nome = 'Grãos'),
  'a operação do ativo vem do CR vigente'
);
select is(
  (select operacao_id from nucleo.operacao_do_ativo where ativo_id = (select id from ids where nome = 'cav41')),
  null::uuid,
  'ativo sem CR vigente fica sem operação'
);
select is(
  (select operacao_id from nucleo.operacao_do_ativo where ativo_id = (select id from ids where nome = 'cav42')),
  null::uuid,
  'ativo cujo CR vigente não tem operação fica sem operação'
);
select is(
  (select operacao_id from nucleo.operacao_do_ativo where ativo_id = (select id from ids where nome = 'cav43')),
  (select id from nucleo.operacao where nome = 'Cimento'),
  'trocar o CR do ativo troca a operação (vale o CR vigente, não o antigo)'
);
select ok(
  not exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = (select id from ids where nome = 'cav40')),
  'ativo com CR e operação não tem alerta'
);
select ok(
  exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = (select id from ids where nome = 'cav41') and alerta = 'sem_cr'),
  'ativo sem CR vigente gera o alerta sem_cr'
);
select ok(
  exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = (select id from ids where nome = 'cav42') and alerta = 'cr_sem_operacao'),
  'CR vigente sem operação gera o alerta cr_sem_operacao'
);
select ok(
  exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = (select id from ids where nome = 'cav43') and alerta = 'buraco_em_cr')
  and not exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = (select id from ids where nome = 'cav43') and alerta = 'sem_cr'),
  'buraco entre dois CRs é aceito e vira o alerta buraco_em_cr'
);
select ok(
  exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = (select id from ids where nome = 'cav44') and alerta = 'buraco_em_custodia'),
  'buraco entre duas custódias é aceito e vira o alerta buraco_em_custodia'
);
select ok(
  not exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = (select id from ids where nome = 'cav2')),
  'ativo baixado (VND) não gera alerta de CR'
);

-- ---- versão, auditoria e exclusão lógica ----
update nucleo.cr set nome = 'Centro A (renomeado)' where codigo = 'CR-A';
select is((select versao from nucleo.cr where codigo = 'CR-A'), 2, 'a versão do CR sobe a cada mudança');
select ok(
  exists (select 1 from auditoria.evento where tabela = 'nucleo.posse_do_ativo' and operacao = 'INSERT'),
  'a posse é auditada'
);
select throws_ok($$delete from nucleo.posse_do_ativo$$, '23000', null, 'posse não se apaga de verdade');
select throws_ok($$delete from nucleo.cr$$, '23000', null, 'CR não se apaga de verdade');
select throws_ok($$delete from nucleo.baixa_do_ativo$$, '23000', null, 'baixa não se apaga de verdade');

-- ---- limites [início, fim) em cada tabela de vigência (ativos sem posse nem gestor, de propósito) ----
select throws_ok(
  format($f$do $b$ declare v uuid := pg_temp.ativo_nu(%s); begin
      perform pg_temp.vig(%L, v, '2026-01-10 00:00-03', '2026-03-10 00:00-03');
      perform pg_temp.vig(%L, v, '2026-02-10 00:00-03', '2026-04-10 00:00-03');
    end $b$$f$, n, tab, tab),
  '23P01', null, tab || ': vigência que se sobrepõe é recusada'
) from (values ('posse_do_ativo', 200), ('gestor_da_carteira', 210), ('cr_do_ativo', 220), ('custodia', 230)) as t (tab, n);

select lives_ok(
  format($f$do $b$ declare v uuid := pg_temp.ativo_nu(%s); begin
      perform pg_temp.vig(%L, v, '2026-01-10 00:00-03', '2026-02-10 00:00-03');
      perform pg_temp.vig(%L, v, '2026-02-10 00:00-03', '2026-03-10 00:00-03');
    end $b$$f$, n, tab, tab),
  tab || ': vigência consecutiva passa (o fim de uma não conta: fim = início da outra)'
) from (values ('posse_do_ativo', 201), ('gestor_da_carteira', 211), ('cr_do_ativo', 221), ('custodia', 231)) as t (tab, n);

select throws_ok(
  format($f$do $b$ declare v uuid := pg_temp.ativo_nu(%s); begin
      perform pg_temp.vig(%L, v, '2026-01-10 00:00-03');
      perform pg_temp.vig(%L, v, '2026-02-10 00:00-03');
    end $b$$f$, n, tab, tab),
  '23P01', null, tab || ': duas vigências em aberto são recusadas'
) from (values ('posse_do_ativo', 202), ('gestor_da_carteira', 212), ('cr_do_ativo', 222), ('custodia', 232)) as t (tab, n);

select lives_ok(
  format($f$do $b$ declare v uuid := pg_temp.ativo_nu(%s); begin
      perform pg_temp.vig(%L, v, '2026-01-10 00:00-03', '2026-03-10 00:00-03');
      execute format('update nucleo.%%I set excluido_em = now() where ativo_id = %%L', %L, v);
      perform pg_temp.vig(%L, v, '2026-02-10 00:00-03', '2026-04-10 00:00-03');
    end $b$$f$, n, tab, tab, tab),
  tab || ': vigência excluída não bloqueia outra no mesmo período'
) from (values ('posse_do_ativo', 203), ('gestor_da_carteira', 213), ('cr_do_ativo', 223), ('custodia', 233)) as t (tab, n);

select lives_ok(
  $$insert into nucleo.posse_do_ativo (ativo_id, regime, pessoa_dona_id, inicio, inicio_origem)
    values (pg_temp.ativo_nu(240), 'acionista', (select id from ids where nome = 'acme'), '2026-01-10 00:00-03', 'informada')$$,
  'posse de acionista com a pessoa dona passa'
);
select lives_ok(
  $$insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem)
    values (pg_temp.ativo_nu(241), 'agregado', '2026-01-10 00:00-03', 'informada')$$,
  'a pessoa dona é opcional fora da posse própria (a importação pode não saber)'
);
select throws_ok(
  $$insert into nucleo.custodia (ativo_id, com_quem, inicio, inicio_origem)
    values (pg_temp.ativo_nu(242), 'operacional', '2026-01-10 00:00-03', 'informada')$$,
  '23514', null, 'custódia do Operacional exige a filial'
);
select throws_ok(
  $$insert into nucleo.custodia (ativo_id, com_quem, filial_id, inicio, inicio_origem)
    values (pg_temp.ativo_nu(243), 'gestor', (select id from config.filial where nome = 'Filial A'), '2026-01-10 00:00-03', 'informada')$$,
  '23514', null, 'custódia com o gestor não tem filial'
);

select * from finish();

rollback;
