-- O CR a partir da lista real do Sankhya (1.714 CRs, 03/11/2026). Migração nova: a 3.6c já foi enviada.
--
--  * AD_FROTA e AD_BLOQUEADO guardados como vieram ('S', 'N' ou vazio), com origem. Deles se derivam
--    participa_da_frota e bloqueado (origem derivada).
--  * Tipo: AD_FROTA 'S' e VEICULO 'S' = frota de placa; AD_FROTA 'S' e VEICULO diferente de 'S' = frota
--    sem placa; AD_FROTA 'N' ou vazio = serviço (546 CRs têm AD_FROTA vazio: o vazio é serviço, nunca
--    pendente).
--  * Bloqueado: AD_BLOQUEADO 'S'; 'N' ou vazio = não bloqueado. ATIVO é 'S' em todos os CRs: fica
--    guardado, mas não decide nada (sai da recusa de vínculo e do alerta cr_sem_operacao).
--  * CR agrupador (ANALITICO 'N', 91 CRs, ex.: FRETES e os acionistas pai) não aceita vínculo, nem pela
--    importação do histórico.

alter table nucleo.cr
  add column ad_frota text,
  add column ad_frota_origem config.origem_do_campo,
  add column ad_bloqueado text,
  add column ad_bloqueado_origem config.origem_do_campo,
  add constraint cr_ad_frota_valido check (ad_frota in ('S', 'N')),
  add constraint cr_ad_bloqueado_valido check (ad_bloqueado in ('S', 'N')),
  add constraint cr_ad_frota_com_origem check (ad_frota is null or ad_frota_origem is not null),
  add constraint cr_ad_bloqueado_com_origem check (ad_bloqueado is null or ad_bloqueado_origem is not null);
comment on column nucleo.cr.ad_frota is
  'AD_FROTA do Sankhya como veio (S, N ou vazio). Com origem, deriva participa_da_frota: só S participa; N e vazio são serviço.';
comment on column nucleo.cr.ad_bloqueado is
  'AD_BLOQUEADO do Sankhya como veio (S, N ou vazio). Com origem, deriva bloqueado: só S bloqueia.';
comment on column nucleo.cr.ativo is 'ATIVO do Sankhya (S em todos os CRs em 03/11/2026): guardado, mas não decide nada.';
comment on column nucleo.cr.analitico is 'ANALITICO do Sankhya. O CR agrupador (não analítico) não aceita vínculo.';

-- O tipo pelos dois sinais: o vazio em AD_FROTA é serviço (nunca pendente).
create or replace function nucleo.tipo_do_cr(p_participa_da_frota boolean, p_veiculo_obrigatorio boolean)
returns nucleo.tipo_de_cr
language sql
immutable
set search_path = ''
as $$
  select case
    when p_participa_da_frota is not true then 'servico'::nucleo.tipo_de_cr
    when p_veiculo_obrigatorio is true then 'frota_de_placa'::nucleo.tipo_de_cr
    else 'frota_sem_placa'::nucleo.tipo_de_cr
  end
$$;

-- Os valores brutos, quando vieram de alguém (com origem), derivam participa_da_frota e bloqueado.
create or replace function nucleo.normalizar_cr()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ad_frota_origem := case when new.ad_frota is not null then coalesce(new.ad_frota_origem, 'informada') else new.ad_frota_origem end;
  new.ad_bloqueado_origem := case when new.ad_bloqueado is not null then coalesce(new.ad_bloqueado_origem, 'informada') else new.ad_bloqueado_origem end;
  if new.ad_frota_origem is not null then
    new.participa_da_frota := coalesce(new.ad_frota = 'S', false);
    new.participa_da_frota_origem := 'derivada';
  end if;
  if new.ad_bloqueado_origem is not null then
    new.bloqueado := coalesce(new.ad_bloqueado = 'S', false);
    new.bloqueado_origem := 'derivada';
  end if;

  new.participa_da_frota_origem := case when new.participa_da_frota is null then null else coalesce(new.participa_da_frota_origem, 'informada') end;
  new.veiculo_obrigatorio_origem := case when new.veiculo_obrigatorio is null then null else coalesce(new.veiculo_obrigatorio_origem, 'informada') end;
  new.cr_pai_origem := case when new.cr_pai_id is null then null else coalesce(new.cr_pai_origem, 'informada') end;
  new.analitico_origem := case when new.analitico is null then null else coalesce(new.analitico_origem, 'informada') end;
  new.garagem_origem := case when new.garagem is null then null else coalesce(new.garagem_origem, 'informada') end;
  if new.tipo_origem is distinct from 'informada' then
    new.tipo := nucleo.tipo_do_cr(new.participa_da_frota, new.veiculo_obrigatorio);
    new.tipo_origem := 'derivada';
  end if;
  return new;
end;
$$;

-- Só o bloqueio recusa vínculo novo (o ATIVO não decide).
create or replace function nucleo.exigir_cr_liberado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.cr_id is distinct from old.cr_id)
     and new.inicio_origem = 'informada'
     and exists (select 1 from nucleo.cr where id = new.cr_id and bloqueado) then
    raise exception 'Este CR está bloqueado: não aceita vínculo novo (os vínculos antigos continuam).'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- O CR agrupador (não analítico) não aceita vínculo de nenhuma origem.
create function nucleo.recusar_cr_agrupador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.cr_id is distinct from old.cr_id)
     and exists (select 1 from nucleo.cr where id = new.cr_id and analitico is false) then
    raise exception 'Este CR é agrupador (não analítico): não aceita vínculo. Escolha um CR analítico abaixo dele.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.recusar_cr_agrupador() from public;

create trigger t12_cr_agrupador before insert or update on nucleo.cr_do_ativo
  for each row execute function nucleo.recusar_cr_agrupador();
create trigger t12_cr_agrupador before insert or update on nucleo.cr_de_servico_na_operacao
  for each row execute function nucleo.recusar_cr_agrupador();

-- O alerta de CR de serviço sem operação deixa de olhar o ATIVO.
create or replace view nucleo.alerta_de_cr with (security_invoker = true) as
  select c.id as cr_id, 'cr_sem_operacao'::text as alerta
    from nucleo.cr c
   where c.excluido_em is null
     and c.tipo = 'servico'
     and not c.bloqueado
     and c.analitico is not false
     and not exists (
       select 1 from nucleo.cr_de_servico_na_operacao s
        where s.cr_id = c.id and s.excluido_em is null and s.periodo @> now()
     );
comment on view nucleo.alerta_de_cr is
  'Pendências dos CRs: cr_sem_operacao (CR de serviço analítico e não bloqueado sem operação agora; o ATIVO não decide). Não existe alerta de CR de frota sem placa.';

-- Os CRs que já existem passam pela regra nova do tipo (o vazio em AD_FROTA é serviço).
update nucleo.cr set tipo = null where tipo is null and tipo_origem is null;
