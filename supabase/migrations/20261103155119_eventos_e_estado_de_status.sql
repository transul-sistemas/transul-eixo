-- Fase 3, fatia 3.5 (1 de 3): eventos de status e o estado de cada camada.
--
--  * Cinco camadas (baixada, fora da frota, impedida, sem motorista, atividade), cada uma com UM estado
--    por vez. O evento tem sigla e hora (com a origem da data) e é imutável: a correção é a exclusão
--    lógica do último evento da camada, com motivo, que desfaz o efeito dele. Evento sem sigla encerra
--    a camada.
--  * O estado de cada camada é uma vigência [início, fim) por (ativo, camada), com exclusão contra
--    sobreposição, gravada só pelo evento.
--  * Validade da sigla: o tipo do ativo tem de estar em `tipos_validos`; `aplica_a` "solo" só sem
--    composição vigente, "conjunto" só com ela, "ambos" sempre; o caminhão (que nunca tem composição)
--    depende só dos tipos.
--  * O ativo nasce com o evento inicial na mesma transação (nunca fica sem situação), e a baixa anda
--    junto do evento da camada baixada, no mesmo instante.
--
-- Tudo nasce fechado: RLS ligado, nenhum grant, nenhuma função SECURITY DEFINER.

alter table config.status add constraint status_sigla_camada_unica unique (sigla, camada);

-- O nome do tipo para as mensagens (sem código técnico na tela).
create function nucleo.nome_do_tipo(p_tipo nucleo.tipo_de_ativo)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'cavalo' then 'cavalo'
    when 'implemento' then 'implemento'
    when 'equipamento' then 'equipamento'
    when 'caminhao' then 'caminhão'
    when 'apoio' then 'apoio'
  end
$$;
revoke all on function nucleo.nome_do_tipo(nucleo.tipo_de_ativo) from public;

-- O ativo está num conjunto (como mestre ou servo) naquele instante?
create function nucleo.em_conjunto(p_ativo_id uuid, p_em timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from nucleo.composicao
     where (cavalo_id = p_ativo_id or implemento_id = p_ativo_id)
       and excluido_em is null
       and periodo @> p_em
  )
$$;
revoke all on function nucleo.em_conjunto(uuid, timestamptz) from public;

-- A sigla vale para este tipo, dentro ou fora de conjunto? O espelho é `siglaValidaNoContexto`
-- (lib/dominio/situacao.ts); um teste compara a assinatura dos dois.
create function nucleo.sigla_valida(p_sigla text, p_tipo nucleo.tipo_de_ativo, p_em_conjunto boolean)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from config.status s
     where s.sigla = p_sigla
       and p_tipo = any (s.tipos_validos)
       and (p_tipo = 'caminhao' or s.aplica_a = 'ambos' or (s.aplica_a = 'conjunto') = p_em_conjunto)
  )
$$;
revoke all on function nucleo.sigla_valida(text, nucleo.tipo_de_ativo, boolean) from public;

-- ---------------------------------------------------------------------------------------------
-- Evento de status (imutável)
-- ---------------------------------------------------------------------------------------------
create table nucleo.evento_de_status (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  camada text not null references config.camada_de_status (codigo),
  sigla text,
  em timestamptz not null,
  em_origem config.origem_da_data not null,
  origem text not null check (origem in ('operacional', 'sankhya', 'manual', 'derivado')),
  registrado_por uuid,
  registrado_em timestamptz not null default now(),
  justificativa text,
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint evento_sigla_da_camada foreign key (sigla, camada) references config.status (sigla, camada)
);
comment on table nucleo.evento_de_status is
  'Cada mudança de situação, com hora: a sigla troca o estado da sua camada; sem sigla, encerra a camada. Imutável: corrigir é excluir o último evento da camada, com motivo.';
comment on column nucleo.evento_de_status.origem is 'Quem gerou: operacional, sankhya, manual ou derivado (pelo próprio banco).';

create index evento_de_status_ativo_id_idx on nucleo.evento_de_status (ativo_id);
create index evento_de_status_camada_idx on nucleo.evento_de_status (camada);
create index evento_de_status_sigla_idx on nucleo.evento_de_status (sigla);
create unique index evento_de_status_um_por_instante_idx on nucleo.evento_de_status (ativo_id, camada, em)
  where excluido_em is null;
