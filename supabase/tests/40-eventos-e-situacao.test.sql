-- Fatia 3.5: eventos de status por camada, vigência do estado de cada camada, situação calculada,
-- herança no conjunto, desatrelar e engatar, baixa com evento e a trava do tipo pela situação.
--
-- Todos os ativos nascem completos (posse, gestor e o evento inicial PÁT), porque os testes usam
-- `set constraints all immediate`, que confere tudo o que está pendente.
begin;

select plan(64);

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

create function pg_temp.id(p_nome text) returns uuid language sql as $$
  select id from ids where nome = p_nome
$$;

create function pg_temp.completar(p_ativo uuid) returns uuid language plpgsql as $$
begin
  insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem)
    values (p_ativo, 'propria', '2026-01-10 00:00-03', 'informada');
  insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
    values (p_ativo, pg_temp.id('ana'), '2026-01-10 00:00-03', 'informada');
  insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem)
    values (p_ativo, 'PÁT', '2026-01-10 00:00-03', 'informada', 'manual');
  return p_ativo;
end;
$$;

create function pg_temp.ativo(p_nome text, p_tipo nucleo.tipo_de_ativo, p_n bigint) returns void language plpgsql as $$
declare v uuid;
begin
  if p_tipo = 'implemento' then
    insert into nucleo.ativo (tipo, funcao, renavam, carroceria_id, eixos)
      values ('implemento', 'semirreboque', pg_temp.renavam(p_n),
              (select id from config.carroceria where nome = 'Graneleira'), 2)
      returning id into v;
  else
    insert into nucleo.ativo (tipo, renavam) values (p_tipo, pg_temp.renavam(p_n)) returning id into v;
  end if;
  insert into ids values (p_nome, pg_temp.completar(v));
end;
$$;

create function pg_temp.ev(p_nome text, p_sigla text, p_em timestamptz) returns uuid language sql as $$
  select nucleo.registrar_evento(pg_temp.id(p_nome), p_sigla, p_em)
$$;

create function pg_temp.encerrar(p_nome text, p_camada text, p_em timestamptz) returns uuid language sql as $$
  select nucleo.registrar_evento(pg_temp.id(p_nome), null, p_em, p_camada => p_camada)
$$;

create function pg_temp.engatar_cru(p_cavalo text, p_implemento text, p_posicao smallint, p_inicio timestamptz)
returns void language plpgsql as $$
begin
  insert into nucleo.composicao (cavalo_id, implemento_id, posicao, inicio, inicio_origem)
    values (pg_temp.id(p_cavalo), pg_temp.id(p_implemento), p_posicao, p_inicio, 'informada');
end;
$$;

create function pg_temp.conferir() returns void language plpgsql as $$
begin
  set constraints all immediate;
  set constraints all deferred;
end;
$$;

insert into nucleo.pessoa (nome) values ('Ana');
insert into ids select 'ana', id from nucleo.pessoa where nome = 'Ana';
insert into nucleo.pessoa_documento (pessoa_id, documento) values (pg_temp.id('ana'), '529.982.247-25');
insert into nucleo.papel_da_pessoa (pessoa_id, papel) values (pg_temp.id('ana'), 'gestor_de_frota');
insert into nucleo.operacao (nome) values ('Grãos');
insert into nucleo.cr (codcencus, codigo, operacao_id) values (3001, 'CR-G', (select id from nucleo.operacao where nome = 'Grãos'));

-- ---- estrutura ----
select has_table('nucleo', 'evento_de_status', 'existe nucleo.evento_de_status');
select has_table('nucleo', 'estado_de_status', 'existe nucleo.estado_de_status');
select has_function('nucleo', 'situacao_em', array['uuid', 'timestamp with time zone'], 'existe nucleo.situacao_em(ativo, instante)');
select has_function('nucleo', 'situacao_atual', array['uuid'], 'existe nucleo.situacao_atual(ativo)');
select has_function('nucleo', 'situacao_do_conjunto', array['uuid', 'timestamp with time zone'], 'existe nucleo.situacao_do_conjunto(cavalo, instante)');
select ok(
  (select relrowsecurity from pg_class where oid = 'nucleo.evento_de_status'::regclass)
  and (select relrowsecurity from pg_class where oid = 'nucleo.estado_de_status'::regclass),
  'evento_de_status e estado_de_status têm RLS ligado'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'nucleo.estado_de_status'::regclass and contype = 'x'),
  'o estado de cada camada tem restrição de exclusão contra sobreposição'
);

