-- Fase 3, fatia 3.4: composição e conjunto.
--
--  * Função do implemento (decisão de Alexandre, 03/11/2026, opção A): semirreboque ou dolly. A
--    carroceria é obrigatória no semirreboque e proibida no dolly; o dolly tem 2 eixos. Os cinco tipos
--    de ativo, as siglas e o catálogo de status não mudam.
--  * Eixos no ativo (2 ou 3 no implemento). Até a 3.7 trazer a origem do campo, implemento sem eixos
--    informados deixa o nome do conjunto "pendente", nunca presumido.
--  * Regra da equipe (03/11/2026) em `config.configuracao_de_conjunto`, pela estrutura: unidades
--    engatadas (o dolly conta), presença de dolly, eixos dos semirreboques e eixos do dolly.
--  * Composição: cavalo mestre, implementos servos (chaves compostas com o tipo), posição de 1 a 3,
--    vigência [início, fim). A estrutura é conferida no fim da transação: semirreboques de eixos
--    iguais e da mesma carroceria, dolly só entre dois semirreboques, e a estrutura tem de bater com
--    uma configuração.
--  * Operação: engatado usa a do cavalo; solto mantém a gravada na saída (uma vez, ao desengatar);
--    nunca engatado usa a do próprio CR. A meta do conjunto é só do cavalo; o implemento herda.
--  * O tipo do ativo só muda pela função com motivo e nunca com composição vigente; a função do
--    implemento não muda com ele engatado.
--
-- Tudo nasce fechado: RLS ligado, nenhum grant, nenhuma função SECURITY DEFINER.

-- ---------------------------------------------------------------------------------------------
-- Função e eixos do implemento
-- ---------------------------------------------------------------------------------------------
create type nucleo.funcao_do_implemento as enum ('semirreboque', 'dolly');
comment on type nucleo.funcao_do_implemento is
  'O papel do implemento no conjunto: semirreboque (com carroceria) ou dolly (sem carroceria, 2 eixos, só no meio do rodotrem).';

alter table nucleo.ativo add column funcao nucleo.funcao_do_implemento;
alter table nucleo.ativo add column eixos smallint;
comment on column nucleo.ativo.funcao is 'Obrigatória no implemento (semirreboque ou dolly), proibida nos demais tipos.';
comment on column nucleo.ativo.eixos is
  'Eixos da peça. No implemento, 2 ou 3 (o dolly tem 2). Sem origem até a 3.7; nulo quer dizer "não informado" e deixa o nome do conjunto pendente.';

alter table nucleo.ativo drop constraint ativo_carroceria_obrigatoria_no_implemento;
alter table nucleo.ativo add constraint ativo_funcao_so_no_implemento
  check ((tipo = 'implemento') = (funcao is not null));
alter table nucleo.ativo add constraint ativo_carroceria_obrigatoria_no_semirreboque
  check (funcao is distinct from 'semirreboque' or carroceria_id is not null);
alter table nucleo.ativo add constraint ativo_dolly_sem_carroceria
  check (funcao is distinct from 'dolly' or carroceria_id is null);
alter table nucleo.ativo add constraint ativo_eixos_positivos
  check (eixos is null or eixos > 0);
alter table nucleo.ativo add constraint ativo_eixos_do_implemento
  check (tipo <> 'implemento' or eixos is null or eixos in (2, 3));
alter table nucleo.ativo add constraint ativo_eixos_do_dolly
  check (funcao is distinct from 'dolly' or eixos = 2);
comment on column nucleo.ativo.carroceria_id is
  'Obrigatória no semirreboque, proibida no dolly, opcional no caminhão e proibida em cavalo, equipamento e apoio.';

-- ---------------------------------------------------------------------------------------------
-- A regra da equipe pela estrutura (as colunas provisórias da 3.1 saem)
-- ---------------------------------------------------------------------------------------------
alter table config.configuracao_de_conjunto
  drop column quantidade_de_implementos,
  drop column com_dolly,
  drop column eixos_por_implemento;
alter table config.configuracao_de_conjunto
  add column unidades smallint,
  add column com_dolly boolean,
  add column eixos_dos_semirreboques smallint[],
  add column eixos_do_dolly smallint;

