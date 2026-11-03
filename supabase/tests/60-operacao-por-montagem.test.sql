-- Fatia 3.6c: o CR vem do Sankhya e a operação é montada por um usuário (decisão de 05/11/2026).
--  * CR: codcencus obrigatório e único; tipo derivado de AD_FROTA e VEICULO (serviço, frota de placa,
--    frota sem placa), com origem; o CR de frota de placa pertence a uma única placa, para sempre.
--  * Operação: o vínculo placa-operação (com vigência, quem montou) e o vínculo CR de serviço-operação.
--    A operação da placa vem do vínculo; engatado (do cavalo) e solto (a gravada na saída) seguem.
--  * O custo de cada data vem do CR que a placa tinha naquela data.
begin;
\ir apoio/como_usuario.psql

select plan(49);

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
    insert into nucleo.ativo (tipo, funcao, renavam, carroceria_id, eixos)
      values ('implemento', 'semirreboque', pg_temp.renavam(p_n), (select id from config.carroceria where nome = 'Graneleira'), 2)
      returning id into v;
  else
    insert into nucleo.ativo (tipo, renavam) values (p_tipo, pg_temp.renavam(p_n)) returning id into v;
  end if;
  insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem) values (v, 'propria', '2026-01-10 00:00-03', 'informada');
  insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem) values (v, pg_temp.id('ana'), '2026-01-10 00:00-03', 'informada');
  insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem) values (v, 'PÁT', '2026-01-10 00:00-03', 'informada', 'manual');
  return pg_temp.guardar(p_nome, v);
end;
$$;

-- CR com os dois sinais do Sankhya (AD_FROTA e VEICULO).
create function pg_temp.cr(p_nome text, p_codcencus bigint, p_frota boolean, p_veiculo boolean) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.cr (codcencus, codigo, participa_da_frota, veiculo_obrigatorio)
    values (p_codcencus, p_nome, p_frota, p_veiculo) returning id into v;
  return pg_temp.guardar(p_nome, v);
end;
$$;

create function pg_temp.placa_na_operacao(p_ativo text, p_operacao text, p_inicio timestamptz) returns void language plpgsql as $$
begin
  insert into nucleo.placa_na_operacao (ativo_id, operacao_id, inicio, inicio_origem)
    values (pg_temp.id(p_ativo), (select id from nucleo.operacao where nome = p_operacao), p_inicio, 'informada');
end;
$$;

create function pg_temp.op(p_nome text) returns uuid language sql as $$
  select id from nucleo.operacao where nome = p_nome
$$;

-- ---- estrutura ----
select has_table('nucleo', 'placa_na_operacao', 'existe o vínculo placa-operação');
select has_table('nucleo', 'cr_de_servico_na_operacao', 'existe o vínculo CR de serviço-operação');
select has_view('nucleo', 'alerta_de_cr', 'existe a visão de alertas de CR');
select has_function('nucleo', 'operacao_em', array['uuid', 'timestamp with time zone'], 'existe nucleo.operacao_em(ativo, instante)');
select has_function('nucleo', 'cr_em', array['uuid', 'timestamp with time zone'], 'existe nucleo.cr_em(ativo, instante)');
select is(
  (select md5(string_agg(coalesce(f::text, 'nulo') || '|' || coalesce(v::text, 'nulo') || '|' || coalesce(nucleo.tipo_do_cr(f, v)::text, 'pendente'), ','
          order by coalesce(f::text, 'nulo') || '|' || coalesce(v::text, 'nulo') || '|' || coalesce(nucleo.tipo_do_cr(f, v)::text, 'pendente') collate "C"))
     from (values (null::boolean), (false), (true)) as a (f)
     cross join (values (null::boolean), (false), (true)) as b (v)),
  'ddb7e0d7b60a5dc8e514fe0deab03297',
  'o tipo do CR pelos dois sinais do Sankhya é o mesmo do espelho em TypeScript (mesma assinatura)'
);