-- ---- cadastro: o ativo nunca fica sem situação ----
select throws_ok(
  $q$do $b$ declare v uuid; begin
      insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(999)) returning id into v;
      insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem) values (v, 'propria', '2026-01-10 00:00-03', 'informada');
      insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem) values (v, pg_temp.id('ana'), '2026-01-10 00:00-03', 'informada');
      set constraints all immediate;
    end $b$$q$,
  '23514', 'O ativo precisa da situação inicial (evento de status) na mesma transação do cadastro.',
  'ativo sem o evento inicial não passa no fim da transação'
);
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.ativo(n, t::nucleo.tipo_de_ativo, k) from (values
        ('c1', 'cavalo', 1), ('c2', 'cavalo', 2), ('c3', 'cavalo', 3), ('c4', 'cavalo', 4), ('c5', 'cavalo', 5),
        ('c6', 'cavalo', 6), ('c7', 'cavalo', 7), ('c8', 'cavalo', 8), ('c9', 'cavalo', 9),
        ('i2', 'implemento', 12), ('i4', 'implemento', 14), ('i5', 'implemento', 15), ('i6', 'implemento', 16),
        ('i7', 'implemento', 17), ('i8', 'implemento', 18), ('i9', 'implemento', 19), ('i10', 'implemento', 20),
        ('i11', 'implemento', 21), ('i12', 'implemento', 22),
        ('k1', 'caminhao', 31), ('a1', 'apoio', 41)) as v (n, t, k);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'ativos com posse, gestor e o evento inicial passam'
);
select is(nucleo.situacao_em(pg_temp.id('c1'), '2026-01-15 00:00-03'), 'PÁT', 'a situação inicial é PÁT');

-- ---- validade da sigla: tipo e conjunto ou solo ----
select pg_temp.engatar_cru('c2', 'i2', 1::smallint, '2026-02-01 00:00-03');
select throws_ok(
  $$select pg_temp.ev('i6', 'SMo', '2026-02-05 00:00-03')$$,
  '23514', 'A situação SMo não vale para implemento.', 'sigla fora dos tipos válidos é recusada'
);
select throws_ok(
  $$select pg_temp.ev('c3', 'ACe', '2026-02-05 00:00-03')$$,
  '23514', 'A situação ACe só vale para conjunto (cavalo com implemento engatado).', 'sigla de conjunto em cavalo sozinho é recusada'
);
select throws_ok(
  $$select pg_temp.ev('c2', 'MAN', '2026-02-05 00:00-03')$$,
  '23514', 'A situação MAN só vale fora de conjunto.', 'sigla de solo em cavalo engatado é recusada'
);
select lives_ok($$select pg_temp.ev('k1', 'ACe', '2026-02-05 00:00-03')$$, 'caminhão vale só pelos tipos (nunca tem composição)');
select throws_ok(
  $$select pg_temp.ev('i6', 'VAz', '2026-02-05 00:00-03')$$,
  '23514', 'A situação VAz não vale para implemento.', 'VAz fica no rascunho: só cavalo e caminhão'
);
select throws_ok(
  $$select pg_temp.ev('a1', 'SMo', '2026-02-05 00:00-03')$$,
  '23514', 'A situação SMo não vale para apoio.', 'o apoio perde o SMo'
);
select lives_ok($$select pg_temp.ev('c2', 'SDo', '2026-02-05 00:00-03')$$, 'sigla de "ambos" vale em conjunto');

