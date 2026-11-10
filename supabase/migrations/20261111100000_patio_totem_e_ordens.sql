-- Operacional (primeira versão): o Pátio, a fila do totem e as ordens de carregamento.
--
--  * A custódia (nucleo.custodia) diz com quem está a placa. A Frota entrega ao Operacional da filial
--    (nucleo.entregar_ao_operacional: custódia e DOp juntos). Daqui em diante o Operacional avança a
--    placa pela régua: DOp → ACe (aceitar) → CAr (criar a ordem de carregamento) → CAn (concluir o
--    carregamento) → ETc (liberar a viagem: a custódia volta ao gestor). Antes de carregar, o
--    Operacional pode devolver a placa ao gestor (PÁT, com o motivo).
--  * Fila (operacional.chegada): o motorista registra a chegada no totem pela placa; a fila de cada
--    filial é a ordem de chegada (desempate pelo id). A placa sai da fila quando a ordem nasce ou
--    quando volta ao gestor.
--  * Ordem de carregamento (operacional.ordem_de_carregamento): nasce da placa aceita (ACe), com a
--    operação, o destino e a data prevista de saída, e registra o CAr na mesma transação. Guarda a
--    placa do momento da ordem (o retrato do documento), para a ordem continuar legível depois que a
--    placa volta ao gestor.
--  * Escopo: config.ve_filial (tudo, ou a filial do usuário). As tabelas não têm INSERT nem UPDATE
--    diretos: só as funções gravam, e rodam como dono depois de conferir a permissão e a filial da
--    custódia vigente. A leitura (patio_da_filial e ordens_de_carregamento) roda com a RLS de quem
--    consulta e entrega as contagens prontas.

grant usage on schema operacional to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Escopo por filial
-- ---------------------------------------------------------------------------------------------
create function config.ve_filial(p_filial_id uuid, p_modulo text, p_acao text)
returns boolean
language sql
stable
security definer -- justificativa: lê a tabela de permissões e as filiais do próprio usuário (auth.uid()) sem passar pelas políticas que chamam esta função; search_path vazio.
set search_path = ''
as $$
  with eu as (
    select u.pessoa_id, u.perfil from nucleo.usuario u where u.auth_user_id = (select auth.uid()) and u.ativo
  ),
  escopos as (
    select p.escopo from config.permissao_do_perfil p join eu on eu.perfil = p.perfil
     where p.modulo = p_modulo and p.acao = p_acao
  )
  select exists (select 1 from escopos where escopo = 'tudo')
      or (exists (select 1 from escopos where escopo = 'filial') and exists (
        select 1 from nucleo.usuario_filial uf join eu on eu.pessoa_id = uf.usuario_id
         where uf.filial_id = p_filial_id))
$$;
revoke all on function config.ve_filial(uuid, text, text) from public;
comment on function config.ve_filial(uuid, text, text) is
  'O usuário alcança a filial com a ação no módulo? Escopo tudo, ou filial (a filial é uma das suas).';

-- ---------------------------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------------------------
create table operacional.chegada (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  filial_id uuid not null references config.filial (id),
  chegou_em timestamptz not null,
  registrada_por uuid,
  saiu_em timestamptz,
  motivo_da_saida text check (motivo_da_saida in ('carregamento', 'devolucao')),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  constraint chegada_saida_com_motivo check ((saiu_em is null) = (motivo_da_saida is null)),
  constraint chegada_saida_depois_da_chegada check (saiu_em is null or saiu_em >= chegou_em)
);
comment on table operacional.chegada is
  'A fila do totem: cada chegada de placa à filial, por ordem de chegada. Sai da fila quando nasce a ordem de carregamento ou quando a placa volta ao gestor. Só as funções gravam.';
create index chegada_ativo_id_idx on operacional.chegada (ativo_id);
create index chegada_filial_id_idx on operacional.chegada (filial_id);
create unique index chegada_uma_aberta_por_ativo_idx on operacional.chegada (ativo_id) where saiu_em is null;
create index chegada_fila_idx on operacional.chegada (filial_id, chegou_em, id) where saiu_em is null;
alter table operacional.chegada enable row level security;