-- ---- dados ----
select pg_temp.pessoa('ana', 600000001, null);
insert into nucleo.operacao (nome) values ('Grãos'), ('Cimento');
select pg_temp.cr('A1', 4011142, true, true);
select pg_temp.cr('A2', 4011143, true, true);
select pg_temp.cr('F', 4011000, true, false);
select pg_temp.cr('S1', 5001001, false, null);
select pg_temp.cr('S2', 5001002, false, false);
select pg_temp.cr('S3', 5001003, false, false);
select pg_temp.ativo(n, t::nucleo.tipo_de_ativo, k) from (values
  ('c1', 'cavalo', 61), ('c2', 'cavalo', 62), ('i1', 'implemento', 63), ('pa', 'cavalo', 64), ('pb', 'cavalo', 65)) as v (n, t, k);
set constraints all immediate;
set constraints all deferred;

-- ---- o CR vem do Sankhya ----
select throws_ok(
  $$insert into nucleo.cr (codigo) values ('Sem código do Sankhya')$$,
  '23502', null, 'CR sem o CODCENCUS do Sankhya é recusado'
);
select ok(
  (select tipo = 'frota_de_placa' and tipo_origem = 'derivada' from nucleo.cr where id = pg_temp.id('A1')),
  'AD_FROTA e VEICULO ligados: frota de placa (derivado)'
);
select is((select tipo::text from nucleo.cr where id = pg_temp.id('F')), 'frota_sem_placa', 'AD_FROTA ligado e VEICULO desligado: frota sem placa');
select is((select tipo::text from nucleo.cr where id = pg_temp.id('S1')), 'servico', 'AD_FROTA desligado: serviço');
insert into nucleo.cr (codcencus, codigo) values (9999001, 'Sem sinais');
select is(
  (select tipo::text from nucleo.cr where codcencus = 9999001),
  null, 'sem os sinais do Sankhya, o tipo fica pendente (nulo), nunca presumido'
);
select is((select conferencia from nucleo.cr where id = pg_temp.id('A1')), 'a_conferir', 'o CR cadastrado antes da ponte nasce "a conferir"');

-- ---- o CR de frota de placa é de uma placa só, para sempre ----
select lives_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, fim, inicio_origem, fim_origem)
    values (pg_temp.id('c1'), pg_temp.id('A1'), '2026-01-10 00:00-03', '2026-03-01 00:00-03', 'informada', 'informada')$$,
  'a placa c1 fica com o CR A1'
);
select throws_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
    values (pg_temp.id('c2'), pg_temp.id('A1'), '2026-04-01 00:00-03', 'informada')$$,
  '23514', 'Este CR de frota de placa já pertence a outra placa: cada CR de placa é de uma placa só, para sempre.',
  'o mesmo CR de frota de placa não vai para outra placa, nem depois'
);
select lives_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
    values (pg_temp.id('c1'), pg_temp.id('A2'), '2026-03-01 00:00-03', 'informada')$$,
  'a troca de garagem dá à placa um CR novo (A2), e o A1 continua com ela'
);
select lives_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values
      (pg_temp.id('c2'), pg_temp.id('F'), '2026-01-10 00:00-03', 'informada'),
      (pg_temp.id('i1'), pg_temp.id('F'), '2026-01-10 00:00-03', 'informada')$$,
  'a regra não vale para CR de frota sem placa'
);
select throws_ok(
  $$update nucleo.cr set veiculo_obrigatorio = true where id = pg_temp.id('F')$$,
  '23514', 'Este CR de frota de placa já pertence a outra placa: cada CR de placa é de uma placa só, para sempre.',
  'virar frota de placa um CR que está em duas placas é recusado'
);
select throws_ok($$delete from nucleo.cr where id = pg_temp.id('A1')$$, '23000', null, 'o CR antigo nunca se exclui de verdade');

