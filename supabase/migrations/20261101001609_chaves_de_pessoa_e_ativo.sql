-- Fase 3: as chaves únicas que o banco garante.
--
--  * Pessoa: CPF ou CNPJ normalizado (só dígitos) com dígito verificador. O documento completo mora em
--    `nucleo.pessoa_documento`; `nucleo.pessoa` só carrega a versão mascarada (decisão 12).
--  * Ativo: RENAVAM é a chave permanente (imutável). Equipamento não tem RENAVAM: a chave é o número
--    de série, único por tipo. O identificador interno do Sankhya (`codveiculo`) é guardado se houver.
--  * Placa: histórico em `nucleo.placa_do_ativo`, sem sobreposição: um ativo nunca tem duas placas ao
--    mesmo tempo e uma placa nunca é de dois ativos ao mesmo tempo (`[início, fim)`).
--
-- Tudo nasce fechado: RLS ligado, nenhum grant. As funções de validação usadas nos `CHECK` precisam
-- de concessão de EXECUTE ao papel que grava; ela chega com as políticas (fatia 3.6).

create type nucleo.tipo_de_ativo as enum ('cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio');
comment on type nucleo.tipo_de_ativo is 'Os cinco tipos de ativo. Um sexto exigiria migration.';

-- ---------------------------------------------------------------------------------------------
-- Funções puras de normalização e validação (imutáveis: valem em CHECK e em coluna gerada).
-- ---------------------------------------------------------------------------------------------
create function nucleo.normalizar_documento(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p_texto, ''), '\D', '', 'g')
$$;
revoke all on function nucleo.normalizar_documento(text) from public;

