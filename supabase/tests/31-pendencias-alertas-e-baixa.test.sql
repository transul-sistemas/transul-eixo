-- Fatia 3.3, ajustes do checkpoint: pendências do pedido de transferência, CODCENCUS único só quando
-- existe, a lista fechada dos nomes de alerta e as siglas de baixa do catálogo.
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

create function pg_temp.nova_pessoa(p_nome text, p_documento text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_id;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_id, p_documento);
  return v_id;
end;
$$;

-- ---- estrutura ----
select has_table('nucleo', 'transferencia_pendencia', 'existe nucleo.transferencia_pendencia');
select ok(
  (select relrowsecurity from pg_class where oid = 'nucleo.transferencia_pendencia'::regclass),
  'transferencia_pendencia tem RLS ligado'
);
select is(
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'nucleo' and table_name = 'transferencia_pendencia'
      and grantee in ('anon', 'authenticated', 'PUBLIC')),
  0::bigint,
  'transferencia_pendencia não dá acesso a anon, authenticated nem PUBLIC'
);
select ok(
  exists (
    select 1 from pg_index i
     where i.indrelid = 'nucleo.transferencia_pendencia'::regclass
       and i.indkey[0] = (select attnum from pg_attribute
                           where attrelid = 'nucleo.transferencia_pendencia'::regclass
                             and attname = 'transferencia_id')
  ),
  'a chave estrangeira transferencia_id tem índice'
);

insert into ids select 'ana', pg_temp.nova_pessoa('Ana', '529.982.247-25');
insert into ids select 'bia', pg_temp.nova_pessoa('Bia', '11144477735');

-- ---- baixa: posse e gestor têm de terminar no instante dela ----
-- (antes de qualquer ativo sem posse: `set constraints all immediate` confere todos os pendentes)
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
insert into ids select 'b1', pg_temp.ativo_completo(601);
insert into ids select 'b2', pg_temp.ativo_completo(602);
insert into ids select 'b3', pg_temp.ativo_completo(603);
set constraints all immediate;
set constraints all deferred;

select throws_ok(
  $q$do $b$ begin
      insert into nucleo.baixa_do_ativo (ativo_id, sigla, em) values ((select id from ids where nome = 'b1'), 'VND', '2026-03-10 00:00-03');
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'baixa com posse e gestor ainda em aberto é recusada'
);
select throws_ok(
  $q$do $b$ begin
      update nucleo.posse_do_ativo set fim = '2026-03-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'b2');
      insert into nucleo.baixa_do_ativo (ativo_id, sigla, em) values ((select id from ids where nome = 'b2'), 'SUC', '2026-03-10 00:00-03');
      set constraints all immediate;
    end $b$$q$,
  '23514', null, 'baixa com a posse fechada e o gestor ainda em aberto é recusada'
);
select lives_ok(
  $q$do $b$ begin
      update nucleo.posse_do_ativo set fim = '2026-03-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'b3');
      update nucleo.gestor_da_carteira set fim = '2026-03-10 00:00-03', fim_origem = 'informada'
       where ativo_id = (select id from ids where nome = 'b3');
      insert into nucleo.baixa_do_ativo (ativo_id, sigla, em) values ((select id from ids where nome = 'b3'), 'SUC', '2026-03-10 00:00-03');
      set constraints all immediate;
      set constraints all deferred;
    end $b$$q$,
  'baixa com posse e gestor terminando exatamente no instante dela passa'
);

-- ---- pendências do pedido ----
with a as (
  insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(500)) returning id
)
insert into ids select 'cav', id from a;
with t as (
  insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo)
  values ((select id from ids where nome = 'cav'), (select id from ids where nome = 'ana'),
          (select id from ids where nome = 'bia'), 'Troca de carteira')
  returning id
)
insert into ids select 'pedido', id from t;

select lives_ok(
  $$insert into nucleo.transferencia_pendencia (transferencia_id, texto)
    values ((select id from ids where nome = 'pedido'), 'Documento do CRLV vencido')$$,
  'pendência em aberto, só com o texto'
);
select throws_ok(
  $$insert into nucleo.transferencia_pendencia (transferencia_id, texto)
    values ((select id from ids where nome = 'pedido'), '   ')$$,
  '23514', null, 'pendência sem texto é recusada'
);
select throws_ok(
  $$update nucleo.transferencia_pendencia set resolvida_por = (select id from ids where nome = 'bia')
     where transferencia_id = (select id from ids where nome = 'pedido')$$,
  '23514', null, 'resolver sem dizer quando é recusado'
);
select lives_ok(
  $$update nucleo.transferencia_pendencia
       set resolvida_por = (select id from ids where nome = 'bia'),
           resolvida_em = '2026-05-01 00:00-03',
           nota = 'CRLV renovado'
     where transferencia_id = (select id from ids where nome = 'pedido')$$,
  'resolver com quem e quando, e a nota opcional'
);
select ok(
  exists (select 1 from auditoria.evento where tabela = 'nucleo.transferencia_pendencia' and operacao = 'UPDATE'),
  'a pendência é auditada'
);
select throws_ok(
  $$delete from nucleo.transferencia_pendencia$$,
  '23000', null, 'pendência não se apaga de verdade'
);
select throws_ok(
  $$insert into nucleo.transferencia_pendencia (transferencia_id, texto)
    values (gen_random_uuid(), 'Pedido que não existe')$$,
  '23503', null, 'pendência só existe num pedido de transferência'
);

-- ---- CODCENCUS: único quando existe ----
select lives_ok(
  $$insert into nucleo.cr (codigo) values ('Sem chave 1'), ('Sem chave 2')$$,
  'vários CRs sem CODCENCUS convivem (até a ponte)'
);
select throws_ok(
  $$insert into nucleo.cr (codcencus, codigo) values (7001, 'Com chave 1'), (7001, 'Com chave 2')$$,
  '23505', null, 'o CODCENCUS que existe é único'
);

-- ---- nomes de alerta: lista fechada ----
select set_eq(
  $$select distinct (regexp_matches(pg_get_viewdef('nucleo.alerta_de_vinculo'::regclass), '''(\w+)''::text', 'g'))[1]$$,
  array['sem_cr', 'cr_sem_operacao', 'buraco_em_cr', 'buraco_em_custodia'],
  'a visão de alertas só produz os nomes registrados em docs/decisoes.md'
);
select is(
  (select count(*) from nucleo.alerta_de_vinculo
    where alerta not in ('sem_cr', 'cr_sem_operacao', 'buraco_em_cr', 'buraco_em_custodia')),
  0::bigint,
  'nenhuma linha de alerta tem nome fora da lista'
);

-- ---- siglas de baixa ----
select set_eq(
  $$select sigla from config.status where baixada$$,
  array['VND', 'SUC'],
  'as siglas de baixa do catálogo são exatamente VND e SUC (as mesmas do CHECK de baixa_do_ativo)'
);
select ok(
  pg_get_constraintdef((select oid from pg_constraint where conname = 'baixa_so_vnd_ou_suc'))
    ~ 'VND' and pg_get_constraintdef((select oid from pg_constraint where conname = 'baixa_so_vnd_ou_suc')) ~ 'SUC',
  'o CHECK de baixa_do_ativo aceita VND e SUC'
);

select * from finish();

rollback;
