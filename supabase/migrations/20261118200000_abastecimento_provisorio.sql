-- Lançar abastecimento (inventário 12) e a leitura do Abastecimento v2.
--
--  * O Sankhya é a fonte principal do abastecimento (hoje, o staging provisório da v1). O lançamento manual é
--    PROVISÓRIO: fica à parte, nunca soma no total do mês (o fato), e é conferido depois: "conferido" quando o
--    abastecimento chega do Sankhya (casado pelo id de origem, da mesma placa; daí em diante conta pelo fato) ou
--    "descartado" com motivo. Nada se apaga.
--  * Quem lança: o gestor da carteira (Frota › criar); quem confere: Frota › editar na placa.
--  * nucleo.abastecimento_do_mes_v2: a leitura v1 (mesmos totais, mesma paginação) mais os provisórios em aberto
--    do mês, por placa (na linha) e no total, com a lista dos pendentes.

create table nucleo.abastecimento_provisorio (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  placa text not null,
  dia date not null,
  litros numeric(12, 3) not null check (litros > 0),
  valor numeric(15, 2) check (valor >= 0),
  km numeric(12, 1) check (km >= 0),
  combustivel text,
  posto text,
  situacao text not null default 'provisorio' check (situacao in ('provisorio', 'conferido', 'descartado')),
  origem_id_sankhya text,
  lancado_por uuid references nucleo.pessoa (id),
  lancado_em timestamptz not null default now(),
  decidido_por uuid references nucleo.pessoa (id),
  decidido_em timestamptz,
  motivo_da_decisao text,
  versao integer not null default 1,
  constraint abastecimento_conferido_com_origem check ((situacao = 'conferido') = (origem_id_sankhya is not null)),
  constraint abastecimento_descartado_com_motivo check (situacao <> 'descartado' or length(btrim(coalesce(motivo_da_decisao, ''))) > 0)
);
comment on table nucleo.abastecimento_provisorio is
  'O abastecimento lançado à mão: provisório até a conferência (conferido com o abastecimento do Sankhya, ou descartado com motivo). Nunca soma no total do mês, que é o do Sankhya.';
create unique index abastecimento_provisorio_uma_conferencia_por_origem on nucleo.abastecimento_provisorio (origem_id_sankhya)
  where situacao = 'conferido';
create index abastecimento_provisorio_ativo_id_idx on nucleo.abastecimento_provisorio (ativo_id);
create index abastecimento_provisorio_dia_idx on nucleo.abastecimento_provisorio (dia) where situacao = 'provisorio';
create index abastecimento_provisorio_lancado_por_idx on nucleo.abastecimento_provisorio (lancado_por);
create index abastecimento_provisorio_decidido_por_idx on nucleo.abastecimento_provisorio (decidido_por);
alter table nucleo.abastecimento_provisorio enable row level security;
create trigger t30_versao before update on nucleo.abastecimento_provisorio
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.abastecimento_provisorio
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.abastecimento_provisorio
  for each row execute function auditoria.registrar_mudanca('id');
grant select on nucleo.abastecimento_provisorio to authenticated;
create policy abastecimento_provisorio_ler on nucleo.abastecimento_provisorio for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota'], 'ver'));

