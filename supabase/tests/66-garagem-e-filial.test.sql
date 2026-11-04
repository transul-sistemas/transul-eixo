-- Garagem e filial são duas dimensões (Alexandre, 03/11/2026).
--  * Filial do CR: os 13 valores de AD_GARAGEM do Sankhya (um rótulo: "Operação Matriz" aparece em CRs
--    das raízes 2, 4 e 6). O catálogo antigo config.garagem passa a ser config.filial_do_cr.
--  * Garagem: as 3 (Matriz, Cordeirópolis, Parauapebas), o lugar, a raiz da árvore de CRs. Até a ponte
--    trazer CODCENCUSPAI, deriva do primeiro dígito do código de 7 dígitos de frota (2, 4, 6), "a confirmar".
--    CR de 8 dígitos e CR de frota com outro dígito ficam sem garagem e vão para a fila de exceções.
--  * A garagem e a filial do ativo são as do CR vigente, calculadas, nunca gravadas no ativo.
--  * config.filial (3.1: custódia e escopo do Operacional) não muda.
begin;
\ir apoio/como_usuario.psql

select plan(29);

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

create function pg_temp.cr(p_nome text, p_codcencus bigint, p_ad_frota text, p_veiculo boolean) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.cr (codcencus, codigo, ad_frota, ad_frota_origem, veiculo_obrigatorio, veiculo_obrigatorio_origem, analitico, analitico_origem)
  values (p_codcencus, p_nome, p_ad_frota, 'sankhya', p_veiculo, 'sankhya', true, 'sankhya')
  returning id into v;
  return pg_temp.guardar(p_nome, v);
end;
$$;

create function pg_temp.garagem(p_codigo text) returns uuid language sql as $$
  select id from config.garagem where codigo = p_codigo
$$;

-- ---- estrutura ----
select has_table('config', 'filial_do_cr', 'o catálogo dos 13 valores de AD_GARAGEM agora se chama filial do CR');
select has_column('nucleo', 'cr', 'filial_do_cr', 'o CR guarda a filial do CR (AD_GARAGEM)');
select has_column('nucleo', 'cr', 'filial_do_cr_origem', 'com a origem');
select hasnt_column('nucleo', 'cr', 'garagem', 'a coluna antiga "garagem" do CR saiu (virou filial_do_cr)');
select has_function('nucleo', 'filial_do_cr_em', array['uuid', 'timestamp with time zone'], 'a filial do ativo num instante');
select has_table('config', 'garagem', 'existe o catálogo das 3 garagens');
select has_column('nucleo', 'cr', 'garagem_id', 'o CR guarda a garagem');
select has_column('nucleo', 'cr', 'garagem_origem', 'com a origem');
select has_function('nucleo', 'garagem_em', array['uuid', 'timestamp with time zone'], 'a garagem do ativo num instante');
select hasnt_column('nucleo', 'ativo', 'garagem_id', 'a garagem nunca é gravada no ativo');
select has_table('config', 'filial', 'a filial da 3.1 (custódia e escopo do Operacional) continua');
select is((select count(*) from config.filial_do_cr), 13::bigint, 'as 13 filiais do CR do Sankhya continuam semeadas');
select set_eq(
  $$select codigo || ':' || digito_da_raiz from config.garagem$$,
  array['matriz:2', 'cordeiropolis:4', 'parauapebas:6'],
  'as 3 garagens, cada uma com o dígito da raiz no Sankhya'
);

-- ---- a garagem do CR pela raiz ----
select pg_temp.cr('COR', 4011142, 'S', true);
select pg_temp.cr('PAR', 6011001, 'S', true);
select pg_temp.cr('MAT', 2011001, 'S', true);
select pg_temp.cr('CINCO', 5011001, 'S', true);
select pg_temp.cr('ACIONISTA', 10010001, null, true);
select pg_temp.cr('SERVICO', 3011001, 'N', false);
select ok(
  (select garagem_id = pg_temp.garagem('cordeiropolis') and garagem_origem = 'derivada' and garagem_conferencia = 'a_conferir'
     from nucleo.cr where id = pg_temp.id('COR')),
  'raiz 4: Cordeirópolis (derivada, a confirmar)'
);
select is((select garagem_id from nucleo.cr where id = pg_temp.id('PAR')), pg_temp.garagem('parauapebas'), 'raiz 6: Parauapebas');
select is((select garagem_id from nucleo.cr where id = pg_temp.id('MAT')), pg_temp.garagem('matriz'), 'raiz 2: Matriz');
select ok(
  (select garagem_id is null from nucleo.cr where id = pg_temp.id('CINCO'))
  and exists (select 1 from nucleo.fila_de_excecoes where cr_id = pg_temp.id('CINCO') and assunto = 'cr_sem_garagem' and resolvida_em is null),
  'CR de frota com dígito fora de 2, 4 e 6 fica sem garagem e vai para a fila de exceções'
);
select ok(
  (select garagem_id is null from nucleo.cr where id = pg_temp.id('ACIONISTA'))
  and exists (select 1 from nucleo.fila_de_excecoes where cr_id = pg_temp.id('ACIONISTA') and assunto = 'cr_sem_garagem'),
  'CR de 8 dígitos (acionista) fica sem garagem e vai para a fila de exceções'
);
select ok(
  (select garagem_id is null from nucleo.cr where id = pg_temp.id('SERVICO'))
  and not exists (select 1 from nucleo.fila_de_excecoes where cr_id = pg_temp.id('SERVICO')),
  'CR de serviço de 7 dígitos não tem garagem pela raiz e não vai para a fila'
);
update nucleo.cr set nome = 'Outro nome' where id = pg_temp.id('CINCO');
select is(
  (select count(*) from nucleo.fila_de_excecoes where cr_id = pg_temp.id('CINCO') and assunto = 'cr_sem_garagem'),
  1::bigint, 'alterar o CR de novo não duplica a exceção aberta'
);
update nucleo.cr set garagem_id = pg_temp.garagem('matriz'), garagem_origem = 'informada' where id = pg_temp.id('COR');
update nucleo.cr set nome = 'Renomeado' where id = pg_temp.id('COR');
select ok(
  (select garagem_id = pg_temp.garagem('matriz') and garagem_origem = 'informada' from nucleo.cr where id = pg_temp.id('COR')),
  'a garagem informada por alguém não é trocada pela derivação'
);
update nucleo.cr set garagem_id = pg_temp.garagem('cordeiropolis'), garagem_origem = 'derivada' where id = pg_temp.id('COR');

