-- Fase 3, fatia 3.1: os catálogos e a régua de status.
--
--  * Catálogos do Eixo: carroceria, marca, modelo (com eixos, opcional), filial e garagem. Entram sem
--    semente de produção (marca, modelo, filial e garagem vêm pelo "+" e, mais tarde, pela ponte).
--  * A régua: as cinco camadas de prioridade e as 26 siglas, com chip, camada, `aplica_a` e os tipos
--    de ativo válidos (Apêndice A do plano, aprovado em 31/10/2026). Os dados vão em `seed.sql`.
--  * Nomes de conjunto: configurações (simples, bi, bitrezão, rodo) e a tabela carroceria x
--    configuração. A regra que reconhece cada configuração (pela estrutura: implementos, dolly e
--    eixos por implemento) é da equipe e fica vazia até a fatia 3.4: nada é inventado aqui.
--  * `nucleo.ativo` ganha `carroceria_id` (só implemento) e `modelo_id` (opcional).
--
-- Tudo nasce fechado: RLS ligado e nenhum grant (as permissões do "+" são da 3.6).

-- ---------------------------------------------------------------------------------------------
-- Carroceria
-- ---------------------------------------------------------------------------------------------
create table config.carroceria (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(btrim(nome)) > 0),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text
);
comment on table config.carroceria is
  'Catálogo de carrocerias do Eixo (Graneleira, Sider, Basculante, Baú frigorífico, Prancha, Tanque...). Cresce com a confirmação da equipe.';
create index carroceria_nao_excluida_idx on config.carroceria (nome) where excluido_em is null;
alter table config.carroceria enable row level security;
create trigger t10_versao before update on config.carroceria
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on config.carroceria
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on config.carroceria
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- Marca e modelo
-- ---------------------------------------------------------------------------------------------
create table config.marca (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(btrim(nome)) > 0),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text
);
comment on table config.marca is 'Marcas de veículo. Sem semente de produção: entram pelo "+".';
create index marca_nao_excluida_idx on config.marca (nome) where excluido_em is null;
alter table config.marca enable row level security;
create trigger t10_versao before update on config.marca
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on config.marca
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on config.marca
  for each row execute function auditoria.registrar_mudanca('id');

create table config.modelo (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references config.marca (id),
  nome text not null check (length(btrim(nome)) > 0),
  carroceria_padrao_id uuid references config.carroceria (id),
  eixos smallint check (eixos > 0),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint modelo_unico_por_marca unique (marca_id, nome)
);
comment on table config.modelo is
  'Modelos de veículo, por marca. A carroceria padrão só sugere (a do ativo é a que vale). Eixos é opcional: nulo quer dizer "não se sabe".';
create index modelo_marca_id_idx on config.modelo (marca_id);
create index modelo_carroceria_padrao_id_idx on config.modelo (carroceria_padrao_id);
create index modelo_nao_excluido_idx on config.modelo (nome) where excluido_em is null;
alter table config.modelo enable row level security;
create trigger t10_versao before update on config.modelo
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on config.modelo
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on config.modelo
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- Filial e garagem
-- ---------------------------------------------------------------------------------------------
create table config.filial (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (length(btrim(nome)) > 0),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text
);
comment on table config.filial is 'Filiais da TranSul. Sem semente de produção: entram pelo "+".';
create index filial_nao_excluida_idx on config.filial (nome) where excluido_em is null;
alter table config.filial enable row level security;
create trigger t10_versao before update on config.filial
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on config.filial
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on config.filial
  for each row execute function auditoria.registrar_mudanca('id');

create table config.garagem (
  id uuid primary key default gen_random_uuid(),
  filial_id uuid not null references config.filial (id),
  nome text not null check (length(btrim(nome)) > 0),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint garagem_unica_por_filial unique (filial_id, nome)
);
comment on table config.garagem is 'Garagens, por filial. Sem semente de produção: entram pelo "+".';
create index garagem_filial_id_idx on config.garagem (filial_id);
create index garagem_nao_excluida_idx on config.garagem (nome) where excluido_em is null;
alter table config.garagem enable row level security;
create trigger t10_versao before update on config.garagem
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on config.garagem
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on config.garagem
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- A régua: camadas de prioridade e as 26 siglas
-- ---------------------------------------------------------------------------------------------
create table config.camada_de_status (
  codigo text primary key,
  nome text not null,
  prioridade smallint not null unique check (prioridade > 0)
);
comment on table config.camada_de_status is
  'As cinco camadas da régua, da que vence (1, baixada) à que perde (5, atividade). A situação de um ativo é a sigla da camada ativa de maior prioridade.';
alter table config.camada_de_status enable row level security;