create function nucleo.lancar_abastecimento_provisorio(
  p_ativo_id uuid, p_dia date, p_litros numeric, p_valor numeric, p_km numeric,
  p_combustivel text, p_posto text, p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: o provisório não tem escrita direta; a função confere por dentro Frota › criar na placa (config.ve_ativo), o dia e os valores, e grava só este lançamento, marcado provisório; search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
  v_placa text;
begin
  if config.usuario_atual() is null or not config.ve_ativo(p_ativo_id, array['frota'], 'criar') then
    raise exception 'Você não tem permissão para lançar abastecimento nesta placa.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'lancar_abastecimento_provisorio');
  if v_id is not null then
    return v_id;
  end if;
  if p_dia is null or p_dia > nucleo.hoje_em_sao_paulo() then
    raise exception 'Lance o abastecimento de um dia até hoje.' using errcode = '22023';
  end if;
  if p_litros is null or p_litros <= 0 then
    raise exception 'Informe os litros (maiores que zero).' using errcode = '22023';
  end if;
  if (p_valor is not null and p_valor < 0) or (p_km is not null and p_km < 0) then
    raise exception 'Valor e hodômetro não são negativos.' using errcode = '22023';
  end if;
  select p.placa into v_placa from nucleo.placa_do_ativo p
   where p.ativo_id = p_ativo_id and p.excluido_em is null order by p.fim nulls first, p.inicio desc limit 1;
  if v_placa is null then
    raise exception 'Placa não encontrada.' using errcode = '23514';
  end if;
  insert into nucleo.abastecimento_provisorio (ativo_id, placa, dia, litros, valor, km, combustivel, posto, lancado_por)
  values (p_ativo_id, v_placa, p_dia, p_litros, p_valor, p_km, nullif(btrim(coalesce(p_combustivel, '')), ''),
          nullif(btrim(coalesce(p_posto, '')), ''), config.usuario_atual())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.lancar_abastecimento_provisorio(uuid, date, numeric, numeric, numeric, text, text, uuid) from public, anon;
comment on function nucleo.lancar_abastecimento_provisorio(uuid, date, numeric, numeric, numeric, text, text, uuid) is
  'Lançar abastecimento à mão: fica provisório (fora do total do mês) até a conferência com o Sankhya. Chave de envio.';

create function nucleo.conferir_abastecimento_provisorio(
  p_id uuid, p_versao integer, p_decisao text, p_origem_id text, p_motivo text, p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: a conferência grava o provisório (sem escrita direta) e lê o staging do Sankhya da mesma placa; a função confere por dentro Frota › editar na placa, a versão e a decisão, e só muda este lançamento; search_path vazio.
set search_path = ''
as $$
declare
  v nucleo.abastecimento_provisorio;
  v_id uuid;
begin
  select * into v from nucleo.abastecimento_provisorio where id = p_id for update;
  if not found or config.usuario_atual() is null or not config.ve_ativo(v.ativo_id, array['frota'], 'editar') then
    raise exception 'Você não tem permissão para conferir este abastecimento.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'conferir_abastecimento_provisorio');
  if v_id is not null then
    return v_id;
  end if;
  if p_decisao is null or p_decisao not in ('conferido', 'descartado') then
    raise exception 'Decida: conferido ou descartado.' using errcode = '22023';
  end if;
  -- A mesma decisão de novo não muda nada (roda duas vezes).
  if v.situacao = p_decisao and (p_decisao = 'descartado' or v.origem_id_sankhya = p_origem_id) then
    perform auditoria.concluir_envio(p_chave, v.id);
    return v.id;
  end if;
  if v.situacao <> 'provisorio' then
    raise exception 'Este abastecimento já foi %.', v.situacao using errcode = '23514';
  end if;
  if p_versao is distinct from v.versao then
    raise exception 'O lançamento mudou desde que você abriu: confira e decida de novo.' using errcode = '40001';
  end if;
  if p_decisao = 'conferido' then
    if not exists (select 1 from staging.abastecimento a where a.origem_id = p_origem_id and a.placa = v.placa) then
      raise exception 'Escolha o abastecimento do Sankhya desta placa que corresponde ao lançamento.' using errcode = '23514';
    end if;
    update nucleo.abastecimento_provisorio
       set situacao = 'conferido', origem_id_sankhya = p_origem_id, decidido_por = config.usuario_atual(), decidido_em = now(),
           motivo_da_decisao = nullif(btrim(coalesce(p_motivo, '')), '')
     where id = v.id;
  else
    if nullif(btrim(coalesce(p_motivo, '')), '') is null then
      raise exception 'Descartar o lançamento pede o motivo.' using errcode = '23514';
    end if;
    update nucleo.abastecimento_provisorio
       set situacao = 'descartado', decidido_por = config.usuario_atual(), decidido_em = now(), motivo_da_decisao = btrim(p_motivo)
     where id = v.id;
  end if;
  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.conferir_abastecimento_provisorio(uuid, integer, text, text, text, uuid) from public, anon;
comment on function nucleo.conferir_abastecimento_provisorio(uuid, integer, text, text, text, uuid) is
  'Confere o provisório: conferido (casado com o abastecimento do Sankhya da mesma placa; passa a contar pelo fato) ou descartado (motivo). Versão; a mesma decisão de novo não muda nada.';

create function nucleo.abastecimento_do_mes_v2(
  p_mes date default null, p_busca text default null, p_ordem text default 'placa',
  p_pagina integer default 1, p_tam integer default 50
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_base jsonb := nucleo.abastecimento_do_mes(p_mes, p_busca, p_ordem, p_pagina, p_tam);
  v_mes date := (v_base->>'mes')::date;
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_por_placa jsonb;
  v_prov jsonb;
begin
  with pend as (
    select a.* from nucleo.abastecimento_provisorio a
     where a.situacao = 'provisorio' and a.dia >= v_mes and a.dia < (v_mes + interval '1 month')::date
       and (v_busca is null or a.placa ilike '%' || replace(replace(upper(v_busca), '-', ''), ' ', '') || '%')
  )
  select coalesce((select jsonb_object_agg(x.placa, jsonb_build_object('abastecimentos', x.n, 'litros', x.litros, 'valor', x.valor))
                     from (select p.placa, count(*) as n, sum(p.litros) as litros, coalesce(sum(p.valor), 0) as valor
                             from pend p group by p.placa) x), '{}'::jsonb),
         jsonb_build_object(
           'abastecimentos', (select count(*) from pend),
           'litros', coalesce((select sum(litros) from pend), 0),
           'valor', coalesce((select sum(valor) from pend), 0),
           'linhas', coalesce((select jsonb_agg(jsonb_build_object(
                                 'id', p.id, 'versao', p.versao, 'ativo_id', p.ativo_id, 'placa', p.placa, 'dia', p.dia,
                                 'litros', p.litros, 'valor', p.valor, 'km', p.km, 'combustivel', p.combustivel,
                                 'posto', p.posto, 'lancado_em', p.lancado_em) order by p.dia desc, p.placa, p.id)
                                 from (select * from pend order by dia desc, placa, id limit 200) p), '[]'::jsonb))
    into v_por_placa, v_prov;

  return jsonb_set(v_base, '{linhas}', coalesce((
           select jsonb_agg(l || jsonb_build_object('provisorios',
                    coalesce(v_por_placa->(l->>'placa'), jsonb_build_object('abastecimentos', 0, 'litros', 0, 'valor', 0)))
                    order by o)
             from jsonb_array_elements(v_base->'linhas') with ordinality as t(l, o)), '[]'::jsonb))
         || jsonb_build_object('provisorios', v_prov);
end;
$$;
revoke all on function nucleo.abastecimento_do_mes_v2(date, text, text, integer, integer) from public, anon;
comment on function nucleo.abastecimento_do_mes_v2(date, text, text, integer, integer) is
  'Frota › Abastecimento v2: a leitura do mês (o Sankhya, o fato: mesmos totais e paginação) mais os provisórios em aberto à parte, por placa e no total, com a lista dos pendentes. Pela RLS de quem chama.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.lancar_abastecimento_provisorio(uuid,date,numeric,numeric,numeric,text,text,uuid)', 'Lançar abastecimento provisório; conferência por dentro e chave de envio.'),
  ('nucleo.conferir_abastecimento_provisorio(uuid,integer,text,text,text,uuid)', 'Conferir ou descartar o provisório; conferência por dentro, versão e chave de envio.'),
  ('nucleo.abastecimento_do_mes_v2(date,text,text,integer,integer)', 'Frota › Abastecimento v2 com os provisórios à parte, pela RLS de quem chama.');
grant execute on function nucleo.lancar_abastecimento_provisorio(uuid, date, numeric, numeric, numeric, text, text, uuid) to authenticated;
grant execute on function nucleo.conferir_abastecimento_provisorio(uuid, integer, text, text, text, uuid) to authenticated;
grant execute on function nucleo.abastecimento_do_mes_v2(date, text, text, integer, integer) to authenticated;