-- Onde as configurações já existem (base já semeada), a regra entra aqui; num banco novo entra pelo seed.
update config.configuracao_de_conjunto set unidades = 1, com_dolly = false, eixos_dos_semirreboques = '{2,3}', eixos_do_dolly = null where codigo = 'simples';
update config.configuracao_de_conjunto set unidades = 2, com_dolly = false, eixos_dos_semirreboques = '{2}', eixos_do_dolly = null where codigo = 'bi';
update config.configuracao_de_conjunto set unidades = 2, com_dolly = false, eixos_dos_semirreboques = '{3}', eixos_do_dolly = null where codigo = 'bitrezao';
update config.configuracao_de_conjunto set unidades = 3, com_dolly = true, eixos_dos_semirreboques = '{2}', eixos_do_dolly = 2 where codigo = 'rodo';

alter table config.configuracao_de_conjunto
  alter column unidades set not null,
  alter column com_dolly set not null,
  alter column eixos_dos_semirreboques set not null,
  add constraint configuracao_unidades check (unidades between 1 and 3),
  add constraint configuracao_eixos_dos_semirreboques check (cardinality(eixos_dos_semirreboques) > 0),
  add constraint configuracao_dolly_com_eixos check (com_dolly = (eixos_do_dolly is not null));
-- De onde vem a regra e se alguém já a conferiu. A regra é da equipe (03/11/2026), não da norma: nasce
-- "a conferir" e sem referência normativa. Conferir é dizer quando e quem (princípio da conformidade:
-- existir no catálogo não é autorização de circular).
alter table config.configuracao_de_conjunto
  add column referencia_normativa text,
  add column conferencia text not null default 'a_conferir',
  add column conferida_em date,
  add column conferida_por uuid references nucleo.pessoa (id),
  add constraint configuracao_conferencia_valida check (conferencia in ('a_conferir', 'conferida')),
  add constraint configuracao_conferida_com_data check ((conferencia = 'conferida') = (conferida_em is not null)),
  add constraint configuracao_conferida_com_quem check ((conferida_em is null) = (conferida_por is null));
create index configuracao_de_conjunto_conferida_por_idx on config.configuracao_de_conjunto (conferida_por);
comment on column config.configuracao_de_conjunto.referencia_normativa is
  'A norma que embasa a configuração (texto consolidado da Resolução CONTRAN e alterações), quando houver. Nula: a regra é só da equipe.';
comment on column config.configuracao_de_conjunto.conferencia is
  'a_conferir ou conferida. Conferida exige a data (conferida_em) e quem conferiu (conferida_por).';

comment on table config.configuracao_de_conjunto is
  'Simples, bi, bitrezão e rodo, reconhecidos pela estrutura (regra da equipe, 03/11/2026): unidades engatadas (o dolly conta), presença de dolly, eixos aceitos nos semirreboques (todos iguais entre si) e eixos do dolly. Nunca pelo total de eixos.';

