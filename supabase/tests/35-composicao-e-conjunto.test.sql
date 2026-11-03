-- Fatia 3.4: composição (cavalo mestre, implementos servos, com posição), função do implemento
-- (semirreboque ou dolly), estrutura do conjunto pela regra da equipe (03/11/2026), nome do conjunto,
-- operação engatada e solta, meta do conjunto só no cavalo e a trava do tipo e da função.
--
-- Todos os ativos daqui nascem completos (posse e gestor), porque os testes de estrutura usam
-- `set constraints all immediate`, que confere tudo o que está pendente.
begin;

select plan(73);

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
  return p_ativo;
end;
$$;

create function pg_temp.cavalo(p_nome text, p_n bigint) returns void language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(p_n)) returning id into v;
  insert into ids values (p_nome, pg_temp.completar(v));
end;
$$;

create function pg_temp.semi(p_nome text, p_n bigint, p_carroceria text, p_eixos smallint) returns void language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.ativo (tipo, funcao, renavam, carroceria_id, eixos)
    values ('implemento', 'semirreboque', pg_temp.renavam(p_n),
            (select id from config.carroceria where nome = p_carroceria), p_eixos)
    returning id into v;
  insert into ids values (p_nome, pg_temp.completar(v));
end;
$$;

create function pg_temp.dolly(p_nome text, p_n bigint) returns void language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.ativo (tipo, funcao, renavam, eixos)
    values ('implemento', 'dolly', pg_temp.renavam(p_n), 2) returning id into v;
  insert into ids values (p_nome, pg_temp.completar(v));
end;
$$;

create function pg_temp.engatar(p_cavalo text, p_implemento text, p_posicao smallint, p_inicio timestamptz default '2026-02-01 00:00-03')
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

-- ---- estrutura ----
select has_table('nucleo', 'composicao', 'existe nucleo.composicao');
select has_table('nucleo', 'meta_do_conjunto', 'existe nucleo.meta_do_conjunto');
select enum_has_labels('nucleo', 'funcao_do_implemento', array['semirreboque', 'dolly'], 'as duas funções do implemento');
select has_function('nucleo', 'nome_do_conjunto', array['uuid', 'timestamp with time zone'], 'existe nucleo.nome_do_conjunto(cavalo, instante)');
select bag_eq(
  $$select codigo, unidades::int, com_dolly, eixos_dos_semirreboques::int[], eixos_do_dolly::int
      from config.configuracao_de_conjunto$$,
  $$values ('simples', 1, false, array[2, 3], null::int),
           ('bi', 2, false, array[2], null::int),
           ('bitrezao', 2, false, array[3], null::int),
           ('rodo', 3, true, array[2], 2)$$,
  'a regra da equipe (03/11/2026) está semeada: unidades, dolly, eixos dos semirreboques e do dolly'
);
select ok(
  (select count(*) from information_schema.columns
    where table_schema = 'config' and table_name = 'configuracao_de_conjunto'
      and column_name in ('referencia_normativa', 'conferencia', 'conferida_em', 'conferida_por')) = 4,
  'a configuração de conjunto tem a referência normativa e o estado da conferência'
);
select is(
  (select count(*) from config.configuracao_de_conjunto where conferencia <> 'a_conferir' or referencia_normativa is not null),
  0::bigint,
  'as quatro configurações nascem "a conferir", sem referência normativa (a regra é da equipe, não da norma)'
);
select throws_ok(
  $$update config.configuracao_de_conjunto set conferencia = 'conferida' where codigo = 'bi'$$,
  '23514', null, 'conferida exige a data e quem conferiu'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'nucleo.composicao'::regclass)
  and (select relrowsecurity from pg_class where oid = 'nucleo.meta_do_conjunto'::regclass),
  'composicao e meta_do_conjunto têm RLS ligado'
);

