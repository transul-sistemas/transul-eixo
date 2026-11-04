-- Fatia 3.9a: a leitura das placas pelo banco, com a sessão do próprio usuário (RLS).
--  * A lista (filtros, busca sem acento, ordem estável com desempate pelo id, página limitada), as
--    contagens dos chips (a de cada grupo ignora o próprio grupo), o detalhe e a história da placa.
--  * Funções SECURITY INVOKER: cada perfil vê só o que a RLS deixa (o gestor A não vê a placa do B; o
--    Operacional vê só o que foi entregue à sua filial). Placa que não se vê é "não existe" (nulo).
begin;
\ir apoio/como_usuario.psql

select plan(43);

create function pg_temp.id(p_nome text) returns uuid language sql as $$
  select nullif(current_setting('t.' || p_nome, true), '')::uuid
$$;
create function pg_temp.guardar(p_nome text, p_id uuid) returns uuid language sql as $$
  select set_config('t.' || p_nome, p_id::text, true)::uuid
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
  v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '@exemplo.local');
  insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (v_pessoa, v_auth, p_perfil);
  perform pg_temp.guardar('auth_' || p_nome, v_auth);
  return pg_temp.guardar(p_nome, v_pessoa);
end;
$$;
create function pg_temp.placa(p_nome text, p_tipo nucleo.tipo_de_ativo, p_placa text, p_n bigint, p_gestor text) returns uuid language plpgsql as $$
begin
  insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio)
    values (8000 + p_n, 'CR' || p_n, true, true);
  return pg_temp.guardar(p_nome, nucleo.cadastrar_ativo(
    p_tipo => p_tipo, p_renavam => pg_temp.renavam(8000 + p_n), p_placa => p_placa,
    p_gestor_id => pg_temp.id(p_gestor),
    p_cr_id => (select id from nucleo.cr where codcencus = 8000 + p_n),
    p_operacao_id => (select id from nucleo.operacao where nome = 'Grãos'),
    p_em => '2026-01-10 08:00-03',
    p_funcao => case when p_tipo = 'implemento' then 'semirreboque'::nucleo.funcao_do_implemento end,
    p_carroceria_id => case when p_tipo = 'implemento' then (select id from config.carroceria where nome = 'Graneleira') end,
    p_eixos => case when p_tipo = 'implemento' then 3::smallint end
  ));
end;
$$;
create function pg_temp.lista(p_busca text default '', p_grupos text[] default '{}', p_tipos text[] default '{}',
  p_siglas text[] default '{}', p_baixadas boolean default false, p_ordem text default 'placa',
  p_decrescente boolean default false, p_pagina int default 1, p_tam int default 25) returns jsonb language sql as $$
  select nucleo.listar_placas(p_busca, p_grupos, p_tipos, p_siglas, p_baixadas, p_ordem, p_decrescente, p_pagina, p_tam)
$$;
create function pg_temp.total(p_lista jsonb) returns int language sql as $$ select (p_lista ->> 'total')::int $$;
create function pg_temp.placas(p_lista jsonb) returns text[] language sql as $$
  select coalesce(array_agg(l ->> 'placa' order by n), '{}') from jsonb_array_elements(p_lista -> 'linhas') with ordinality as x (l, n)
$$;
create function pg_temp.chip(p_chip text, p_tipos text[] default '{}', p_grupos text[] default '{}') returns bigint language sql as $$
  select coalesce((select quantidade from nucleo.contar_chips_de_placas('', p_grupos, p_tipos, '{}', false) where chip = p_chip), 0)
$$;

-- ---- estrutura ----
select has_view('nucleo', 'linha_de_placa', 'existe a linha da lista de placas');
select ok(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'nucleo.linha_de_placa'::regclass),
  'a linha de placa roda com a RLS de quem consulta (security_invoker)'
);
select has_function('nucleo', 'listar_placas', 'existe a lista de placas paginada');
select has_function('nucleo', 'contar_chips_de_placas', 'existe a contagem dos chips');
select has_function('nucleo', 'detalhe_da_placa', 'existe o detalhe da placa');
select has_function('nucleo', 'historia_da_placa', 'existe a história da placa');
select ok(
  (select bool_and(not p.prosecdef) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'nucleo' and p.proname in ('listar_placas', 'contar_chips_de_placas', 'detalhe_da_placa', 'historia_da_placa', 'texto_simples')),
  'as funções de leitura são SECURITY INVOKER (a RLS vale)'
);
select ok(
  (select count(*) = 5 from config.funcao_executavel where assinatura in (
    'nucleo.listar_placas(text,text[],text[],text[],boolean,text,boolean,integer,integer)',
    'nucleo.contar_chips_de_placas(text,text[],text[],text[],boolean)',
    'nucleo.detalhe_da_placa(text)',
    'nucleo.historia_da_placa(text)',
    'nucleo.texto_simples(text)')),
  'as funções de leitura estão na lista de executáveis, com justificativa'
);
select is(nucleo.texto_simples('Grãos ÇÁ É'), 'graos ca e', 'texto simples: minúscula e sem acento');

