-- Fase 3, fatia 3.6c: o CR vem do Sankhya e a operação é montada por um usuário (decisão de Alexandre,
-- 05/11/2026). Substitui a regra da 3.3 de que a operação da placa é a do CR vigente.
--
--  * CR: codcencus obrigatório e único; tipo (serviço, frota de placa, frota sem placa) derivado de
--    AD_FROTA e VEICULO, com origem; CR pai, ativo, bloqueado e analítico, cada um com origem; nasce
--    "a conferir" antes da ponte. O CR nunca se exclui de verdade (o gasto histórico aponta para ele).
--  * O CR de frota de placa pertence a uma única placa (o ativo), para sempre. Não vale para CR de
--    frota sem placa nem para CR de serviço.
--  * A operação tem dois lados: as placas (vínculo placa-operação) e os CRs de serviço (vínculo CR de
--    serviço-operação), cada um com vigência, quem montou e exclusão contra sobreposição.
--  * A operação de um ativo num instante: engatado, a do cavalo; senão, a montagem mais recente entre
--    o vínculo da placa e a operação gravada na saída do conjunto. O custo de cada data vai para o CR
--    que a placa tinha naquela data (nucleo.cr_em).
--  * Alertas: cr_sem_operacao só para CR de serviço (visão nova alerta_de_cr); o escopo "operação" da
--    RLS passa a ler a montagem (pela visão operacao_do_ativo).

create type nucleo.tipo_de_cr as enum ('servico', 'frota_de_placa', 'frota_sem_placa');
comment on type nucleo.tipo_de_cr is
  'Serviço (AD_FROTA desligado), frota de placa (AD_FROTA e VEICULO ligados) e frota sem placa (AD_FROTA ligado, VEICULO desligado).';

create type config.origem_do_campo as enum ('sankhya', 'derivada', 'informada');
comment on type config.origem_do_campo is
  'De onde veio o valor de um campo: lido do Sankhya, derivado de outros campos ou informado por alguém.';

-- O tipo do CR pelos dois sinais do Sankhya; nulo (pendente) sem o sinal que decide. Espelho em
-- lib/dominio/cr.ts.
create function nucleo.tipo_do_cr(p_participa_da_frota boolean, p_veiculo_obrigatorio boolean)
returns nucleo.tipo_de_cr
language sql
immutable
set search_path = ''
as $$
  select case
    when p_participa_da_frota is null then null
    when not p_participa_da_frota then 'servico'::nucleo.tipo_de_cr
    when p_veiculo_obrigatorio is null then null
    when p_veiculo_obrigatorio then 'frota_de_placa'::nucleo.tipo_de_cr
    else 'frota_sem_placa'::nucleo.tipo_de_cr
  end
$$;
revoke all on function nucleo.tipo_do_cr(boolean, boolean) from public;

-- ---------------------------------------------------------------------------------------------
-- CR: o código do Sankhya obrigatório e os campos com origem
-- ---------------------------------------------------------------------------------------------
alter table nucleo.cr alter column codcencus set not null;
alter table nucleo.cr
  add column participa_da_frota boolean,
  add column participa_da_frota_origem config.origem_do_campo,
  add column veiculo_obrigatorio boolean,
  add column veiculo_obrigatorio_origem config.origem_do_campo,
  add column tipo nucleo.tipo_de_cr,
  add column tipo_origem config.origem_do_campo,
  add column cr_pai_id uuid references nucleo.cr (id),
  add column cr_pai_origem config.origem_do_campo,
  add column analitico boolean,
  add column analitico_origem config.origem_do_campo,
  add column ativo_origem config.origem_do_campo not null default 'informada',
  add column bloqueado_origem config.origem_do_campo not null default 'informada',
  add column conferencia text not null default 'a_conferir',
  add constraint cr_conferencia_valida check (conferencia in ('a_conferir', 'conferida')),
  add constraint cr_participa_da_frota_com_origem check ((participa_da_frota is null) = (participa_da_frota_origem is null)),
  add constraint cr_veiculo_obrigatorio_com_origem check ((veiculo_obrigatorio is null) = (veiculo_obrigatorio_origem is null)),
  add constraint cr_tipo_com_origem check ((tipo is null) = (tipo_origem is null)),
  add constraint cr_pai_com_origem check ((cr_pai_id is null) = (cr_pai_origem is null)),
  add constraint cr_analitico_com_origem check ((analitico is null) = (analitico_origem is null)),
  add constraint cr_pai_nao_e_ele_mesmo check (cr_pai_id is distinct from id);