-- ---- camadas: um estado por vez, com vigência [início, fim) ----
select lives_ok($$select pg_temp.ev('c3', 'DOp', '2026-02-10 00:00-03')$$, 'evento novo troca o estado da camada');
select is(
  (select fim from nucleo.estado_de_status where ativo_id = pg_temp.id('c3') and sigla = 'PÁT' and excluido_em is null),
  '2026-02-10 00:00-03'::timestamptz,
  'o estado anterior termina no instante do evento novo'
);
select is(
  (select count(*) from nucleo.estado_de_status where ativo_id = pg_temp.id('c3') and camada = 'atividade' and fim is null and excluido_em is null),
  1::bigint,
  'um só estado aberto por camada'
);
select throws_ok(
  $$select pg_temp.ev('c3', 'ETv', '2026-02-09 00:00-03')$$,
  '23514', null, 'evento anterior ao último da camada é recusado (correção é outro caminho)'
);
select throws_ok(
  $$select pg_temp.ev('c3', 'ETv', '2026-02-10 00:00-03')$$,
  '23514', null, 'dois eventos no mesmo instante da mesma camada são recusados'
);
select lives_ok($$select pg_temp.encerrar('c3', 'atividade', '2026-02-12 00:00-03')$$, 'evento sem sigla encerra a camada');
select is(nucleo.situacao_em(pg_temp.id('c3'), '2026-02-13 00:00-03'), 'pendente', 'sem estado em nenhuma camada, a situação é pendente (nunca presumida)');
select throws_ok(
  $$select pg_temp.encerrar('c3', 'atividade', '2026-02-14 00:00-03')$$,
  '23514', null, 'encerrar uma camada sem estado aberto é recusado'
);
select throws_ok(
  $$insert into nucleo.estado_de_status (ativo_id, camada, sigla, inicio, inicio_origem)
    values (pg_temp.id('c3'), 'atividade', 'ETv', '2026-03-01 00:00-03', 'informada')$$,
  '23514', null, 'o estado só se grava pelo evento'
);

-- ---- evento imutável: correção é exclusão lógica do último, com motivo ----
select throws_ok(
  $$update nucleo.evento_de_status set sigla = 'ETv' where ativo_id = pg_temp.id('c3') and sigla = 'DOp'$$,
  '23514', null, 'evento não se altera'
);
select throws_ok(
  $$update nucleo.evento_de_status set excluido_em = now()
     where ativo_id = pg_temp.id('c3') and camada = 'atividade' and sigla is null$$,
  '23514', null, 'excluir evento exige o motivo'
);
select lives_ok(
  $$update nucleo.evento_de_status set excluido_em = now(), motivo_da_exclusao = 'Encerrado por engano'
     where ativo_id = pg_temp.id('c3') and camada = 'atividade' and sigla is null$$,
  'excluir o último evento da camada, com motivo, desfaz o efeito dele'
);
select is(nucleo.situacao_em(pg_temp.id('c3'), '2026-02-13 00:00-03'), 'DOp', 'o estado anterior volta a ficar aberto');
select throws_ok(
  $$update nucleo.evento_de_status set excluido_em = now(), motivo_da_exclusao = 'Teste'
     where ativo_id = pg_temp.id('c3') and sigla = 'PÁT'$$,
  '23514', null, 'só o último evento da camada pode ser excluído'
);

-- ---- prioridade das camadas ----
select pg_temp.ev('c1', 'SMo', '2026-03-01 00:00-03');
select is(nucleo.situacao_em(pg_temp.id('c1'), '2026-03-02 00:00-03'), 'SMo', 'sem motorista vence atividade');
select pg_temp.ev('c1', 'MAN', '2026-03-05 00:00-03');
select is(nucleo.situacao_em(pg_temp.id('c1'), '2026-03-06 00:00-03'), 'MAN', 'impedida vence sem motorista');
select pg_temp.ev('c1', 'VEN', '2026-03-10 00:00-03');
select is(nucleo.situacao_em(pg_temp.id('c1'), '2026-03-11 00:00-03'), 'VEN', 'fora da frota vence impedida');
select is(nucleo.situacao_em(pg_temp.id('c1'), '2026-03-03 00:00-03'), 'SMo', 'a situação de um instante passado vem dos estados daquele instante');