alter table nucleo.evento_de_status enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Estado de cada camada (vigência gravada só pelo evento)
-- ---------------------------------------------------------------------------------------------
create table nucleo.estado_de_status (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  camada text not null references config.camada_de_status (codigo),
  sigla text not null,
  inicio timestamptz not null,
  fim timestamptz,
  inicio_origem config.origem_da_data not null,
  fim_origem config.origem_da_data,
  periodo tstzrange generated always as (tstzrange(inicio, fim, '[)')) stored,
  evento_inicio_id uuid not null references nucleo.evento_de_status (id),
  evento_fim_id uuid references nucleo.evento_de_status (id),
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint estado_sigla_da_camada foreign key (sigla, camada) references config.status (sigla, camada),
  constraint estado_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint estado_fim_com_origem check ((fim is null) = (fim_origem is null)),
  constraint estado_um_por_camada exclude using gist (ativo_id with =, camada with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.estado_de_status is
  'O estado de cada camada de um ativo ao longo do tempo, [início, fim), um por vez. Gravado só pelos eventos de status.';

create index estado_de_status_ativo_id_idx on nucleo.estado_de_status (ativo_id);
create index estado_de_status_camada_idx on nucleo.estado_de_status (camada);
create index estado_de_status_sigla_idx on nucleo.estado_de_status (sigla);
create index estado_de_status_evento_inicio_id_idx on nucleo.estado_de_status (evento_inicio_id);
create index estado_de_status_evento_fim_id_idx on nucleo.estado_de_status (evento_fim_id);
create index estado_de_status_aberto_idx on nucleo.estado_de_status (ativo_id, camada) where excluido_em is null;
alter table nucleo.estado_de_status enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Gatilhos do evento
-- ---------------------------------------------------------------------------------------------
create function nucleo.validar_evento_de_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo nucleo.tipo_de_ativo;
  v_aplica text;
  v_ultimo timestamptz;
begin
  if new.sigla is not null then
    select camada, aplica_a into new.camada, v_aplica from config.status where sigla = new.sigla;
    if not found then
      raise exception 'A situação % não existe na régua.', new.sigla using errcode = '23514';
    end if;
  end if;
  if new.camada is null then
    raise exception 'Informe a camada que o evento encerra.' using errcode = '23514';
  end if;

  select tipo into v_tipo from nucleo.ativo where id = new.ativo_id;

  if new.sigla is not null then
    if not nucleo.sigla_valida(new.sigla, v_tipo, true) and not nucleo.sigla_valida(new.sigla, v_tipo, false) then
      raise exception 'A situação % não vale para %.', new.sigla, nucleo.nome_do_tipo(v_tipo) using errcode = '23514';
    end if;
    if not nucleo.sigla_valida(new.sigla, v_tipo, nucleo.em_conjunto(new.ativo_id, new.em)) then
      if v_aplica = 'conjunto' then
        raise exception 'A situação % só vale para conjunto (cavalo com implemento engatado).', new.sigla using errcode = '23514';
      else
        raise exception 'A situação % só vale fora de conjunto.', new.sigla using errcode = '23514';
      end if;
    end if;
    if new.camada = 'baixada' and not exists (
      select 1 from nucleo.baixa_do_ativo
       where ativo_id = new.ativo_id and sigla = new.sigla and em = new.em and excluido_em is null
    ) then
      raise exception 'O evento da camada baixada só nasce com a baixa: registre a baixa (venda ou sucata).' using errcode = '23514';
    end if;
  else
    if new.camada = 'baixada' then
      raise exception 'A baixa não se encerra por evento.' using errcode = '23514';
    end if;
    if not exists (
      select 1 from nucleo.estado_de_status
       where ativo_id = new.ativo_id and camada = new.camada and fim is null and excluido_em is null
    ) then
      raise exception 'Não há situação aberta na camada % para encerrar.', new.camada using errcode = '23514';
    end if;
  end if;

  select max(em) into v_ultimo
    from nucleo.evento_de_status
   where ativo_id = new.ativo_id and camada = new.camada and excluido_em is null;
  if v_ultimo is not null and new.em <= v_ultimo then
    raise exception 'Evento fora de ordem: a camada % já tem evento em %. Para corrigir, exclua o último evento (com o motivo) e registre de novo.', new.camada, v_ultimo
      using errcode = '23514';
  end if;

  new.registrado_por := coalesce(new.registrado_por, auth.uid());
  return new;
end;
$$;
revoke all on function nucleo.validar_evento_de_status() from public;

-- O evento troca o estado da camada: fecha o aberto no instante dele e, com sigla, abre o novo.
create function nucleo.aplicar_evento_de_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('eixo.estado_pelo_evento', 'sim', true);
  update nucleo.estado_de_status
     set fim = new.em, fim_origem = new.em_origem, evento_fim_id = new.id
   where ativo_id = new.ativo_id and camada = new.camada and fim is null and excluido_em is null;
  if new.sigla is not null then
    insert into nucleo.estado_de_status (ativo_id, camada, sigla, inicio, inicio_origem, evento_inicio_id)
    values (new.ativo_id, new.camada, new.sigla, new.em, new.em_origem, new.id);
  end if;
  perform set_config('eixo.estado_pelo_evento', '', true);
  return null;
end;
$$;
revoke all on function nucleo.aplicar_evento_de_status() from public;

-- Imutável: só se marca a exclusão lógica do último evento da camada, com motivo.
create function nucleo.proteger_evento_de_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_campos text[] := array['excluido_em', 'excluido_por', 'motivo_da_exclusao'];
begin
  if (to_jsonb(new) - v_campos) is distinct from (to_jsonb(old) - v_campos) then
    raise exception 'Evento de status não se altera: para corrigir, exclua o último evento da camada (com o motivo) e registre de novo.'
      using errcode = '23514';
  end if;
  if old.excluido_em is not null then
    raise exception 'Este evento já foi excluído.' using errcode = '23514';
  end if;
  if new.excluido_em is null then
    return new;
  end if;
  if nullif(btrim(coalesce(new.motivo_da_exclusao, '')), '') is null then
    raise exception 'Excluir um evento de status exige o motivo.' using errcode = '23514';
  end if;
  if old.camada = 'baixada' then
    raise exception 'O evento da baixa não se exclui por aqui.' using errcode = '23514';
  end if;
  if exists (
    select 1 from nucleo.evento_de_status
     where ativo_id = old.ativo_id and camada = old.camada and excluido_em is null and em > old.em
  ) then
    raise exception 'Só o último evento da camada pode ser excluído.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.proteger_evento_de_status() from public;

-- Excluir o último evento desfaz o efeito dele: o estado que ele abriu sai, o que ele fechou reabre.
create function nucleo.desfazer_evento_de_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.excluido_em is null and new.excluido_em is not null then
    perform set_config('eixo.estado_pelo_evento', 'sim', true);
    update nucleo.estado_de_status
       set excluido_em = new.excluido_em, excluido_por = new.excluido_por, motivo_da_exclusao = new.motivo_da_exclusao
     where evento_inicio_id = new.id;
    update nucleo.estado_de_status
       set fim = null, fim_origem = null, evento_fim_id = null
     where evento_fim_id = new.id;
    perform set_config('eixo.estado_pelo_evento', '', true);
  end if;
  return null;
end;
$$;
revoke all on function nucleo.desfazer_evento_de_status() from public;

create function nucleo.estado_so_pelo_evento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('eixo.estado_pelo_evento', true), '') <> 'sim' then
    raise exception 'O estado da camada só muda por evento de status.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.estado_so_pelo_evento() from public;

create trigger t10_validar before insert on nucleo.evento_de_status
  for each row execute function nucleo.validar_evento_de_status();
create trigger t20_imutavel before update on nucleo.evento_de_status
  for each row execute function nucleo.proteger_evento_de_status();
create trigger t40_sem_exclusao_fisica before delete on nucleo.evento_de_status
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t50_aplicar after insert on nucleo.evento_de_status
  for each row execute function nucleo.aplicar_evento_de_status();
create trigger t55_desfazer after update on nucleo.evento_de_status
  for each row execute function nucleo.desfazer_evento_de_status();
create trigger t90_auditoria after insert or update or delete on nucleo.evento_de_status
  for each row execute function auditoria.registrar_mudanca('id');

create trigger t05_so_pelo_evento before insert or update on nucleo.estado_de_status
  for each row execute function nucleo.estado_so_pelo_evento();
create trigger t10_intervalo before insert or update on nucleo.estado_de_status
  for each row execute function nucleo.conferir_intervalo_da_vigencia();
create trigger t40_sem_exclusao_fisica before delete on nucleo.estado_de_status
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.estado_de_status
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- O ativo nasce com o evento inicial; a baixa anda com o evento da camada baixada.
-- ---------------------------------------------------------------------------------------------
create function nucleo.exigir_evento_inicial()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from nucleo.ativo where id = new.id and excluido_em is null)
     and not exists (select 1 from nucleo.evento_de_status where ativo_id = new.id and excluido_em is null) then
    raise exception 'O ativo precisa da situação inicial (evento de status) na mesma transação do cadastro.'
      using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function nucleo.exigir_evento_inicial() from public;