-- ---- a operação é montada: vínculo placa-operação com vigência ----
select lives_ok($$select pg_temp.placa_na_operacao('c1', 'Grãos', '2026-01-10 00:00-03')$$, 'montar a placa c1 na operação Grãos (vigência aberta)');
select throws_ok(
  $$select pg_temp.placa_na_operacao('c1', 'Cimento', '2026-02-01 00:00-03')$$,
  '23P01', null, 'uma operação por vez por placa: a sobreposição é recusada'
);
select is(nucleo.operacao_em(pg_temp.id('c1'), '2026-02-15 00:00-03'), pg_temp.op('Grãos'), 'a operação da placa vem do vínculo');
select is(nucleo.operacao_em(pg_temp.id('c1'), '2026-04-01 00:00-03'), pg_temp.op('Grãos'), 'a troca de CR (garagem) não troca a operação');
select is(nucleo.cr_em(pg_temp.id('c1'), '2026-02-15 00:00-03'), pg_temp.id('A1'), 'o custo de antes da troca vai para o CR de então (A1)');
select is(nucleo.cr_em(pg_temp.id('c1'), '2026-04-01 00:00-03'), pg_temp.id('A2'), 'o custo de depois da troca vai para o CR novo (A2)');
select ok(
  exists (select 1 from nucleo.cr_do_ativo where ativo_id = pg_temp.id('c1') and cr_id = pg_temp.id('A1') and excluido_em is null),
  'o vínculo com o CR antigo continua guardado (gasto histórico)'
);
select is((select degrau from nucleo.operacao_do_ativo where ativo_id = pg_temp.id('c1')), 'elenco', 'o degrau da placa montada é "elenco"');
select is((select cr_id from nucleo.operacao_do_ativo where ativo_id = pg_temp.id('c1')), pg_temp.id('A2'), 'a visão mostra o CR vigente da própria placa');
select lives_ok(
  $q$do $b$ begin
      update nucleo.placa_na_operacao set fim = '2026-05-01 00:00-03', fim_origem = 'informada'
       where ativo_id = pg_temp.id('c1') and fim is null;
      perform pg_temp.placa_na_operacao('c1', 'Cimento', '2026-05-01 00:00-03');
    end $b$$q$,
  'trocar a placa de operação fecha a vigência e abre outra'
);
select ok(
  nucleo.operacao_em(pg_temp.id('c1'), '2026-04-30 00:00-03') = pg_temp.op('Grãos')
  and nucleo.operacao_em(pg_temp.id('c1'), '2026-05-02 00:00-03') = pg_temp.op('Cimento'),
  'a operação vale por data'
);

-- ---- engatado e solto ----
select lives_ok(
  $q$do $b$ begin
      insert into nucleo.composicao (cavalo_id, implemento_id, posicao, inicio, inicio_origem)
        values (pg_temp.id('c1'), pg_temp.id('i1'), 1, '2026-06-01 00:00-03', 'informada');
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'engatar o implemento i1 no cavalo c1'
);
select is(nucleo.operacao_em(pg_temp.id('i1'), '2026-06-15 00:00-03'), pg_temp.op('Cimento'), 'engatado: a operação é a do cavalo');
select lives_ok(
  $q$do $b$ begin
      update nucleo.composicao set fim = '2026-07-01 00:00-03', fim_origem = 'informada' where implemento_id = pg_temp.id('i1') and fim is null;
      set constraints all immediate; set constraints all deferred;
    end $b$$q$,
  'desengatar o implemento'
);
select is(
  (select operacao_na_saida_id from nucleo.composicao where implemento_id = pg_temp.id('i1')),
  pg_temp.op('Cimento'), 'a operação na saída é a do cavalo pelo vínculo (não pelo CR)'
);
select is(nucleo.operacao_em(pg_temp.id('i1'), '2026-07-02 00:00-03'), pg_temp.op('Cimento'), 'solto: mantém a operação da saída');
select pg_temp.placa_na_operacao('i1', 'Grãos', '2026-08-01 00:00-03');
select is(nucleo.operacao_em(pg_temp.id('i1'), '2026-08-02 00:00-03'), pg_temp.op('Grãos'), 'montado depois da saída: vale a montagem mais recente');

-- ---- CR de serviço na operação ----
select lives_ok(
  $$insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem)
    values (pg_temp.id('S1'), pg_temp.op('Grãos'), '2026-01-10 00:00-03', 'informada')$$,
  'o CR de serviço S1 entra na operação Grãos'
);
select lives_ok(
  $$insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem)
    values (pg_temp.id('S2'), pg_temp.op('Grãos'), '2026-01-10 00:00-03', 'informada')$$,
  'vários CRs de serviço na mesma operação (hipótese)'
);
select throws_ok(
  $$insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem)
    values (pg_temp.id('A1'), pg_temp.op('Grãos'), '2026-01-10 00:00-03', 'informada')$$,
  '23514', 'Só CR de serviço entra na operação como serviço; as placas entram pelo vínculo placa-operação.',
  'CR de frota não entra como serviço'
);
select throws_ok(
  $$insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem)
    values (pg_temp.id('S1'), pg_temp.op('Cimento'), '2026-02-01 00:00-03', 'informada')$$,
  '23P01', null, 'um CR de serviço em uma operação por vez'
);

