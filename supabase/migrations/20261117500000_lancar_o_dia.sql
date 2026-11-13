-- A2, Lançar o dia (inventário 5, 6 e 7). Decisões de Alexandre: mesma sigla e mesma hora para todos no lote,
-- tudo ou nada com "X de Y"; Programado sim (fora do realizado, de "X de Y" e do resultado).
--
-- Funções (assinaturas que a tela usa):
--  * nucleo.lancar_situacao_na_hora(p_ativo_id, p_sigla, p_em) -> uuid (o evento): a regra de lancar_situacao_do_dia
--    com a hora escolhida (fecha as camadas de prioridade maior e registra o evento, pela política do evento).
--  * nucleo.lancar_o_dia_em_lote(p_ativos uuid[], p_sigla, p_dia, p_hora, p_chave) -> jsonb
--      {lote_id, total, lancados, recusados[{ativo_id, motivo}], repetido}: tudo ou nada (um recusado, nada grava).
--  * nucleo.programar_situacao(p_ativo_id, p_dia, p_sigla, p_hora, p_chave) -> uuid (dia futuro)
--  * nucleo.confirmar_situacao_programada(p_programada_id, p_versao, p_chave) -> uuid (o evento)
--  * nucleo.cancelar_situacao_programada(p_programada_id, p_motivo, p_chave) -> uuid
--  * nucleo.situacoes_programadas(p_de, p_ate) -> setof (as abertas no período, para a grade tracejada)
--  * nucleo.corrigir_ultimo_evento(p_evento_id, p_motivo, p_nova_sigla, p_chave) -> uuid (o evento excluído)

-- ---------------------------------------------------------------------------------------------
-- Lançar na hora escolhida (o corpo de lancar_situacao_do_dia, com o instante dado)
-- ---------------------------------------------------------------------------------------------
create function nucleo.lancar_situacao_na_hora(p_ativo_id uuid, p_sigla text, p_em timestamptz)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_camada text;
  v_prioridade smallint;
  v_aberta text;
begin
  if not config.ve_ativo(p_ativo_id, array['frota', 'operacional'], 'criar') then
    raise exception 'Você não tem permissão para lançar a situação desta placa.' using errcode = '42501';
  end if;
  if p_em is null or p_em > now() then
    raise exception 'Não se lança a situação de uma hora que ainda não chegou.' using errcode = '22023';
  end if;
  select s.camada, c.prioridade into v_camada, v_prioridade
    from config.status s join config.camada_de_status c on c.codigo = s.camada
   where s.sigla = p_sigla;
  if not found then
    raise exception 'A situação % não existe na régua.', p_sigla using errcode = '23514';
  end if;
  if v_camada = 'baixada' then
    raise exception 'A baixa (venda ou sucata) se pede pela ficha da placa, não pela grade.' using errcode = '23514';
  end if;
  for v_aberta in
    select e.camada from nucleo.estado_de_status e join config.camada_de_status c on c.codigo = e.camada
     where e.ativo_id = p_ativo_id and e.fim is null and e.excluido_em is null
       and c.prioridade < v_prioridade and e.camada <> 'baixada'
     order by c.prioridade
  loop
    perform nucleo.registrar_evento(p_ativo_id, null, p_em, 'manual', 'informada', 'Lançar o dia', v_aberta);
  end loop;
  return nucleo.registrar_evento(p_ativo_id, p_sigla, p_em, 'manual', 'informada', 'Lançar o dia');
end;
$$;
revoke all on function nucleo.lancar_situacao_na_hora(uuid, text, timestamptz) from public;
comment on function nucleo.lancar_situacao_na_hora(uuid, text, timestamptz) is
  'Lança a situação num instante escolhido: confere a permissão, fecha as camadas de prioridade maior abertas e registra o evento (pela política do evento). Devolve o evento.';