create trigger t30_versao before update on operacional.chegada
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on operacional.chegada
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on operacional.chegada
  for each row execute function auditoria.registrar_mudanca('id');

create table operacional.ordem_de_carregamento (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  ativo_id uuid not null references nucleo.ativo (id),
  placa text not null,
  filial_id uuid not null references config.filial (id),
  operacao_id uuid not null references nucleo.operacao (id),
  destino text not null check (length(btrim(destino)) between 1 and 120),
  data_prevista date not null,
  situacao text not null default 'carregando' check (situacao in ('carregando', 'carregada', 'em_viagem')),
  criada_em timestamptz not null,
  criada_por uuid,
  carregada_em timestamptz,
  saiu_em timestamptz,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  constraint ordem_carregada_com_data check ((situacao in ('carregada', 'em_viagem')) = (carregada_em is not null)),
  constraint ordem_saida_com_data check ((situacao = 'em_viagem') = (saiu_em is not null))
);
comment on table operacional.ordem_de_carregamento is
  'A ordem de carregamento: nasce da placa aceita no pátio (CAr), é concluída (CAn) e sai em viagem (ETc). Guarda a placa do momento da ordem. Só as funções gravam.';
comment on column operacional.ordem_de_carregamento.placa is
  'A placa no momento da ordem (o retrato do documento); a placa da frota continua sendo uma só, em nucleo.placa_do_ativo.';
create index ordem_de_carregamento_ativo_id_idx on operacional.ordem_de_carregamento (ativo_id);
create index ordem_de_carregamento_filial_id_idx on operacional.ordem_de_carregamento (filial_id);
create index ordem_de_carregamento_operacao_id_idx on operacional.ordem_de_carregamento (operacao_id);
create index ordem_de_carregamento_situacao_idx on operacional.ordem_de_carregamento (situacao);
create index ordem_de_carregamento_criada_em_idx on operacional.ordem_de_carregamento (criada_em desc, numero desc);
create unique index ordem_de_carregamento_uma_aberta_por_ativo_idx on operacional.ordem_de_carregamento (ativo_id)
  where situacao in ('carregando', 'carregada');
alter table operacional.ordem_de_carregamento enable row level security;

create trigger t30_versao before update on operacional.ordem_de_carregamento
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on operacional.ordem_de_carregamento
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on operacional.ordem_de_carregamento
  for each row execute function auditoria.registrar_mudanca('id');

-- Leitura pela filial (as gravações só pelas funções: sem INSERT nem UPDATE para authenticated).
create policy chegada_ler on operacional.chegada for select to authenticated
  using (config.ve_filial(filial_id, 'operacional', 'ver'));
create policy ordem_de_carregamento_ler on operacional.ordem_de_carregamento for select to authenticated
  using (config.ve_filial(filial_id, 'operacional', 'ver'));
grant select on operacional.chegada, operacional.ordem_de_carregamento to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Apoio das funções que gravam (não é executável pelo app: só as funções abaixo a chamam)
-- ---------------------------------------------------------------------------------------------