-- ---- alertas ----
select ok(
  exists (select 1 from nucleo.alerta_de_cr where cr_id = pg_temp.id('S3') and alerta = 'cr_sem_operacao'),
  'CR de serviço sem operação gera o alerta cr_sem_operacao'
);
select ok(
  not exists (select 1 from nucleo.alerta_de_cr where cr_id in (pg_temp.id('S1'), pg_temp.id('A1'), pg_temp.id('F'))),
  'CR de serviço na operação, ou CR de frota (com ou sem placa), não gera alerta de CR'
);
select ok(
  exists (select 1 from nucleo.alerta_de_vinculo where ativo_id = pg_temp.id('pa') and alerta = 'sem_cr'),
  'placa sem CR continua gerando sem_cr'
);

-- ---- montagem pelo usuário e o escopo "operação" lendo o vínculo ----
insert into config.perfil (codigo, nome) values ('teste_operacao', 'Teste por operação');
insert into config.permissao_do_perfil (perfil, modulo, acao, escopo) values ('teste_operacao', 'frota', 'ver', 'operacao');
select pg_temp.pessoa('adm', 600000002, 'administrador');
select pg_temp.pessoa('uga', 600000003, 'teste_operacao');
select pg_temp.pessoa('ucim', 600000004, 'teste_operacao');
select pg_temp.pessoa('gestor', 600000005, 'gestor_de_frota');
insert into nucleo.usuario_operacao (usuario_id, operacao_id) values
  (pg_temp.id('uga'), pg_temp.op('Grãos')), (pg_temp.id('ucim'), pg_temp.op('Cimento'));
select pg_temp.placa_na_operacao('pb', 'Cimento', '2026-01-10 00:00-03');

select tests.como(pg_temp.id('auth_adm'));
select lives_ok($$select pg_temp.placa_na_operacao('pa', 'Grãos', '2026-01-10 00:00-03')$$, 'placa_na_operacao_criar: quem tem Operações monta a placa na operação');
reset role;
select is((select montado_por from nucleo.placa_na_operacao where ativo_id = pg_temp.id('pa')), pg_temp.id('adm'), 'o vínculo guarda quem montou');
select tests.como(pg_temp.id('auth_gestor'));
select throws_ok(
  $$insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem)
    values (pg_temp.id('S3'), pg_temp.op('Grãos'), '2026-01-10 00:00-03', 'informada')$$,
  '42501', null, 'cr_de_servico_na_operacao_criar: quem não tem Operações não monta'
);
reset role;
select tests.como(pg_temp.id('auth_uga'));
select set_eq(
  $$select id from nucleo.ativo where id in (pg_temp.id('pa'), pg_temp.id('pb'))$$,
  $$values (pg_temp.id('pa'))$$,
  'placa_na_operacao_ler e o escopo operação: a pessoa da operação Grãos vê só a placa montada em Grãos'
);
reset role;
select tests.como(pg_temp.id('auth_ucim'));
select set_eq(
  $$select id from nucleo.ativo where id in (pg_temp.id('pa'), pg_temp.id('pb'))$$,
  $$values (pg_temp.id('pb'))$$,
  'e a pessoa da operação Cimento vê só a de Cimento'
);
select ok(
  (select count(*) from nucleo.cr_de_servico_na_operacao) = 0,
  'cr_de_servico_na_operacao_ler: sem Operações, não vê a montagem dos serviços'
);
reset role;
update nucleo.placa_na_operacao set fim = '2026-09-01 00:00-03', fim_origem = 'informada' where ativo_id = pg_temp.id('pb') and fim is null;
select pg_temp.placa_na_operacao('pb', 'Grãos', '2026-09-01 00:00-03');
select tests.como(pg_temp.id('auth_uga'));
select is(
  (select count(*) from nucleo.ativo where id in (pg_temp.id('pa'), pg_temp.id('pb'))),
  2::bigint, 'placa_na_operacao_alterar: o escopo segue a montagem (pb passou para Grãos)'
);
reset role;

select * from finish();

rollback;
