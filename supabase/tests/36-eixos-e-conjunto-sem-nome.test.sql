-- Ajuste 3.4b (Alexandre, 04/11/2026): o implemento tem de 1 a 6 eixos por placa, e o conjunto cuja
-- estrutura não bate com nenhuma configuração conhecida deixa de ser recusado: fica "sem nome
-- definido" e gera o alerta conjunto_sem_nome. Continuam recusados: semirreboques de eixos diferentes,
-- dolly fora do meio, mais de três unidades e conjunto misto.
begin;

select plan(20);

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

create function pg_temp.cavalo(p_nome text, p_n bigint) returns void language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(p_n)) returning id into v;
  insert into ids values (p_nome, pg_temp.completar(v));
end;
$$;

create function pg_temp.semi(p_nome text, p_n bigint, p_eixos smallint) returns void language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.ativo (tipo, funcao, renavam, carroceria_id, eixos)
    values ('implemento', 'semirreboque', pg_temp.renavam(p_n),
            (select id from config.carroceria where nome = 'Graneleira'), p_eixos)
    returning id into v;
  insert into ids values (p_nome, pg_temp.completar(v));
end;
$$;

create function pg_temp.dolly(p_nome text, p_n bigint, p_eixos smallint) returns void language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.ativo (tipo, funcao, renavam, eixos)
    values ('implemento', 'dolly', pg_temp.renavam(p_n), p_eixos) returning id into v;
  insert into ids values (p_nome, pg_temp.completar(v));
end;
$$;

create function pg_temp.engatar(p_cavalo text, p_implemento text, p_posicao smallint) returns void language plpgsql as $$
begin
  insert into nucleo.composicao (cavalo_id, implemento_id, posicao, inicio, inicio_origem)
    values (pg_temp.id(p_cavalo), pg_temp.id(p_implemento), p_posicao, '2026-02-01 00:00-03', 'informada');
end;
$$;

insert into nucleo.pessoa (nome) values ('Ana');
insert into ids select 'ana', id from nucleo.pessoa where nome = 'Ana';
insert into nucleo.pessoa_documento (pessoa_id, documento) values (pg_temp.id('ana'), '529.982.247-25');

-- ---- eixos do implemento: de 1 a 6 ----
select lives_ok($$select pg_temp.semi('e1', 801, 1::smallint)$$, 'implemento de 1 eixo passa');
select lives_ok($$select pg_temp.semi('e4a', 804, 4::smallint)$$, 'implemento de 4 eixos passa (ex.: SR/LIBRELATO SRCA 4E)');
select lives_ok($$select pg_temp.semi('e5', 805, 5::smallint)$$, 'implemento de 5 eixos passa');
select lives_ok($$select pg_temp.semi('e6', 806, 6::smallint)$$, 'implemento de 6 eixos passa');
select throws_ok($$select pg_temp.semi('e7', 807, 7::smallint)$$, '23514', null, 'implemento de 7 eixos é recusado');

select pg_temp.semi('e4b', 808, 4::smallint);
select pg_temp.semi('e4c', 809, 4::smallint);
select pg_temp.semi('t3a', 831, 3::smallint);
select pg_temp.semi('t3b', 832, 3::smallint);
select pg_temp.semi('t2a', 821, 2::smallint);
select pg_temp.semi('t2b', 822, 2::smallint);
select pg_temp.dolly('d2', 841, 2::smallint);
select pg_temp.dolly('d3', 842, 3::smallint);
select pg_temp.cavalo(c, n) from (values ('k1', 851), ('k2', 852), ('k3', 853), ('k4', 854), ('k5', 855), ('k6', 856), ('k7', 857), ('k8', 858)) as v (c, n);
set constraints all immediate;
set constraints all deferred;

-- ---- estrutura sem configuração conhecida: sem nome definido, com alerta ----
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('k1', 'e4a', 1::smallint); perform pg_temp.engatar('k1', 'e4b', 2::smallint);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'bi de semirreboques de 4 eixos não é recusado'
);
select is(nucleo.nome_do_conjunto(pg_temp.id('k1')), 'sem nome definido', 'bi de 4 eixos fica "sem nome definido"');
select ok(
  exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = pg_temp.id('k1') and alerta = 'conjunto_sem_nome'),
  'conjunto sem nome definido gera o alerta conjunto_sem_nome no cavalo'
);
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('k2', 't3a', 1::smallint); perform pg_temp.engatar('k2', 'd2', 2::smallint);
      perform pg_temp.engatar('k2', 't3b', 3::smallint);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'rodo com semirreboques de 3 eixos não é recusado'
);
select is(nucleo.nome_do_conjunto(pg_temp.id('k2')), 'sem nome definido', 'rodo com semirreboques de 3 eixos fica "sem nome definido"');
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('k3', 't2a', 1::smallint); perform pg_temp.engatar('k3', 'd3', 2::smallint);
      perform pg_temp.engatar('k3', 't2b', 3::smallint);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'rodo com dolly de 3 eixos não é recusado (o dolly de 2 eixos é exigência do nome Rodotrem)'
);
select is(nucleo.nome_do_conjunto(pg_temp.id('k3')), 'sem nome definido', 'rodo com dolly de 3 eixos fica "sem nome definido"');

-- ---- continuam recusados, com a mensagem exata ----
select throws_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('k4', 'e1', 1::smallint); perform pg_temp.engatar('k4', 'e5', 2::smallint);
      set constraints all immediate;
    end $b$$q$,
  '23514', 'Os semirreboques do conjunto têm de ter o mesmo número de eixos.', 'semirreboques de eixos diferentes continuam recusados'
);
-- ---- simples: um semirreboque, sem dolly, de 1 a 6 eixos (ajuste do checkpoint 3.4b) ----
select lives_ok(
  $q$do $b$ begin
      perform pg_temp.engatar('k5', 'e1', 1::smallint);
      perform pg_temp.engatar('k6', 'e4c', 1::smallint);
      perform pg_temp.engatar('k7', 'e5', 1::smallint);
      perform pg_temp.engatar('k8', 'e6', 1::smallint);
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'simples de 1, 4, 5 e 6 eixos engatam'
);
select is(nucleo.nome_do_conjunto(pg_temp.id('k5')), 'Graneleira', 'simples de 1 eixo tem o nome da carroceria');
select is(nucleo.nome_do_conjunto(pg_temp.id('k6')), 'Graneleira', 'simples de 4 eixos tem o nome da carroceria');
select is(nucleo.nome_do_conjunto(pg_temp.id('k7')), 'Graneleira', 'simples de 5 eixos tem o nome da carroceria');
select is(nucleo.nome_do_conjunto(pg_temp.id('k8')), 'Graneleira', 'simples de 6 eixos tem o nome da carroceria');
select ok(
  not exists (select 1 from nucleo.alerta_de_vinculo where alerta = 'conjunto_sem_nome'
               and ativo_id in (pg_temp.id('k5'), pg_temp.id('k6'), pg_temp.id('k7'), pg_temp.id('k8'))),
  'simples de 1 a 6 eixos não gera o alerta conjunto_sem_nome'
);

select ok(
  not exists (select 1 from nucleo.alerta_de_vinculo where alerta = 'conjunto_sem_nome'
               and ativo_id not in (pg_temp.id('k1'), pg_temp.id('k2'), pg_temp.id('k3'))),
  'só os conjuntos sem nome definido geram o alerta'
);

select * from finish();

rollback;