-- ---- pessoas, operações e CRs ----
insert into nucleo.pessoa (nome) values ('Ana');
insert into ids select 'ana', id from nucleo.pessoa where nome = 'Ana';
insert into nucleo.pessoa_documento (pessoa_id, documento) values (pg_temp.id('ana'), '529.982.247-25');
insert into nucleo.operacao (nome) values ('Grãos'), ('Cimento');
insert into nucleo.cr (codcencus, codigo, operacao_id) values
  (2001, 'CR-G', (select id from nucleo.operacao where nome = 'Grãos')),
  (2002, 'CR-C', (select id from nucleo.operacao where nome = 'Cimento'));

-- ---- função do implemento (cadastro) ----
select throws_ok(
  $$insert into nucleo.ativo (tipo, renavam, carroceria_id) values ('implemento', pg_temp.renavam(900), (select id from config.carroceria where nome = 'Sider'))$$,
  '23514', null, 'implemento sem função é recusado'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, funcao, renavam) values ('cavalo', 'semirreboque', pg_temp.renavam(901))$$,
  '23514', null, 'função em cavalo é recusada'
);
select lives_ok(
  $q$do $b$ declare v uuid; begin
      insert into nucleo.ativo (tipo, funcao, renavam, eixos) values ('implemento', 'dolly', pg_temp.renavam(902), 2) returning id into v;
      perform pg_temp.completar(v);
    end $b$$q$,
  'dolly sem carroceria e com 2 eixos passa'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, funcao, renavam, eixos, carroceria_id) values ('implemento', 'dolly', pg_temp.renavam(903), 2, (select id from config.carroceria where nome = 'Sider'))$$,
  '23514', null, 'dolly com carroceria é recusado'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, funcao, renavam, eixos) values ('implemento', 'semirreboque', pg_temp.renavam(904), 2)$$,
  '23514', null, 'semirreboque sem carroceria é recusado'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, funcao, renavam, eixos) values ('implemento', 'dolly', pg_temp.renavam(905), 3)$$,
  '23514', null, 'dolly com 3 eixos é recusado (o dolly tem 2)'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, funcao, renavam, eixos, carroceria_id) values ('implemento', 'semirreboque', pg_temp.renavam(906), 4, (select id from config.carroceria where nome = 'Sider'))$$,
  '23514', null, 'implemento com 4 eixos é recusado (os operados têm 2 ou 3)'
);
select lives_ok(
  $q$do $b$ declare v uuid; begin
      insert into nucleo.ativo (tipo, funcao, renavam, carroceria_id) values ('implemento', 'semirreboque', pg_temp.renavam(907), (select id from config.carroceria where nome = 'Sider')) returning id into v;
      perform pg_temp.completar(v);
    end $b$$q$,
  'semirreboque sem eixos informados passa (o nome do conjunto fica pendente)'
);

-- ---- os ativos dos conjuntos ----
select pg_temp.cavalo(c, n) from (values ('c1', 1), ('c2', 2), ('c3', 3), ('c4', 4), ('c5', 5), ('c6', 6), ('c7', 7), ('c8', 8), ('c9', 9), ('c10', 10)) as v (c, n);
select pg_temp.semi(s, n, carroceria, eixos::smallint) from (values
  ('g2a', 21, 'Graneleira', 2), ('g2b', 22, 'Graneleira', 2), ('g2c', 23, 'Graneleira', 2), ('g2d', 24, 'Graneleira', 2),
  ('g2e', 25, 'Graneleira', 2), ('g2f', 26, 'Graneleira', 2), ('g2g', 27, 'Graneleira', 2), ('g2h', 28, 'Graneleira', 2),
  ('g3a', 31, 'Graneleira', 3), ('g3b', 32, 'Graneleira', 3), ('g3c', 33, 'Graneleira', 3), ('g3d', 34, 'Graneleira', 3),
  ('g3e', 35, 'Graneleira', 3), ('s2a', 41, 'Sider', 2), ('s2b', 42, 'Sider', 2), ('p2a', 51, 'Prancha', 2), ('p2b', 52, 'Prancha', 2),
  ('gxa', 61, 'Graneleira', null)) as v (s, n, carroceria, eixos);