create constraint trigger t97_evento_inicial after insert on nucleo.ativo
  deferrable initially deferred
  for each row execute function nucleo.exigir_evento_inicial();

create function nucleo.exigir_evento_da_baixa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.excluido_em is null and not exists (
    select 1 from nucleo.evento_de_status
     where ativo_id = new.ativo_id and camada = 'baixada' and sigla = new.sigla and em = new.em and excluido_em is null
  ) then
    raise exception 'A baixa precisa do evento da camada baixada (%) no mesmo instante.', new.sigla
      using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function nucleo.exigir_evento_da_baixa() from public;

create constraint trigger t96_evento_da_baixa after insert on nucleo.baixa_do_ativo
  deferrable initially deferred
  for each row execute function nucleo.exigir_evento_da_baixa();

-- ---------------------------------------------------------------------------------------------
-- Registrar um evento: a camada vem da sigla; sem sigla, diga a camada que encerra.
-- ---------------------------------------------------------------------------------------------
create function nucleo.registrar_evento(
  p_ativo_id uuid,
  p_sigla text,
  p_em timestamptz,
  p_origem text default 'manual',
  p_em_origem config.origem_da_data default 'informada',
  p_justificativa text default null,
  p_camada text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into nucleo.evento_de_status (ativo_id, camada, sigla, em, em_origem, origem, justificativa)
  values (p_ativo_id, p_camada, p_sigla, p_em, p_em_origem, p_origem, p_justificativa)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function nucleo.registrar_evento(uuid, text, timestamptz, text, config.origem_da_data, text, text) from public;