create index cr_cr_pai_id_idx on nucleo.cr (cr_pai_id);
comment on column nucleo.cr.codcencus is 'CODCENCUS do Sankhya (o inteiro, sem a máscara): obrigatório e único. O CR sempre vem do Sankhya.';
comment on column nucleo.cr.codigo is 'O código com a máscara hierárquica (ex.: 04.011.142), só para exibição.';
comment on column nucleo.cr.operacao_id is
  'AD_OPERACAO do Sankhya: só sugestão. A operação é montada no Eixo (placa_na_operacao e cr_de_servico_na_operacao).';
comment on column nucleo.cr.tipo is 'Derivado de AD_FROTA e VEICULO (tipo_origem = derivada), salvo se informado.';
comment on column nucleo.cr.conferencia is 'a_conferir (cadastrado antes da ponte, pelo "+") ou conferida.';

-- A origem acompanha o valor (informada quando ninguém disse outra) e o tipo é derivado dos sinais,
-- salvo se alguém o informou.
create function nucleo.normalizar_cr()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.participa_da_frota_origem := case when new.participa_da_frota is null then null else coalesce(new.participa_da_frota_origem, 'informada') end;
  new.veiculo_obrigatorio_origem := case when new.veiculo_obrigatorio is null then null else coalesce(new.veiculo_obrigatorio_origem, 'informada') end;
  new.cr_pai_origem := case when new.cr_pai_id is null then null else coalesce(new.cr_pai_origem, 'informada') end;
  new.analitico_origem := case when new.analitico is null then null else coalesce(new.analitico_origem, 'informada') end;
  if new.tipo_origem is distinct from 'informada' then
    new.tipo := nucleo.tipo_do_cr(new.participa_da_frota, new.veiculo_obrigatorio);
    new.tipo_origem := case when new.tipo is null then null else 'derivada' end;
  end if;
  return new;
end;
$$;
revoke all on function nucleo.normalizar_cr() from public;

create trigger t05_normalizar before insert or update on nucleo.cr
  for each row execute function nucleo.normalizar_cr();

-- ---------------------------------------------------------------------------------------------
-- O CR de frota de placa pertence a uma única placa, para sempre
-- ---------------------------------------------------------------------------------------------
create function nucleo.conferir_cr_de_placa()
returns trigger
language plpgsql
security definer -- justificativa: a regra precisa enxergar os vínculos do CR com todas as placas, inclusive as que o usuário não alcança pela RLS; só lê cr e cr_do_ativo, com search_path vazio.
set search_path = ''
as $$
begin
  if new.excluido_em is null
     and (select tipo from nucleo.cr where id = new.cr_id) = 'frota_de_placa' then
    -- Duas transações não ligam o mesmo CR a placas diferentes ao mesmo tempo.
    perform pg_advisory_xact_lock(hashtextextended(new.cr_id::text, 0));
    if exists (
      select 1 from nucleo.cr_do_ativo
       where cr_id = new.cr_id and ativo_id <> new.ativo_id and excluido_em is null and id <> new.id
    ) then
      raise exception 'Este CR de frota de placa já pertence a outra placa: cada CR de placa é de uma placa só, para sempre.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function nucleo.conferir_cr_de_placa() from public;

create trigger t15_cr_de_placa before insert or update on nucleo.cr_do_ativo
  for each row execute function nucleo.conferir_cr_de_placa();