create table config.status (
  sigla text primary key,
  nome text not null,
  chip text not null check (chip in ('em-atividade', 'atencao', 'impedida', 'patio', 'fora')),
  camada text not null references config.camada_de_status (codigo),
  baixada boolean not null,
  aplica_a text not null check (aplica_a in ('conjunto', 'solo', 'ambos')),
  tipos_validos nucleo.tipo_de_ativo[] not null check (cardinality(tipos_validos) > 0),
  ordem smallint not null unique,
  versao integer not null default 1,
  constraint status_baixada_so_na_camada_baixada check (baixada = (camada = 'baixada'))
);
comment on table config.status is
  'A régua única de 26 siglas (CLAUDE.md), com chip (agrupamento dos filtros), camada, aplica_a (conjunto, solo ou ambos) e os tipos de ativo que podem receber a sigla. O espelho em TypeScript é lib/dominio/status.ts.';
create index status_camada_idx on config.status (camada);
alter table config.status enable row level security;
create trigger t10_versao before update on config.status
  for each row execute function nucleo.incrementar_versao();
create trigger t90_auditoria after insert or update or delete on config.status
  for each row execute function auditoria.registrar_mudanca('sigla');

-- ---------------------------------------------------------------------------------------------
-- Nomes de conjunto
-- ---------------------------------------------------------------------------------------------
create table config.configuracao_de_conjunto (
  codigo text primary key,
  nome text not null,
  quantidade_de_implementos smallint check (quantidade_de_implementos > 0),
  com_dolly boolean,
  eixos_por_implemento smallint check (eixos_por_implemento > 0),
  versao integer not null default 1
);
comment on table config.configuracao_de_conjunto is
  'Simples, bi, bitrezão e rodo. As colunas da regra de reconhecimento (pela estrutura: implementos, dolly e eixos por implemento) ficam vazias: a regra é da equipe e entra na fatia 3.4.';
alter table config.configuracao_de_conjunto enable row level security;
create trigger t10_versao before update on config.configuracao_de_conjunto
  for each row execute function nucleo.incrementar_versao();
create trigger t90_auditoria after insert or update or delete on config.configuracao_de_conjunto
  for each row execute function auditoria.registrar_mudanca('codigo');

create table config.nomenclatura_de_conjunto (
  carroceria_id uuid not null references config.carroceria (id),
  configuracao text not null references config.configuracao_de_conjunto (codigo),
  nome text not null check (length(btrim(nome)) > 0),
  versao integer not null default 1,
  primary key (carroceria_id, configuracao)
);
comment on table config.nomenclatura_de_conjunto is
  'O nome do conjunto por carroceria e configuração (renomeável). Carroceria sem linha aqui (Baú, Prancha, Tanque) não tem nome de conjunto.';
create index nomenclatura_de_conjunto_configuracao_idx on config.nomenclatura_de_conjunto (configuracao);
alter table config.nomenclatura_de_conjunto enable row level security;
create trigger t10_versao before update on config.nomenclatura_de_conjunto
  for each row execute function nucleo.incrementar_versao();
create trigger t90_auditoria after insert or update or delete on config.nomenclatura_de_conjunto
  for each row execute function auditoria.registrar_mudanca('carroceria_id');

-- O nome do conjunto. Até a 3.4 a regra de reconhecimento está vazia: carroceria que tem nomes de
-- conjunto devolve "sem nome"; carroceria que não tem (Baú frigorífico, Prancha, Tanque) devolve só a
-- carroceria e a quantidade de implementos ("Prancha, 2 implementos").
create function config.nome_do_conjunto(
  p_carroceria_id uuid,
  p_quantidade_de_implementos integer,
  p_eixos integer
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when exists (select 1 from config.nomenclatura_de_conjunto n where n.carroceria_id = c.id)
      then 'sem nome'
    else c.nome || ', ' || p_quantidade_de_implementos
      || case when p_quantidade_de_implementos = 1 then ' implemento' else ' implementos' end
  end
  from config.carroceria c
  where c.id = p_carroceria_id
$$;
revoke all on function config.nome_do_conjunto(uuid, integer, integer) from public;

-- ---------------------------------------------------------------------------------------------
-- O ativo: carroceria (só implemento) e modelo (opcional)
-- ---------------------------------------------------------------------------------------------
alter table nucleo.ativo add column carroceria_id uuid references config.carroceria (id);
alter table nucleo.ativo add column modelo_id uuid references config.modelo (id);
alter table nucleo.ativo add constraint ativo_carroceria_do_implemento
  check ((tipo = 'implemento') = (carroceria_id is not null));
create index ativo_carroceria_id_idx on nucleo.ativo (carroceria_id);
create index ativo_modelo_id_idx on nucleo.ativo (modelo_id);
comment on column nucleo.ativo.carroceria_id is 'Obrigatória no implemento e proibida nos demais tipos.';
comment on column nucleo.ativo.modelo_id is 'Opcional: a v1 tem cavalos com modelo "A DEFINIR".';
