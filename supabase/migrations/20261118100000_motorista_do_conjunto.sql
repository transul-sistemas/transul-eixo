-- A6, status do dia do motorista e Indicar substituto (inventário 11; ficha
-- frota-acompanhamento-status-do-motorista.md; decisões de Alexandre de 11/11/2026).
--
--  * Códigos do realizado (os da v1): TBV, TBE, TBX, FOL, FÉR, ATS, FRD, FLT (pessoas.codigo_do_motorista).
--    A escala (T, F, FE, AT, em pessoas.marcacao_da_escala) continua sendo o planejado e só SUGERE
--    (T→TBV, F→FOL, FE→FÉR, AT→ATS); nada é convertido: o dia vira realizado quando alguém lança.
--  * Motorista do conjunto (pessoas.motorista_do_conjunto): UM motorista por conjunto (dois motoristas por
--    conjunto ficam FORA da primeira versão) e um conjunto por motorista, com vigência [início, fim) sem
--    sobreposição (EXCLUDE). Só cavalo e caminhão; a pessoa precisa do vínculo de função motorista.
--  * Status do dia (pessoas.status_do_motorista): um vigente por pessoa e dia; corrigir pede a versão vista e
--    o motivo, e o anterior fica no histórico com exclusão lógica.
--  * Substituição (pessoas.substituicao_do_motorista): o substituto dirige o conjunto do titular de uma data a
--    outra, [início, fim), sem sobreposição no conjunto nem no substituto. Quem já é titular de outro conjunto
--    no período não substitui. Encerrar na data do início (ou antes) cancela (exclusão lógica com motivo).
--  * Quem grava: Pessoas › editar (escopo tudo) ou o gestor da carteira do conjunto (Frota › criar para o status
--    do dia, Frota › editar para os vínculos). As tabelas não têm escrita direta: só as funções gravam.
--  * Quem lê: as tabelas, só Pessoas › ver (escopo tudo). O gestor lê pelas funções de leitura recortadas
--    (nome e código do dia, só dos conjuntos da carteira; nunca CPF, contato, salário ou documento).
--  * A tarefa "indicar substituto" é a leitura nucleo.ferias_sem_substituto(): férias na escala do titular nos
--    próximos N dias (config.parametro dias_para_indicar_substituto, 10) sem substituição que cubra o dia.

-- ---------------------------------------------------------------------------------------------
-- Catálogo dos códigos do motorista
-- ---------------------------------------------------------------------------------------------
create table pessoas.codigo_do_motorista (
  codigo text primary key,
  nome text not null unique,
  grupo text not null check (grupo in ('trabalho', 'folga', 'ferias', 'atestado', 'feriado', 'falta')),
  sugerido_pela_escala text check (sugerido_pela_escala in ('T', 'F', 'FE', 'AT')),
  ordem smallint not null unique
);
comment on table pessoas.codigo_do_motorista is
  'Os códigos do realizado do motorista (os da v1, a confirmar): o grupo de cada um alimenta os totais do mês; sugerido_pela_escala diz qual marcação da escala sugere o código.';
insert into pessoas.codigo_do_motorista (codigo, nome, grupo, sugerido_pela_escala, ordem) values
  ('TBV', 'Trabalhando em viagem', 'trabalho', 'T', 1),
  ('TBE', 'Trabalhando em casa', 'trabalho', null, 2),
  ('TBX', 'Trabalho extra', 'trabalho', null, 3),
  ('FOL', 'Folga', 'folga', 'F', 4),
  ('FÉR', 'Férias', 'ferias', 'FE', 5),
  ('ATS', 'Atestado', 'atestado', 'AT', 6),
  ('FRD', 'Feriado', 'feriado', null, 7),
  ('FLT', 'Falta', 'falta', null, 8);
alter table pessoas.codigo_do_motorista enable row level security;
create policy codigo_do_motorista_ler on pessoas.codigo_do_motorista for select to authenticated
  using ((select config.usuario_atual()) is not null);
grant select on pessoas.codigo_do_motorista to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Motorista do conjunto
-- ---------------------------------------------------------------------------------------------
create table pessoas.motorista_do_conjunto (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references nucleo.pessoa (id),
  ativo_id uuid not null references nucleo.ativo (id),
  inicio date not null,
  fim date,
  periodo daterange generated always as (daterange(inicio, fim, '[)')) stored,
  registrado_por uuid references nucleo.pessoa (id),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid references nucleo.pessoa (id),
  motivo_da_exclusao text,
  constraint motorista_do_conjunto_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint motorista_do_conjunto_um_por_conjunto exclude using gist (ativo_id with =, periodo with &&) where (excluido_em is null),
  constraint motorista_do_conjunto_um_conjunto_por_vez exclude using gist (pessoa_id with =, periodo with &&) where (excluido_em is null)
);
comment on table pessoas.motorista_do_conjunto is
  'O motorista titular do conjunto (cavalo ou caminhão), com vigência [início, fim): um por conjunto e um conjunto por motorista (EXCLUDE). Encerrar é dar a data de fim; só as funções gravam.';
