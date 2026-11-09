-- Bugs do cadastro (09/11/2026): o "+" de CR para o gestor de frota, os CRs livres vistos por toda a
-- frota (não só pela carteira de quem consulta), ano e valor gravados na mesma transação do cadastro e o
-- nome do conjunto "pendente" quando falta a carroceria do semirreboque.
begin;
\ir apoio/como_usuario.psql

select plan(12);

create function pg_temp.id(p_nome text) returns uuid language sql as $$
  select nullif(current_setting('t.' || lower(regexp_replace(p_nome, '[^A-Za-z0-9]', '_', 'g')), true), '')::uuid
$$;
create function pg_temp.guardar(p_nome text, p_id uuid) returns uuid language sql as $$
  select set_config('t.' || lower(regexp_replace(p_nome, '[^A-Za-z0-9]', '_', 'g')), p_id::text, true)::uuid
$$;
create function pg_temp.renavam(p_n bigint) returns text language plpgsql as $$
declare
  v_prefixo text := lpad(p_n::text, 10, '0');
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
create function pg_temp.pessoa(p_nome text, p_n bigint, p_perfil text, p_gestor boolean) returns uuid language plpgsql as $$
declare
  v_pessoa uuid;
  v_auth uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_pessoa;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, pg_temp.cpf(p_n));
  if p_gestor then
    insert into nucleo.papel_da_pessoa (pessoa_id, papel) values (v_pessoa, 'gestor_de_frota');
  end if;
  if p_perfil is not null then
    v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '@exemplo.local');
    insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (v_pessoa, v_auth, p_perfil);
    perform pg_temp.guardar('auth_' || p_nome, v_auth);
  end if;
  return pg_temp.guardar(p_nome, v_pessoa);
end;
$$;
create function pg_temp.erro_de(p_sql text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
    set constraints all immediate;
    raise exception 'a tentativa executou' using errcode = 'ZZ999';
  exception when others then
    return case when sqlstate = 'ZZ999' then 'executou' else sqlstate end;
  end;
end;
$$;

select pg_temp.pessoa('Gestor A', 850000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 850000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Op', 850000003, 'operacional', false);
insert into nucleo.operacao (nome) values ('Grãos 85');
insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio) values
  (8501, 'K85A', true, true), (8502, 'K85B', true, true), (8503, 'K85LIVRE', true, true);
select nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8501), p_placa => 'FFF8F51',
  p_gestor_id => pg_temp.id('Gestor B'), p_cr_id => (select id from nucleo.cr where codigo = 'K85B'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 85'));
set constraints all immediate;
set constraints all deferred;

-- ---- b) o "+" de CR serve ao gestor de frota (frota.criar), não a quem não cadastra placa ----
select tests.como(pg_temp.id('auth_Gestor A'));
select is(
  pg_temp.erro_de($$select nucleo.criar_cr(8599, 'K85NOVO', 'K85NOVO')$$),
  'executou', 'b) o gestor de frota cria o CR pelo "+" do cadastro'
);
select pg_temp.guardar('cr_novo', nucleo.criar_cr(8599, 'K85NOVO', 'K85NOVO'));
reset role;
select ok(
  (select tipo = 'frota_de_ativo' and conferencia = 'a_conferir' from nucleo.cr where id = pg_temp.id('cr_novo')),
  'b) o CR do "+" nasce de frota de ativo, a conferir'
);
select tests.como(pg_temp.id('auth_Op'));
select is(
  pg_temp.erro_de($$select nucleo.criar_cr(8598, 'K85OP', 'K85OP')$$),
  '42501', 'b) quem não cadastra placa nem cadastros não cria CR'
);
reset role;