create function nucleo.documento_valido(p_texto text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := nucleo.normalizar_documento(p_texto);
  v_soma int;
  v_resto int;
  v_dv1 int;
  v_dv2 int;
  v_pesos1 int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  v_pesos2 int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
begin
  if v ~ '^(\d)\1+$' then
    return false; -- todos os dígitos iguais
  end if;
  if length(v) = 11 then
    v_soma := 0;
    for v_i in 1 .. 9 loop
      v_soma := v_soma + substr(v, v_i, 1)::int * (11 - v_i);
    end loop;
    v_dv1 := (v_soma * 10) % 11 % 10;
    v_soma := 0;
    for v_i in 1 .. 10 loop
      v_soma := v_soma + substr(v, v_i, 1)::int * (12 - v_i);
    end loop;
    v_dv2 := (v_soma * 10) % 11 % 10;
    return v_dv1 = substr(v, 10, 1)::int and v_dv2 = substr(v, 11, 1)::int;
  elsif length(v) = 14 then
    v_soma := 0;
    for v_i in 1 .. 12 loop
      v_soma := v_soma + substr(v, v_i, 1)::int * v_pesos1[v_i];
    end loop;
    v_resto := v_soma % 11;
    v_dv1 := case when v_resto < 2 then 0 else 11 - v_resto end;
    v_soma := 0;
    for v_i in 1 .. 13 loop
      v_soma := v_soma + substr(v, v_i, 1)::int * v_pesos2[v_i];
    end loop;
    v_resto := v_soma % 11;
    v_dv2 := case when v_resto < 2 then 0 else 11 - v_resto end;
    return v_dv1 = substr(v, 13, 1)::int and v_dv2 = substr(v, 14, 1)::int;
  end if;
  return false;
end;
$$;
revoke all on function nucleo.documento_valido(text) from public;

-- CPF: ***.982.247-**   CNPJ: **.***.333/0001-**
create function nucleo.mascarar_documento(p_texto text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := nucleo.normalizar_documento(p_texto);
begin
  if length(v) = 11 then
    return '***.' || substr(v, 4, 3) || '.' || substr(v, 7, 3) || '-**';
  elsif length(v) = 14 then
    return '**.***.' || substr(v, 6, 3) || '/' || substr(v, 9, 4) || '-**';
  end if;
  return null;
end;
$$;
revoke all on function nucleo.mascarar_documento(text) from public;

-- RENAVAM de 9 ou 10 dígitos é completado com zeros à esquerda (11 dígitos).
create function nucleo.normalizar_renavam(p_texto text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p_texto is null then
    return null;
  end if;
  v := nucleo.normalizar_documento(p_texto);
  if length(v) between 9 and 10 then
    v := lpad(v, 11, '0');
  end if;
  return nullif(v, '');
end;
$$;
revoke all on function nucleo.normalizar_renavam(text) from public;

create function nucleo.renavam_valido(p_texto text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := nucleo.normalizar_renavam(p_texto);
  v_pesos int[] := array[3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  v_soma int := 0;
  v_dv int;
begin
  if v is null or v !~ '^[0-9]{11}$' then
    return false;
  end if;
  for v_i in 1 .. 10 loop
    v_soma := v_soma + substr(v, v_i, 1)::int * v_pesos[v_i];
  end loop;
  v_dv := (v_soma * 10) % 11;
  if v_dv = 10 then
    v_dv := 0;
  end if;
  return v_dv = substr(v, 11, 1)::int;
end;
$$;
revoke all on function nucleo.renavam_valido(text) from public;

-- Placa em maiúscula, sem hífen nem espaço. Valem as duas famílias: ABC1234 e ABC1D23.
create function nucleo.normalizar_placa(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_texto, ''), '[^A-Za-z0-9]', '', 'g'))
$$;
revoke all on function nucleo.normalizar_placa(text) from public;

create function nucleo.placa_valida(p_texto text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_texto ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$', false)
$$;
revoke all on function nucleo.placa_valida(text) from public;

-- ---------------------------------------------------------------------------------------------
-- Pessoa
-- ---------------------------------------------------------------------------------------------
create table nucleo.pessoa (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) > 0),
  codparc bigint unique,
  email text,
  documento_mascarado text,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text
);
comment on table nucleo.pessoa is
  'Identidade única de pessoa física ou jurídica. Papéis (motorista, gestor, acionista, usuário) ficam em outras tabelas. O documento completo mora em pessoa_documento; aqui só a versão mascarada.';
comment on column nucleo.pessoa.codparc is 'Código do parceiro no Sankhya (CODPARC), único quando existe.';
comment on column nucleo.pessoa.documento_mascarado is 'Mantido por gatilho a partir de pessoa_documento. Nunca é o documento completo.';

create index pessoa_nao_excluida_idx on nucleo.pessoa (nome) where excluido_em is null;
alter table nucleo.pessoa enable row level security;

create table nucleo.pessoa_documento (
  pessoa_id uuid primary key references nucleo.pessoa (id),
  documento text not null unique check (documento ~ '^([0-9]{11}|[0-9]{14})$' and nucleo.documento_valido(documento)),
  tipo_de_documento text generated always as (case when length(documento) = 11 then 'cpf' else 'cnpj' end) stored,
  versao integer not null default 1,
  criado_em timestamptz not null default now()
);
comment on table nucleo.pessoa_documento is
  'O CPF ou CNPJ completo, só com dígitos, único e imutável. Só abre com a permissão específica (políticas na fatia 3.6).';
alter table nucleo.pessoa_documento enable row level security;

create function nucleo.normalizar_documento_da_pessoa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.documento := nucleo.normalizar_documento(new.documento);
  return new;
end;
$$;
revoke all on function nucleo.normalizar_documento_da_pessoa() from public;

-- A pessoa guarda só o documento mascarado, copiado do documento completo.
create function nucleo.sincronizar_mascara_da_pessoa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update nucleo.pessoa
     set documento_mascarado = nucleo.mascarar_documento(new.documento)
   where id = new.pessoa_id;
  return null;
end;
$$;
revoke all on function nucleo.sincronizar_mascara_da_pessoa() from public;

-- Pessoa sem documento não existe: confere no fim da transação.
create function nucleo.exigir_documento_da_pessoa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from nucleo.pessoa_documento where pessoa_id = new.id) then
    raise exception 'A pessoa % precisa de um documento (CPF ou CNPJ).', new.nome
      using errcode = '23000';
  end if;
  return null;
end;
$$;
revoke all on function nucleo.exigir_documento_da_pessoa() from public;

create trigger t10_versao before update on nucleo.pessoa
  for each row execute function nucleo.incrementar_versao('documento_mascarado');
create trigger t40_sem_exclusao_fisica before delete on nucleo.pessoa
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.pessoa
  for each row execute function auditoria.registrar_mudanca('id');
create constraint trigger t95_exige_documento after insert on nucleo.pessoa
  deferrable initially deferred
  for each row execute function nucleo.exigir_documento_da_pessoa();

create trigger t10_normalizar before insert or update on nucleo.pessoa_documento
  for each row execute function nucleo.normalizar_documento_da_pessoa();
create trigger t20_chave_imutavel before update on nucleo.pessoa_documento
  for each row execute function nucleo.proibir_mudanca_de_chave('documento');
create trigger t30_versao before update on nucleo.pessoa_documento
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.pessoa_documento
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t80_mascara after insert or update on nucleo.pessoa_documento
  for each row execute function nucleo.sincronizar_mascara_da_pessoa();
create trigger t90_auditoria after insert or update or delete on nucleo.pessoa_documento
  for each row execute function auditoria.registrar_mudanca('pessoa_id', 'documento');

-- ---------------------------------------------------------------------------------------------
-- Ativo
-- ---------------------------------------------------------------------------------------------
create table nucleo.ativo (
  id uuid primary key default gen_random_uuid(),
  tipo nucleo.tipo_de_ativo not null,
  renavam text,
  numero_de_serie text,
  chassi text unique,
  codveiculo bigint unique,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint ativo_id_tipo_unico unique (id, tipo),
  constraint ativo_renavam_unico unique (renavam),
  constraint ativo_serie_unica unique (tipo, numero_de_serie),
  constraint ativo_renavam_valido check (renavam is null or (renavam ~ '^[0-9]{11}$' and nucleo.renavam_valido(renavam))),
  constraint ativo_renavam_por_tipo check ((tipo = 'equipamento') = (renavam is null)),
  constraint ativo_serie_do_equipamento check (tipo <> 'equipamento' or numero_de_serie is not null)
);
comment on table nucleo.ativo is
  'O ativo (cavalo, implemento, equipamento, caminhão ou apoio) existe uma vez só. A chave é o RENAVAM; equipamento usa o número de série, único por tipo.';
comment on column nucleo.ativo.codveiculo is 'Identificador interno do veículo no Sankhya (CODVEICULO), único quando existe.';

create index ativo_nao_excluido_idx on nucleo.ativo (tipo) where excluido_em is null;
alter table nucleo.ativo enable row level security;

create function nucleo.normalizar_chaves_do_ativo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.renavam := nucleo.normalizar_renavam(new.renavam);
  new.numero_de_serie := nullif(upper(btrim(new.numero_de_serie)), '');
  new.chassi := nullif(upper(btrim(new.chassi)), '');
  return new;
end;
$$;
revoke all on function nucleo.normalizar_chaves_do_ativo() from public;

create trigger t10_normalizar before insert or update on nucleo.ativo
  for each row execute function nucleo.normalizar_chaves_do_ativo();
create trigger t20_chave_imutavel before update on nucleo.ativo
  for each row execute function nucleo.proibir_mudanca_de_chave('renavam', 'numero_de_serie');
create trigger t30_versao before update on nucleo.ativo
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.ativo
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.ativo
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- Histórico de placas
-- ---------------------------------------------------------------------------------------------
create table nucleo.placa_do_ativo (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  placa text not null,
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
  constraint placa_formato check (nucleo.placa_valida(placa)),
  constraint placa_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint placa_fim_com_origem check ((fim is null) = (fim_origem is null)),
  constraint placa_um_ativo_por_vez exclude using gist (placa with =, periodo with &&) where (excluido_em is null),
  constraint placa_uma_por_ativo exclude using gist (ativo_id with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.placa_do_ativo is
  'Cada placa que um ativo teve, com vigência [início, fim). O Sankhya não guarda a placa antiga: o histórico é do Eixo. A conversão para Mercosul é uma linha nova para o mesmo ativo.';

create index placa_do_ativo_ativo_id_idx on nucleo.placa_do_ativo (ativo_id);
create index placa_do_ativo_nao_excluida_idx on nucleo.placa_do_ativo (placa) where excluido_em is null;
alter table nucleo.placa_do_ativo enable row level security;

-- Normaliza a placa e confere o intervalo antes de a coluna gerada calcular o período (que falharia
-- com uma mensagem menos clara).
create function nucleo.normalizar_chaves_da_placa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.placa := nucleo.normalizar_placa(new.placa);
  if new.fim is not null and new.fim <= new.inicio then
    raise exception 'O fim da vigência da placa % tem de ser depois do início.', new.placa
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.normalizar_chaves_da_placa() from public;

create trigger t10_normalizar before insert or update on nucleo.placa_do_ativo
  for each row execute function nucleo.normalizar_chaves_da_placa();
create trigger t20_chave_imutavel before update on nucleo.placa_do_ativo
  for each row execute function nucleo.proibir_mudanca_de_chave('placa', 'ativo_id');
create trigger t30_versao before update on nucleo.placa_do_ativo
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.placa_do_ativo
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.placa_do_ativo
  for each row execute function auditoria.registrar_mudanca('id');

-- A placa atual de cada ativo (a vigência aberta). Roda com as permissões de quem consulta.
create view nucleo.placa_atual with (security_invoker = true) as
  select ativo_id, placa, inicio
    from nucleo.placa_do_ativo
   where fim is null
     and excluido_em is null;
comment on view nucleo.placa_atual is 'A placa vigente de cada ativo (a vigência sem fim).';