create index motorista_do_conjunto_pessoa_id_idx on pessoas.motorista_do_conjunto (pessoa_id);
create index motorista_do_conjunto_ativo_id_idx on pessoas.motorista_do_conjunto (ativo_id, inicio) where excluido_em is null;
create index motorista_do_conjunto_registrado_por_idx on pessoas.motorista_do_conjunto (registrado_por);
create index motorista_do_conjunto_excluido_por_idx on pessoas.motorista_do_conjunto (excluido_por);
alter table pessoas.motorista_do_conjunto enable row level security;
create trigger t30_versao before update on pessoas.motorista_do_conjunto
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on pessoas.motorista_do_conjunto
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on pessoas.motorista_do_conjunto
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- Status do dia do motorista (o realizado)
-- ---------------------------------------------------------------------------------------------
create table pessoas.status_do_motorista (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references nucleo.pessoa (id),
  dia date not null,
  codigo text not null references pessoas.codigo_do_motorista (codigo),
  registrado_por uuid references nucleo.pessoa (id),
  registrado_em timestamptz not null default now(),
  versao integer not null default 1,
  excluido_em timestamptz,
  excluido_por uuid references nucleo.pessoa (id),
  motivo_da_exclusao text,
  constraint status_do_motorista_exclusao_com_motivo check (excluido_em is null or length(btrim(coalesce(motivo_da_exclusao, ''))) > 0)
);
comment on table pessoas.status_do_motorista is
  'O realizado do motorista: um código por pessoa e dia (o vigente). Corrigir exclui o anterior com o motivo e grava o novo; nada some do histórico. Distinto da escala (o planejado).';
create unique index status_do_motorista_um_por_dia on pessoas.status_do_motorista (pessoa_id, dia) where excluido_em is null;
create index status_do_motorista_pessoa_id_idx on pessoas.status_do_motorista (pessoa_id, dia);
create index status_do_motorista_codigo_idx on pessoas.status_do_motorista (codigo);
create index status_do_motorista_registrado_por_idx on pessoas.status_do_motorista (registrado_por);
create index status_do_motorista_excluido_por_idx on pessoas.status_do_motorista (excluido_por);
alter table pessoas.status_do_motorista enable row level security;
create trigger t30_versao before update on pessoas.status_do_motorista
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on pessoas.status_do_motorista
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on pessoas.status_do_motorista
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- Substituição do motorista
-- ---------------------------------------------------------------------------------------------
create table pessoas.substituicao_do_motorista (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  titular_id uuid not null references nucleo.pessoa (id),
  substituto_id uuid not null references nucleo.pessoa (id),
  inicio date not null,
  fim date not null,
  periodo daterange generated always as (daterange(inicio, fim, '[)')) stored,
  motivo text not null check (length(btrim(motivo)) > 0),
  registrado_por uuid references nucleo.pessoa (id),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid references nucleo.pessoa (id),
  motivo_da_exclusao text,
  constraint substituicao_fim_depois_do_inicio check (fim > inicio),
  constraint substituicao_nao_e_o_titular check (substituto_id <> titular_id),
  constraint substituicao_uma_por_conjunto exclude using gist (ativo_id with =, periodo with &&) where (excluido_em is null),
  constraint substituicao_um_conjunto_por_substituto exclude using gist (substituto_id with =, periodo with &&) where (excluido_em is null)
);
comment on table pessoas.substituicao_do_motorista is
  'Quem dirige o conjunto no lugar do titular, de uma data a outra [início, fim), sem sobreposição no conjunto nem no substituto. Cancelar é exclusão lógica com motivo.';
create index substituicao_do_motorista_ativo_id_idx on pessoas.substituicao_do_motorista (ativo_id, inicio) where excluido_em is null;
create index substituicao_do_motorista_titular_id_idx on pessoas.substituicao_do_motorista (titular_id);
create index substituicao_do_motorista_substituto_id_idx on pessoas.substituicao_do_motorista (substituto_id);
create index substituicao_do_motorista_registrado_por_idx on pessoas.substituicao_do_motorista (registrado_por);
create index substituicao_do_motorista_excluido_por_idx on pessoas.substituicao_do_motorista (excluido_por);
alter table pessoas.substituicao_do_motorista enable row level security;
create trigger t30_versao before update on pessoas.substituicao_do_motorista
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on pessoas.substituicao_do_motorista
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on pessoas.substituicao_do_motorista
  for each row execute function auditoria.registrar_mudanca('id');

-- Leitura direta só com Pessoas › ver em todo o escopo; o gestor lê pelas funções recortadas abaixo.
create policy motorista_do_conjunto_ler on pessoas.motorista_do_conjunto for select to authenticated
  using ((select config.pode_em_tudo('pessoas', 'ver')));
create policy status_do_motorista_ler on pessoas.status_do_motorista for select to authenticated
  using ((select config.pode_em_tudo('pessoas', 'ver')));
