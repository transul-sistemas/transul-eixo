-- Fase 3, fatia 3.3 (1 de 3): operação, CR e CR do ativo, com as peças comuns às vigências.
--
--  * Operação e CR: o CR tem a chave do Sankhya (`codcencus`) e um código de exibição livre, sem formato
--    imposto (fim do CR-0000). A operação do CR pode faltar: vira alerta, não erro.
--  * CR do ativo: uma vigência por vez, `[início, fim)`. O buraco entre dois CRs é aceito e vira alerta
--    (visão `alerta_de_vinculo`, na migration 3).
--  * Peças comuns às quatro tabelas de vigência (posse, gestor, CR do ativo e custódia): o intervalo
--    válido e o motivo obrigatório ao corrigir uma data já registrada.
--
-- Tudo nasce fechado: RLS ligado, nenhum grant. As políticas chegam na fatia 3.6.

-- ---------------------------------------------------------------------------------------------
-- Peças comuns às vigências
-- ---------------------------------------------------------------------------------------------

-- O fim tem de ser depois do início. Roda antes da coluna gerada `periodo`, que falharia com uma
-- mensagem menos clara.
create function nucleo.conferir_intervalo_da_vigencia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fim is not null and new.fim <= new.inicio then
    raise exception 'O fim da vigência em % tem de ser depois do início.', tg_table_name
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.conferir_intervalo_da_vigencia() from public;

-- Fechar uma vigência em aberto não é correção. Mudar o início, ou um fim já registrado, é correção de
-- data e só vale com o motivo (`eixo.motivo`), que a auditoria guarda.
create function nucleo.exigir_motivo_da_correcao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.inicio is distinct from old.inicio
      or (old.fim is not null and new.fim is distinct from old.fim))
     and nullif(btrim(coalesce(current_setting('eixo.motivo', true), '')), '') is null then
    raise exception 'Corrigir uma data já registrada exige o motivo da correção.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.exigir_motivo_da_correcao() from public;

-- ---------------------------------------------------------------------------------------------
-- Operação
-- ---------------------------------------------------------------------------------------------
create table nucleo.operacao (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(btrim(nome)) > 0),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text
);
comment on table nucleo.operacao is
  'Operação da TranSul (Grãos, Cimento, …). O CR aponta para ela; o ativo a herda do CR vigente.';
create index operacao_nao_excluida_idx on nucleo.operacao (nome) where excluido_em is null;
alter table nucleo.operacao enable row level security;

create trigger t10_versao before update on nucleo.operacao
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.operacao
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.operacao
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- CR (centro de resultado)
-- ---------------------------------------------------------------------------------------------
create table nucleo.cr (
  id uuid primary key default gen_random_uuid(),
  codcencus bigint unique,
  codigo text not null unique check (length(btrim(codigo)) > 0),
  nome text,
  operacao_id uuid references nucleo.operacao (id),
  ativo boolean not null default true,
  bloqueado boolean not null default false,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text
);
comment on table nucleo.cr is
  'Centro de resultado. `codcencus` é a chave do Sankhya (pode faltar até a ponte); `codigo` é o texto de exibição, único e de formato livre. A operação pode faltar (alerta).';
comment on column nucleo.cr.codcencus is 'CODCENCUS do Sankhya, único quando existe.';
comment on column nucleo.cr.ativo is 'Sinalizador do Sankhya (ATIVO do centro de resultado).';
comment on column nucleo.cr.bloqueado is 'Sinalizador do Sankhya (bloqueio do centro de resultado).';

create index cr_operacao_id_idx on nucleo.cr (operacao_id);
create index cr_nao_excluido_idx on nucleo.cr (codigo) where excluido_em is null;
alter table nucleo.cr enable row level security;

create trigger t10_versao before update on nucleo.cr
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.cr
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.cr
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- CR do ativo (vigência)
-- ---------------------------------------------------------------------------------------------
create table nucleo.cr_do_ativo (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  cr_id uuid not null references nucleo.cr (id),
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
  constraint cr_do_ativo_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint cr_do_ativo_fim_com_origem check ((fim is null) = (fim_origem is null)),
  constraint cr_do_ativo_um_por_vez exclude using gist (ativo_id with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.cr_do_ativo is
  'O CR de cada ativo ao longo do tempo, `[início, fim)`, um vigente. O Eixo é a fonte da verdade da posse do CR. Buraco entre dois CRs é aceito e vira alerta.';

create index cr_do_ativo_ativo_id_idx on nucleo.cr_do_ativo (ativo_id);
create index cr_do_ativo_cr_id_idx on nucleo.cr_do_ativo (cr_id);
create index cr_do_ativo_nao_excluido_idx on nucleo.cr_do_ativo (ativo_id) where excluido_em is null;
alter table nucleo.cr_do_ativo enable row level security;

create trigger t10_intervalo before insert or update on nucleo.cr_do_ativo
  for each row execute function nucleo.conferir_intervalo_da_vigencia();
create trigger t20_motivo_da_correcao before update on nucleo.cr_do_ativo
  for each row execute function nucleo.exigir_motivo_da_correcao();
create trigger t30_versao before update on nucleo.cr_do_ativo
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.cr_do_ativo
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.cr_do_ativo
  for each row execute function auditoria.registrar_mudanca('id');
