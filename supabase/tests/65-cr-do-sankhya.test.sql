-- O CR a partir da lista real do Sankhya (1.714 CRs, 03/11/2026).
--  * AD_FROTA e AD_BLOQUEADO guardados como vieram ('S', 'N' ou nulo), com origem.
--  * Tipo: AD_FROTA 'S' e VEICULO 'S' = frota de placa; AD_FROTA 'S' e VEICULO diferente de 'S' = frota sem
--    placa; AD_FROTA 'N' ou nulo = serviço (o vazio é serviço, nunca pendente).
--  * Bloqueado: AD_BLOQUEADO 'S'; 'N' ou nulo = não bloqueado. ATIVO é guardado, mas não decide nada.
--  * CR agrupador (ANALITICO 'N') não aceita vínculo.
begin;
\ir apoio/como_usuario.psql

select plan(27);

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

create function pg_temp.ativo(p_nome text, p_n bigint) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(p_n)) returning id into v;
  insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem) values (v, 'propria', '2026-01-10 00:00-03', 'informada');
  insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem) values (v, pg_temp.id('ana'), '2026-01-10 00:00-03', 'informada');
  insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem) values (v, 'PÁT', '2026-01-10 00:00-03', 'informada', 'manual');
  return pg_temp.guardar(p_nome, v);
end;
$$;

-- CR como vem da ponte: os valores brutos do Sankhya, com origem sankhya.
create function pg_temp.cr(p_nome text, p_codcencus bigint, p_ad_frota text, p_veiculo boolean, p_ad_bloqueado text, p_analitico boolean)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.cr (codcencus, codigo, ad_frota, ad_frota_origem, veiculo_obrigatorio, veiculo_obrigatorio_origem,
                         ad_bloqueado, ad_bloqueado_origem, analitico, analitico_origem, ativo, ativo_origem)
  values (p_codcencus, p_nome, p_ad_frota, 'sankhya', p_veiculo, 'sankhya', p_ad_bloqueado, 'sankhya', p_analitico, 'sankhya', true, 'sankhya')
  returning id into v;
  return pg_temp.guardar(p_nome, v);
end;
$$;

-- ---- estrutura ----
select enum_has_labels('nucleo', 'tipo_de_cr', array['servico', 'frota_de_ativo', 'frota_sem_placa'], 'o CR de frota é do ativo (placa ou equipamento): frota_de_ativo');
select has_column('nucleo', 'cr', 'ad_frota', 'o CR guarda o AD_FROTA bruto');
select has_column('nucleo', 'cr', 'ad_frota_origem', 'com a origem');
select has_column('nucleo', 'cr', 'ad_bloqueado', 'o CR guarda o AD_BLOQUEADO bruto');
select has_column('nucleo', 'cr', 'ad_bloqueado_origem', 'com a origem');
select is(
  (select md5(string_agg(coalesce(f::text, 'nulo') || '|' || coalesce(v::text, 'nulo') || '|' || coalesce(nucleo.tipo_do_cr(f, v)::text, 'pendente'), ','
          order by coalesce(f::text, 'nulo') || '|' || coalesce(v::text, 'nulo') || '|' || coalesce(nucleo.tipo_do_cr(f, v)::text, 'pendente') collate "C"))
     from (values (null::boolean), (false), (true)) as a (f)
     cross join (values (null::boolean), (false), (true)) as b (v)),
  'a8823458d9dc448f92e48d710b52f760',
  'o tipo do CR é o mesmo do espelho em TypeScript (a assinatura nova, sem pendente)'
);

-- ---- dados ----
insert into nucleo.pessoa (nome) values ('ana');
select pg_temp.guardar('ana', (select id from nucleo.pessoa where nome = 'ana'));
insert into nucleo.pessoa_documento (pessoa_id, documento) values (pg_temp.id('ana'), pg_temp.cpf(650000001));
insert into nucleo.papel_da_pessoa (pessoa_id, papel) values (pg_temp.id('ana'), 'gestor_de_frota');
insert into nucleo.operacao (nome) values ('Grãos');
select pg_temp.cr('P', 4011142, 'S', true, null, true);
select pg_temp.cr('F', 4011000, 'S', false, 'N', true);
select pg_temp.cr('FN', 4011001, 'S', null, null, true);
select pg_temp.cr('SN', 5001001, 'N', false, null, true);
select pg_temp.cr('SV', 5001002, null, false, null, true);
select pg_temp.cr('SVV', 5001003, null, true, null, true);
select pg_temp.cr('B', 4011143, 'S', true, 'S', true);
select pg_temp.cr('G', 4010000, 'S', false, null, false);
select pg_temp.cr('GS', 5000000, null, false, null, false);
select pg_temp.ativo(n, k) from (values ('c1', 81), ('c2', 82), ('c3', 83)) as v (n, k);
set constraints all immediate;
set constraints all deferred;