-- ---- dados ----
select pg_temp.pessoa('Gestor A', 800000001, 'gestor_de_frota', true);
select pg_temp.pessoa('Gestor B', 800000002, 'gestor_de_frota', true);
select pg_temp.pessoa('Adm', 800000003, 'administrador', false);
select pg_temp.pessoa('Opa', 800000004, 'operacional', false);
insert into nucleo.operacao (nome) values ('Grãos');
insert into config.filial (nome) values ('Filial A');
insert into nucleo.usuario_filial (usuario_id, filial_id) values (pg_temp.id('Opa'), (select id from config.filial where nome = 'Filial A'));
select pg_temp.placa('k1', 'cavalo', 'AAA1A11', 1, 'Gestor A');
select pg_temp.placa('i1', 'implemento', 'AAA1A12', 2, 'Gestor A');
select pg_temp.placa('ap1', 'apoio', 'AAA1A13', 3, 'Gestor A');
select pg_temp.placa('k3', 'cavalo', 'AAA1A14', 4, 'Gestor A');
select pg_temp.placa('k2', 'cavalo', 'BBB2B22', 5, 'Gestor B');
select nucleo.engatar(pg_temp.id('k1'), pg_temp.id('i1'), 1::smallint, '2026-01-11 08:00-03');
select nucleo.entregar_ao_operacional(pg_temp.id('k1'), (select id from config.filial where nome = 'Filial A'),
  '2026-01-12 08:00-03', (select versao from nucleo.ativo where id = pg_temp.id('k1')));
select nucleo.registrar_baixa(pg_temp.id('k3'), 'VND', '2026-01-13 08:00-03', 'Vendido');
set constraints all immediate;
set constraints all deferred;