select pg_temp.dolly(d, n) from (values ('d1', 71), ('d2', 72)) as v (d, n);
select pg_temp.conferir();

-- ---- composição tipada ----
select throws_ok(
  $$insert into nucleo.composicao (cavalo_id, implemento_id, posicao, inicio, inicio_origem)
    values (pg_temp.id('c4'), pg_temp.id('c5'), 1, '2026-02-01 00:00-03', 'informada')$$,
  '23503', null, 'cavalo não é servo: só implemento entra na posição do implemento'
);
select throws_ok(
  $$insert into nucleo.composicao (cavalo_id, implemento_id, posicao, inicio, inicio_origem)
    values (pg_temp.id('g2e'), pg_temp.id('g2f'), 1, '2026-02-01 00:00-03', 'informada')$$,
  '23503', null, 'implemento não é mestre: só cavalo puxa'
);

-- ---- estrutura do conjunto (regra da equipe) ----
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c1', 'g2a', 1::smallint); perform pg_temp.engatar('c1', 'g2b', 2::smallint);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'bitrem: dois semirreboques de 2 eixos, engatados direto'
);
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c2', 'g3a', 1::smallint); perform pg_temp.engatar('c2', 'g3b', 2::smallint);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'bitrezão: dois semirreboques de 3 eixos, engatados direto'
);
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c3', 'g2c', 1::smallint); perform pg_temp.engatar('c3', 'd1', 2::smallint);
      perform pg_temp.engatar('c3', 'g2d', 3::smallint);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'rodotrem: semirreboque de 2 eixos, dolly de 2 e semirreboque de 2'
);
select throws_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c4', 'g2e', 1::smallint); perform pg_temp.engatar('c4', 'g3c', 2::smallint);
      set constraints all immediate;
    end $b$$q$,
  '23514', 'Os semirreboques do conjunto têm de ter o mesmo número de eixos.', 'semirreboques de eixos diferentes entre si são recusados'
);
select throws_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c4', 'g3d', 1::smallint); perform pg_temp.engatar('c4', 'd2', 2::smallint);
      perform pg_temp.engatar('c4', 'g3e', 3::smallint);
      set constraints all immediate;
    end $b$$q$,
  '23514', 'Esta estrutura não corresponde a nenhuma configuração de conjunto: o rodotrem só leva semirreboques de 2 eixos e dolly de 2.', 'rodo com semirreboques de 3 eixos é recusado (o rodotrem de 11 eixos não existe na TranSul)'
);
select throws_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c4', 'g2e', 1::smallint); perform pg_temp.engatar('c4', 'g2f', 2::smallint);
      perform pg_temp.engatar('c4', 'd2', 3::smallint);
      set constraints all immediate;
    end $b$$q$,
  '23514', 'O dolly só entra no rodotrem, entre dois semirreboques.', 'dolly na última posição é recusado (só entre dois semirreboques)'
);
select throws_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c4', 'd2', 1::smallint);
      set constraints all immediate;
    end $b$$q$,
  '23514', 'O dolly só entra no rodotrem, entre dois semirreboques.', 'dolly sozinho é recusado'
);
select throws_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c4', 'g2e', 1::smallint); perform pg_temp.engatar('c4', 'd2', 2::smallint);
      set constraints all immediate;
    end $b$$q$,
  '23514', 'O dolly só entra no rodotrem, entre dois semirreboques.', 'dolly com um só semirreboque é recusado'
);
select throws_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c4', 'g2e', 1::smallint); perform pg_temp.engatar('c4', 'g2f', 2::smallint);
      perform pg_temp.engatar('c4', 'g2g', 3::smallint);
      set constraints all immediate;
    end $b$$q$,
  '23514', 'Três semirreboques sem dolly não formam um conjunto operado pela TranSul.', 'três semirreboques sem dolly são recusados (treminhão e tritrem não são operados)'
);
select throws_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c4', 'g2e', 1::smallint); perform pg_temp.engatar('c4', 's2a', 2::smallint);
      set constraints all immediate;
    end $b$$q$,
  '23514', 'Conjunto misto não pode: os semirreboques têm de ter a mesma carroceria.', 'conjunto misto de carrocerias é recusado'
);
select throws_ok(
  $$select pg_temp.engatar('c4', 'g2e', 4::smallint)$$,
  '23514', null, 'não há quarta unidade: a posição vai de 1 a 3'
);
select throws_ok(
  $$select pg_temp.engatar('c4', 'g2e', 1::smallint), pg_temp.engatar('c4', 'g2f', 1::smallint)$$,
  '23P01', null, 'duas unidades na mesma posição do mesmo cavalo são recusadas'
);
select throws_ok(
  $$select pg_temp.engatar('c4', 'g2a', 1::smallint)$$,
  '23P01', null, 'implemento engatado não entra em outro cavalo ao mesmo tempo'
);
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c5', 'gxa', 1::smallint); perform pg_temp.engatar('c5', 'g2h', 2::smallint);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'semirreboque sem eixos informados não trava a composição (o nome fica pendente)'
);
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c6', 's2a', 1::smallint);
      perform pg_temp.engatar('c8', 'p2a', 1::smallint); perform pg_temp.engatar('c8', 'p2b', 2::smallint);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'simples Sider e bi Prancha passam'
);
select throws_ok(
  $q$do $b$ begin
      update nucleo.ativo set eixos = 3 where id = pg_temp.id('g2c');
      set constraints all immediate;
    end $b$$q$,
  '23514', 'Os semirreboques do conjunto têm de ter o mesmo número de eixos.', 'mudar os eixos de um semirreboque engatado para quebrar a regra é recusado'
);