-- ---- a garagem e a filial do ativo: as do CR vigente, calculadas ----
insert into nucleo.pessoa (nome) values ('ana');
select pg_temp.guardar('ana', (select id from nucleo.pessoa where nome = 'ana'));
insert into nucleo.pessoa_documento (pessoa_id, documento) values (pg_temp.id('ana'), pg_temp.cpf(660000001));
insert into nucleo.papel_da_pessoa (pessoa_id, papel) values (pg_temp.id('ana'), 'gestor_de_frota');
insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(91));
select pg_temp.guardar('c1', (select id from nucleo.ativo where renavam = pg_temp.renavam(91)));
insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem) values (pg_temp.id('c1'), 'propria', '2026-01-10 00:00-03', 'informada');
insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem) values (pg_temp.id('c1'), pg_temp.id('ana'), '2026-01-10 00:00-03', 'informada');
insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem) values (pg_temp.id('c1'), 'PÁT', '2026-01-10 00:00-03', 'informada', 'manual');
update nucleo.cr set filial_do_cr = 'M' where id = pg_temp.id('COR');
update nucleo.cr set filial_do_cr = 'M' where id = pg_temp.id('PAR');
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, fim, inicio_origem, fim_origem)
  values (pg_temp.id('c1'), pg_temp.id('COR'), '2026-01-10 00:00-03', '2026-03-01 00:00-03', 'informada', 'informada');
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
  values (pg_temp.id('c1'), pg_temp.id('PAR'), '2026-03-01 00:00-03', 'informada');
set constraints all immediate;
set constraints all deferred;
select ok(
  nucleo.garagem_em(pg_temp.id('c1'), '2026-02-01 00:00-03') = pg_temp.garagem('cordeiropolis')
  and nucleo.garagem_em(pg_temp.id('c1'), '2026-04-01 00:00-03') = pg_temp.garagem('parauapebas'),
  'trocar de garagem é trocar de CR: a garagem do ativo acompanha a vigência do CR'
);
select ok(
  nucleo.filial_do_cr_em(pg_temp.id('c1'), '2026-02-01 00:00-03') = 'M'
  and nucleo.filial_do_cr_em(pg_temp.id('c1'), '2026-04-01 00:00-03') = 'M',
  'a mesma filial do CR ("Operação Matriz") em duas garagens: são dimensões diferentes'
);
select is(nucleo.garagem_em(pg_temp.id('c1'), '2025-12-01 00:00-03'), null, 'sem CR vigente, sem garagem');

-- ---- acesso ----
select tests.criar_usuario('gestor66@exemplo.local') as u \gset
insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (pg_temp.id('ana'), :'u', 'gestor_de_frota');
select tests.como(:'u');
select is((select count(*) from config.garagem), 3::bigint, 'garagem_ler: todo usuário vinculado lê as garagens');
select is((select count(*) from config.filial_do_cr), 13::bigint, 'filial_do_cr_ler: e as filiais do CR');
select throws_ok(
  $$insert into config.garagem (codigo, rotulo, digito_da_raiz) values ('nova', 'Nova', 8)$$,
  '42501', null, 'garagem_criar: o gestor não cria garagem (só Cadastros)'
);
select throws_ok(
  $$insert into config.filial_do_cr (codigo, rotulo, ordem) values ('W', 'Nova', 99)$$,
  '42501', null, 'filial_do_cr_criar: nem filial do CR'
);
select is((select count(*) from nucleo.fila_de_excecoes), 0::bigint, 'o gestor não vê a fila de exceções dos CRs');
reset role;

select * from finish();

rollback;