-- Trava a placa e devolve a custódia vigente do Operacional; confere que quem age alcança a filial.
create function nucleo.placa_no_patio_para_agir(
  p_ativo_id uuid, p_acao text, p_em timestamptz,
  out custodia_id uuid, out filial_id uuid, out inicio timestamptz
)
language plpgsql
set search_path = ''
as $$
begin
  if not config.pode('operacional', p_acao) then
    raise exception 'Você não tem permissão para agir no pátio. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  perform 1 from nucleo.ativo where id = p_ativo_id and excluido_em is null for update;
  if not found then
    raise exception 'Esta placa não está no pátio da sua filial.' using errcode = '23514';
  end if;
  select c.id, c.filial_id, c.inicio into custodia_id, filial_id, inicio
    from nucleo.custodia c
   where c.ativo_id = p_ativo_id and c.com_quem = 'operacional' and c.excluido_em is null and c.fim is null;
  if custodia_id is null or not config.ve_filial(filial_id, 'operacional', p_acao) then
    raise exception 'Esta placa não está no pátio da sua filial.' using errcode = '23514';
  end if;
  if p_em is null or p_em > now() + interval '5 minutes' then
    raise exception 'O registro do pátio é de agora ou do passado, nunca do futuro.' using errcode = '22023';
  end if;
  if p_em <= inicio then
    raise exception 'O registro tem de ser depois da entrega da placa ao Operacional.' using errcode = '22023';
  end if;
end;
$$;
revoke all on function nucleo.placa_no_patio_para_agir(uuid, text, timestamptz) from public;