create policy substituicao_do_motorista_ler on pessoas.substituicao_do_motorista for select to authenticated
  using ((select config.pode_em_tudo('pessoas', 'ver')));
grant select on pessoas.motorista_do_conjunto, pessoas.status_do_motorista, pessoas.substituicao_do_motorista to authenticated;

insert into config.parametro (chave, valor, descricao) values
  ('dias_para_indicar_substituto', '10',
   'Quantos dias antes do primeiro dia de férias sem substituto a tarefa "Indicar substituto" aparece (A6).');

-- ---------------------------------------------------------------------------------------------
-- Apoio (não executável pelo app)
-- ---------------------------------------------------------------------------------------------
create function nucleo.e_motorista_em(p_pessoa_id uuid, p_dia date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pessoas.vinculo v
                  where v.pessoa_id = p_pessoa_id and v.funcao = 'motorista' and v.excluido_em is null and v.periodo @> p_dia)
$$;
revoke all on function nucleo.e_motorista_em(uuid, date) from public, anon;

-- O conjunto que a pessoa dirige no dia: como substituto (a substituição vale sobre o titular) ou como titular.
create function nucleo.conjunto_do_motorista_em(p_pessoa_id uuid, p_dia date)
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select s.ativo_id from pessoas.substituicao_do_motorista s
      where s.substituto_id = p_pessoa_id and s.excluido_em is null and s.periodo @> p_dia limit 1),
    (select m.ativo_id from pessoas.motorista_do_conjunto m
      where m.pessoa_id = p_pessoa_id and m.excluido_em is null and m.periodo @> p_dia
        and not exists (select 1 from pessoas.substituicao_do_motorista s
                         where s.ativo_id = m.ativo_id and s.titular_id = p_pessoa_id and s.excluido_em is null and s.periodo @> p_dia)
      limit 1))
$$;
revoke all on function nucleo.conjunto_do_motorista_em(uuid, date) from public, anon;

