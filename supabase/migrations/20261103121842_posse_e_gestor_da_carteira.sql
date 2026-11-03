-- Fase 3, fatia 3.3 (2 de 3): posse, gestor da carteira e baixa do ativo.
--
-- Posse e gestor são as duas vigências em que o banco proíbe o buraco (decisão 6 do plano): enquanto o
-- ativo não for baixado, ele sempre tem dono e sempre tem responsável. As duas se cobrem de ponta a
-- ponta, `[início, fim)`, sem intervalo entre uma e a próxima, e a última ou fica em aberto ou termina
-- exatamente no instante da baixa (VND ou SUC), registrada na mesma transação.
--
-- A conferência é um gatilho de restrição adiado: o ativo e as suas vigências nascem na mesma transação
-- e só se confere o conjunto no fim dela. Nenhuma função daqui é SECURITY DEFINER: roda com o usuário.

create type nucleo.regime_de_posse as enum ('propria', 'acionista', 'agregado', 'terceiro', 'alugada');
comment on type nucleo.regime_de_posse is
  'Regime da posse do ativo. Um sexto regime exigiria migration.';

-- ---------------------------------------------------------------------------------------------
-- Posse do ativo
-- ---------------------------------------------------------------------------------------------
create table nucleo.posse_do_ativo (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  regime nucleo.regime_de_posse not null,
  pessoa_dona_id uuid references nucleo.pessoa (id),
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
  constraint posse_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint posse_fim_com_origem check ((fim is null) = (fim_origem is null)),
  constraint posse_propria_sem_dono check (regime <> 'propria' or pessoa_dona_id is null),
  constraint posse_uma_por_vez exclude using gist (ativo_id with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.posse_do_ativo is
  'De quem é o ativo, ao longo do tempo. O Eixo é a fonte da verdade da posse; AD_ACIONISTA, AD_ORIGEM e AD_CODPARC do Sankhya só sugerem. A pessoa dona é opcional: a importação pode não saber.';

create index posse_do_ativo_ativo_id_idx on nucleo.posse_do_ativo (ativo_id);
create index posse_do_ativo_pessoa_dona_id_idx on nucleo.posse_do_ativo (pessoa_dona_id);
create index posse_do_ativo_nao_excluida_idx on nucleo.posse_do_ativo (ativo_id) where excluido_em is null;
alter table nucleo.posse_do_ativo enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Gestor da carteira
-- ---------------------------------------------------------------------------------------------
create table nucleo.gestor_da_carteira (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  gestor_id uuid not null references nucleo.pessoa (id),
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
  constraint gestor_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint gestor_fim_com_origem check ((fim is null) = (fim_origem is null)),
  constraint gestor_um_por_vez exclude using gist (ativo_id with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.gestor_da_carteira is
  'O gestor de frota responsável por cada ativo, ao longo do tempo. O Sankhya não mantém esse vínculo: o escopo "minha carteira" nasce daqui.';

create index gestor_da_carteira_ativo_id_idx on nucleo.gestor_da_carteira (ativo_id);
create index gestor_da_carteira_gestor_id_idx on nucleo.gestor_da_carteira (gestor_id);
create index gestor_da_carteira_nao_excluida_idx on nucleo.gestor_da_carteira (ativo_id) where excluido_em is null;
alter table nucleo.gestor_da_carteira enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Baixa do ativo: o único jeito de posse e gestor terminarem sem sucessora.
-- ---------------------------------------------------------------------------------------------
create table nucleo.baixa_do_ativo (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  sigla text not null references config.status (sigla),
  em timestamptz not null,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint baixa_so_vnd_ou_suc check (sigla in ('VND', 'SUC'))
);
comment on table nucleo.baixa_do_ativo is
  'Venda (VND) ou sucata (SUC) do ativo. Posse e gestor da carteira terminam exatamente em `em`. A régua de status (3.5) grava o evento na mesma transação.';

create index baixa_do_ativo_sigla_idx on nucleo.baixa_do_ativo (sigla);
create unique index baixa_uma_por_ativo_idx on nucleo.baixa_do_ativo (ativo_id) where excluido_em is null;
alter table nucleo.baixa_do_ativo enable row level security;

-- ---------------------------------------------------------------------------------------------
-- A regra do buraco. Argumento: a coluna do ativo na tabela do gatilho (`id` no próprio ativo).
-- ---------------------------------------------------------------------------------------------
create function nucleo.conferir_cobertura_do_ativo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ativo uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  v_baixa timestamptz;
  v_tabela text;
  v_nome text;
  v_n int;
  v_sem_buraco boolean;
  v_ultimo_fim timestamptz;
  v_ultimo_aberto boolean;
begin
  if not exists (select 1 from nucleo.ativo where id = v_ativo and excluido_em is null) then
    return null;
  end if;

  select em into v_baixa
    from nucleo.baixa_do_ativo
   where ativo_id = v_ativo and excluido_em is null;

  foreach v_tabela in array array['posse_do_ativo', 'gestor_da_carteira'] loop
    v_nome := case v_tabela when 'posse_do_ativo' then 'posse' else 'gestor da carteira' end;

    execute format(
      $f$
      select count(*)::int,
             coalesce(bool_and(prox is null or fim is not distinct from prox), true),
             max(fim) filter (where prox is null),
             coalesce(bool_or(prox is null and fim is null), false)
        from (
          select fim, lead(inicio) over (order by inicio) as prox
            from nucleo.%I
           where ativo_id = $1 and excluido_em is null
        ) v
      $f$,
      v_tabela
    ) into v_n, v_sem_buraco, v_ultimo_fim, v_ultimo_aberto using v_ativo;

    if v_n = 0 then
      raise exception 'O ativo % precisa de % (a placa não pode ficar sem registro).', v_ativo, v_nome
        using errcode = '23514';
    end if;
    if not v_sem_buraco then
      raise exception 'O ativo % tem buraco entre duas vigências de %: a seguinte começa no instante em que a anterior termina.', v_ativo, v_nome
        using errcode = '23514';
    end if;
    if v_baixa is null and not v_ultimo_aberto then
      raise exception 'A % do ativo % terminou sem sucessora e sem baixa: registre a venda ou a sucata na mesma transação.', v_nome, v_ativo
        using errcode = '23514';
    end if;
    if v_baixa is not null and (v_ultimo_aberto or v_ultimo_fim <> v_baixa) then
      raise exception 'A % do ativo % tem de terminar exatamente no instante da baixa (%).', v_nome, v_ativo, v_baixa
        using errcode = '23514';
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function nucleo.conferir_cobertura_do_ativo() from public;

-- ---------------------------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------------------------
create trigger t10_intervalo before insert or update on nucleo.posse_do_ativo
  for each row execute function nucleo.conferir_intervalo_da_vigencia();
create trigger t20_motivo_da_correcao before update on nucleo.posse_do_ativo
  for each row execute function nucleo.exigir_motivo_da_correcao();
create trigger t30_versao before update on nucleo.posse_do_ativo
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.posse_do_ativo
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.posse_do_ativo
  for each row execute function auditoria.registrar_mudanca('id');
create constraint trigger t95_cobertura after insert or update on nucleo.posse_do_ativo
  deferrable initially deferred
  for each row execute function nucleo.conferir_cobertura_do_ativo('ativo_id');

create trigger t10_intervalo before insert or update on nucleo.gestor_da_carteira
  for each row execute function nucleo.conferir_intervalo_da_vigencia();
create trigger t20_motivo_da_correcao before update on nucleo.gestor_da_carteira
  for each row execute function nucleo.exigir_motivo_da_correcao();
create trigger t30_versao before update on nucleo.gestor_da_carteira
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.gestor_da_carteira
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.gestor_da_carteira
  for each row execute function auditoria.registrar_mudanca('id');
create constraint trigger t95_cobertura after insert or update on nucleo.gestor_da_carteira
  deferrable initially deferred
  for each row execute function nucleo.conferir_cobertura_do_ativo('ativo_id');

create trigger t20_chave_imutavel before update on nucleo.baixa_do_ativo
  for each row execute function nucleo.proibir_mudanca_de_chave('ativo_id');
create trigger t30_versao before update on nucleo.baixa_do_ativo
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.baixa_do_ativo
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.baixa_do_ativo
  for each row execute function auditoria.registrar_mudanca('id');
create constraint trigger t95_cobertura after insert or update on nucleo.baixa_do_ativo
  deferrable initially deferred
  for each row execute function nucleo.conferir_cobertura_do_ativo('ativo_id');

-- O ativo nunca nasce sem posse e sem gestor: a função que cadastra cria os três na mesma transação.
create constraint trigger t95_cobertura after insert on nucleo.ativo
  deferrable initially deferred
  for each row execute function nucleo.conferir_cobertura_do_ativo('id');
