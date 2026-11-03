-- Fase 3, fatia 3.3 (3 de 3): custódia, transferência de gestor e as visões de operação e de alerta.
--
--  * Custódia: com quem está a placa, o gestor de frota ou o Operacional de uma filial, `[início, fim)`.
--    Buraco entre duas custódias é aceito e vira alerta.
--  * Transferência: pedido de troca de gestor. Receber abre a conferência sem trocar o gestor; concluir
--    (com toda pendência respondida) fecha o gestor antigo e abre o novo na mesma transação; uma
--    pendência contestada devolve o pedido ao remetente (a regra do buraco da migration 2 confere).
--  * Visões: `operacao_do_ativo` (a operação vem do CR vigente; engatado e solto entram com a
--    composição, na 3.4) e `alerta_de_vinculo` (a lista de pendências dos vínculos).

-- ---------------------------------------------------------------------------------------------
-- Custódia
-- ---------------------------------------------------------------------------------------------
create type nucleo.com_quem_da_custodia as enum ('gestor', 'operacional');
comment on type nucleo.com_quem_da_custodia is
  'Com quem está a placa: o gestor de frota ou o Operacional de uma filial.';

create table nucleo.custodia (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  com_quem nucleo.com_quem_da_custodia not null,
  filial_id uuid references config.filial (id),
  inicio timestamptz not null,
  fim timestamptz,
  inicio_origem config.origem_da_data not null,
  fim_origem config.origem_da_data,
  periodo tstzrange generated always as (tstzrange(inicio, fim, '[)')) stored,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint custodia_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint custodia_fim_com_origem check ((fim is null) = (fim_origem is null)),
  constraint custodia_filial_so_do_operacional check ((com_quem = 'operacional') = (filial_id is not null)),
  constraint custodia_uma_por_vez exclude using gist (ativo_id with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.custodia is
  'Com quem está a placa ao longo do tempo: o gestor de frota ou o Operacional de uma filial (o pátio da filial). Disponibilizar grava a custódia e o evento DOp juntos (3.7).';

create index custodia_ativo_id_idx on nucleo.custodia (ativo_id);
create index custodia_filial_id_idx on nucleo.custodia (filial_id);
create index custodia_nao_excluida_idx on nucleo.custodia (ativo_id) where excluido_em is null;
alter table nucleo.custodia enable row level security;

create trigger t10_intervalo before insert or update on nucleo.custodia
  for each row execute function nucleo.conferir_intervalo_da_vigencia();
create trigger t20_motivo_da_correcao before update on nucleo.custodia
  for each row execute function nucleo.exigir_motivo_da_correcao();
create trigger t30_versao before update on nucleo.custodia
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.custodia
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.custodia
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- Transferência de gestor
--
-- Etapas (decisão B de Alexandre, 03/11/2026): pendente → em_conferencia (receber: registra a
-- chegada, o gestor não muda) → concluida (concluir: troca o gestor) ou devolvida (uma pendência
-- contestada devolve o pedido ao remetente; o gestor nunca muda). Cancelada fica para o assistente.
-- ---------------------------------------------------------------------------------------------
create table nucleo.transferencia (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  de_gestor_id uuid not null references nucleo.pessoa (id),
  para_gestor_id uuid not null references nucleo.pessoa (id),
  motivo text not null check (length(btrim(motivo)) > 0),
  situacao text not null default 'pendente'
    check (situacao in ('pendente', 'em_conferencia', 'concluida', 'devolvida', 'cancelada')),
  recebida_em timestamptz,
  concluida_em timestamptz,
  devolvida_em timestamptz,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint transferencia_gestores_diferentes check (de_gestor_id <> para_gestor_id),
  constraint transferencia_recebida_com_data
    check ((situacao in ('em_conferencia', 'concluida', 'devolvida')) = (recebida_em is not null)),
  constraint transferencia_concluida_com_data check ((situacao = 'concluida') = (concluida_em is not null)),
  constraint transferencia_devolvida_com_data check ((situacao = 'devolvida') = (devolvida_em is not null))
);
comment on table nucleo.transferencia is
  'Pedido de troca do gestor da carteira. Qualquer um abre; receber abre a conferência sem trocar o gestor; concluir troca, depois que toda pendência tem resposta; uma pendência contestada devolve o pedido ao remetente.';

create index transferencia_ativo_id_idx on nucleo.transferencia (ativo_id);
create index transferencia_de_gestor_id_idx on nucleo.transferencia (de_gestor_id);
create index transferencia_para_gestor_id_idx on nucleo.transferencia (para_gestor_id);
create index transferencia_nao_excluida_idx on nucleo.transferencia (ativo_id) where excluido_em is null;
-- Um pedido aberto (pendente ou em conferência) por ativo.
create unique index transferencia_um_aberto_por_ativo_idx on nucleo.transferencia (ativo_id)
  where situacao in ('pendente', 'em_conferencia') and excluido_em is null;
alter table nucleo.transferencia enable row level security;

create trigger t20_chave_imutavel before update on nucleo.transferencia
  for each row execute function nucleo.proibir_mudanca_de_chave('ativo_id', 'de_gestor_id', 'para_gestor_id');
create trigger t30_versao before update on nucleo.transferencia
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.transferencia
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.transferencia
  for each row execute function auditoria.registrar_mudanca('id');

-- Pendências conhecidas do pedido (documento vencido, multa, avaria…). Na conferência, cada uma
-- recebe uma resposta: resolvida, aceita com nota ou contestada (com nota).
create table nucleo.transferencia_pendencia (
  id uuid primary key default gen_random_uuid(),
  transferencia_id uuid not null references nucleo.transferencia (id),
  texto text not null check (length(btrim(texto)) > 0),
  resposta text check (resposta in ('resolvida', 'aceita_com_nota', 'contestada')),
  respondida_por uuid references nucleo.pessoa (id),
  respondida_em timestamptz,
  nota text,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint transferencia_pendencia_resposta_completa
    check ((resposta is null) = (respondida_por is null) and (resposta is null) = (respondida_em is null)),
  constraint transferencia_pendencia_nota_quando_exigida
    check (resposta not in ('aceita_com_nota', 'contestada') or length(btrim(coalesce(nota, ''))) > 0)
);
comment on table nucleo.transferencia_pendencia is
  'Pendências de um pedido de transferência. Sem resposta, o pedido não se conclui; contestada devolve o pedido ao remetente. Aceitar e contestar exigem a nota.';

create index transferencia_pendencia_transferencia_id_idx on nucleo.transferencia_pendencia (transferencia_id);
create index transferencia_pendencia_respondida_por_idx on nucleo.transferencia_pendencia (respondida_por);
create index transferencia_pendencia_nao_excluida_idx on nucleo.transferencia_pendencia (transferencia_id)
  where excluido_em is null;
alter table nucleo.transferencia_pendencia enable row level security;

-- Pendência nova só em pedido aberto; resposta só durante a conferência; pedido encerrado congela
-- as pendências.
create function nucleo.conferir_pendencia_do_pedido()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_situacao text;
begin
  select situacao into v_situacao from nucleo.transferencia where id = new.transferencia_id;
  if not found then
    return new; -- a chave estrangeira recusa
  end if;
  if v_situacao not in ('pendente', 'em_conferencia') then
    raise exception 'Este pedido de transferência já está %: as pendências dele não mudam mais.', v_situacao
      using errcode = '23514';
  end if;
  if new.resposta is distinct from (case when tg_op = 'UPDATE' then old.resposta end)
     and v_situacao <> 'em_conferencia' then
    raise exception 'As pendências são respondidas na conferência: receba a placa antes de responder.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.conferir_pendencia_do_pedido() from public;

-- Contestar uma pendência devolve o pedido ao remetente, no instante da resposta.
create function nucleo.devolver_pedido_contestado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.resposta = 'contestada'
     and (tg_op = 'INSERT' or old.resposta is distinct from 'contestada') then
    update nucleo.transferencia
       set situacao = 'devolvida', devolvida_em = new.respondida_em
     where id = new.transferencia_id and situacao = 'em_conferencia';
  end if;
  return null;
end;
$$;
revoke all on function nucleo.devolver_pedido_contestado() from public;

create trigger t15_pedido_aberto before insert or update on nucleo.transferencia_pendencia
  for each row execute function nucleo.conferir_pendencia_do_pedido();
create trigger t20_chave_imutavel before update on nucleo.transferencia_pendencia
  for each row execute function nucleo.proibir_mudanca_de_chave('transferencia_id');
create trigger t30_versao before update on nucleo.transferencia_pendencia
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.transferencia_pendencia
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t80_devolver_contestado after insert or update on nucleo.transferencia_pendencia
  for each row execute function nucleo.devolver_pedido_contestado();
create trigger t90_auditoria after insert or update or delete on nucleo.transferencia_pendencia
  for each row execute function auditoria.registrar_mudanca('id');

-- Receber a placa: registra a chegada e abre a conferência. O gestor não muda aqui. Confere que o
-- gestor vigente ainda é o de origem. Roda com o usuário (a RLS vale).
create function nucleo.receber_transferencia(p_transferencia_id uuid, p_em timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_de uuid;
  v_situacao text;
begin
  select ativo_id, de_gestor_id, situacao
    into v_ativo, v_de, v_situacao
    from nucleo.transferencia
   where id = p_transferencia_id and excluido_em is null
     for update;
  if not found then
    raise exception 'O pedido de transferência % não existe.', p_transferencia_id;
  end if;
  if v_situacao <> 'pendente' then
    raise exception 'Este pedido já está %: só se recebe um pedido pendente.', v_situacao;
  end if;
  if not exists (
    select 1 from nucleo.gestor_da_carteira
     where ativo_id = v_ativo and gestor_id = v_de and fim is null and excluido_em is null
  ) then
    raise exception 'O gestor vigente da placa não é o gestor de origem do pedido: confira a carteira e abra um novo pedido.';
  end if;

  update nucleo.transferencia
     set situacao = 'em_conferencia', recebida_em = p_em
   where id = p_transferencia_id;
end;
$$;
revoke all on function nucleo.receber_transferencia(uuid, timestamptz) from public;

-- Concluir: com toda pendência respondida, fecha o gestor antigo e abre o novo, no mesmo instante,
-- e marca o pedido como concluído. Devolve o id da vigência nova do gestor.
create function nucleo.concluir_transferencia(p_transferencia_id uuid, p_em timestamptz)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_de uuid;
  v_para uuid;
  v_situacao text;
  v_recebida timestamptz;
  v_vigente uuid;
  v_vigente_gestor uuid;
  v_sem_resposta int;
  v_novo uuid;
begin
  select ativo_id, de_gestor_id, para_gestor_id, situacao, recebida_em
    into v_ativo, v_de, v_para, v_situacao, v_recebida
    from nucleo.transferencia
   where id = p_transferencia_id and excluido_em is null
     for update;
  if not found then
    raise exception 'O pedido de transferência % não existe.', p_transferencia_id;
  end if;
  if v_situacao <> 'em_conferencia' then
    raise exception 'Este pedido está %: só se conclui um pedido em conferência.', v_situacao;
  end if;
  if p_em < v_recebida then
    raise exception 'A conclusão não pode ser antes do recebimento (%).', v_recebida;
  end if;

  select count(*) into v_sem_resposta
    from nucleo.transferencia_pendencia
   where transferencia_id = p_transferencia_id and excluido_em is null and resposta is null;
  if v_sem_resposta > 0 then
    raise exception 'Faltam % pendência(s) sem resposta: responda cada uma (resolvida, aceita com nota ou contestada) antes de concluir.', v_sem_resposta;
  end if;

  select id, gestor_id
    into v_vigente, v_vigente_gestor
    from nucleo.gestor_da_carteira
   where ativo_id = v_ativo and fim is null and excluido_em is null
     for update;
  if not found or v_vigente_gestor <> v_de then
    raise exception 'O gestor vigente da placa não é o gestor de origem do pedido: confira a carteira e abra um novo pedido.';
  end if;

  update nucleo.gestor_da_carteira
     set fim = p_em, fim_origem = 'informada'
   where id = v_vigente;

  insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
  values (v_ativo, v_para, p_em, 'informada')
  returning id into v_novo;

  update nucleo.transferencia
     set situacao = 'concluida', concluida_em = p_em
   where id = p_transferencia_id;

  return v_novo;
end;
$$;
revoke all on function nucleo.concluir_transferencia(uuid, timestamptz) from public;

-- ---------------------------------------------------------------------------------------------
-- Operação do ativo: a do CR vigente. Uma linha por ativo, com a operação nula quando falta.
-- (Engatado: a do cavalo; solto: a última. Entram com a composição, na 3.4.)
-- ---------------------------------------------------------------------------------------------
create view nucleo.operacao_do_ativo with (security_invoker = true) as
  select a.id as ativo_id,
         c.id as cr_id,
         c.operacao_id
    from nucleo.ativo a
    left join nucleo.cr_do_ativo v
      on v.ativo_id = a.id
     and v.excluido_em is null
     and v.periodo @> now()
    left join nucleo.cr c on c.id = v.cr_id
   where a.excluido_em is null;
comment on view nucleo.operacao_do_ativo is
  'A operação de cada ativo, vinda do CR vigente. Sem CR vigente, ou com CR sem operação, a operação é nula (e há alerta).';

-- ---------------------------------------------------------------------------------------------
-- Alertas dos vínculos que aceitam buraco. Só ativos ainda na frota (sem baixa).
-- ---------------------------------------------------------------------------------------------
create view nucleo.alerta_de_vinculo with (security_invoker = true) as
  with na_frota as (
    select a.id
      from nucleo.ativo a
     where a.excluido_em is null
       and not exists (
         select 1 from nucleo.baixa_do_ativo b
          where b.ativo_id = a.id and b.excluido_em is null and b.em <= now()
       )
  )
  select f.id as ativo_id, 'sem_cr'::text as alerta
    from na_frota f
   where not exists (
     select 1 from nucleo.cr_do_ativo v
      where v.ativo_id = f.id and v.excluido_em is null and v.periodo @> now()
   )
  union all
  select f.id, 'cr_sem_operacao'
    from na_frota f
    join nucleo.cr_do_ativo v on v.ativo_id = f.id and v.excluido_em is null and v.periodo @> now()
    join nucleo.cr c on c.id = v.cr_id
   where c.operacao_id is null
  union all
  select distinct f.id, 'buraco_em_cr'
    from na_frota f
    join (
      select ativo_id, fim, lead(inicio) over (partition by ativo_id order by inicio) as prox
        from nucleo.cr_do_ativo
       where excluido_em is null
    ) v on v.ativo_id = f.id
   where v.prox > v.fim
  union all
  select distinct f.id, 'buraco_em_custodia'
    from na_frota f
    join (
      select ativo_id, fim, lead(inicio) over (partition by ativo_id order by inicio) as prox
        from nucleo.custodia
       where excluido_em is null
    ) v on v.ativo_id = f.id
   where v.prox > v.fim;
comment on view nucleo.alerta_de_vinculo is
  'Pendências dos vínculos: sem_cr, cr_sem_operacao, buraco_em_cr e buraco_em_custodia. Ativo baixado não entra. Posse e gestor não aparecem aqui porque o banco proíbe o buraco neles.';