-- Quem age sobre o motorista do conjunto: Pessoas (escopo tudo) ou o gestor da carteira com a ação na Frota.
create function nucleo.pode_no_motorista_do_conjunto(p_ativo_id uuid, p_acao_na_frota text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select config.usuario_atual() is not null
     and (config.pode_em_tudo('pessoas', 'editar')
          or (p_ativo_id is not null and config.ve_ativo(p_ativo_id, array['frota'], p_acao_na_frota)))
$$;
revoke all on function nucleo.pode_no_motorista_do_conjunto(uuid, text) from public, anon;

-- ---------------------------------------------------------------------------------------------
-- Vincular e encerrar o motorista do conjunto
-- ---------------------------------------------------------------------------------------------
create function nucleo.vincular_motorista(p_ativo_id uuid, p_pessoa_id uuid, p_inicio date, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: o vínculo motorista × conjunto não tem escrita direta; a função confere por dentro Pessoas › editar ou o gestor da carteira (Frota › editar), o tipo do ativo e a função motorista, fecha na data o vínculo anterior do conjunto e do motorista e grava só este vínculo; search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
  v_tipo text;
begin
  if not nucleo.pode_no_motorista_do_conjunto(p_ativo_id, 'editar') then
    raise exception 'Você não tem permissão para vincular motorista a este conjunto.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'vincular_motorista');
  if v_id is not null then
    return v_id;
  end if;
  if p_inicio is null or p_pessoa_id is null then
    raise exception 'Informe o motorista e a data de início.' using errcode = '22023';
  end if;
  select a.tipo into v_tipo from nucleo.ativo a where a.id = p_ativo_id and a.excluido_em is null;
  if v_tipo is null or v_tipo not in ('cavalo', 'caminhao') then
    raise exception 'Só cavalo e caminhão têm motorista.' using errcode = '23514';
  end if;
  if not nucleo.e_motorista_em(p_pessoa_id, p_inicio) then
    raise exception 'Esta pessoa não tem vínculo de motorista em %. Confira o vínculo na ficha da pessoa.',
      to_char(p_inicio, 'DD/MM/YYYY') using errcode = '23514';
  end if;

  perform 1 from pessoas.motorista_do_conjunto m
   where (m.ativo_id = p_ativo_id or m.pessoa_id = p_pessoa_id) and m.excluido_em is null
   for update;
  select m.id into v_id from pessoas.motorista_do_conjunto m
   where m.ativo_id = p_ativo_id and m.pessoa_id = p_pessoa_id and m.excluido_em is null and m.periodo @> p_inicio;
  if v_id is not null then
    perform auditoria.concluir_envio(p_chave, v_id);
    return v_id;
  end if;
  if exists (select 1 from pessoas.motorista_do_conjunto m
              where (m.ativo_id = p_ativo_id or m.pessoa_id = p_pessoa_id) and m.excluido_em is null and m.inicio >= p_inicio) then
    raise exception 'Já há vínculo de motorista a partir de %: encerre-o antes.', to_char(p_inicio, 'DD/MM/YYYY')
      using errcode = '23514';
  end if;

  -- Fecha na data o motorista anterior do conjunto e o conjunto anterior do motorista (encerrar, não excluir).
  update pessoas.motorista_do_conjunto m set fim = p_inicio
   where (m.ativo_id = p_ativo_id or m.pessoa_id = p_pessoa_id) and m.excluido_em is null
     and m.inicio < p_inicio and (m.fim is null or m.fim > p_inicio);
  insert into pessoas.motorista_do_conjunto (pessoa_id, ativo_id, inicio, registrado_por)
  values (p_pessoa_id, p_ativo_id, p_inicio, config.usuario_atual())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.vincular_motorista(uuid, uuid, date, uuid) from public, anon;
comment on function nucleo.vincular_motorista(uuid, uuid, date, uuid) is
  'Vincula o motorista ao conjunto a partir da data: encerra na mesma data o motorista anterior do conjunto e o conjunto anterior do motorista. Um motorista por conjunto. Chave de envio.';

create function nucleo.encerrar_motorista_do_conjunto(p_vinculo_id uuid, p_fim date, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: encerrar o vínculo motorista × conjunto (sem escrita direta); a função confere por dentro Pessoas › editar ou o gestor da carteira do conjunto e só muda a data de fim deste vínculo; search_path vazio.
set search_path = ''
as $$
declare
  v pessoas.motorista_do_conjunto;
  v_id uuid;
begin
  select * into v from pessoas.motorista_do_conjunto where id = p_vinculo_id and excluido_em is null for update;
  if not found or not nucleo.pode_no_motorista_do_conjunto(v.ativo_id, 'editar') then
    raise exception 'Você não tem permissão para encerrar este vínculo.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'encerrar_motorista_do_conjunto');
  if v_id is not null then
    return v_id;
  end if;
  if v.fim is not distinct from p_fim then
    perform auditoria.concluir_envio(p_chave, v.id);
    return v.id;
  end if;
  if p_fim is null or p_fim <= v.inicio or (v.fim is not null and p_fim > v.fim) then
    raise exception 'A data de fim fica depois do início e não estende um vínculo já encerrado.' using errcode = '22023';
  end if;
  update pessoas.motorista_do_conjunto set fim = p_fim where id = v.id;
  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.encerrar_motorista_do_conjunto(uuid, date, uuid) from public, anon;
comment on function nucleo.encerrar_motorista_do_conjunto(uuid, date, uuid) is
  'Encerra o vínculo motorista × conjunto na data (encerrar não é excluir). Encerrar de novo na mesma data não muda nada.';

-- ---------------------------------------------------------------------------------------------
-- Lançar o status do dia do motorista
-- ---------------------------------------------------------------------------------------------
create function nucleo.lancar_status_do_motorista(
  p_pessoa_id uuid, p_dia date, p_codigo text, p_versao integer default null, p_motivo text default null, p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: o status do motorista não tem escrita direta; a função confere por dentro Pessoas › editar ou o gestor da carteira do conjunto que o motorista dirige no dia (Frota › criar), o código, o dia e a versão, e grava só o status desta pessoa e dia; search_path vazio.
set search_path = ''
as $$
declare
  v_ativo uuid;
  v pessoas.status_do_motorista;
  v_id uuid;
begin
  if p_codigo is null or not exists (select 1 from pessoas.codigo_do_motorista c where c.codigo = p_codigo) then
    raise exception 'Escolha o código do dia: TBV, TBE, TBX, FOL, FÉR, ATS, FRD ou FLT.' using errcode = '22023';
  end if;
  if p_dia is null or p_dia > nucleo.hoje_em_sao_paulo() then
    raise exception 'Lance um dia até hoje; os dias futuros são a escala.' using errcode = '22023';
  end if;
  v_ativo := nucleo.conjunto_do_motorista_em(p_pessoa_id, p_dia);
  if not (config.usuario_atual() is not null
          and (config.pode_em_tudo('pessoas', 'editar')
               or (v_ativo is not null and config.ve_ativo(v_ativo, array['frota'], 'criar')))) then
    raise exception 'Você não tem permissão para lançar o dia deste motorista.' using errcode = '42501';
  end if;
  if not nucleo.e_motorista_em(p_pessoa_id, p_dia) then
    raise exception 'Esta pessoa não tem vínculo de motorista em %.', to_char(p_dia, 'DD/MM/YYYY') using errcode = '23514';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'lancar_status_do_motorista');
  if v_id is not null then
    return v_id;
  end if;

  select * into v from pessoas.status_do_motorista s
   where s.pessoa_id = p_pessoa_id and s.dia = p_dia and s.excluido_em is null for update;
  if found then
    if v.codigo = p_codigo then
      perform auditoria.concluir_envio(p_chave, v.id);
      return v.id;
    end if;
    if p_versao is distinct from v.versao then
      raise exception 'O dia deste motorista mudou desde que você abriu: confira e lance de novo.' using errcode = '40001';
    end if;
    if nullif(btrim(coalesce(p_motivo, '')), '') is null then
      raise exception 'Corrigir o dia do motorista pede o motivo.' using errcode = '23514';
    end if;
    update pessoas.status_do_motorista
       set excluido_em = now(), excluido_por = config.usuario_atual(), motivo_da_exclusao = btrim(p_motivo)
     where id = v.id;
  end if;
  insert into pessoas.status_do_motorista (pessoa_id, dia, codigo, registrado_por)
  values (p_pessoa_id, p_dia, p_codigo, config.usuario_atual())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.lancar_status_do_motorista(uuid, date, text, integer, text, uuid) from public, anon;
comment on function nucleo.lancar_status_do_motorista(uuid, date, text, integer, text, uuid) is
  'Lança o realizado do motorista no dia (até hoje). Mesmo código: não grava de novo. Outro código: pede a versão vista e o motivo, exclui o anterior (fica no histórico) e grava o novo. Chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Indicar substituto e encerrar a substituição
-- ---------------------------------------------------------------------------------------------
create function nucleo.indicar_substituto(
  p_titular_id uuid, p_substituto_id uuid, p_inicio date, p_fim date, p_motivo text, p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: a substituição não tem escrita direta; a função confere por dentro Pessoas › editar ou o gestor da carteira do conjunto do titular (Frota › editar), que o substituto é motorista e está livre no período, e grava só esta substituição; search_path vazio.
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_id uuid;
begin
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'Informe o período da substituição: o fim fica depois do início.' using errcode = '22023';
  end if;
  select m.ativo_id into v_ativo from pessoas.motorista_do_conjunto m
   where m.pessoa_id = p_titular_id and m.excluido_em is null and m.periodo @> p_inicio;
  if not nucleo.pode_no_motorista_do_conjunto(v_ativo, 'editar') then
    raise exception 'Você não tem permissão para indicar substituto para este motorista.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'indicar_substituto');
  if v_id is not null then
    return v_id;
  end if;
  if v_ativo is null then
    raise exception 'O titular não dirige nenhum conjunto em %.', to_char(p_inicio, 'DD/MM/YYYY') using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Indicar substituto pede o motivo (férias, atestado...).' using errcode = '23514';
  end if;
  if p_substituto_id is null or p_substituto_id = p_titular_id then
    raise exception 'O substituto é outra pessoa, não o titular.' using errcode = '23514';
  end if;
  if not nucleo.e_motorista_em(p_substituto_id, p_inicio) then
    raise exception 'O substituto precisa ter vínculo de motorista em %.', to_char(p_inicio, 'DD/MM/YYYY') using errcode = '23514';
  end if;
  if exists (select 1 from pessoas.motorista_do_conjunto m
              where m.pessoa_id = p_substituto_id and m.excluido_em is null and m.periodo && daterange(p_inicio, p_fim, '[)')) then
    raise exception 'O substituto já dirige outro conjunto no período.' using errcode = '23514';
  end if;

  insert into pessoas.substituicao_do_motorista (ativo_id, titular_id, substituto_id, inicio, fim, motivo, registrado_por)
  values (v_ativo, p_titular_id, p_substituto_id, p_inicio, p_fim, btrim(p_motivo), config.usuario_atual())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.indicar_substituto(uuid, uuid, date, date, text, uuid) from public, anon;
comment on function nucleo.indicar_substituto(uuid, uuid, date, date, text, uuid) is
  'Indicar substituto: o substituto dirige o conjunto do titular em [início, fim), com motivo. Sem sobreposição no conjunto nem no substituto; quem é titular de outro conjunto no período não substitui. Chave de envio.';

create function nucleo.encerrar_substituicao(p_substituicao_id uuid, p_fim date, p_motivo text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: encerrar a substituição (sem escrita direta); a função confere por dentro Pessoas › editar ou o gestor da carteira do conjunto e só muda esta substituição (fim mais cedo, ou cancelada com motivo); search_path vazio.
set search_path = ''
as $$
declare
  v pessoas.substituicao_do_motorista;
  v_id uuid;
begin
  select * into v from pessoas.substituicao_do_motorista where id = p_substituicao_id for update;
  if not found or not nucleo.pode_no_motorista_do_conjunto(v.ativo_id, 'editar') then
    raise exception 'Você não tem permissão para encerrar esta substituição.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'encerrar_substituicao');
  if v_id is not null then
    return v_id;
  end if;
  -- Já cancelada, ou já termina na data: nada muda (roda duas vezes).
  if v.excluido_em is not null or v.fim = p_fim then
    perform auditoria.concluir_envio(p_chave, v.id);
    return v.id;
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Encerrar a substituição pede o motivo.' using errcode = '23514';
  end if;
  if p_fim is null or p_fim > v.fim then
    raise exception 'A substituição só se encurta; para estender, indique outra a partir do fim desta.' using errcode = '22023';
  end if;
  if p_fim <= v.inicio then
    update pessoas.substituicao_do_motorista
       set excluido_em = now(), excluido_por = config.usuario_atual(), motivo_da_exclusao = btrim(p_motivo)
     where id = v.id;
  else
    update pessoas.substituicao_do_motorista set fim = p_fim where id = v.id;
  end if;
  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.encerrar_substituicao(uuid, date, text, uuid) from public, anon;
comment on function nucleo.encerrar_substituicao(uuid, date, text, uuid) is
  'Encerra a substituição na data (fim mais cedo); na data do início, ou antes, a cancela (exclusão lógica com motivo). Já encerrada ou cancelada: não muda nada.';

-- ---------------------------------------------------------------------------------------------
-- Leituras recortadas (nome e código; nunca CPF, contato, salário ou documento)
-- ---------------------------------------------------------------------------------------------
create function nucleo.linha_do_motorista(p_de date, p_ate date)
returns table (
  ativo_id uuid, placa text, dia date, pessoa_id uuid, nome text, substituto boolean,
  realizado text, escala text, sugestao text
)
language plpgsql
stable
security definer -- justificativa: o gestor de frota não lê as tabelas de Pessoas; a função entrega só nome e código do dia dos conjuntos que quem chama alcança (Pessoas › ver em tudo, ou config.ve_ativo na Frota, a carteira do gestor), nunca documento; search_path vazio.
set search_path = ''
as $$
declare
  v_tudo boolean := config.pode_em_tudo('pessoas', 'ver');
begin
  if config.usuario_atual() is null then
    raise exception 'Entre no sistema para ver os motoristas.' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 62 then
    raise exception 'Escolha um período de até 63 dias.' using errcode = '22023';
  end if;
  return query
  with conj as (
    select l.ativo_id, l.placa
      from nucleo.leitura_da_placa l
     where l.tipo in ('cavalo', 'caminhao')
       and exists (select 1 from pessoas.motorista_do_conjunto m
                    where m.ativo_id = l.ativo_id and m.excluido_em is null and m.periodo && daterange(p_de, p_ate, '[]'))
       and (v_tudo or config.ve_ativo(l.ativo_id, array['frota'], 'ver'))
  ),
  dias as (
    select g::date as dia from generate_series(p_de, p_ate, interval '1 day') g
  ),
  efetivo as (
    select c.ativo_id, c.placa, d.dia, coalesce(s.substituto_id, m.pessoa_id) as pessoa_id, s.id is not null as substituto
      from conj c
     cross join dias d
      left join pessoas.motorista_do_conjunto m
        on m.ativo_id = c.ativo_id and m.excluido_em is null and m.periodo @> d.dia
      left join pessoas.substituicao_do_motorista s
        on s.ativo_id = c.ativo_id and s.excluido_em is null and s.periodo @> d.dia
     where m.id is not null or s.id is not null
  )
  select e.ativo_id, e.placa, e.dia, e.pessoa_id, p.nome, e.substituto, st.codigo, esc.sigla, cm.codigo
    from efetivo e
    join nucleo.pessoa p on p.id = e.pessoa_id
    left join pessoas.status_do_motorista st on st.pessoa_id = e.pessoa_id and st.dia = e.dia and st.excluido_em is null
    left join pessoas.marcacao_da_escala esc on esc.pessoa_id = e.pessoa_id and esc.dia = e.dia
    left join pessoas.codigo_do_motorista cm on cm.sugerido_pela_escala = esc.sigla
   order by e.placa, e.ativo_id, e.dia;
end;
$$;
revoke all on function nucleo.linha_do_motorista(date, date) from public, anon;
comment on function nucleo.linha_do_motorista(date, date) is
  'A linha fina do motorista sob cada conjunto, dia a dia: quem dirige (o substituto vale sobre o titular), o realizado (liso), a escala e a sugestão (pontilhado). Só nome e código; só os conjuntos que quem chama alcança.';

create function nucleo.motoristas_no_dia(p_dia date)
returns jsonb
language plpgsql
stable
security definer -- justificativa: a contagem do dia lê as tabelas de Pessoas que o gestor não lê; só números, pelos conjuntos que quem chama alcança (os mesmos de nucleo.linha_do_motorista); search_path vazio.
set search_path = ''
as $$
declare
  v_tudo boolean := config.pode_em_tudo('pessoas', 'ver');
  v_inicio timestamptz;
  v_fim timestamptz;
  v_resultado jsonb;
begin
  if p_dia is null then
    raise exception 'Escolha o dia.' using errcode = '22023';
  end if;
  v_inicio := p_dia::timestamp at time zone 'America/Sao_Paulo';
  v_fim := (p_dia + 1)::timestamp at time zone 'America/Sao_Paulo';
  with linha as (
    select * from nucleo.linha_do_motorista(p_dia, p_dia)
  ),
  ativos as (
    select count(*) as n
      from nucleo.leitura_da_placa a
     where a.tipo in ('cavalo', 'caminhao')
       and (a.baixada_em is null or a.baixada_em >= v_inicio)
       and exists (select 1 from nucleo.evento_de_status e where e.ativo_id = a.ativo_id and e.excluido_em is null and e.em < v_fim)
       and (v_tudo or config.ve_ativo(a.ativo_id, array['frota'], 'ver'))
  )
  select jsonb_build_object(
           'dia', p_dia,
           'com_motorista', (select count(*) from linha),
           'sem_motorista', greatest((select n from ativos) - (select count(*) from linha), 0),
           'sem_lancamento', (select count(*) from linha where realizado is null),
           'por_codigo', coalesce((select jsonb_object_agg(x.realizado, x.n) from (
                            select l.realizado, count(*) as n from linha l where l.realizado is not null group by l.realizado) x), '{}'::jsonb))
    into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.motoristas_no_dia(date) from public, anon;
comment on function nucleo.motoristas_no_dia(date) is
  'A faixa do motorista no topo da grade: conjuntos com motorista no dia, por código do realizado, sem lançamento (nunca presume TBV) e conjuntos ativos sem motorista. Contagem pronta no banco.';

create function nucleo.motorista_do_conjunto_no_mes(p_ativo_id uuid, p_mes date)
returns jsonb
language plpgsql
stable
security definer -- justificativa: a aba Motorista do gestor lê as tabelas de Pessoas que ele não lê; a função confere que quem chama alcança o conjunto (Pessoas › ver em tudo, ou config.ve_ativo na Frota) e entrega só nome, datas e códigos; search_path vazio.
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', coalesce(p_mes, nucleo.hoje_em_sao_paulo()))::date;
  v_fim date;
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_resultado jsonb;
begin
  if config.usuario_atual() is null
     or not (config.pode_em_tudo('pessoas', 'ver') or config.ve_ativo(p_ativo_id, array['frota'], 'ver')) then
    raise exception 'Você não tem acesso ao motorista deste conjunto.' using errcode = '42501';
  end if;
  v_fim := (v_mes + interval '1 month')::date;
  with dias as (
    select * from nucleo.linha_do_motorista(v_mes, v_fim - 1) l where l.ativo_id = p_ativo_id
  ),
  ate_hoje as (
    select d.*, c.grupo from dias d left join pessoas.codigo_do_motorista c on c.codigo = d.realizado where d.dia <= v_hoje
  )
  select jsonb_build_object(
    'ativo_id', p_ativo_id,
    'mes', v_mes,
    'vigente', (select jsonb_build_object('pessoa_id', m.pessoa_id, 'nome', p.nome, 'desde', m.inicio)
                  from pessoas.motorista_do_conjunto m join nucleo.pessoa p on p.id = m.pessoa_id
                 where m.ativo_id = p_ativo_id and m.excluido_em is null and m.periodo @> v_hoje),
    'vinculos', coalesce((select jsonb_agg(jsonb_build_object('pessoa_id', m.pessoa_id, 'nome', p.nome, 'inicio', m.inicio, 'fim', m.fim)
                                           order by m.inicio desc, m.id)
                            from pessoas.motorista_do_conjunto m join nucleo.pessoa p on p.id = m.pessoa_id
                           where m.ativo_id = p_ativo_id and m.excluido_em is null and m.periodo && daterange(v_mes, v_fim, '[)')), '[]'::jsonb),
    'substituicoes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'versao', s.versao, 'titular', pt.nome, 'substituto', ps.nome,
                                                                   'inicio', s.inicio, 'fim', s.fim, 'motivo', s.motivo) order by s.inicio, s.id)
                                 from pessoas.substituicao_do_motorista s
                                 join nucleo.pessoa pt on pt.id = s.titular_id
                                 join nucleo.pessoa ps on ps.id = s.substituto_id
                                where s.ativo_id = p_ativo_id and s.excluido_em is null and s.periodo && daterange(v_mes, v_fim, '[)')), '[]'::jsonb),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('dia', d.dia, 'pessoa_id', d.pessoa_id, 'nome', d.nome, 'substituto', d.substituto,
                                                          'realizado', d.realizado, 'escala', d.escala, 'sugestao', d.sugestao) order by d.dia)
                        from dias d), '[]'::jsonb),
    'totais', (select jsonb_build_object(
                 'trabalhados', count(*) filter (where a.grupo = 'trabalho'),
                 'folgas', count(*) filter (where a.grupo = 'folga'),
                 'ferias', count(*) filter (where a.grupo = 'ferias'),
                 'atestados', count(*) filter (where a.grupo = 'atestado'),
                 'feriados', count(*) filter (where a.grupo = 'feriado'),
                 'faltas', count(*) filter (where a.grupo = 'falta'),
                 'sem_lancamento', count(*) filter (where a.realizado is null)) from ate_hoje a),
    'ferias_sem_substituto_a_partir_de', (select min(f.primeiro_dia) from nucleo.ferias_sem_substituto() f where f.ativo_id = p_ativo_id)
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.motorista_do_conjunto_no_mes(uuid, date) from public, anon;
comment on function nucleo.motorista_do_conjunto_no_mes(uuid, date) is
  'A aba Motorista do conjunto no mês: o vigente, os vínculos e as substituições do mês, o calendário (realizado, escala e sugestão), os totais até hoje por grupo do código e o aviso de férias sem substituto.';