-- ---- nome do conjunto ----
select is(nucleo.nome_do_conjunto(pg_temp.id('c1')), 'Bitrem', 'nome: Bitrem');
select is(nucleo.nome_do_conjunto(pg_temp.id('c2')), 'Bitrezão', 'nome: Bitrezão');
select is(nucleo.nome_do_conjunto(pg_temp.id('c3')), 'Rodotrem', 'nome: Rodotrem (o dolly conta como unidade)');
select is(nucleo.nome_do_conjunto(pg_temp.id('c6')), 'Sider', 'nome: simples Sider');
select is(nucleo.nome_do_conjunto(pg_temp.id('c8')), 'Prancha, 2 implementos', 'carroceria sem nome de conjunto: a carroceria e a quantidade de semirreboques');
select is(nucleo.nome_do_conjunto(pg_temp.id('c5')), 'pendente', 'semirreboque sem eixos informados: nome pendente, nunca presumido');
select is(nucleo.nome_do_conjunto(pg_temp.id('c7')), null, 'cavalo sem implemento não tem nome de conjunto');
select ok(
  exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = pg_temp.id('gxa') and alerta = 'implemento_sem_eixos')
  and not exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = pg_temp.id('g2h') and alerta = 'implemento_sem_eixos'),
  'implemento sem eixos informados gera o alerta implemento_sem_eixos'
);
update config.nomenclatura_de_conjunto set nome = 'Bitrem graneleiro'
 where configuracao = 'bi' and carroceria_id = (select id from config.carroceria where nome = 'Graneleira');
select is(nucleo.nome_do_conjunto(pg_temp.id('c1')), 'Bitrem graneleiro', 'renomear a nomenclatura muda o nome sem tocar na placa');