-- ---- c) CR livre é o sem placa vigente em toda a frota, não só na carteira de quem consulta ----
select tests.como(pg_temp.id('auth_Gestor A'));
select ok(
  not exists (select 1 from jsonb_array_elements(nucleo.catalogos_dos_assistentes() -> 'crs') c
               where c ->> 'codigo' = 'K85B'),
  'c) o CR da placa de outro gestor não aparece como livre'
);
select ok(
  exists (select 1 from jsonb_array_elements(nucleo.catalogos_dos_assistentes() -> 'crs') c
           where c ->> 'codigo' = 'K85LIVRE'),
  'c) o CR sem placa aparece como livre'
);
select ok(
  not has_function_privilege('anon', 'nucleo.crs_ocupados()', 'EXECUTE'),
  'c) anon não executa a lista de CRs ocupados'
);

-- ---- d) ano e valor gravados no próprio cadastro ----
select is(
  pg_temp.erro_de(format($$select nucleo.cadastrar_ativo(
    p_tipo => 'apoio', p_renavam => %L, p_placa => 'FFF8F52', p_gestor_id => %L,
    p_cr_id => (select id from nucleo.cr where codigo = 'K85A'),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 85'),
    p_ano_fabricacao => 2020::smallint, p_valor_manual => 1234.56, p_valor_manual_fonte => 'Nota fiscal',
    p_valor_manual_em => '2026-10-01'::date)$$, pg_temp.renavam(8502), pg_temp.id('Gestor A'))),
  'executou', 'd) o cadastro recebe o ano e o valor'
);
select pg_temp.guardar('apoio', nucleo.cadastrar_ativo(
  p_tipo => 'apoio', p_renavam => pg_temp.renavam(8502), p_placa => 'FFF8F52', p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K85A'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 85'),
  p_ano_fabricacao => 2020::smallint, p_valor_manual => 1234.56, p_valor_manual_fonte => 'Nota fiscal',
  p_valor_manual_em => '2026-10-01'::date));
reset role;
select ok(
  (select ano_fabricacao = 2020 and ano_fabricacao_origem = 'informada' and valor_manual = 1234.56
          and valor_manual_fonte = 'Nota fiscal' and valor_manual_em = '2026-10-01'
     from nucleo.ativo where id = pg_temp.id('apoio')),
  'd) ano e valor manual ficam no ativo, com origem informada'
);
select tests.como(pg_temp.id('auth_Gestor A'));
select pg_temp.guardar('cavalo', nucleo.cadastrar_ativo(
  p_tipo => 'cavalo', p_renavam => pg_temp.renavam(8503), p_placa => 'FFF8F53', p_gestor_id => pg_temp.id('Gestor A'),
  p_cr_id => (select id from nucleo.cr where codigo = 'K85LIVRE'),
  p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 85'),
  p_ano_fabricacao => 2022::smallint, p_codigo_fipe => '509035-0', p_valor_fipe => 785000.00,
  p_valor_fipe_referencia => '2026-11-01'::date));
reset role;
select ok(
  (select ano_fabricacao = 2022 and codigo_fipe = '509035-0' and valor_fipe = 785000.00
          and valor_fipe_referencia = '2026-11-01'
     from nucleo.ativo where id = pg_temp.id('cavalo')),
  'd) ano e valor FIPE ficam no ativo'
);
select is(
  pg_temp.erro_de(format($$select nucleo.cadastrar_ativo(
    p_tipo => 'apoio', p_renavam => %L, p_placa => 'FFF8F54', p_gestor_id => %L,
    p_cr_id => (select id from nucleo.cr where codigo = 'K85NOVO'),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos 85'),
    p_ano_fabricacao => 1900::smallint)$$, pg_temp.renavam(8504), pg_temp.id('Gestor A'))),
  '23514', 'd) ano inválido desfaz o cadastro inteiro (nada fica pela metade)'
);

-- ---- e) sem a carroceria do semirreboque, o nome do conjunto fica "pendente" ----
select is(config.nome_do_conjunto(null, 1, false, 3, null), 'pendente',
  'e) semirreboque sem carroceria: nome pendente (como sem os eixos)');
select is(config.nome_do_conjunto(null, 1, false, null, null), 'pendente',
  'e) sem carroceria e sem eixos: pendente');

select * from finish();
rollback;