-- O nome por carroceria e estrutura. Sem os eixos dos semirreboques, "pendente". Carroceria sem
-- nomes de conjunto (Baú frigorífico, Prancha, Tanque): a carroceria e a quantidade de semirreboques.
drop function config.nome_do_conjunto(uuid, integer, integer);
create function config.nome_do_conjunto(
  p_carroceria_id uuid,
  p_unidades integer,
  p_com_dolly boolean,
  p_eixos_dos_semirreboques integer,
  p_eixos_do_dolly integer
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_configuracao text;
  v_semirreboques integer := p_unidades - case when p_com_dolly then 1 else 0 end;
begin
  if p_carroceria_id is null then
    return null;
  end if;
  if p_eixos_dos_semirreboques is null then
    return 'pendente';
  end if;
  select codigo into v_configuracao
    from config.configuracao_de_conjunto
   where unidades = p_unidades
     and com_dolly = p_com_dolly
     and p_eixos_dos_semirreboques = any (eixos_dos_semirreboques)
     and eixos_do_dolly is not distinct from p_eixos_do_dolly;
  if v_configuracao is null then
    return null;
  end if;
  if exists (select 1 from config.nomenclatura_de_conjunto where carroceria_id = p_carroceria_id) then
    return (select nome from config.nomenclatura_de_conjunto
             where carroceria_id = p_carroceria_id and configuracao = v_configuracao);
  end if;
  return (select nome from config.carroceria where id = p_carroceria_id)
    || ', ' || v_semirreboques
    || case when v_semirreboques = 1 then ' implemento' else ' implementos' end;
end;
$$;
revoke all on function config.nome_do_conjunto(uuid, integer, boolean, integer, integer) from public;

-- ---------------------------------------------------------------------------------------------
-- Composição
-- ---------------------------------------------------------------------------------------------
create table nucleo.composicao (
  id uuid primary key default gen_random_uuid(),
  cavalo_id uuid not null,
  cavalo_tipo nucleo.tipo_de_ativo not null generated always as ('cavalo'::nucleo.tipo_de_ativo) stored,
  implemento_id uuid not null,
  implemento_tipo nucleo.tipo_de_ativo not null generated always as ('implemento'::nucleo.tipo_de_ativo) stored,
  posicao smallint not null,
  operacao_na_saida_id uuid references nucleo.operacao (id),
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
  constraint composicao_cavalo_fk foreign key (cavalo_id, cavalo_tipo) references nucleo.ativo (id, tipo),
  constraint composicao_implemento_fk foreign key (implemento_id, implemento_tipo) references nucleo.ativo (id, tipo),
  constraint composicao_posicao check (posicao between 1 and 3),
  constraint composicao_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint composicao_fim_com_origem check ((fim is null) = (fim_origem is null)),
  constraint composicao_implemento_um_cavalo_por_vez exclude using gist (implemento_id with =, periodo with &&) where (excluido_em is null),
  constraint composicao_uma_unidade_por_posicao exclude using gist (cavalo_id with =, posicao with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.composicao is
  'Cada implemento engatado num cavalo, com a posição (1 a 3, a partir do cavalo) e a vigência [início, fim). Só cavalo é mestre e só implemento é servo. A operação na saída é gravada uma vez, ao desengatar.';
comment on column nucleo.composicao.operacao_na_saida_id is
  'A operação do cavalo no instante em que o implemento saiu. Fato do momento da saída: gravado pelo banco ao desengatar e nunca alterado.';

create index composicao_cavalo_id_idx on nucleo.composicao (cavalo_id);
create index composicao_implemento_id_idx on nucleo.composicao (implemento_id);
create index composicao_operacao_na_saida_id_idx on nucleo.composicao (operacao_na_saida_id);
create index composicao_nao_excluida_idx on nucleo.composicao (cavalo_id) where excluido_em is null;
alter table nucleo.composicao enable row level security;

-- A estrutura de um cavalo, conferida em cada instante em que ela muda (início ou fim de uma unidade).
-- As mensagens são as mesmas de `lib/dominio/composicao.ts`.
create function nucleo.conferir_conjunto(p_cavalo_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_instante timestamptz;
  v_n integer;
  v_funcoes text[];
  v_dollies integer;
  v_carrocerias integer;
  v_eixos_distintos integer;
  v_eixos_faltando boolean;
  v_eixos_semi integer;
  v_eixos_dolly integer;
begin
  for v_instante in
    select inicio from nucleo.composicao where cavalo_id = p_cavalo_id and excluido_em is null
    union
    select fim from nucleo.composicao where cavalo_id = p_cavalo_id and excluido_em is null and fim is not null
  loop
    select count(*)::int,
           array_agg(a.funcao::text order by c.posicao),
           count(*) filter (where a.funcao = 'dolly')::int,
           count(distinct a.carroceria_id) filter (where a.funcao = 'semirreboque')::int,
           count(distinct a.eixos) filter (where a.funcao = 'semirreboque')::int,
           coalesce(bool_or(a.funcao = 'semirreboque' and a.eixos is null), false),
           max(a.eixos) filter (where a.funcao = 'semirreboque'),
           max(a.eixos) filter (where a.funcao = 'dolly')
      into v_n, v_funcoes, v_dollies, v_carrocerias, v_eixos_distintos, v_eixos_faltando, v_eixos_semi, v_eixos_dolly
      from nucleo.composicao c
      join nucleo.ativo a on a.id = c.implemento_id
     where c.cavalo_id = p_cavalo_id and c.excluido_em is null and c.periodo @> v_instante;

    continue when v_n = 0;

    if v_n > 3 then
      raise exception 'O conjunto tem no máximo três unidades.' using errcode = '23514';
    end if;
    if v_dollies > 0 and not (v_n = 3 and v_dollies = 1 and v_funcoes[2] = 'dolly') then
      raise exception 'O dolly só entra no rodotrem, entre dois semirreboques.' using errcode = '23514';
    end if;
    if v_dollies = 0 and v_n = 3 then
      raise exception 'Três semirreboques sem dolly não formam um conjunto operado pela TranSul.' using errcode = '23514';
    end if;
    if v_carrocerias > 1 then
      raise exception 'Conjunto misto não pode: os semirreboques têm de ter a mesma carroceria.' using errcode = '23514';
    end if;
    if v_eixos_distintos > 1 then
      raise exception 'Os semirreboques do conjunto têm de ter o mesmo número de eixos.' using errcode = '23514';
    end if;
    if not v_eixos_faltando and not exists (
      select 1 from config.configuracao_de_conjunto
       where unidades = v_n
         and com_dolly = (v_dollies > 0)
         and v_eixos_semi = any (eixos_dos_semirreboques)
         and eixos_do_dolly is not distinct from v_eixos_dolly
    ) then
      raise exception 'Esta estrutura não corresponde a nenhuma configuração de conjunto: o rodotrem só leva semirreboques de 2 eixos e dolly de 2.'
        using errcode = '23514';
    end if;
  end loop;
end;
$$;
revoke all on function nucleo.conferir_conjunto(uuid) from public;

create function nucleo.conferir_conjunto_da_composicao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform nucleo.conferir_conjunto(new.cavalo_id);
  if tg_op = 'UPDATE' and old.cavalo_id is distinct from new.cavalo_id then
    perform nucleo.conferir_conjunto(old.cavalo_id);
  end if;
  return null;
end;
$$;
revoke all on function nucleo.conferir_conjunto_da_composicao() from public;

-- Mudar eixos, carroceria ou função de um implemento confere os conjuntos em que ele esteve.
create function nucleo.conferir_conjuntos_do_implemento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cavalo uuid;
begin
  for v_cavalo in
    select distinct cavalo_id from nucleo.composicao where implemento_id = new.id and excluido_em is null
  loop
    perform nucleo.conferir_conjunto(v_cavalo);
  end loop;
  return null;
end;
$$;
revoke all on function nucleo.conferir_conjuntos_do_implemento() from public;

-- A operação na saída: gravada pelo banco ao desengatar (a do CR vigente do cavalo no instante logo
-- antes do fim) e nunca alterada depois.
create function nucleo.gravar_operacao_na_saida()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fechando boolean := new.fim is not null and (tg_op = 'INSERT' or old.fim is null);
begin
  if tg_op = 'UPDATE' and not v_fechando
     and new.operacao_na_saida_id is distinct from old.operacao_na_saida_id then
    raise exception 'A operação na saída é gravada uma vez, ao desengatar, e não muda.'
      using errcode = '23514';
  end if;
  if v_fechando then
    new.operacao_na_saida_id := (
      select c.operacao_id
        from nucleo.cr_do_ativo v
        join nucleo.cr c on c.id = v.cr_id
       where v.ativo_id = new.cavalo_id
         and v.excluido_em is null
         and v.periodo @> (new.fim - interval '1 microsecond')
    );
  end if;
  return new;
end;
$$;
revoke all on function nucleo.gravar_operacao_na_saida() from public;

create trigger t10_intervalo before insert or update on nucleo.composicao
  for each row execute function nucleo.conferir_intervalo_da_vigencia();
create trigger t20_motivo_da_correcao before update on nucleo.composicao
  for each row execute function nucleo.exigir_motivo_da_correcao();
create trigger t25_operacao_na_saida before insert or update on nucleo.composicao
  for each row execute function nucleo.gravar_operacao_na_saida();
create trigger t30_versao before update on nucleo.composicao
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.composicao
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.composicao
  for each row execute function auditoria.registrar_mudanca('id');
create constraint trigger t95_estrutura after insert or update on nucleo.composicao
  deferrable initially deferred
  for each row execute function nucleo.conferir_conjunto_da_composicao();

create constraint trigger t96_estrutura_do_conjunto after update of eixos, carroceria_id, funcao on nucleo.ativo
  deferrable initially deferred
  for each row execute function nucleo.conferir_conjuntos_do_implemento();

-- ---------------------------------------------------------------------------------------------
-- Trava (ajuste do checkpoint 3.4): o tipo só muda pela função `mudar_tipo_do_ativo`, com motivo, e
-- nunca com composição vigente (como mestre ou servo). Posse e gestor não dependem do tipo. A função
-- do implemento não muda enquanto ele estiver engatado. A 3.5 acrescenta a trava por evento de status
-- incompatível com o novo tipo.
-- ---------------------------------------------------------------------------------------------
create function nucleo.travar_tipo_com_vinculo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo is distinct from old.tipo then
    if coalesce(current_setting('eixo.mudanca_de_tipo', true), '') <> 'sim' then
      raise exception 'O tipo do ativo só muda pela função de mudança de tipo, com o motivo.'
        using errcode = '23514';
    end if;
    if exists (select 1 from nucleo.composicao where (cavalo_id = new.id or implemento_id = new.id)
                  and excluido_em is null and (fim is null or fim > now())) then
      raise exception 'O tipo do ativo não muda enquanto ele estiver num conjunto: desengate antes.'
        using errcode = '23514';
    end if;
  end if;
  if new.funcao is distinct from old.funcao and exists (
       select 1 from nucleo.composicao where implemento_id = new.id and excluido_em is null and (fim is null or fim > now())
  ) then
    raise exception 'A função do implemento não muda enquanto ele estiver engatado: desengate antes.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.travar_tipo_com_vinculo() from public;

create trigger t15_trava_com_vinculo before update on nucleo.ativo
  for each row execute function nucleo.travar_tipo_com_vinculo();

-- Mudar o tipo do ativo: só com motivo, que vai para a auditoria. Roda com o usuário (a RLS vale).
create function nucleo.mudar_tipo_do_ativo(p_ativo_id uuid, p_tipo nucleo.tipo_de_ativo, p_motivo text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_achou boolean;
begin
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Mudar o tipo do ativo exige o motivo.' using errcode = '23514';
  end if;
  perform set_config('eixo.motivo', p_motivo, true);
  perform set_config('eixo.mudanca_de_tipo', 'sim', true);
  update nucleo.ativo set tipo = p_tipo where id = p_ativo_id;
  v_achou := found;
  perform set_config('eixo.mudanca_de_tipo', '', true);
  perform set_config('eixo.motivo', '', true);
  if not v_achou then
    raise exception 'O ativo % não existe.', p_ativo_id;
  end if;
end;
$$;
revoke all on function nucleo.mudar_tipo_do_ativo(uuid, nucleo.tipo_de_ativo, text) from public;

-- ---------------------------------------------------------------------------------------------
-- Meta do conjunto: só no cavalo. O implemento herda pela composição (função, não coluna copiada).
-- ---------------------------------------------------------------------------------------------
create table nucleo.meta_do_conjunto (
  id uuid primary key default gen_random_uuid(),
  cavalo_id uuid not null,
  cavalo_tipo nucleo.tipo_de_ativo not null generated always as ('cavalo'::nucleo.tipo_de_ativo) stored,
  valor numeric(15,2) not null check (valor >= 0),
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
  constraint meta_cavalo_fk foreign key (cavalo_id, cavalo_tipo) references nucleo.ativo (id, tipo),
  constraint meta_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint meta_fim_com_origem check ((fim is null) = (fim_origem is null)),
  constraint meta_uma_por_vez exclude using gist (cavalo_id with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.meta_do_conjunto is
  'A meta do conjunto (ver docs/glossario.md), sempre do cavalo, ao longo do tempo. O implemento engatado herda a do cavalo e a perde ao sair.';

create index meta_do_conjunto_cavalo_id_idx on nucleo.meta_do_conjunto (cavalo_id);
create index meta_do_conjunto_nao_excluida_idx on nucleo.meta_do_conjunto (cavalo_id) where excluido_em is null;
alter table nucleo.meta_do_conjunto enable row level security;

create trigger t10_intervalo before insert or update on nucleo.meta_do_conjunto
  for each row execute function nucleo.conferir_intervalo_da_vigencia();
create trigger t20_motivo_da_correcao before update on nucleo.meta_do_conjunto
  for each row execute function nucleo.exigir_motivo_da_correcao();
create trigger t30_versao before update on nucleo.meta_do_conjunto
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.meta_do_conjunto
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.meta_do_conjunto
  for each row execute function auditoria.registrar_mudanca('id');

-- A meta que vale para um ativo num instante: a do próprio cavalo, ou a do cavalo em que o implemento
-- está engatado. Implemento solto não tem meta.
create function nucleo.meta_do_conjunto_de(p_ativo_id uuid, p_em timestamptz default now())
returns numeric
language sql
stable
set search_path = ''
as $$
  select m.valor
    from nucleo.meta_do_conjunto m
   where m.excluido_em is null
     and m.periodo @> p_em
     and m.cavalo_id = coalesce(
       (select c.cavalo_id from nucleo.composicao c
         where c.implemento_id = p_ativo_id and c.excluido_em is null and c.periodo @> p_em),
       p_ativo_id
     )
$$;
revoke all on function nucleo.meta_do_conjunto_de(uuid, timestamptz) from public;

-- ---------------------------------------------------------------------------------------------
-- Nome do conjunto de um cavalo num instante: calculado na hora, nunca gravado na placa.
-- ---------------------------------------------------------------------------------------------
create function nucleo.nome_do_conjunto(p_cavalo_id uuid, p_em timestamptz default now())
returns text
language sql
stable
set search_path = ''
as $$
  select case when count(*) = 0 then null else
    config.nome_do_conjunto(
      (array_agg(a.carroceria_id) filter (where a.funcao = 'semirreboque'))[1],
      count(*)::int,
      coalesce(bool_or(a.funcao = 'dolly'), false),
      case when bool_or(a.funcao = 'semirreboque' and a.eixos is null) then null
           else max(a.eixos) filter (where a.funcao = 'semirreboque') end,
      max(a.eixos) filter (where a.funcao = 'dolly')
    )
  end
    from nucleo.composicao c
    join nucleo.ativo a on a.id = c.implemento_id
   where c.cavalo_id = p_cavalo_id and c.excluido_em is null and c.periodo @> p_em
$$;
revoke all on function nucleo.nome_do_conjunto(uuid, timestamptz) from public;

-- ---------------------------------------------------------------------------------------------
-- Operação do ativo em três degraus: engatado (a do cavalo), solto (a gravada na saída) e nunca
-- engatado (a do próprio CR). O CR é sempre o da própria placa: o custo não muda de CR.
-- ---------------------------------------------------------------------------------------------
create or replace view nucleo.operacao_do_ativo with (security_invoker = true) as
  select a.id as ativo_id,
         v.cr_id,
         case
           when eng.cavalo_id is not null then opc.operacao_id
           when sai.existe then sai.operacao_na_saida_id
           else c.operacao_id
         end as operacao_id,
         case
           when eng.cavalo_id is not null then 'engatado'
           when sai.existe then 'solto'
           else 'proprio_cr'
         end as degrau
    from nucleo.ativo a
    left join nucleo.cr_do_ativo v
      on v.ativo_id = a.id
     and v.excluido_em is null
     and v.periodo @> now()
    left join nucleo.cr c on c.id = v.cr_id
    left join lateral (
      select comp.cavalo_id
        from nucleo.composicao comp
       where comp.implemento_id = a.id and comp.excluido_em is null and comp.periodo @> now()
    ) eng on true
    left join lateral (
      select cc.operacao_id
        from nucleo.cr_do_ativo vc
        join nucleo.cr cc on cc.id = vc.cr_id
       where vc.ativo_id = eng.cavalo_id and vc.excluido_em is null and vc.periodo @> now()
    ) opc on true
    left join lateral (
      select comp.operacao_na_saida_id, true as existe
        from nucleo.composicao comp
       where comp.implemento_id = a.id and comp.excluido_em is null and comp.fim <= now()
       order by comp.fim desc
       limit 1
    ) sai on true
   where a.excluido_em is null;
comment on view nucleo.operacao_do_ativo is
  'A operação de cada ativo: engatado, a do cavalo; solto, a gravada na saída; nunca engatado, a do próprio CR. O CR (cr_id) é sempre o da própria placa.';

-- ---------------------------------------------------------------------------------------------
-- Alertas: acrescenta implemento_sem_eixos (o nome do conjunto fica pendente sem esse dado).
-- A lista fechada dos nomes está em docs/decisoes.md e tem teste.
-- ---------------------------------------------------------------------------------------------
create or replace view nucleo.alerta_de_vinculo with (security_invoker = true) as
  with na_frota as (
    select a.id, a.tipo, a.eixos
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
   where v.prox > v.fim
  union all
  select f.id, 'implemento_sem_eixos'
    from na_frota f
   where f.tipo = 'implemento' and f.eixos is null;
comment on view nucleo.alerta_de_vinculo is
  'Pendências dos vínculos e do cadastro: sem_cr, cr_sem_operacao, buraco_em_cr, buraco_em_custodia e implemento_sem_eixos. Ativo baixado não entra. Posse e gestor não aparecem aqui porque o banco proíbe o buraco neles.';