-- ---- herança no conjunto (calculada, nunca gravada) ----
select pg_temp.engatar_cru('c4', 'i4', 1::smallint, '2026-04-01 00:00-03');
select pg_temp.engatar_cru('c4', 'i5', 2::smallint, '2026-04-01 00:00-03');
select pg_temp.conferir();
select pg_temp.ev('c4', 'ETc', '2026-04-02 00:00-03');
select is(nucleo.situacao_em(pg_temp.id('i4'), '2026-04-03 00:00-03'), 'ETc', 'implemento engatado herda a atividade do cavalo');
select pg_temp.ev('c4', 'FEr', '2026-04-04 00:00-03');
select ok(
  nucleo.situacao_em(pg_temp.id('c4'), '2026-04-05 00:00-03') = 'FEr'
  and nucleo.situacao_em(pg_temp.id('i4'), '2026-04-05 00:00-03') = 'ETc',
  'o implemento não herda o sem motorista do cavalo (FEr fica no cavalo)'
);
select pg_temp.ev('i5', 'MAc', '2026-04-06 00:00-03');
select is(nucleo.situacao_em(pg_temp.id('c4'), '2026-04-07 00:00-03'), 'MAc', 'manutenção de implemento engatado deixa o conjunto impedido');
select is(
  (select causa_id from nucleo.situacao_do_conjunto(pg_temp.id('c4'), '2026-04-07 00:00-03')),
  pg_temp.id('i5'),
  'a situação do conjunto aponta o implemento como causa'
);
select is(nucleo.situacao_em(pg_temp.id('i4'), '2026-04-07 00:00-03'), 'MAc', 'o outro implemento do conjunto também fica impedido');
select ok(
  exists (select 1 from nucleo.composicao where implemento_id = pg_temp.id('i5') and fim is null and excluido_em is null),
  'o banco nunca desengata sozinho: a composição continua aberta'
);
select pg_temp.encerrar('i5', 'impedida', '2026-04-08 00:00-03');
select pg_temp.ev('i5', 'SDo', '2026-04-09 00:00-03');
select is(nucleo.situacao_em(pg_temp.id('c4'), '2026-04-10 00:00-03'), 'SDo', 'SDo de implemento engatado deixa o conjunto impedido');
select pg_temp.encerrar('i5', 'impedida', '2026-04-11 00:00-03');
select pg_temp.ev('i5', 'DOC', '2026-04-12 00:00-03');
select is(nucleo.situacao_em(pg_temp.id('c4'), '2026-04-13 00:00-03'), 'DOC', 'DOC de implemento engatado deixa o conjunto impedido');
select pg_temp.encerrar('i5', 'impedida', '2026-04-13 12:00-03');
select pg_temp.ev('c4', 'MAc', '2026-04-14 00:00-03');
select is(nucleo.situacao_em(pg_temp.id('i4'), '2026-04-15 00:00-03'), 'MAc', 'cavalo impedido deixa o conjunto impedido');
select pg_temp.ev('i7', 'MAN', '2026-02-01 00:00-03');
select pg_temp.engatar_cru('c5', 'i7', 1::smallint, '2026-04-01 00:00-03');
select pg_temp.conferir();
select is(nucleo.situacao_em(pg_temp.id('c5'), '2026-04-02 00:00-03'), 'MAN', 'implemento em MAN engatado deixa o conjunto impedido');

-- ---- engatar e desatrelar (funções atômicas) ----
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
  values (pg_temp.id('c6'), (select id from nucleo.cr where codigo = 'CR-G'), '2026-01-10 00:00-03', 'informada');
select lives_ok(
  $q$do $b$ begin
      perform nucleo.engatar(pg_temp.id('c6'), pg_temp.id('i8'), 1::smallint, '2026-05-01 00:00-03');
      perform nucleo.engatar(pg_temp.id('c6'), pg_temp.id('i9'), 2::smallint, '2026-05-01 00:00-03');
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'engatar dois semirreboques'
);
select is(
  (select fim from nucleo.estado_de_status where ativo_id = pg_temp.id('i8') and sigla = 'PÁT' and excluido_em is null),
  '2026-05-01 00:00-03'::timestamptz,
  'engatar encerra a atividade própria do implemento (ele passa a herdar a do cavalo)'
);
select pg_temp.ev('c6', 'ETc', '2026-05-02 00:00-03');
select throws_ok(
  $$select nucleo.desatrelar(pg_temp.id('c6'), '2026-05-03 00:00-03')$$,
  '23514', 'A situação ETc do cavalo exige conjunto: mude a situação do cavalo antes de desatrelar o último implemento.',
  'desatrelar o último implemento com o cavalo em situação de conjunto é recusado'
);
select pg_temp.ev('c6', 'ETv', '2026-05-04 00:00-03');
select lives_ok(
  $q$do $b$ begin
      perform nucleo.desatrelar(pg_temp.id('c6'), '2026-05-05 00:00-03');
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'desatrelar fecha a composição'
);
select is(
  (select count(*) from nucleo.composicao where cavalo_id = pg_temp.id('c6') and operacao_na_saida_id is not null),
  2::bigint,
  'desatrelar grava a operação na saída de cada implemento'
);
select is(nucleo.situacao_em(pg_temp.id('i8'), '2026-05-06 00:00-03'), 'PÁT', 'o implemento solto volta ao pátio');
select is(nucleo.situacao_em(pg_temp.id('c6'), '2026-05-06 00:00-03'), 'ETv', 'o cavalo fica com a própria atividade');