create function nucleo.ferias_sem_substituto()
returns table (titular_id uuid, nome text, ativo_id uuid, placa text, primeiro_dia date, ultimo_dia date, dias integer)
language plpgsql
stable
security definer -- justificativa: a tarefa "Indicar substituto" cruza a escala (Pessoas) com o conjunto; a função entrega só nome, placa e datas dos conjuntos que quem chama alcança (Pessoas › ver em tudo, ou config.ve_ativo na Frota); search_path vazio.
set search_path = ''
as $$
declare
  v_tudo boolean := config.pode_em_tudo('pessoas', 'ver');
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_janela integer := coalesce((select p.valor::integer from config.parametro p where p.chave = 'dias_para_indicar_substituto'), 10);
begin
  if config.usuario_atual() is null then
    return;
  end if;
  return query
  select m.pessoa_id, p.nome, m.ativo_id, l.placa, min(e.dia), max(e.dia), count(*)::integer
    from pessoas.marcacao_da_escala e
    join pessoas.motorista_do_conjunto m on m.pessoa_id = e.pessoa_id and m.excluido_em is null and m.periodo @> e.dia
    join nucleo.pessoa p on p.id = m.pessoa_id
    left join nucleo.leitura_da_placa l on l.ativo_id = m.ativo_id
   where e.sigla = 'FE' and e.dia between v_hoje and v_hoje + v_janela
     and not exists (select 1 from pessoas.substituicao_do_motorista s
                      where s.ativo_id = m.ativo_id and s.excluido_em is null and s.periodo @> e.dia)
     and (v_tudo or config.ve_ativo(m.ativo_id, array['frota'], 'ver'))
   group by m.pessoa_id, p.nome, m.ativo_id, l.placa
   order by min(e.dia), l.placa, m.ativo_id;