-- ---------------------------------------------------------------------------------------------
-- O lote: tudo ou nada
-- ---------------------------------------------------------------------------------------------
create function nucleo.lancar_o_dia_em_lote(p_ativos uuid[], p_sigla text, p_dia date, p_hora time, p_chave uuid default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_em timestamptz;
  v_ativo uuid;
  v_recusados jsonb := '[]'::jsonb;
  v_lancados integer := 0;
  v_total integer := coalesce(cardinality(p_ativos), 0);
  v_lote uuid;
begin
  if v_total = 0 then
    raise exception 'Escolha ao menos um conjunto para lançar.' using errcode = '22023';
  end if;
  if p_dia is null or p_hora is null or p_dia > nucleo.hoje_em_sao_paulo() then
    raise exception 'Lance um dia até hoje, com a hora (dia futuro se programa).' using errcode = '22023';
  end if;
  v_em := (p_dia + p_hora) at time zone 'America/Sao_Paulo';
  if v_em > now() then
    raise exception 'A hora escolhida ainda não chegou.' using errcode = '22023';
  end if;

  v_lote := auditoria.reservar_envio(p_chave, 'lancar_o_dia_em_lote');
  if v_lote is not null then
    return jsonb_build_object('lote_id', v_lote, 'total', v_total, 'lancados', null, 'recusados', '[]'::jsonb, 'repetido', true);
  end if;
  v_lote := gen_random_uuid();

  begin
    foreach v_ativo in array p_ativos loop
      begin
        perform nucleo.lancar_situacao_na_hora(v_ativo, p_sigla, v_em);
        v_lancados := v_lancados + 1;
      exception when others then
        v_recusados := v_recusados || jsonb_build_object('ativo_id', v_ativo, 'motivo', sqlerrm, 'codigo', sqlstate);
      end;
    end loop;
    if jsonb_array_length(v_recusados) > 0 then
      -- Tudo ou nada: desfaz o que entrou do lote.
      raise exception 'lote recusado' using errcode = 'P0002';
    end if;
  exception when sqlstate 'P0002' then
    v_lancados := 0;
  end;

  if v_lancados > 0 then
    perform auditoria.concluir_envio(p_chave, v_lote);
  end if;
  return jsonb_build_object('lote_id', v_lote, 'total', v_total, 'lancados', v_lancados, 'recusados', v_recusados, 'repetido', false);
end;
$$;
revoke all on function nucleo.lancar_o_dia_em_lote(uuid[], text, date, time, uuid) from public;
comment on function nucleo.lancar_o_dia_em_lote(uuid[], text, date, time, uuid) is
  'Lançar o dia em lote: a mesma sigla e a mesma hora para vários conjuntos, tudo ou nada; devolve "lançados de total" e os recusados com o motivo (a tela oferece remover e lançar os outros). Pela política do evento, com chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Programado
-- ---------------------------------------------------------------------------------------------
create table nucleo.situacao_programada (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  dia date not null,
  hora time not null,
  sigla text not null references config.status (sigla),
  situacao text not null default 'programada' check (situacao in ('programada', 'confirmada', 'cancelada')),
  programado_por uuid references nucleo.pessoa (id),
  programado_em timestamptz not null default now(),
  decidido_por uuid references nucleo.pessoa (id),
  decidido_em timestamptz,
  motivo_do_cancelamento text,
  evento_id uuid references nucleo.evento_de_status (id),
  versao integer not null default 1,
  constraint programada_confirmada_com_evento check ((situacao = 'confirmada') = (evento_id is not null)),
  constraint programada_cancelada_com_motivo check (situacao <> 'cancelada' or length(btrim(coalesce(motivo_do_cancelamento, ''))) > 0)
);
comment on table nucleo.situacao_programada is
  'A situação programada para um dia futuro (Programado): fica fora do realizado, de "X de Y" e do resultado até ser confirmada no dia, quando vira evento. Uma aberta por conjunto e dia.';
create unique index situacao_programada_uma_por_dia on nucleo.situacao_programada (ativo_id, dia) where situacao = 'programada';
create index situacao_programada_ativo_id_idx on nucleo.situacao_programada (ativo_id);
create index situacao_programada_sigla_idx on nucleo.situacao_programada (sigla);
create index situacao_programada_programado_por_idx on nucleo.situacao_programada (programado_por);
create index situacao_programada_decidido_por_idx on nucleo.situacao_programada (decidido_por);
create index situacao_programada_evento_id_idx on nucleo.situacao_programada (evento_id);
create index situacao_programada_dia_idx on nucleo.situacao_programada (dia) where situacao = 'programada';
alter table nucleo.situacao_programada enable row level security;
create trigger t30_versao before update on nucleo.situacao_programada
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.situacao_programada
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.situacao_programada
  for each row execute function auditoria.registrar_mudanca('id');
grant select on nucleo.situacao_programada to authenticated;
create policy situacao_programada_ler on nucleo.situacao_programada for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver'));

create function nucleo.programar_situacao(p_ativo_id uuid, p_dia date, p_sigla text, p_hora time, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: a programada não tem grant de escrita para o app; a função confere por dentro a mesma permissão de lançar a situação (config.ve_ativo, Frota ou Operacional › criar) e grava só a programada deste conjunto e dia; search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if config.usuario_atual() is null or not config.ve_ativo(p_ativo_id, array['frota', 'operacional'], 'criar') then
    raise exception 'Você não tem permissão para programar a situação desta placa.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'programar_situacao');
  if v_id is not null then
    return v_id;
  end if;
  if p_dia is null or p_dia <= nucleo.hoje_em_sao_paulo() or p_hora is null then
    raise exception 'Programar é para um dia futuro, com a hora; hoje e os dias que passaram se lançam.' using errcode = '22023';
  end if;
  if not exists (select 1 from config.status where sigla = p_sigla and camada <> 'baixada') then
    raise exception 'A situação % não se programa.', p_sigla using errcode = '23514';
  end if;

  update nucleo.situacao_programada set sigla = p_sigla, hora = p_hora
   where ativo_id = p_ativo_id and dia = p_dia and situacao = 'programada'
  returning id into v_id;
  if v_id is null then
    insert into nucleo.situacao_programada (ativo_id, dia, hora, sigla, programado_por)
    values (p_ativo_id, p_dia, p_hora, p_sigla, config.usuario_atual())
    returning id into v_id;
  end if;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.programar_situacao(uuid, date, text, time, uuid) from public;

create function nucleo.confirmar_situacao_programada(p_programada_id uuid, p_versao integer, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: confirmar grava a programada (sem grant para o app) e o evento; a função confere por dentro a permissão de lançar a situação (nucleo.lancar_situacao_na_hora confere de novo), a versão e o dia, e só mexe nesta programada; search_path vazio.
set search_path = ''
as $$
declare
  v nucleo.situacao_programada;
  v_evento uuid;
begin
  select * into v from nucleo.situacao_programada where id = p_programada_id for update;
  if not found or config.usuario_atual() is null or not config.ve_ativo(v.ativo_id, array['frota', 'operacional'], 'criar') then
    raise exception 'Você não tem permissão para confirmar esta situação.' using errcode = '42501';
  end if;
  v_evento := auditoria.reservar_envio(p_chave, 'confirmar_situacao_programada');
  if v_evento is not null then
    return v_evento;
  end if;
  if v.situacao <> 'programada' then
    raise exception 'Esta situação já está %.', v.situacao using errcode = '23514';
  end if;
  if p_versao is distinct from v.versao then
    raise exception 'A programação mudou desde que você abriu: confira e confirme de novo.' using errcode = '40001';
  end if;
  if v.dia > nucleo.hoje_em_sao_paulo() or ((v.dia + v.hora) at time zone 'America/Sao_Paulo') > now() then
    raise exception 'A situação programada só se confirma quando o dia e a hora chegarem.' using errcode = '23514';
  end if;

  v_evento := nucleo.lancar_situacao_na_hora(v.ativo_id, v.sigla, (v.dia + v.hora) at time zone 'America/Sao_Paulo');
  update nucleo.situacao_programada
     set situacao = 'confirmada', evento_id = v_evento, decidido_por = config.usuario_atual(), decidido_em = now()
   where id = v.id;
  perform auditoria.concluir_envio(p_chave, v_evento);
  return v_evento;
end;
$$;
revoke all on function nucleo.confirmar_situacao_programada(uuid, integer, uuid) from public;

create function nucleo.cancelar_situacao_programada(p_programada_id uuid, p_motivo text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: cancelar grava a programada (sem grant para o app); a função confere por dentro a permissão de lançar a situação do conjunto e só muda esta programada, com o motivo; search_path vazio.
set search_path = ''
as $$
declare
  v nucleo.situacao_programada;
  v_id uuid;
begin
  select * into v from nucleo.situacao_programada where id = p_programada_id for update;
  if not found or config.usuario_atual() is null or not config.ve_ativo(v.ativo_id, array['frota', 'operacional'], 'criar') then
    raise exception 'Você não tem permissão para cancelar esta situação.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'cancelar_situacao_programada');
  if v_id is not null then
    return v_id;
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Cancelar a programação pede o motivo.' using errcode = '23514';
  end if;
  if v.situacao <> 'programada' then
    raise exception 'Esta situação já está %.', v.situacao using errcode = '23514';
  end if;
  update nucleo.situacao_programada
     set situacao = 'cancelada', motivo_do_cancelamento = btrim(p_motivo), decidido_por = config.usuario_atual(), decidido_em = now()
   where id = v.id;
  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.cancelar_situacao_programada(uuid, text, uuid) from public;

create function nucleo.situacoes_programadas(p_de date, p_ate date)
returns table (id uuid, versao integer, ativo_id uuid, placa text, dia date, hora time, sigla text, grupo text)
language sql
stable
set search_path = ''
as $$
  select p.id, p.versao, p.ativo_id, l.placa, p.dia, p.hora, p.sigla, s.chip
    from nucleo.situacao_programada p
    left join nucleo.leitura_da_placa l on l.ativo_id = p.ativo_id
    left join config.status s on s.sigla = p.sigla
   where p.situacao = 'programada' and p.dia between p_de and p_ate
   order by p.dia, l.placa, p.id
$$;
revoke all on function nucleo.situacoes_programadas(date, date) from public;
comment on function nucleo.situacoes_programadas(date, date) is
  'As situações programadas em aberto no período (a célula tracejada da grade), com a RLS de quem consulta. Não entram no realizado.';

-- ---------------------------------------------------------------------------------------------
-- Corrigir o último evento
-- ---------------------------------------------------------------------------------------------
create function nucleo.corrigir_ultimo_evento(p_evento_id uuid, p_motivo text, p_nova_sigla text default null, p_chave uuid default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v record;
  v_id uuid;
begin
  select e.id, e.ativo_id, e.camada, e.em, e.excluido_em into v from nucleo.evento_de_status e where e.id = p_evento_id;
  if v.id is null or not config.ve_ativo(v.ativo_id, array['frota', 'operacional'], 'editar') then
    raise exception 'Você não tem permissão para corrigir este evento.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'corrigir_ultimo_evento');
  if v_id is not null then
    return v_id;
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Corrigir o evento pede o motivo.' using errcode = '23514';
  end if;

  -- A exclusão lógica passa pela política e pelos gatilhos do evento: só o último da camada, com motivo, e o
  -- estado volta ao anterior.
  update nucleo.evento_de_status
     set excluido_em = now(), excluido_por = config.usuario_atual(), motivo_da_exclusao = btrim(p_motivo)
   where id = v.id;
  if nullif(btrim(coalesce(p_nova_sigla, '')), '') is not null then
    perform nucleo.lancar_situacao_na_hora(v.ativo_id, p_nova_sigla, v.em);
  end if;

  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.corrigir_ultimo_evento(uuid, text, text, uuid) from public;
comment on function nucleo.corrigir_ultimo_evento(uuid, text, text, uuid) is
  'Corrige o último evento da camada: exclusão lógica com motivo (que desfaz o efeito) e, se informada, a sigla certa na mesma hora. Pela política do evento; nada some do histórico.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.lancar_situacao_na_hora(uuid,text,timestamp with time zone)', 'Lançar o dia: a situação numa hora escolhida, pela política do evento, com a permissão conferida.'),
  ('nucleo.lancar_o_dia_em_lote(uuid[],text,date,time without time zone,uuid)', 'Lançar o dia em lote (tudo ou nada, "X de Y"), pela política do evento, com chave de envio.'),
  ('nucleo.programar_situacao(uuid,date,text,time without time zone,uuid)', 'Programado: grava a situação de um dia futuro. Conferência por dentro e chave de envio.'),
  ('nucleo.confirmar_situacao_programada(uuid,integer,uuid)', 'Programado: confirma no dia (vira evento). Conferência por dentro, versão e chave de envio.'),
  ('nucleo.cancelar_situacao_programada(uuid,text,uuid)', 'Programado: cancela com motivo. Conferência por dentro e chave de envio.'),
  ('nucleo.situacoes_programadas(date,date)', 'Programado: as abertas no período, com a RLS de quem consulta.'),
  ('nucleo.corrigir_ultimo_evento(uuid,text,text,uuid)', 'Corrigir o último evento: exclusão lógica com motivo, pela política do evento, com chave de envio.');
grant execute on function nucleo.lancar_situacao_na_hora(uuid, text, timestamptz) to authenticated;
grant execute on function nucleo.lancar_o_dia_em_lote(uuid[], text, date, time, uuid) to authenticated;
grant execute on function nucleo.programar_situacao(uuid, date, text, time, uuid) to authenticated;
grant execute on function nucleo.confirmar_situacao_programada(uuid, integer, uuid) to authenticated;
grant execute on function nucleo.cancelar_situacao_programada(uuid, text, uuid) to authenticated;
grant execute on function nucleo.situacoes_programadas(date, date) to authenticated;
grant execute on function nucleo.corrigir_ultimo_evento(uuid, text, text, uuid) to authenticated;