-- ---- operação: engatado, solto e nunca engatado ----
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values
  (pg_temp.id('c1'), (select id from nucleo.cr where codigo = 'CR-G'), '2026-01-10 00:00-03', 'informada'),
  (pg_temp.id('g2a'), (select id from nucleo.cr where codigo = 'CR-C'), '2026-01-10 00:00-03', 'informada'),
  (pg_temp.id('g3c'), (select id from nucleo.cr where codigo = 'CR-C'), '2026-01-10 00:00-03', 'informada');

select is(
  (select operacao_id from nucleo.operacao_do_ativo where ativo_id = pg_temp.id('g2a')),
  (select id from nucleo.operacao where nome = 'Grãos'),
  'engatado: a operação é a do cavalo'
);
select is(
  (select cr_id from nucleo.operacao_do_ativo where ativo_id = pg_temp.id('g2a')),
  (select id from nucleo.cr where codigo = 'CR-C'),
  'engatado: o CR continua o da própria placa (o custo não muda de CR)'
);
select is((select degrau from nucleo.operacao_do_ativo where ativo_id = pg_temp.id('g2a')), 'engatado', 'degrau engatado');

select lives_ok(
  $q$do $b$ begin
      update nucleo.composicao set fim = '2026-06-01 00:00-03', fim_origem = 'informada'
       where cavalo_id = pg_temp.id('c1') and fim is null;
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'desengatar o bitrem inteiro'
);
select is(
  (select operacao_na_saida_id from nucleo.composicao where implemento_id = pg_temp.id('g2a')),
  (select id from nucleo.operacao where nome = 'Grãos'),
  'ao desengatar, a operação do cavalo fica gravada na saída'
);
update nucleo.cr_do_ativo set fim = '2026-07-01 00:00-03', fim_origem = 'informada'
 where ativo_id = pg_temp.id('c1') and fim is null;
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
  values (pg_temp.id('c1'), (select id from nucleo.cr where codigo = 'CR-C'), '2026-07-01 00:00-03', 'informada');
select is(
  (select operacao_id from nucleo.operacao_do_ativo where ativo_id = pg_temp.id('g2a')),
  (select id from nucleo.operacao where nome = 'Grãos'),
  'solto: mantém a última operação, mesmo que o cavalo mude de CR depois'
);
select is((select degrau from nucleo.operacao_do_ativo where ativo_id = pg_temp.id('g2a')), 'solto', 'degrau solto');
select throws_ok(
  $$update nucleo.composicao set operacao_na_saida_id = (select id from nucleo.operacao where nome = 'Cimento')
     where implemento_id = pg_temp.id('g2a')$$,
  '23514', null, 'a operação na saída não aceita alteração'
);
select is(
  (select operacao_id from nucleo.operacao_do_ativo where ativo_id = pg_temp.id('g3c')),
  (select id from nucleo.operacao where nome = 'Cimento'),
  'nunca engatado: a operação do próprio CR'
);
select is((select degrau from nucleo.operacao_do_ativo where ativo_id = pg_temp.id('g3c')), 'proprio_cr', 'degrau próprio CR');
select is(nucleo.nome_do_conjunto(pg_temp.id('c1')), null, 'depois de desengatar, o cavalo fica sem nome de conjunto');
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('c9', 'g2a', 1::smallint, '2026-06-01 00:00-03');
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'desengatar e reengatar em outro cavalo no mesmo instante passa ([início, fim))'
);