-- ---- Administrador: vê tudo ----
select tests.como(pg_temp.id('auth_Adm'));
select is(pg_temp.total(pg_temp.lista()), 4, 'a lista esconde a placa baixada por padrão');
select is(pg_temp.total(pg_temp.lista(p_baixadas => true)), 5, 'e mostra com "inclui baixadas"');
select is(pg_temp.placas(pg_temp.lista()), array['AAA1A11', 'AAA1A12', 'AAA1A13', 'BBB2B22'], 'ordem padrão: placa crescente');
select is(pg_temp.placas(pg_temp.lista(p_decrescente => true)), array['BBB2B22', 'AAA1A13', 'AAA1A12', 'AAA1A11'], 'placa decrescente');
select is(
  pg_temp.placas(pg_temp.lista(p_ordem => 'motorista')),
  (select array_agg(placa order by ativo_id) from nucleo.placa_atual where placa in ('AAA1A11', 'AAA1A12', 'AAA1A13', 'BBB2B22')),
  'coluna vazia no banco (motorista): ordem estável pelo id'
);
select is(pg_temp.placas(pg_temp.lista(p_ordem => 'coluna; drop table x')), array['AAA1A11', 'AAA1A12', 'AAA1A13', 'BBB2B22'], 'ordem fora da lista vira placa');
select is(pg_temp.total(pg_temp.lista(p_busca => 'GRAOS')), 4, 'busca sem acento nem caixa (a operação Grãos)');
select is(pg_temp.placas(pg_temp.lista(p_busca => 'bbb-2b')), array['BBB2B22'], 'busca pela placa, com traço');
select is(pg_temp.total(pg_temp.lista(p_busca => '%')), 0, 'o % da busca é texto, não curinga');
select is(pg_temp.total(pg_temp.lista(p_tipos => '{cavalo}')), 2, 'filtro por tipo');
select is(pg_temp.placas(pg_temp.lista(p_siglas => '{DOp}')), array['AAA1A11', 'AAA1A12'], 'filtro por situação: o implemento engatado segue o cavalo');
select is(
  (select array[l ->> 'pagina', l ->> 'paginas', l ->> 'total', jsonb_array_length(l -> 'linhas')::text] from pg_temp.lista(p_pagina => 99, p_tam => 1) l),
  array['4', '4', '4', '1'], 'página além da última devolve a última'
);
select is((pg_temp.lista(p_tam => 1000) ->> 'tam')::int, 100, 'no máximo 100 por página');
select is(pg_temp.chip('implemento', p_tipos => '{cavalo}'), 1::bigint, 'a contagem de um grupo ignora a seleção do próprio grupo');
select is(
  (select sum(quantidade) from nucleo.contar_chips_de_placas('', '{}', '{cavalo}', '{}', false)
    where chip in ('em-atividade', 'atencao', 'impedida', 'patio', 'fora')),
  2::numeric, 'os chips de situação contam só o que passa pelo filtro de tipo'
);
select ok(
  (select l ->> 'gestor' = 'Gestor A' and l ->> 'operacao' = 'Grãos' and l ->> 'cr' = 'CR1' and l ->> 'tipo' = 'cavalo'
     and l -> 'implementos' = '["AAA1A12"]'::jsonb and l ->> 'sigla' = 'DOp'
     from jsonb_array_elements(pg_temp.lista() -> 'linhas') l where l ->> 'placa' = 'AAA1A11'),
  'a linha traz gestor, operação, CR, tipo, conjunto e situação'
);
select is(
  (select l ->> 'cavalo' from jsonb_array_elements(pg_temp.lista() -> 'linhas') l where l ->> 'placa' = 'AAA1A12'),
  'AAA1A11', 'o implemento mostra o cavalo do conjunto'
);
select ok(
  (select (l ->> 'dias_no_status')::int >= 0 and l ->> 'desde' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
     from jsonb_array_elements(pg_temp.lista() -> 'linhas') l where l ->> 'placa' = 'AAA1A13'),
  'dias na situação e "desde" na hora de São Paulo'
);
select is(nucleo.detalhe_da_placa('AAA1A11') ->> 'sigla', 'DOp', 'o detalhe da placa');
select is(jsonb_array_length(nucleo.detalhe_da_placa('AAA1A11') -> 'crs'), 1, 'com as vigências de CR');
select is(nucleo.detalhe_da_placa('AAA1A11') -> 'crs' -> 0 ->> 'inicio', '2026-01-10', 'a vigência em data de São Paulo');
select is(nucleo.detalhe_da_placa('AAA1A14') ->> 'sigla', 'VND', 'a ficha acha a placa baixada');
select is(nucleo.detalhe_da_placa('ZZZ9Z99'), null, 'placa que não existe: nulo');
select is(
  (select array_agg(sigla order by em) from nucleo.historia_da_placa('AAA1A11')),
  array['PÁT', 'DOp'], 'a história da placa: as situações em ordem'
);
select is(
  (select em from nucleo.historia_da_placa('AAA1A11') order by em limit 1),
  '2026-01-10T08:00', 'a história em hora de parede de São Paulo'
);

-- ---- Gestor A: só a própria carteira ----
reset role;
select tests.como(pg_temp.id('auth_Gestor A'));
select is(pg_temp.placas(pg_temp.lista()), array['AAA1A11', 'AAA1A12', 'AAA1A13'], 'o gestor A vê só a carteira dele');
select is(nucleo.detalhe_da_placa('BBB2B22'), null, 'o gestor A não abre a placa do gestor B');
select is(pg_temp.total(pg_temp.lista(p_busca => 'BBB')), 0, 'nem acha pela busca');
select is((select count(*) from nucleo.historia_da_placa('BBB2B22')), 0::bigint, 'nem a história dela');
select is(pg_temp.chip('cavalo'), 1::bigint, 'as contagens respeitam a carteira');

-- ---- Gestor B ----
reset role;
select tests.como(pg_temp.id('auth_Gestor B'));
select is(pg_temp.placas(pg_temp.lista()), array['BBB2B22'], 'o gestor B vê só a dele');

-- ---- Operacional: só o que foi entregue à sua filial ----
reset role;
select tests.como(pg_temp.id('auth_Opa'));
select is(pg_temp.placas(pg_temp.lista()), array['AAA1A11'], 'o Operacional vê só a placa entregue à filial dele');
select is(nucleo.detalhe_da_placa('AAA1A13'), null, 'e não abre a que não foi entregue');

-- ---- sem login ----
reset role;
select tests.como_anonimo();
select throws_ok($$select nucleo.listar_placas('', '{}', '{}', '{}', false, 'placa', false, 1, 25)$$, '42501', null, 'sem login não lista');
reset role;

select * from finish();
rollback;