-- ---- o tipo pelos valores brutos ----
select ok(
  (select ad_frota = 'S' and ad_frota_origem = 'sankhya' and participa_da_frota and tipo = 'frota_de_ativo' from nucleo.cr where id = pg_temp.id('P')),
  'AD_FROTA S e VEICULO S: frota de placa, com o valor bruto guardado'
);
select is((select tipo::text from nucleo.cr where id = pg_temp.id('F')), 'frota_sem_placa', 'AD_FROTA S e VEICULO N: frota sem placa');
select is((select tipo::text from nucleo.cr where id = pg_temp.id('FN')), 'frota_sem_placa', 'AD_FROTA S e VEICULO vazio: frota sem placa');
select is((select tipo::text from nucleo.cr where id = pg_temp.id('SN')), 'servico', 'AD_FROTA N: serviço');
select ok(
  (select ad_frota is null and ad_frota_origem = 'sankhya' and not participa_da_frota and tipo = 'servico' from nucleo.cr where id = pg_temp.id('SV')),
  'AD_FROTA vazio: serviço (o vazio é serviço, nunca pendente)'
);
select is((select tipo::text from nucleo.cr where id = pg_temp.id('SVV')), 'servico', 'AD_FROTA vazio com VEICULO S: ainda serviço');
select throws_ok(
  $$insert into nucleo.cr (codcencus, codigo, ad_frota, ad_frota_origem) values (9000001, 'X', 'X', 'sankhya')$$,
  '23514', null, 'AD_FROTA só aceita S, N ou vazio'
);

-- ---- bloqueado pelo valor bruto; ATIVO não decide ----
select ok(
  (select ad_bloqueado = 'S' and bloqueado from nucleo.cr where id = pg_temp.id('B')),
  'AD_BLOQUEADO S: bloqueado'
);
select ok(
  (select not bloqueado from nucleo.cr where id = pg_temp.id('F')) and (select not bloqueado from nucleo.cr where id = pg_temp.id('P')),
  'AD_BLOQUEADO N ou vazio: não bloqueado'
);
select throws_ok(
  $$insert into nucleo.cr (codcencus, codigo, ad_bloqueado, ad_bloqueado_origem) values (9000002, 'Y', 's ', 'sankhya')$$,
  '23514', null, 'AD_BLOQUEADO só aceita S, N ou vazio (sem normalizar o que não é S nem N)'
);
select throws_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values (pg_temp.id('c1'), pg_temp.id('B'), '2026-02-01 00:00-03', 'informada')$$,
  '23514', 'Este CR está bloqueado: não aceita vínculo novo (os vínculos antigos continuam).',
  'CR bloqueado não aceita vínculo novo'
);
update nucleo.cr set ativo = false where id = pg_temp.id('P');
select lives_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values (pg_temp.id('c1'), pg_temp.id('P'), '2026-02-01 00:00-03', 'informada')$$,
  'ATIVO do Sankhya fica guardado, mas não decide nada (o CR com ATIVO N ainda aceita vínculo)'
);
select ok(
  exists (select 1 from nucleo.alerta_de_cr where cr_id = pg_temp.id('SN')),
  'o alerta cr_sem_operacao vale para o CR de serviço não bloqueado'
);
update nucleo.cr set ativo = false where id = pg_temp.id('SN');
select ok(
  exists (select 1 from nucleo.alerta_de_cr where cr_id = pg_temp.id('SN')),
  'e o ATIVO não o tira do alerta'
);

-- ---- CR agrupador (ANALITICO N) não aceita vínculo ----
select throws_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values (pg_temp.id('c2'), pg_temp.id('G'), '2026-02-01 00:00-03', 'informada')$$,
  '23514', 'Este CR é agrupador (não analítico): não aceita vínculo. Escolha um CR analítico abaixo dele.',
  'CR agrupador não vai para uma placa'
);
select throws_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, fim, inicio_origem, fim_origem)
    values (pg_temp.id('c2'), pg_temp.id('G'), '2025-01-01 00:00-03', '2025-06-01 00:00-03', 'derivada', 'derivada')$$,
  '23514', 'Este CR é agrupador (não analítico): não aceita vínculo. Escolha um CR analítico abaixo dele.',
  'nem pela importação do histórico'
);
select throws_ok(
  $$insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem)
    values (pg_temp.id('GS'), (select id from nucleo.operacao where nome = 'Grãos'), '2026-02-01 00:00-03', 'informada')$$,
  '23514', 'Este CR é agrupador (não analítico): não aceita vínculo. Escolha um CR analítico abaixo dele.',
  'CR agrupador não entra numa operação'
);
select lives_ok(
  $$insert into nucleo.cr_de_servico_na_operacao (cr_id, operacao_id, inicio, inicio_origem)
    values (pg_temp.id('SN'), (select id from nucleo.operacao where nome = 'Grãos'), '2026-02-01 00:00-03', 'informada')$$,
  'CR de serviço analítico entra na operação'
);
select lives_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem) values (pg_temp.id('c3'), pg_temp.id('F'), '2026-02-01 00:00-03', 'informada')$$,
  'CR analítico de frota sem placa vai para a placa'
);
select throws_ok(
  $$update nucleo.cr_do_ativo set cr_id = pg_temp.id('G') where ativo_id = pg_temp.id('c3')$$,
  '23514', 'Este CR é agrupador (não analítico): não aceita vínculo. Escolha um CR analítico abaixo dele.',
  'trocar o CR do vínculo por um agrupador também é recusado'
);
select ok(
  (select analitico from nucleo.cr where codcencus = 4011142),
  'o CR da ponte guarda ANALITICO'
);

select * from finish();

rollback;
