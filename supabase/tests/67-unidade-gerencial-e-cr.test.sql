-- Fatia 3.9c: catálogos e CRs (Alexandre, 06/11/2026).
--  * A unidade gerencial decide o tipo do CR; AD_FROTA vira conferência (divergência na fila).
--  * Filial = Garagem: as 3, com cidade e UF; config.filial ganha a garagem, uma para uma.
--  * A operação ganha base, tipo e o rótulo do Sankhya; nascem as 14 reais.
--  * Mais de um CR por placa: dois do mesmo tipo geram alerta e fila, sem recusa; o CR da placa é o de
--    frota; o mesmo CR não se sobrepõe a si mesmo.
begin;
\ir apoio/como_usuario.psql

select plan(30);

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
create function pg_temp.cr(p_nome text, p_codcencus bigint, p_unidade text, p_ad_frota text, p_veiculo boolean)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into nucleo.cr (codcencus, codigo, unidade_gerencial, unidade_gerencial_origem, ad_frota, ad_frota_origem,
                         veiculo_obrigatorio, veiculo_obrigatorio_origem, analitico, analitico_origem)
  values (p_codcencus, p_nome, p_unidade, case when p_unidade is null then null else 'sankhya'::config.origem_do_campo end,
          p_ad_frota, case when p_ad_frota is null then null else 'sankhya'::config.origem_do_campo end,
          p_veiculo, case when p_veiculo is null then null else 'sankhya'::config.origem_do_campo end, true, 'sankhya')
  returning id into v;
  return pg_temp.guardar(p_nome, v);
end;
$$;

-- ---- catálogos ----
select is(
  (select string_agg(codigo, ',' order by ordem) from config.unidade_gerencial),
  'frota,acionista,servico,participacoes,transulog',
  'as 5 unidades gerenciais, na ordem'
);
select is(
  (select string_agg(rotulo || ' ' || cidade || '/' || uf, ',' order by digito_da_raiz) from config.garagem),
  'Matriz São Luís/MA,Cordeirópolis Cordeirópolis/SP,Parauapebas Parauapebas/PA',
  'as 3 garagens com cidade e UF'
);
select is(
  (select count(*) from config.filial f join config.garagem g on g.id = f.garagem_id),
  3::bigint,
  'filial = garagem: as 3 filiais, cada uma com a sua garagem'
);
select throws_ok(
  $$insert into config.filial (nome, garagem_id) select 'Outra', id from config.garagem where codigo = 'matriz'$$,
  '23505', null, 'uma filial por garagem'
);
select is((select count(*) from nucleo.operacao where rotulo_no_sankhya is not null), 14::bigint, 'as 14 operações reais');
select is(
  (select tipo || ' ' || base_cidade || '/' || base_uf from nucleo.operacao where nome = 'Sem Operação Sudeste'),
  'parada Cordeirópolis/SP', 'Sem Operação é parada, com a base'
);
select is(
  (select string_agg(tipo, ',' order by tipo) from (select distinct tipo from nucleo.operacao where rotulo_no_sankhya is not null) t),
  'administrativa,holding,operacao,parada', 'os tipos usados pelas 14'
);
select throws_ok(
  $$insert into nucleo.operacao (nome, tipo) values ('X', 'outra')$$,
  '23514', null, 'tipo de operação fora da lista é recusado'
);

-- ---- o tipo pela unidade ----
select pg_temp.cr('FROTA_A', 2000001, 'frota', 'S', true);
select pg_temp.cr('FROTA_SEM', 2000002, 'frota', 'S', false);
select pg_temp.cr('FROTA_NULO', 2000003, 'frota', 'S', null);
select pg_temp.cr('ACIO', 20000001, 'acionista', 'N', true);
select pg_temp.cr('SERV', 2000005, 'servico', 'N', null);
select pg_temp.cr('PART', 2000006, 'participacoes', 'N', null);
select pg_temp.cr('LOG', 2000007, 'transulog', 'N', null);
select pg_temp.cr('ANTIGO', 2000008, null, 'S', true);
select is((select tipo::text from nucleo.cr where id = pg_temp.id('FROTA_A')), 'frota_de_ativo', 'frota com VEICULO S: frota de ativo');
select is((select tipo::text from nucleo.cr where id = pg_temp.id('FROTA_SEM')), 'frota_sem_placa', 'frota com VEICULO N: frota sem placa');
select is((select tipo::text from nucleo.cr where id = pg_temp.id('FROTA_NULO')), 'frota_de_ativo', 'frota sem o sinal VEICULO: frota de ativo');
select is((select tipo::text from nucleo.cr where id = pg_temp.id('ACIO')), 'acionista', 'acionista: acionista, mesmo com VEICULO S');
select is((select tipo::text from nucleo.cr where id = pg_temp.id('SERV')), 'servico', 'serviço');
select is((select tipo::text from nucleo.cr where id = pg_temp.id('PART')), 'participacoes', 'participações');
select is((select tipo::text from nucleo.cr where id = pg_temp.id('LOG')), 'transulog', 'TransuLOG');
select is((select tipo::text from nucleo.cr where id = pg_temp.id('ANTIGO')), 'frota_de_ativo', 'sem unidade, a regra antiga');
select is(
  md5((select string_agg(u || '|' || coalesce(v::text, 'nulo') || '|' || nucleo.tipo_do_cr_pela_unidade(u, v), ',' order by u || '|' || coalesce(v::text, 'nulo'))
         from unnest(array['acionista', 'frota', 'participacoes', 'servico', 'transulog']) u
         cross join unnest(array[null, false, true]::boolean[]) v)),
  'd01179725d9db49ddb5bb56cdcb9ce37',
  'a assinatura do tipo pela unidade é a do espelho (lib/dominio/cr.ts)'
);