-- Virar frota de placa um CR que já está em mais de uma placa também é recusado.
create function nucleo.conferir_tipo_do_cr_de_placa()
returns trigger
language plpgsql
security definer -- justificativa: precisa contar os vínculos do CR com todas as placas, inclusive as fora do alcance do usuário; só lê cr_do_ativo, com search_path vazio.
set search_path = ''
as $$
begin
  if new.tipo = 'frota_de_placa' and (
    select count(distinct ativo_id) from nucleo.cr_do_ativo where cr_id = new.id and excluido_em is null
  ) > 1 then
    raise exception 'Este CR de frota de placa já pertence a outra placa: cada CR de placa é de uma placa só, para sempre.'
      using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function nucleo.conferir_tipo_do_cr_de_placa() from public;

create trigger t60_cr_de_placa after insert or update on nucleo.cr
  for each row execute function nucleo.conferir_tipo_do_cr_de_placa();

-- ---------------------------------------------------------------------------------------------
-- A montagem da operação: as placas e os CRs de serviço, com vigência
-- ---------------------------------------------------------------------------------------------
create table nucleo.placa_na_operacao (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  operacao_id uuid not null references nucleo.operacao (id),
  inicio timestamptz not null,
  fim timestamptz,
  inicio_origem config.origem_da_data not null,
  fim_origem config.origem_da_data,
  periodo tstzrange generated always as (tstzrange(inicio, fim, '[)')) stored,
  montado_por uuid references nucleo.pessoa (id),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint placa_na_operacao_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint placa_na_operacao_fim_com_origem check ((fim is null) = (fim_origem is null)),
  constraint placa_na_operacao_uma_por_vez exclude using gist (ativo_id with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.placa_na_operacao is
  'O lado da frota da operação: cada placa (o ativo) numa operação por vez, montada por um usuário. A vigência aberta se mantém até alguém alterar.';
create index placa_na_operacao_ativo_id_idx on nucleo.placa_na_operacao (ativo_id);
create index placa_na_operacao_operacao_id_idx on nucleo.placa_na_operacao (operacao_id);
create index placa_na_operacao_montado_por_idx on nucleo.placa_na_operacao (montado_por);
create index placa_na_operacao_nao_excluida_idx on nucleo.placa_na_operacao (ativo_id) where excluido_em is null;
alter table nucleo.placa_na_operacao enable row level security;

create table nucleo.cr_de_servico_na_operacao (
  id uuid primary key default gen_random_uuid(),
  cr_id uuid not null references nucleo.cr (id),
  operacao_id uuid not null references nucleo.operacao (id),
  inicio timestamptz not null,
  fim timestamptz,
  inicio_origem config.origem_da_data not null,
  fim_origem config.origem_da_data,
  periodo tstzrange generated always as (tstzrange(inicio, fim, '[)')) stored,
  montado_por uuid references nucleo.pessoa (id),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint cr_de_servico_fim_depois_do_inicio check (fim is null or fim > inicio),
  constraint cr_de_servico_fim_com_origem check ((fim is null) = (fim_origem is null)),
  constraint cr_de_servico_uma_operacao_por_vez exclude using gist (cr_id with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.cr_de_servico_na_operacao is
  'O lado do serviço da operação: cada CR de serviço numa operação por vez (hipótese: vários CRs de serviço por operação).';
create index cr_de_servico_na_operacao_cr_id_idx on nucleo.cr_de_servico_na_operacao (cr_id);
create index cr_de_servico_na_operacao_operacao_id_idx on nucleo.cr_de_servico_na_operacao (operacao_id);
create index cr_de_servico_na_operacao_montado_por_idx on nucleo.cr_de_servico_na_operacao (montado_por);
create index cr_de_servico_na_operacao_nao_excluida_idx on nucleo.cr_de_servico_na_operacao (cr_id) where excluido_em is null;
alter table nucleo.cr_de_servico_na_operacao enable row level security;

-- Quem montou: o usuário logado, salvo se informado.
create function nucleo.registrar_quem_montou()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.montado_por := coalesce(new.montado_por, config.usuario_atual());
  return new;
end;
$$;
revoke all on function nucleo.registrar_quem_montou() from public;

-- Só CR de serviço entra no lado do serviço.
create function nucleo.exigir_cr_de_servico()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select tipo from nucleo.cr where id = new.cr_id) is distinct from 'servico' then
    raise exception 'Só CR de serviço entra na operação como serviço; as placas entram pelo vínculo placa-operação.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.exigir_cr_de_servico() from public;

create trigger t05_permissao_de_excluir before update on nucleo.placa_na_operacao
  for each row execute function nucleo.exigir_permissao_de_excluir('operacoes');
create trigger t08_quem_montou before insert on nucleo.placa_na_operacao
  for each row execute function nucleo.registrar_quem_montou();
create trigger t10_intervalo before insert or update on nucleo.placa_na_operacao
  for each row execute function nucleo.conferir_intervalo_da_vigencia();
create trigger t20_motivo_da_correcao before update on nucleo.placa_na_operacao
  for each row execute function nucleo.exigir_motivo_da_correcao();
create trigger t30_versao before update on nucleo.placa_na_operacao
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.placa_na_operacao
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.placa_na_operacao
  for each row execute function auditoria.registrar_mudanca('id');

create trigger t05_permissao_de_excluir before update on nucleo.cr_de_servico_na_operacao
  for each row execute function nucleo.exigir_permissao_de_excluir('operacoes');
create trigger t08_quem_montou before insert on nucleo.cr_de_servico_na_operacao
  for each row execute function nucleo.registrar_quem_montou();
create trigger t10_intervalo before insert or update on nucleo.cr_de_servico_na_operacao
  for each row execute function nucleo.conferir_intervalo_da_vigencia();
create trigger t12_so_servico before insert or update on nucleo.cr_de_servico_na_operacao
  for each row execute function nucleo.exigir_cr_de_servico();
create trigger t20_motivo_da_correcao before update on nucleo.cr_de_servico_na_operacao
  for each row execute function nucleo.exigir_motivo_da_correcao();
create trigger t30_versao before update on nucleo.cr_de_servico_na_operacao
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.cr_de_servico_na_operacao
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.cr_de_servico_na_operacao
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- Operação e CR de um ativo num instante
-- ---------------------------------------------------------------------------------------------

-- O CR que a placa tinha naquele instante (é para ele que vai o custo daquela data).
create function nucleo.cr_em(p_ativo_id uuid, p_em timestamptz)
returns uuid
language sql
stable
set search_path = ''
as $$
  select cr_id from nucleo.cr_do_ativo
   where ativo_id = p_ativo_id and excluido_em is null and periodo @> p_em
$$;
revoke all on function nucleo.cr_em(uuid, timestamptz) from public;

-- A operação e o degrau: engatado (a do cavalo, pela montagem dele); senão, a mais recente entre a
-- montagem da própria placa (elenco) e a gravada na saída do conjunto (solto); sem nada, nula.
create function nucleo.operacao_e_degrau_em(p_ativo_id uuid, p_em timestamptz)
returns table (operacao_id uuid, degrau text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_cavalo uuid;
  v_elenco uuid;
  v_elenco_desde timestamptz;
  v_saida uuid;
  v_saida_em timestamptz;
begin
  select c.cavalo_id into v_cavalo
    from nucleo.composicao c
   where c.implemento_id = p_ativo_id and c.excluido_em is null and c.periodo @> p_em;
  if v_cavalo is not null then
    operacao_id := (select p.operacao_id from nucleo.placa_na_operacao p
                     where p.ativo_id = v_cavalo and p.excluido_em is null and p.periodo @> p_em);
    degrau := 'engatado';
    return next;
    return;
  end if;

  select p.operacao_id, p.inicio into v_elenco, v_elenco_desde
    from nucleo.placa_na_operacao p
   where p.ativo_id = p_ativo_id and p.excluido_em is null and p.periodo @> p_em;

  select c.operacao_na_saida_id, c.fim into v_saida, v_saida_em
    from nucleo.composicao c
   where c.implemento_id = p_ativo_id and c.excluido_em is null and c.fim <= p_em
   order by c.fim desc
   limit 1;

  if v_elenco_desde is not null and (v_saida_em is null or v_elenco_desde >= v_saida_em) then
    operacao_id := v_elenco;
    degrau := 'elenco';
  elsif v_saida_em is not null then
    operacao_id := v_saida;
    degrau := 'solto';
  else
    operacao_id := null;
    degrau := 'sem_operacao';
  end if;
  return next;
end;
$$;
revoke all on function nucleo.operacao_e_degrau_em(uuid, timestamptz) from public;

create function nucleo.operacao_em(p_ativo_id uuid, p_em timestamptz)
returns uuid
language sql
stable
set search_path = ''
as $$
  select o.operacao_id from nucleo.operacao_e_degrau_em(p_ativo_id, p_em) o
$$;
revoke all on function nucleo.operacao_em(uuid, timestamptz) from public;

create or replace view nucleo.operacao_do_ativo with (security_invoker = true) as
  select a.id as ativo_id,
         nucleo.cr_em(a.id, now()) as cr_id,
         o.operacao_id,
         o.degrau
    from nucleo.ativo a
    cross join lateral nucleo.operacao_e_degrau_em(a.id, now()) o
   where a.excluido_em is null;
comment on view nucleo.operacao_do_ativo is
  'A operação de cada ativo agora: engatado (a do cavalo), elenco (a montagem da placa), solto (a gravada na saída) ou sem_operacao. O cr_id é o CR vigente da própria placa (o custo não muda de CR).';

-- A operação na saída do conjunto: a do cavalo pela montagem dele, logo antes do desengate.
create or replace function nucleo.gravar_operacao_na_saida()
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
    new.operacao_na_saida_id := nucleo.operacao_em(new.cavalo_id, new.fim - interval '1 microsecond');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Alertas: cr_sem_operacao sai da visão das placas e vai para a visão de CR (só CR de serviço)
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
  ),
  prazos as (
    select
      (select valor::int from config.parametro where chave = 'prazo_de_correcao_de_status_dias') as prazo,
      (select valor::int from config.parametro where chave = 'dias_do_alerta_de_correcao') as dias,
      (select valor::int from config.parametro where chave = 'dias_parado_em_patio') as parado
  )
  select f.id as ativo_id, 'sem_cr'::text as alerta
    from na_frota f
   where not exists (
     select 1 from nucleo.cr_do_ativo v
      where v.ativo_id = f.id and v.excluido_em is null and v.periodo @> now()
   )
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
   where f.tipo = 'implemento' and f.eixos is null
  union all
  select f.id, 'conjunto_sem_nome'
    from na_frota f
   where f.tipo = 'cavalo' and nucleo.nome_do_conjunto(f.id) = 'sem nome definido'
  union all
  select distinct f.id, 'correcao_tardia_de_status'
    from na_frota f
    cross join prazos p
    join nucleo.evento_de_status e on e.ativo_id = f.id
   where e.excluido_em is not null
     and e.excluido_em - e.em > make_interval(days => p.prazo)
     and e.excluido_em >= now() - make_interval(days => p.dias)
  union all
  select f.id, 'parado_em_patio'
    from na_frota f
    cross join prazos p
    join nucleo.estado_de_status e
      on e.ativo_id = f.id and e.camada = 'atividade' and e.sigla = 'PÁT'
     and e.fim is null and e.excluido_em is null
   where e.inicio < now() - make_interval(days => p.parado);
comment on view nucleo.alerta_de_vinculo is
  'Pendências das placas: sem_cr, buraco_em_cr, buraco_em_custodia, implemento_sem_eixos, conjunto_sem_nome (no cavalo), correcao_tardia_de_status e parado_em_patio. Ativo baixado não entra. Os alertas de CR ficam em alerta_de_cr.';

create view nucleo.alerta_de_cr with (security_invoker = true) as
  select c.id as cr_id, 'cr_sem_operacao'::text as alerta
    from nucleo.cr c
   where c.excluido_em is null
     and c.tipo = 'servico'
     and c.ativo and not c.bloqueado
     and not exists (
       select 1 from nucleo.cr_de_servico_na_operacao s
        where s.cr_id = c.id and s.excluido_em is null and s.periodo @> now()
     );
comment on view nucleo.alerta_de_cr is
  'Pendências dos CRs: cr_sem_operacao (CR de serviço ativo e não bloqueado sem operação agora). Não existe alerta de CR de frota sem placa.';

-- ---------------------------------------------------------------------------------------------
-- Acesso: quem monta é o módulo Operações (sem perfil novo até Alexandre decidir)
-- ---------------------------------------------------------------------------------------------

-- O usuário tem a ação no módulo Operações para esta operação (escopo tudo, ou operação dele)?
create function config.pode_na_operacao(p_operacao_id uuid, p_acao text)
returns boolean
language sql
stable
security definer -- justificativa: lê a tabela de permissões e as operações do próprio auth.uid() sem passar pelas políticas (que chamam esta função); search_path vazio.
set search_path = ''
as $$
  select exists (
    select 1 from config.permissao_do_perfil p
      join nucleo.usuario u on u.perfil = p.perfil
     where u.auth_user_id = (select auth.uid()) and u.ativo
       and p.modulo = 'operacoes' and p.acao = p_acao
       and (p.escopo = 'tudo'
            or (p.escopo = 'operacao' and exists (
                  select 1 from nucleo.usuario_operacao uo where uo.usuario_id = u.pessoa_id and uo.operacao_id = p_operacao_id)))
  )
$$;
revoke all on function config.pode_na_operacao(uuid, text) from public;

grant select, insert, update on nucleo.placa_na_operacao, nucleo.cr_de_servico_na_operacao to authenticated;
grant select on nucleo.alerta_de_cr to authenticated;

create policy placa_na_operacao_ler on nucleo.placa_na_operacao for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver') or config.pode_na_operacao(operacao_id, 'ver'));
create policy placa_na_operacao_criar on nucleo.placa_na_operacao for insert to authenticated
  with check (config.pode_na_operacao(operacao_id, 'criar'));
create policy placa_na_operacao_alterar on nucleo.placa_na_operacao for update to authenticated
  using (config.pode_na_operacao(operacao_id, 'editar'))
  with check (config.pode_na_operacao(operacao_id, 'editar'));

create policy cr_de_servico_na_operacao_ler on nucleo.cr_de_servico_na_operacao for select to authenticated
  using (config.pode_na_operacao(operacao_id, 'ver'));
create policy cr_de_servico_na_operacao_criar on nucleo.cr_de_servico_na_operacao for insert to authenticated
  with check (config.pode_na_operacao(operacao_id, 'criar'));
create policy cr_de_servico_na_operacao_alterar on nucleo.cr_de_servico_na_operacao for update to authenticated
  using (config.pode_na_operacao(operacao_id, 'editar'))
  with check (config.pode_na_operacao(operacao_id, 'editar'));

-- As funções novas que o app executa (a lista de exceções, com o porquê de cada uma).
insert into config.funcao_executavel (assinatura, justificativa) values
  ('config.pode_na_operacao(uuid,text)', 'Usada nas políticas da montagem: a ação no módulo Operações para a operação.'),
  ('nucleo.tipo_do_cr(boolean,boolean)', 'Pura e imutável: o tipo do CR pelos sinais do Sankhya (gatilho do CR).'),
  ('nucleo.cr_em(uuid,timestamp with time zone)', 'Leitura do CR da placa num instante, com a RLS de quem consulta.'),
  ('nucleo.operacao_e_degrau_em(uuid,timestamp with time zone)', 'Leitura da operação da placa num instante, com a RLS de quem consulta.'),
  ('nucleo.operacao_em(uuid,timestamp with time zone)', 'Leitura da operação da placa num instante (e a gravada na saída do conjunto).');

do $$
declare
  v_assinatura text;
begin
  for v_assinatura in
    select assinatura from config.funcao_executavel
     where assinatura in (
       'config.pode_na_operacao(uuid,text)', 'nucleo.tipo_do_cr(boolean,boolean)',
       'nucleo.cr_em(uuid,timestamp with time zone)', 'nucleo.operacao_e_degrau_em(uuid,timestamp with time zone)',
       'nucleo.operacao_em(uuid,timestamp with time zone)')
  loop
    execute format('grant execute on function %s to authenticated', v_assinatura);
  end loop;
end;
$$;