-- ---- meta do conjunto: só no cavalo; o implemento herda pela composição ----
select lives_ok(
  $$insert into nucleo.meta_do_conjunto (cavalo_id, valor, inicio, inicio_origem)
    values (pg_temp.id('c2'), 1000.00, '2026-01-10 00:00-03', 'informada')$$,
  'meta no cavalo passa'
);
select throws_ok(
  $$insert into nucleo.meta_do_conjunto (cavalo_id, valor, inicio, inicio_origem)
    values (pg_temp.id('g3a'), 500.00, '2026-01-10 00:00-03', 'informada')$$,
  '23503', null, 'meta em implemento é recusada'
);
select throws_ok(
  $$insert into nucleo.meta_do_conjunto (cavalo_id, valor, inicio, inicio_origem)
    values (pg_temp.id('c2'), 800.00, '2026-03-01 00:00-03', 'informada')$$,
  '23P01', null, 'duas metas sobrepostas no mesmo cavalo são recusadas'
);
select is(nucleo.meta_do_conjunto_de(pg_temp.id('g3a')), 1000.00::numeric(15,2), 'o implemento engatado herda a meta do cavalo');
select is(nucleo.meta_do_conjunto_de(pg_temp.id('c2')), 1000.00::numeric(15,2), 'o cavalo tem a própria meta');
update nucleo.composicao set fim = '2026-06-01 00:00-03', fim_origem = 'informada'
 where cavalo_id = pg_temp.id('c2') and fim is null;
select is(nucleo.meta_do_conjunto_de(pg_temp.id('g3a')), null::numeric(15,2), 'ao sair do conjunto, o implemento perde a meta');

-- ---- trava do tipo e da função com vínculo vigente ----
select throws_ok(
  $$update nucleo.ativo set tipo = 'caminhao' where id = pg_temp.id('c10')$$,
  '23514', 'O tipo do ativo só muda pela função de mudança de tipo, com o motivo.', 'UPDATE direto do tipo é recusado (o tipo muda só pela função, com motivo)'
);
select throws_ok(
  $$select nucleo.mudar_tipo_do_ativo(pg_temp.id('c3'), 'caminhao', 'Cadastrado como cavalo por engano')$$,
  '23514', 'O tipo do ativo não muda enquanto ele estiver num conjunto: desengate antes.', 'o tipo não muda com composição vigente (como mestre)'
);
select throws_ok(
  $$select nucleo.mudar_tipo_do_ativo(pg_temp.id('c10'), 'caminhao', '   ')$$,
  '23514', null, 'mudar o tipo exige o motivo'
);
select lives_ok(
  $$select nucleo.mudar_tipo_do_ativo(pg_temp.id('c10'), 'caminhao', 'Cadastrado como cavalo por engano')$$,
  'sem composição, o tipo muda pela função com motivo (posse e gestor não dependem do tipo)'
);
select is((select tipo from nucleo.ativo where id = pg_temp.id('c10')), 'caminhao'::nucleo.tipo_de_ativo, 'o tipo mudou');
select ok(
  exists (select 1 from auditoria.evento
           where tabela = 'nucleo.ativo' and operacao = 'UPDATE' and registro_id = pg_temp.id('c10')::text
             and motivo = 'Cadastrado como cavalo por engano'),
  'a mudança de tipo fica na auditoria com o motivo'
);
select throws_ok(
  $$update nucleo.ativo set funcao = 'semirreboque', carroceria_id = (select id from config.carroceria where nome = 'Graneleira')
     where id = pg_temp.id('d1')$$,
  '23514', null, 'a função não muda com o implemento engatado'
);

-- ---- versão, auditoria e exclusão lógica ----
select throws_ok($$delete from nucleo.composicao$$, '23000', null, 'composição não se apaga de verdade');
select throws_ok($$delete from nucleo.meta_do_conjunto$$, '23000', null, 'meta não se apaga de verdade');
select ok(
  exists (select 1 from auditoria.evento where tabela = 'nucleo.composicao' and operacao = 'INSERT'),
  'a composição é auditada'
);
select lives_ok(
  $q$do $b$ begin
      update nucleo.composicao set excluido_em = now(), motivo_da_exclusao = 'Lançado no cavalo errado'
       where cavalo_id = pg_temp.id('c6');
      perform pg_temp.engatar('c7', 's2a', 1::smallint);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'composição excluída não bloqueia o implemento em outro cavalo'
);

select * from finish();

rollback;