-- ---- AD_FROTA confere a unidade ----
select pg_temp.cr('DIVERGE_1', 2000009, 'servico', 'S', null);
select pg_temp.cr('DIVERGE_2', 2000010, 'frota', 'N', true);
select is(
  (select count(*) from nucleo.fila_de_excecoes where assunto = 'cr_frota_diverge_da_unidade' and resolvida_em is null),
  2::bigint, 'AD_FROTA contra a unidade (nos dois sentidos) vai para a fila'
);
update nucleo.cr set nome = 'outro nome' where id = pg_temp.id('DIVERGE_1');
select is(
  (select count(*) from nucleo.fila_de_excecoes where cr_id = pg_temp.id('DIVERGE_1') and assunto = 'cr_frota_diverge_da_unidade'),
  1::bigint, 'uma exceção aberta por CR, mesmo gravando de novo'
);
select is(
  (select count(*) from nucleo.fila_de_excecoes where cr_id in (pg_temp.id('FROTA_A'), pg_temp.id('ACIO'), pg_temp.id('ANTIGO')) and assunto = 'cr_frota_diverge_da_unidade'),
  0::bigint, 'sem divergência (ou sem unidade), sem fila'
);

-- ---- mais de um CR por placa ----
insert into nucleo.pessoa (nome) values ('bia');
select pg_temp.guardar('bia', (select id from nucleo.pessoa where nome = 'bia'));
insert into nucleo.pessoa_documento (pessoa_id, documento) values (pg_temp.id('bia'), pg_temp.cpf(670000001));
insert into nucleo.papel_da_pessoa (pessoa_id, papel) values (pg_temp.id('bia'), 'gestor_de_frota');
insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(671));
select pg_temp.guardar('c1', (select id from nucleo.ativo where renavam = pg_temp.renavam(671)));
insert into nucleo.posse_do_ativo (ativo_id, regime, inicio, inicio_origem) values (pg_temp.id('c1'), 'propria', '2026-01-10 00:00-03', 'informada');
insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem) values (pg_temp.id('c1'), 'TSC6A71', '2026-01-10 00:00-03', 'informada');
insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem) values (pg_temp.id('c1'), pg_temp.id('bia'), '2026-01-10 00:00-03', 'informada');
insert into nucleo.evento_de_status (ativo_id, sigla, em, em_origem, origem) values (pg_temp.id('c1'), 'PÁT', '2026-01-10 00:00-03', 'informada', 'manual');
insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
  values (pg_temp.id('c1'), pg_temp.id('ACIO'), '2026-01-10 00:00-03', 'informada');
select lives_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
      values (pg_temp.id('c1'), pg_temp.id('FROTA_A'), '2026-01-10 00:00-03', 'informada')$$,
  'CR de frota e de acionista ao mesmo tempo é normal'
);
set constraints all immediate;
set constraints all deferred;
select is(nucleo.cr_em(pg_temp.id('c1'), '2026-02-01 00:00-03'), pg_temp.id('FROTA_A'), 'o CR da placa é o de frota (o custo vai a ele)');
select is(
  nucleo.garagem_em(pg_temp.id('c1'), '2026-02-01 00:00-03'),
  (select id from config.garagem where codigo = 'matriz'),
  'a garagem da placa vem do CR de frota (o de acionista não tem garagem)'
);
select ok(
  not ('placa_com_dois_cr_do_mesmo_tipo' = any (nucleo.alertas_do_ativo(pg_temp.id('c1'), '2026-02-01 00:00-03'))),
  'frota e acionista juntos não geram alerta'
);
select is((select count(*) from nucleo.fila_de_excecoes where ativo_id = pg_temp.id('c1')), 0::bigint, 'nem fila');
select throws_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
      values (pg_temp.id('c1'), pg_temp.id('FROTA_A'), '2026-02-01 00:00-03', 'informada')$$,
  '23P01', null, 'o mesmo CR não se sobrepõe a si mesmo na mesma placa'
);
select lives_ok(
  $$insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
      values (pg_temp.id('c1'), pg_temp.id('FROTA_NULO'), '2026-02-01 00:00-03', 'informada')$$,
  'dois CRs de frota ao mesmo tempo não são recusados'
);
set constraints all immediate;
set constraints all deferred;
select ok(
  'placa_com_dois_cr_do_mesmo_tipo' = any (nucleo.alertas_do_ativo(pg_temp.id('c1'), '2026-02-15 00:00-03')),
  'dois CRs do mesmo tipo geram o alerta'
);
select is(
  (select count(*) from nucleo.fila_de_excecoes where ativo_id = pg_temp.id('c1') and assunto = 'placa_com_dois_cr_do_mesmo_tipo' and resolvida_em is null),
  1::bigint, 'e entram na fila (uma exceção aberta por placa)'
);
select ok(
  (select 'placa_com_dois_cr_do_mesmo_tipo' = any (alertas_vigentes) from nucleo.leitura_da_placa where ativo_id = pg_temp.id('c1')),
  'a leitura mantida da placa mostra o alerta'
);

select * from finish();

rollback;