-- ---- baixa: a baixa e o evento da camada baixada andam juntos ----
select lives_ok(
  $q$do $b$ begin
      perform nucleo.registrar_baixa(pg_temp.id('i10'), 'VND', '2026-05-10 00:00-03', 'Vendido para terceiro');
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'registrar a baixa fecha posse e gestor e grava a baixa e o evento juntos'
);
select is(nucleo.situacao_em(pg_temp.id('i10'), '2026-05-11 00:00-03'), 'VND', 'baixada vence todas as camadas');
select ok(
  exists (select 1 from nucleo.baixa_do_ativo where ativo_id = pg_temp.id('i10') and sigla = 'VND')
  and exists (select 1 from nucleo.evento_de_status where ativo_id = pg_temp.id('i10') and camada = 'baixada' and sigla = 'VND'),
  'a baixa e o evento existem'
);
select throws_ok(
  $$select nucleo.engatar(pg_temp.id('c9'), pg_temp.id('i10'), 1::smallint, '2026-05-12 00:00-03')$$,
  '23514', 'Ativo baixado não entra em conjunto.', 'engatar implemento baixado é recusado'
);
select pg_temp.ev('i11', 'VEN', '2026-05-11 00:00-03');
select throws_ok(
  $$select nucleo.engatar(pg_temp.id('c9'), pg_temp.id('i11'), 1::smallint, '2026-05-12 00:00-03')$$,
  '23514', 'O implemento está em VEN (fora da frota): ele não entra em conjunto.',
  'engatar implemento fora da frota (VEN) é recusado'
);
select pg_temp.ev('i12', 'ALU', '2026-05-11 00:00-03');
select throws_ok(
  $$select nucleo.engatar(pg_temp.id('c9'), pg_temp.id('i12'), 1::smallint, '2026-05-12 00:00-03')$$,
  '23514', 'O implemento está em ALU (fora da frota): ele não entra em conjunto.',
  'engatar implemento alugado a terceiro (ALU) é recusado'
);
select throws_ok(
  $$select pg_temp.ev('c7', 'SUC', '2026-05-10 00:00-03')$$,
  '23514', null, 'evento da camada baixada sem a baixa é recusado'
);
select throws_ok(
  $q$do $b$ begin
      update nucleo.posse_do_ativo set fim = '2026-05-10 00:00-03', fim_origem = 'informada' where ativo_id = pg_temp.id('c7');
      update nucleo.gestor_da_carteira set fim = '2026-05-10 00:00-03', fim_origem = 'informada' where ativo_id = pg_temp.id('c7');
      insert into nucleo.baixa_do_ativo (ativo_id, sigla, em) values (pg_temp.id('c7'), 'SUC', '2026-05-10 00:00-03');
      set constraints all immediate;
    end $b$$q$,
  '23514', 'A baixa precisa do evento da camada baixada (SUC) no mesmo instante.', 'baixa sem o evento é recusada no fim da transação'
);

-- ---- trava do tipo pela situação ----
select pg_temp.ev('c8', 'SMo', '2026-06-01 00:00-03');
select throws_ok(
  $$select nucleo.mudar_tipo_do_ativo(pg_temp.id('c8'), 'apoio', 'Cadastrado errado')$$,
  '23514', 'A situação SMo vigente não vale para apoio: encerre-a antes de mudar o tipo.',
  'o tipo não muda se há situação vigente que o tipo novo não aceita'
);
select lives_ok(
  $$select nucleo.mudar_tipo_do_ativo(pg_temp.id('c9'), 'apoio', 'Cadastrado errado')$$,
  'com só PÁT vigente (vale para todos), o tipo muda'
);

-- ---- situação atual e o espelho ----
select is(nucleo.situacao_atual(pg_temp.id('c1')), 'VEN', 'situacao_atual é a situação de agora');
select is(
  (select md5(string_agg(s.sigla || '|' || t.tipo || '|' || c.ctx, ',' order by s.sigla || '|' || t.tipo || '|' || c.ctx collate "C"))
     from config.status s
     cross join unnest(enum_range(null::nucleo.tipo_de_ativo)) as t (tipo)
     cross join (values ('solo'), ('conjunto')) as c (ctx)
    where nucleo.sigla_valida(s.sigla, t.tipo, c.ctx = 'conjunto')),
  '6f838f3c16c75615ab050c9493d0efc9',
  'a validade (sigla × tipo × contexto) do banco é a mesma do espelho em TypeScript (mesma assinatura)'
);

select * from finish();

rollback;