end;
$$;
revoke all on function nucleo.ferias_sem_substituto() from public, anon;
comment on function nucleo.ferias_sem_substituto() is
  'A tarefa "Indicar substituto": férias na escala do titular nos próximos dias (parâmetro dias_para_indicar_substituto) sem substituição que cubra o dia, por titular e conjunto, com o primeiro dia sem motorista. Some quando a substituição cobre os dias.';

-- ---------------------------------------------------------------------------------------------
-- O que o app executa
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.vincular_motorista(uuid,uuid,date,uuid)', 'A6: vincula o motorista ao conjunto; conferência por dentro e chave de envio.'),
  ('nucleo.encerrar_motorista_do_conjunto(uuid,date,uuid)', 'A6: encerra o vínculo motorista × conjunto; conferência por dentro.'),
  ('nucleo.lancar_status_do_motorista(uuid,date,text,integer,text,uuid)', 'A6: o realizado do dia do motorista; conferência por dentro, versão e chave de envio.'),
  ('nucleo.indicar_substituto(uuid,uuid,date,date,text,uuid)', 'A6: Indicar substituto; conferência por dentro e chave de envio.'),
  ('nucleo.encerrar_substituicao(uuid,date,text,uuid)', 'A6: encerra ou cancela a substituição; conferência por dentro.'),
  ('nucleo.linha_do_motorista(date,date)', 'A6: a linha do motorista sob o conjunto, recortada (nome e código) pelos conjuntos que quem chama alcança.'),
  ('nucleo.motoristas_no_dia(date)', 'A6: a contagem do dia do motorista, pronta no banco, recortada.'),
  ('nucleo.motorista_do_conjunto_no_mes(uuid,date)', 'A6: a aba Motorista do conjunto, recortada e com a conferência do acesso.'),
  ('nucleo.ferias_sem_substituto()', 'A6: a tarefa Indicar substituto (férias sem substituto), recortada.');
grant execute on function nucleo.vincular_motorista(uuid, uuid, date, uuid) to authenticated;
grant execute on function nucleo.encerrar_motorista_do_conjunto(uuid, date, uuid) to authenticated;
grant execute on function nucleo.lancar_status_do_motorista(uuid, date, text, integer, text, uuid) to authenticated;
grant execute on function nucleo.indicar_substituto(uuid, uuid, date, date, text, uuid) to authenticated;
grant execute on function nucleo.encerrar_substituicao(uuid, date, text, uuid) to authenticated;
grant execute on function nucleo.linha_do_motorista(date, date) to authenticated;
grant execute on function nucleo.motoristas_no_dia(date) to authenticated;
grant execute on function nucleo.motorista_do_conjunto_no_mes(uuid, date) to authenticated;
grant execute on function nucleo.ferias_sem_substituto() to authenticated;