-- Fecha a custódia do Operacional e devolve a placa ao gestor, no mesmo instante.
create function nucleo.devolver_custodia_ao_gestor(p_ativo_id uuid, p_custodia_id uuid, p_em timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update nucleo.custodia set fim = p_em, fim_origem = 'informada' where id = p_custodia_id;
  insert into nucleo.custodia (ativo_id, com_quem, filial_id, inicio, inicio_origem)
  values (p_ativo_id, 'gestor', null, p_em, 'informada');
end;
$$;
revoke all on function nucleo.devolver_custodia_ao_gestor(uuid, uuid, timestamptz) from public;

-- A posição na fila da chegada aberta (1 = a primeira), ou nula.
create function nucleo.posicao_na_fila(p_chegada_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
    from operacional.chegada c
    join operacional.chegada eu on eu.id = p_chegada_id and eu.saiu_em is null
   where c.filial_id = eu.filial_id and c.saiu_em is null
     and (c.chegou_em, c.id) <= (eu.chegou_em, eu.id)
  having count(*) > 0
$$;
revoke all on function nucleo.posicao_na_fila(uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- Totem: registrar a chegada
-- ---------------------------------------------------------------------------------------------
create function nucleo.registrar_chegada(p_placa text, p_em timestamptz default now(), p_chave uuid default null)
returns jsonb
language plpgsql
security definer -- justificativa: sem INSERT direto na fila; a função confere operacional.criar, a custódia vigente na filial de quem registra e a situação (DOp ou ACe); search_path vazio.
set search_path = ''
as $$
declare
  v_placa text := upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g'));
  v_ativo uuid;
  v_custodia record;
  v_sigla text;
  v_id uuid;
  v_ja_estava boolean := false;
begin
  if not config.pode('operacional', 'criar') then
    raise exception 'Você não tem permissão para registrar a chegada. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  if not nucleo.placa_valida(v_placa) then
    raise exception 'Digite a placa completa, com 3 letras e 4 números ou letras (ex.: ABC1D23).' using errcode = '23514';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'registrar_chegada');
  if v_id is null then
    select p.ativo_id into v_ativo
      from nucleo.placa_do_ativo p
     where p.placa = v_placa and p.excluido_em is null and p.fim is null;
    if v_ativo is null then
      raise exception 'Não achamos a placa % no pátio da sua filial. Confira a placa ou fale com o Operacional.', v_placa using errcode = '23514';
    end if;
    begin
      select * into v_custodia from nucleo.placa_no_patio_para_agir(v_ativo, 'criar', coalesce(p_em, now()));
    exception when sqlstate '23514' then
      raise exception 'Não achamos a placa % no pátio da sua filial. Confira a placa ou fale com o Operacional.', v_placa using errcode = '23514';
    end;
    v_sigla := nucleo.situacao_em(v_ativo, coalesce(p_em, now()));
    select id into v_id from operacional.chegada where ativo_id = v_ativo and saiu_em is null;
    if v_id is not null then
      v_ja_estava := true;
    elsif v_sigla not in ('DOp', 'ACe') then
      raise exception 'A placa % está em % e não entra na fila agora. Fale com o Operacional.', v_placa, v_sigla using errcode = '23514';
    else
      insert into operacional.chegada (ativo_id, filial_id, chegou_em, registrada_por)
      values (v_ativo, v_custodia.filial_id, coalesce(p_em, now()), auth.uid())
      returning id into v_id;
    end if;
    perform auditoria.concluir_envio(p_chave, v_id);
  end if;

  return (
    select jsonb_build_object(
      'chegada_id', c.id, 'placa', v_placa, 'filial', f.nome, 'chegou_em', c.chegou_em,
      'posicao', nucleo.posicao_na_fila(c.id), 'ja_estava', v_ja_estava)
      from operacional.chegada c join config.filial f on f.id = c.filial_id
     where c.id = v_id
  );
end;
$$;
revoke all on function nucleo.registrar_chegada(text, timestamptz, uuid) from public;
comment on function nucleo.registrar_chegada(text, timestamptz, uuid) is
  'Totem: a placa entra na fila da filial (ordem de chegada). Confere a permissão, a custódia vigente na filial de quem registra e a situação (DOp ou ACe); a placa que já está na fila devolve a posição dela. Chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Pátio: avançar a placa (aceitar, concluir o carregamento, liberar a viagem, devolver ao gestor)
-- ---------------------------------------------------------------------------------------------
create function nucleo.avancar_no_patio(
  p_ativo_id uuid, p_acao text, p_motivo text default null, p_em timestamptz default now(), p_chave uuid default null
)
returns jsonb
language plpgsql
security definer -- justificativa: devolver e liberar trocam a custódia (o Operacional perde o acesso à placa no meio da troca) e as tabelas do pátio não têm escrita direta; a função confere operacional.editar e a filial da custódia vigente antes de gravar; search_path vazio.
set search_path = ''
as $$
declare
  v_em timestamptz := coalesce(p_em, now());
  v_custodia record;
  v_sigla text;
  v_id uuid;
begin
  if p_acao is null or p_acao not in ('aceitar', 'concluir', 'liberar', 'devolver') then
    raise exception 'Escolha o que fazer com a placa: aceitar, concluir o carregamento, liberar a viagem ou devolver ao gestor.' using errcode = '22023';
  end if;
  select * into v_custodia from nucleo.placa_no_patio_para_agir(p_ativo_id, 'editar', v_em);

  v_id := auditoria.reservar_envio(p_chave, 'avancar_no_patio');
  if v_id is not null then
    return jsonb_build_object('ativo_id', p_ativo_id, 'acao', p_acao, 'sigla', nucleo.situacao_atual(p_ativo_id));
  end if;

  v_sigla := nucleo.situacao_em(p_ativo_id, v_em);
  if p_acao = 'aceitar' then
    if v_sigla is distinct from 'DOp' then
      raise exception 'A placa está em %: aceitar vale só para a placa disponível no Operacional (DOp).', v_sigla using errcode = '23514';
    end if;
    v_id := nucleo.registrar_evento(p_ativo_id, 'ACe', v_em, 'operacional', 'informada', 'Aceita no pátio');
  elsif p_acao = 'concluir' then
    if v_sigla is distinct from 'CAr' then
      raise exception 'A placa está em %: concluir o carregamento vale só para a placa carregando (CAr).', v_sigla using errcode = '23514';
    end if;
    v_id := nucleo.registrar_evento(p_ativo_id, 'CAn', v_em, 'operacional', 'informada', 'Carregamento concluído');
    update operacional.ordem_de_carregamento set situacao = 'carregada', carregada_em = v_em
     where ativo_id = p_ativo_id and situacao = 'carregando';
  elsif p_acao = 'liberar' then
    if v_sigla is distinct from 'CAn' then
      raise exception 'A placa está em %: liberar a viagem vale só para a placa carregada (CAn).', v_sigla using errcode = '23514';
    end if;
    v_id := nucleo.registrar_evento(p_ativo_id, 'ETc', v_em, 'operacional', 'informada', 'Viagem liberada pelo pátio');
    update operacional.ordem_de_carregamento set situacao = 'em_viagem', saiu_em = v_em
     where ativo_id = p_ativo_id and situacao = 'carregada';
    perform nucleo.devolver_custodia_ao_gestor(p_ativo_id, v_custodia.custodia_id, v_em);
  else
    if v_sigla is null or v_sigla not in ('DOp', 'ACe') then
      raise exception 'A placa está em %: só se devolve ao gestor a placa que ainda não começou a carregar (DOp ou ACe).', v_sigla using errcode = '23514';
    end if;
    if nullif(btrim(coalesce(p_motivo, '')), '') is null then
      raise exception 'Diga o motivo de devolver a placa ao gestor.' using errcode = '23514';
    end if;
    v_id := nucleo.registrar_evento(p_ativo_id, 'PÁT', v_em, 'operacional', 'informada',
      'Devolvida ao gestor pelo pátio: ' || btrim(p_motivo));
    update operacional.chegada set saiu_em = v_em, motivo_da_saida = 'devolucao'
     where ativo_id = p_ativo_id and saiu_em is null;
    perform nucleo.devolver_custodia_ao_gestor(p_ativo_id, v_custodia.custodia_id, v_em);
  end if;

  perform auditoria.concluir_envio(p_chave, v_id);
  return jsonb_build_object('ativo_id', p_ativo_id, 'acao', p_acao, 'sigla', nucleo.situacao_em(p_ativo_id, v_em));
end;
$$;
revoke all on function nucleo.avancar_no_patio(uuid, text, text, timestamptz, uuid) from public;
comment on function nucleo.avancar_no_patio(uuid, text, text, timestamptz, uuid) is
  'Pátio: aceitar (DOp → ACe), concluir o carregamento (CAr → CAn), liberar a viagem (CAn → ETc, a custódia volta ao gestor) ou devolver ao gestor (DOp ou ACe → PÁT, com motivo). Confere a permissão, a filial da custódia vigente, a situação e a chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Ordem de carregamento: nasce da placa aceita e registra o CAr
-- ---------------------------------------------------------------------------------------------
create function nucleo.criar_ordem_de_carregamento(
  p_ativo_id uuid, p_operacao_id uuid, p_destino text, p_data_prevista date,
  p_em timestamptz default now(), p_chave uuid default null
)
returns jsonb
language plpgsql
security definer -- justificativa: as tabelas do pátio não têm escrita direta; a função confere operacional.criar, a filial da custódia vigente, a situação (ACe), a operação, o destino e a data antes de gravar a ordem e o CAr juntos; search_path vazio.
set search_path = ''
as $$
declare
  v_em timestamptz := coalesce(p_em, now());
  v_custodia record;
  v_sigla text;
  v_placa text;
  v_id uuid;
begin
  select * into v_custodia from nucleo.placa_no_patio_para_agir(p_ativo_id, 'criar', v_em);

  v_id := auditoria.reservar_envio(p_chave, 'criar_ordem_de_carregamento');
  if v_id is null then
    v_sigla := nucleo.situacao_em(p_ativo_id, v_em);
    if v_sigla is distinct from 'ACe' then
      raise exception 'A placa está em %: a ordem de carregamento nasce da placa aceita no pátio (ACe).', v_sigla using errcode = '23514';
    end if;
    if not exists (select 1 from nucleo.operacao where id = p_operacao_id and excluido_em is null) then
      raise exception 'A operação escolhida não existe. Escolha outra.' using errcode = '23503';
    end if;
    if nullif(btrim(coalesce(p_destino, '')), '') is null or length(btrim(p_destino)) > 120 then
      raise exception 'Diga o destino da carga, com até 120 caracteres.' using errcode = '23514';
    end if;
    if p_data_prevista is null or p_data_prevista < (v_em at time zone 'America/Sao_Paulo')::date then
      raise exception 'A data prevista de saída é hoje ou depois.' using errcode = '22023';
    end if;
    select placa into v_placa from nucleo.placa_do_ativo
     where ativo_id = p_ativo_id and excluido_em is null and periodo @> v_em;

    insert into operacional.ordem_de_carregamento
      (ativo_id, placa, filial_id, operacao_id, destino, data_prevista, criada_em, criada_por)
    values (p_ativo_id, v_placa, v_custodia.filial_id, p_operacao_id, btrim(p_destino), p_data_prevista, v_em, auth.uid())
    returning id into v_id;
    perform nucleo.registrar_evento(p_ativo_id, 'CAr', v_em, 'operacional', 'informada', 'Ordem de carregamento criada');
    update operacional.chegada set saiu_em = v_em, motivo_da_saida = 'carregamento'
     where ativo_id = p_ativo_id and saiu_em is null;
    perform auditoria.concluir_envio(p_chave, v_id);
  end if;

  return (
    select jsonb_build_object('ordem_id', o.id, 'numero', o.numero, 'placa', o.placa, 'situacao', o.situacao)
      from operacional.ordem_de_carregamento o where o.id = v_id
  );
end;
$$;
revoke all on function nucleo.criar_ordem_de_carregamento(uuid, uuid, text, date, timestamptz, uuid) from public;
comment on function nucleo.criar_ordem_de_carregamento(uuid, uuid, text, date, timestamptz, uuid) is
  '"Criar ordem": a placa aceita (ACe) ganha a ordem de carregamento e passa a carregando (CAr) na mesma transação; sai da fila. Confere a permissão, a filial da custódia vigente, a operação, o destino, a data e a chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Leitura: o pátio da filial (com a fila) e as ordens
-- ---------------------------------------------------------------------------------------------
-- As placas do pátio (custódia vigente do Operacional), com a fila e a ordem aberta, pela RLS de quem
-- consulta (leitura_da_placa, chegada e ordem).
create function nucleo.placas_do_patio()
returns table (
  ativo_id uuid, placa text, tipo text, modelo text, implementos text[], sigla text, nome_da_situacao text,
  grupo text, filial text, desde timestamptz, chegou_em timestamptz, posicao integer, ordem_numero bigint,
  ordem_destino text, ordem_operacao text, ordem_data date
)
language sql
stable
set search_path = ''
as $$
  select l.ativo_id, l.placa, l.tipo, l.modelo, l.implementos, l.sigla, l.nome_da_situacao, l.grupo, f.nome,
         cu.inicio, ch.chegou_em, ch.posicao, o.numero, o.destino, op.nome, o.data_prevista
    from nucleo.leitura_da_placa l
    join config.filial f on f.id = l.filial_da_custodia_id
    left join lateral (
      select c.inicio from nucleo.custodia c
       where c.ativo_id = l.ativo_id and c.com_quem = 'operacional' and c.excluido_em is null and c.fim is null
    ) cu on true
    left join (
      select c.ativo_id, c.chegou_em,
             (row_number() over (partition by c.filial_id order by c.chegou_em, c.id))::integer as posicao
        from operacional.chegada c where c.saiu_em is null
    ) ch on ch.ativo_id = l.ativo_id
    left join operacional.ordem_de_carregamento o
      on o.ativo_id = l.ativo_id and o.situacao in ('carregando', 'carregada')
    left join nucleo.operacao op on op.id = o.operacao_id
   where l.filial_da_custodia_id is not null and l.baixada_em is null
$$;
revoke all on function nucleo.placas_do_patio() from public;

create function nucleo.patio_da_filial(p_situacao text default 'todas', p_pagina integer default 1, p_tam integer default 50)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tam integer := least(greatest(coalesce(p_tam, 50), 1), 200);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_filtro text := coalesce(p_situacao, 'todas');
  v_total integer;
  v_paginas integer;
  v_contagens jsonb;
  v_linhas jsonb;
begin
  if not config.pode('operacional', 'ver') then
    raise exception 'Você não tem permissão para ver o pátio. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  if v_filtro not in ('todas', 'fila', 'DOp', 'ACe', 'CAr', 'CAn') then
    raise exception 'Filtre o pátio por todas, fila, DOp, ACe, CAr ou CAn.' using errcode = '22023';
  end if;

  select jsonb_build_object(
           'todas', count(*), 'fila', count(*) filter (where p.posicao is not null),
           'DOp', count(*) filter (where p.sigla = 'DOp'), 'ACe', count(*) filter (where p.sigla = 'ACe'),
           'CAr', count(*) filter (where p.sigla = 'CAr'), 'CAn', count(*) filter (where p.sigla = 'CAn')),
         count(*) filter (where v_filtro = 'todas' or (v_filtro = 'fila' and p.posicao is not null) or p.sigla = v_filtro)
    into v_contagens, v_total
    from nucleo.placas_do_patio() p;
  v_paginas := greatest(ceil(v_total::numeric / v_tam)::integer, 1);
  v_pagina := least(v_pagina, v_paginas);

  select coalesce(jsonb_agg(x.linha order by x.n), '[]'::jsonb) into v_linhas
    from (
      select row_number() over (order by p.posicao nulls last, p.desde, p.placa, p.ativo_id) as n,
             jsonb_build_object(
               'ativo_id', p.ativo_id, 'placa', p.placa, 'tipo', p.tipo, 'modelo', p.modelo,
               'implementos', to_jsonb(p.implementos), 'sigla', p.sigla, 'nome_da_situacao', p.nome_da_situacao,
               'grupo', p.grupo, 'filial', p.filial, 'desde', p.desde, 'chegou_em', p.chegou_em,
               'posicao', p.posicao, 'ordem_numero', p.ordem_numero, 'ordem_destino', p.ordem_destino,
               'ordem_operacao', p.ordem_operacao, 'ordem_data', p.ordem_data) as linha
        from nucleo.placas_do_patio() p
       where v_filtro = 'todas' or (v_filtro = 'fila' and p.posicao is not null) or p.sigla = v_filtro
       order by p.posicao nulls last, p.desde, p.placa, p.ativo_id
       offset (v_pagina - 1) * v_tam limit v_tam
    ) x;

  return jsonb_build_object('linhas', v_linhas, 'contagens', v_contagens,
    'total', v_total, 'pagina', v_pagina, 'paginas', v_paginas, 'tam', v_tam);
end;
$$;
revoke all on function nucleo.patio_da_filial(text, integer, integer) from public;
comment on function nucleo.patio_da_filial(text, integer, integer) is
  'O Pátio: as placas sob custódia do Operacional das filiais de quem consulta, com a posição na fila e a ordem aberta; a fila primeiro (ordem de chegada), depois pela entrega. Paginado no banco, com as contagens prontas e a RLS de quem consulta.';

create function nucleo.ordens_de_carregamento(p_situacao text default 'todas', p_pagina integer default 1, p_tam integer default 50)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tam integer := least(greatest(coalesce(p_tam, 50), 1), 200);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_filtro text := coalesce(p_situacao, 'todas');
  v_total integer;
  v_paginas integer;
  v_contagens jsonb;
  v_linhas jsonb;
begin
  if not config.pode('operacional', 'ver') then
    raise exception 'Você não tem permissão para ver as ordens de carregamento. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  if v_filtro not in ('todas', 'carregando', 'carregada', 'em_viagem') then
    raise exception 'Filtre as ordens por todas, carregando, carregada ou em viagem.' using errcode = '22023';
  end if;

  select jsonb_build_object(
           'todas', count(*), 'carregando', count(*) filter (where o.situacao = 'carregando'),
           'carregada', count(*) filter (where o.situacao = 'carregada'),
           'em_viagem', count(*) filter (where o.situacao = 'em_viagem')),
         count(*) filter (where v_filtro = 'todas' or o.situacao = v_filtro)
    into v_contagens, v_total
    from operacional.ordem_de_carregamento o;
  v_paginas := greatest(ceil(v_total::numeric / v_tam)::integer, 1);
  v_pagina := least(v_pagina, v_paginas);

  select coalesce(jsonb_agg(x.linha order by x.criada_em desc, x.numero desc), '[]'::jsonb) into v_linhas
    from (
      select o.criada_em, o.numero, jsonb_build_object(
               'ordem_id', o.id, 'numero', o.numero, 'ativo_id', o.ativo_id, 'placa', o.placa,
               'filial', f.nome, 'operacao', op.nome, 'destino', o.destino, 'data_prevista', o.data_prevista,
               'situacao', o.situacao, 'criada_em', o.criada_em, 'carregada_em', o.carregada_em,
               'saiu_em', o.saiu_em) as linha
        from operacional.ordem_de_carregamento o
        join config.filial f on f.id = o.filial_id
        left join nucleo.operacao op on op.id = o.operacao_id
       where v_filtro = 'todas' or o.situacao = v_filtro
       order by o.criada_em desc, o.numero desc
       offset (v_pagina - 1) * v_tam limit v_tam
    ) x;

  return jsonb_build_object('linhas', v_linhas, 'contagens', v_contagens,
    'total', v_total, 'pagina', v_pagina, 'paginas', v_paginas, 'tam', v_tam);
end;
$$;
revoke all on function nucleo.ordens_de_carregamento(text, integer, integer) from public;
comment on function nucleo.ordens_de_carregamento(text, integer, integer) is
  'As ordens de carregamento das filiais de quem consulta, das mais novas para as mais antigas (desempate pelo número), paginadas no banco, com as contagens por situação prontas e a RLS de quem consulta.';

-- ---------------------------------------------------------------------------------------------
-- O que o app executa (a lista de exceções, com o porquê de cada uma)
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('config.ve_filial(uuid,text,text)', 'Escopo por filial das políticas do Operacional (roda como dono; usa só auth.uid()).'),
  ('nucleo.registrar_chegada(text,timestamp with time zone,uuid)', 'Totem: registra a chegada na fila; roda como dono e confere a permissão, a filial da custódia, a situação e a chave de envio.'),
  ('nucleo.avancar_no_patio(uuid,text,text,timestamp with time zone,uuid)', 'Pátio: aceitar, concluir, liberar ou devolver; roda como dono e confere a permissão, a filial da custódia, a situação e a chave de envio.'),
  ('nucleo.criar_ordem_de_carregamento(uuid,uuid,text,date,timestamp with time zone,uuid)', 'Criar ordem de carregamento (e o CAr); roda como dono e confere a permissão, a filial da custódia, a situação e a chave de envio.'),
  ('nucleo.placas_do_patio()', 'As placas do pátio (com a fila e a ordem aberta), com a RLS de quem consulta.'),
  ('nucleo.patio_da_filial(text,integer,integer)', 'O Pátio da filial (com a fila e as contagens), com a RLS de quem consulta.'),
  ('nucleo.ordens_de_carregamento(text,integer,integer)', 'As ordens de carregamento (com as contagens), com a RLS de quem consulta.');

grant execute on function config.ve_filial(uuid, text, text) to authenticated;
grant execute on function nucleo.registrar_chegada(text, timestamptz, uuid) to authenticated;
grant execute on function nucleo.avancar_no_patio(uuid, text, text, timestamptz, uuid) to authenticated;
grant execute on function nucleo.criar_ordem_de_carregamento(uuid, uuid, text, date, timestamptz, uuid) to authenticated;
grant execute on function nucleo.placas_do_patio() to authenticated;
grant execute on function nucleo.patio_da_filial(text, integer, integer) to authenticated;
grant execute on function nucleo.ordens_de_carregamento(text, integer, integer) to authenticated;
