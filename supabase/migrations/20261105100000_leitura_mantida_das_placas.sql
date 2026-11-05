-- Fatia 3.9a, parte 2: a leitura das placas MANTIDA por gatilho. O diagnóstico (docs/decisoes.md,
-- 03/11/2026) mostrou que calcular a linha na hora não serve: em 5.000 ativos, só a situação leva 4 s
-- sem RLS e 16 s com ela, e os alertas por linha são quadráticos.
--  * nucleo.leitura_da_placa: uma linha por ativo não excluído, com o que a lista precisa e as colunas
--    de escopo (gestor, operação, filial da custódia) para a RLS da própria tabela.
--  * Uma definição só de cada regra: a linha é calculada pelas funções de sempre (situacao_com_causa,
--    operacao_em, cr_em, filial_do_cr_em, garagem_em) e os alertas por funções que a visão
--    alerta_de_vinculo também usa. O que depende do relógio (dias na situação, parado no pátio,
--    correção tardia) não é gravado: guardam-se os instantes e calcula-se na leitura.
--  * Gatilhos adiados (no fim da transação) em todas as tabelas fonte recalculam a placa e os membros
--    do conjunto. Mudança com data futura: proximo_recalculo guarda o próximo instante em que a linha
--    muda sozinha; nucleo.recalcular_linhas_vencidas() as recalcula (agendamento proposto no
--    checkpoint).

-- ---------------------------------------------------------------------------------------------
-- Alertas: uma definição só, por ativo (a visão alerta_de_vinculo passa a usar estas funções)
-- ---------------------------------------------------------------------------------------------
create function nucleo.alertas_vigentes_do_ativo(p_ativo_id uuid, p_em timestamptz)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(x.alerta order by x.alerta), '{}')
    from (
      select 'sem_cr'::text as alerta
       where not exists (
         select 1 from nucleo.cr_do_ativo v
          where v.ativo_id = p_ativo_id and v.excluido_em is null and v.periodo @> p_em
       )
      union all
      select 'buraco_em_cr'::text
       where exists (
         select 1 from (
           select v.fim, lead(v.inicio) over (order by v.inicio) as prox
             from nucleo.cr_do_ativo v where v.ativo_id = p_ativo_id and v.excluido_em is null
         ) b where b.prox > b.fim
       )
      union all
      select 'buraco_em_custodia'::text
       where exists (
         select 1 from (
           select c.fim, lead(c.inicio) over (order by c.inicio) as prox
             from nucleo.custodia c where c.ativo_id = p_ativo_id and c.excluido_em is null
         ) b where b.prox > b.fim
       )
      union all
      select 'implemento_sem_eixos'::text
        from nucleo.ativo a where a.id = p_ativo_id and a.tipo = 'implemento' and a.eixos is null
      union all
      select 'conjunto_sem_nome'::text
        from nucleo.ativo a
       where a.id = p_ativo_id and a.tipo = 'cavalo' and nucleo.nome_do_conjunto(a.id, p_em) = 'sem nome definido'
      union all
      select 'ativo_sem_operacao'::text where nucleo.operacao_em(p_ativo_id, p_em) is null
    ) x
   where exists (select 1 from nucleo.ativo a where a.id = p_ativo_id and a.excluido_em is null)
     and not exists (
       select 1 from nucleo.baixa_do_ativo b where b.ativo_id = p_ativo_id and b.excluido_em is null and b.em <= p_em
     )
$$;
revoke all on function nucleo.alertas_vigentes_do_ativo(uuid, timestamptz) from public;
comment on function nucleo.alertas_vigentes_do_ativo(uuid, timestamptz) is
  'Os alertas do ativo que não dependem de prazo no relógio (sem CR, buracos, eixos, conjunto sem nome, sem operação).';

-- O início da situação PÁT em aberto (a base do alerta de parado no pátio).
create function nucleo.inicio_do_pat(p_ativo_id uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select min(e.inicio) from nucleo.estado_de_status e
   where e.ativo_id = p_ativo_id and e.camada = 'atividade' and e.sigla = 'PÁT' and e.fim is null and e.excluido_em is null
$$;
revoke all on function nucleo.inicio_do_pat(uuid) from public;

-- O instante da última correção tardia de status (a base do alerta de correção tardia).
create function nucleo.ultima_correcao_tardia_em(p_ativo_id uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select max(e.excluido_em) from nucleo.evento_de_status e
   where e.ativo_id = p_ativo_id and e.excluido_em is not null
     and e.excluido_em - e.em > make_interval(days => (select p.valor::int from config.parametro p where p.chave = 'prazo_de_correcao_de_status_dias'))
$$;
revoke all on function nucleo.ultima_correcao_tardia_em(uuid) from public;

create function nucleo.alerta_parado_em_patio(p_inicio_do_pat timestamptz, p_em timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_inicio_do_pat < p_em - make_interval(days => (select p.valor::int from config.parametro p where p.chave = 'dias_parado_em_patio')), false)
$$;
revoke all on function nucleo.alerta_parado_em_patio(timestamptz, timestamptz) from public;

create function nucleo.alerta_correcao_tardia(p_ultima timestamptz, p_em timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_ultima >= p_em - make_interval(days => (select p.valor::int from config.parametro p where p.chave = 'dias_do_alerta_de_correcao')), false)
$$;
revoke all on function nucleo.alerta_correcao_tardia(timestamptz, timestamptz) from public;

-- Todos os alertas do ativo naquele instante (ordem alfabética); nada para placa baixada.
create function nucleo.alertas_com_prazos(
  p_vigentes text[], p_inicio_do_pat timestamptz, p_ultima_correcao timestamptz, p_baixada boolean, p_em timestamptz
)
returns text[]
language sql
stable
set search_path = ''
as $$
  select case when p_baixada then '{}'::text[] else array(
    select x from unnest(
      p_vigentes
      || case when nucleo.alerta_parado_em_patio(p_inicio_do_pat, p_em) then array['parado_em_patio'::text] else '{}'::text[] end
      || case when nucleo.alerta_correcao_tardia(p_ultima_correcao, p_em) then array['correcao_tardia_de_status'::text] else '{}'::text[] end
    ) x order by x
  ) end
$$;
revoke all on function nucleo.alertas_com_prazos(text[], timestamptz, timestamptz, boolean, timestamptz) from public;

create function nucleo.alertas_do_ativo(p_ativo_id uuid, p_em timestamptz)
returns text[]
language sql
stable
set search_path = ''
as $$
  select nucleo.alertas_com_prazos(
    nucleo.alertas_vigentes_do_ativo(p_ativo_id, p_em),
    nucleo.inicio_do_pat(p_ativo_id),
    nucleo.ultima_correcao_tardia_em(p_ativo_id),
    exists (select 1 from nucleo.baixa_do_ativo b where b.ativo_id = p_ativo_id and b.excluido_em is null and b.em <= p_em),
    p_em
  )
$$;
revoke all on function nucleo.alertas_do_ativo(uuid, timestamptz) from public;
comment on function nucleo.alertas_do_ativo(uuid, timestamptz) is
  'Todos os alertas de vínculo do ativo naquele instante: a única definição (a visão alerta_de_vinculo e a leitura da placa usam esta).';

create or replace view nucleo.alerta_de_vinculo with (security_invoker = true) as
  select a.id as ativo_id, x.alerta
    from nucleo.ativo a
    cross join lateral unnest(nucleo.alertas_do_ativo(a.id, now())) as x (alerta)
   where a.excluido_em is null;

-- ---------------------------------------------------------------------------------------------
-- A tabela mantida
-- ---------------------------------------------------------------------------------------------
create table nucleo.leitura_da_placa (
  ativo_id uuid primary key references nucleo.ativo (id),
  placa text not null,
  tipo text not null,
  modelo text not null,
  cavalo text,
  implementos text[] not null,
  gestor_id uuid,
  gestor text,
  operacao_id uuid,
  operacao text,
  cr text,
  garagem text,
  filial text,
  filial_da_custodia_id uuid,
  sigla text not null,
  causa_id uuid,
  nome_da_situacao text,
  grupo text,
  desde timestamptz,
  inicio_do_pat timestamptz,
  ultima_correcao_tardia_em timestamptz,
  alertas_vigentes text[] not null,
  valor_fipe numeric(15, 2),
  ano integer,
  renavam text,
  baixada_em timestamptz,
  busca text not null,
  proximo_recalculo timestamptz,
  recalculado_em timestamptz not null default now()
);
comment on table nucleo.leitura_da_placa is
  'A linha da lista de placas, mantida por gatilho (fatia 3.9a). Só a função de recálculo grava; a RLS usa as colunas de escopo.';
create index leitura_da_placa_placa_idx on nucleo.leitura_da_placa (placa);
create index leitura_da_placa_gestor_id_idx on nucleo.leitura_da_placa (gestor_id);
create index leitura_da_placa_operacao_id_idx on nucleo.leitura_da_placa (operacao_id);
create index leitura_da_placa_filial_da_custodia_id_idx on nucleo.leitura_da_placa (filial_da_custodia_id);
create index leitura_da_placa_grupo_idx on nucleo.leitura_da_placa (grupo);
create index leitura_da_placa_sigla_idx on nucleo.leitura_da_placa (sigla);
create index leitura_da_placa_tipo_idx on nucleo.leitura_da_placa (tipo);
create index leitura_da_placa_proximo_recalculo_idx on nucleo.leitura_da_placa (proximo_recalculo)
  where proximo_recalculo is not null;
alter table nucleo.leitura_da_placa enable row level security;

-- O próximo instante em que a linha muda sozinha (vigência que começa ou acaba no futuro).
create function nucleo.proximo_recalculo_do_ativo(p_ativo_id uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select min(t) from (
    select inicio as t from nucleo.cr_do_ativo where ativo_id = p_ativo_id and excluido_em is null and inicio > now()
    union all select fim from nucleo.cr_do_ativo where ativo_id = p_ativo_id and excluido_em is null and fim > now()
    union all select inicio from nucleo.gestor_da_carteira where ativo_id = p_ativo_id and excluido_em is null and inicio > now()
    union all select fim from nucleo.gestor_da_carteira where ativo_id = p_ativo_id and excluido_em is null and fim > now()
    union all select inicio from nucleo.custodia where ativo_id = p_ativo_id and excluido_em is null and inicio > now()
    union all select fim from nucleo.custodia where ativo_id = p_ativo_id and excluido_em is null and fim > now()
    union all select inicio from nucleo.placa_na_operacao where ativo_id = p_ativo_id and excluido_em is null and inicio > now()
    union all select fim from nucleo.placa_na_operacao where ativo_id = p_ativo_id and excluido_em is null and fim > now()
    union all select inicio from nucleo.placa_do_ativo where ativo_id = p_ativo_id and excluido_em is null and inicio > now()
    union all select fim from nucleo.placa_do_ativo where ativo_id = p_ativo_id and excluido_em is null and fim > now()
    union all select inicio from nucleo.estado_de_status where ativo_id = p_ativo_id and excluido_em is null and inicio > now()
    union all select fim from nucleo.estado_de_status where ativo_id = p_ativo_id and excluido_em is null and fim > now()
    union all select inicio from nucleo.composicao where (cavalo_id = p_ativo_id or implemento_id = p_ativo_id) and excluido_em is null and inicio > now()
    union all select fim from nucleo.composicao where (cavalo_id = p_ativo_id or implemento_id = p_ativo_id) and excluido_em is null and fim > now()
    union all select em from nucleo.baixa_do_ativo where ativo_id = p_ativo_id and excluido_em is null and em > now()
  ) x
$$;
revoke all on function nucleo.proximo_recalculo_do_ativo(uuid) from public;

-- A linha calculada agora, pelas funções de sempre (o que a tabela guarda, e o que o teste de
-- equivalência compara). Nula se o ativo não existe ou foi excluído.
create function nucleo.linha_calculada_da_placa(p_ativo_id uuid)
returns nucleo.leitura_da_placa
language sql
stable
set search_path = ''
as $$
  select
    a.id,
    coalesce(pl.placa, a.numero_de_serie, ''),
    a.tipo::text,
    mo.modelo,
    cj.cavalo,
    cj.implementos,
    gv.gestor_id,
    coalesce(gv.gestor, gu.gestor),
    op.operacao_id,
    op.operacao,
    crv.cr,
    ga.garagem,
    fi.filial,
    cu.filial_id,
    s.sigla,
    s.causa_id,
    st.nome,
    st.chip,
    de.desde,
    nucleo.inicio_do_pat(a.id),
    nucleo.ultima_correcao_tardia_em(a.id),
    nucleo.alertas_vigentes_do_ativo(a.id, now()),
    a.valor_fipe,
    coalesce(a.ano_modelo, a.ano_fabricacao)::int,
    a.renavam,
    (select min(b.em) from nucleo.baixa_do_ativo b where b.ativo_id = a.id and b.excluido_em is null),
    nucleo.texto_simples(concat_ws(' ', pl.placa, mo.modelo, coalesce(gv.gestor, gu.gestor), op.operacao, crv.cr)),
    nucleo.proximo_recalculo_do_ativo(a.id),
    now()
  from nucleo.ativo a
  left join lateral (
    select p.placa from nucleo.placa_do_ativo p
     where p.ativo_id = a.id and p.excluido_em is null
     order by p.fim is null desc, p.inicio desc
     limit 1
  ) pl on true
  left join lateral (
    select case when m.id is null then 'Modelo a definir' else btrim(coalesce(ma.nome, '') || ' ' || m.nome) end as modelo
      from (select 1) x
      left join config.modelo m on m.id = a.modelo_id
      left join config.marca ma on ma.id = m.marca_id
  ) mo on true
  left join lateral (
    select
      (select pc.placa
         from nucleo.composicao c
         join nucleo.placa_do_ativo pc on pc.ativo_id = c.cavalo_id and pc.excluido_em is null and pc.fim is null
        where c.implemento_id = a.id and c.excluido_em is null and c.periodo @> now()
        limit 1) as cavalo,
      array(
        select pi.placa
          from nucleo.composicao c
          join nucleo.placa_do_ativo pi on pi.ativo_id = c.implemento_id and pi.excluido_em is null and pi.fim is null
         where c.cavalo_id = a.id and c.excluido_em is null and c.periodo @> now()
         order by c.posicao
      ) as implementos
  ) cj on true
  left join lateral (
    select g.gestor_id, pe.nome as gestor
      from nucleo.gestor_da_carteira g
      join nucleo.pessoa pe on pe.id = g.gestor_id
     where g.ativo_id = a.id and g.excluido_em is null and g.periodo @> now()
     limit 1
  ) gv on true
  left join lateral (
    select pe.nome as gestor
      from nucleo.gestor_da_carteira g
      join nucleo.pessoa pe on pe.id = g.gestor_id
     where g.ativo_id = a.id and g.excluido_em is null
     order by g.fim is null desc, g.inicio desc
     limit 1
  ) gu on true
  left join lateral (
    select o.id as operacao_id, o.nome as operacao from nucleo.operacao o where o.id = nucleo.operacao_em(a.id, now())
  ) op on true
  left join lateral (
    select c.codigo as cr from nucleo.cr c where c.id = nucleo.cr_em(a.id, now())
  ) crv on true
  left join lateral (
    select g.rotulo as garagem from config.garagem g where g.id = nucleo.garagem_em(a.id, now())
  ) ga on true
  left join lateral (
    select f.rotulo as filial from config.filial_do_cr f where f.codigo = nucleo.filial_do_cr_em(a.id, now())
  ) fi on true
  left join lateral (
    select c.filial_id from nucleo.custodia c
     where c.ativo_id = a.id and c.com_quem = 'operacional' and c.excluido_em is null and c.periodo @> now()
     limit 1
  ) cu on true
  cross join lateral nucleo.situacao_com_causa(a.id, now()) s
  left join config.status st on st.sigla = s.sigla
  left join lateral (
    select e.inicio as desde
      from nucleo.estado_de_status e
     where e.ativo_id = s.causa_id and e.sigla = s.sigla and e.excluido_em is null and e.periodo @> now()
     order by e.inicio desc
     limit 1
  ) de on true
  where a.id = p_ativo_id and a.excluido_em is null
$$;
revoke all on function nucleo.linha_calculada_da_placa(uuid) from public;

-- Recalcula só a linha de um ativo. Um erro aqui não derruba a gravação de negócio: a linha fica
-- marcada para o recálculo agendado (proximo_recalculo = agora) e o aviso vai para o log.
create function nucleo.recalcular_so_a_linha(p_ativo_id uuid)
returns void
language plpgsql
security definer -- justificativa: a linha junta tabelas que cada perfil só enxerga em parte (gestor, custódia, operação) e é gravada só por aqui, nunca pelo usuário; não confere permissão porque não devolve nada, só mantém a leitura; search_path vazio.
set search_path = ''
as $$
declare
  v nucleo.leitura_da_placa;
begin
  if p_ativo_id is null then
    return;
  end if;
  v := nucleo.linha_calculada_da_placa(p_ativo_id);
  delete from nucleo.leitura_da_placa where ativo_id = p_ativo_id;
  if v.ativo_id is not null then
    insert into nucleo.leitura_da_placa values (v.*);
  end if;
exception when others then
  raise warning 'leitura da placa % não recalculada: %', p_ativo_id, sqlerrm;
  update nucleo.leitura_da_placa set proximo_recalculo = now() where ativo_id = p_ativo_id;
end;
$$;
revoke all on function nucleo.recalcular_so_a_linha(uuid) from public;

-- Recalcula o ativo e os membros do conjunto afetados (a herança do cavalo e dos implementos).
create function nucleo.recalcular_linha_da_placa(p_ativo_id uuid)
returns void
language plpgsql
security definer -- justificativa: mesma de recalcular_so_a_linha (mantém a leitura; não devolve dados); search_path vazio.
set search_path = ''
as $$
declare
  v_membro uuid;
begin
  if p_ativo_id is null then
    return;
  end if;
  perform nucleo.recalcular_so_a_linha(p_ativo_id);
  for v_membro in
    select c.implemento_id from nucleo.composicao c
     where c.cavalo_id = p_ativo_id and c.excluido_em is null and c.periodo @> now()
    union
    select c.cavalo_id from nucleo.composicao c
     where c.implemento_id = p_ativo_id and c.excluido_em is null and c.periodo @> now()
    union
    select c2.implemento_id
      from nucleo.composicao c
      join nucleo.composicao c2 on c2.cavalo_id = c.cavalo_id and c2.excluido_em is null and c2.periodo @> now()
     where c.implemento_id = p_ativo_id and c.excluido_em is null and c.periodo @> now()
  loop
    if v_membro <> p_ativo_id then
      perform nucleo.recalcular_so_a_linha(v_membro);
    end if;
  end loop;
end;
$$;
revoke all on function nucleo.recalcular_linha_da_placa(uuid) from public;

-- O gatilho das tabelas fonte: acha os ativos afetados pela linha mudada e os recalcula.
create function nucleo.recalcular_pela_mudanca()
returns trigger
language plpgsql
security definer -- justificativa: chamado pelos gatilhos das tabelas fonte; só recalcula a leitura mantida (não devolve dados); search_path vazio.
set search_path = ''
as $$
declare
  v_ativo uuid;
begin
  case tg_table_name
    when 'ativo' then
      perform nucleo.recalcular_linha_da_placa(new.id);
    when 'composicao' then
      perform nucleo.recalcular_linha_da_placa(new.cavalo_id);
      perform nucleo.recalcular_linha_da_placa(new.implemento_id);
    when 'cr' then
      for v_ativo in select distinct v.ativo_id from nucleo.cr_do_ativo v where v.cr_id = new.id and v.excluido_em is null loop
        perform nucleo.recalcular_linha_da_placa(v_ativo);
      end loop;
    when 'pessoa' then
      for v_ativo in select distinct g.ativo_id from nucleo.gestor_da_carteira g where g.gestor_id = new.id and g.excluido_em is null loop
        perform nucleo.recalcular_linha_da_placa(v_ativo);
      end loop;
    when 'operacao' then
      for v_ativo in select distinct o.ativo_id from nucleo.placa_na_operacao o where o.operacao_id = new.id and o.excluido_em is null loop
        perform nucleo.recalcular_linha_da_placa(v_ativo);
      end loop;
    else
      perform nucleo.recalcular_linha_da_placa(new.ativo_id);
  end case;
  return null;
end;
$$;
revoke all on function nucleo.recalcular_pela_mudanca() from public;

-- Sem gatilho na posse (a linha não mostra o regime), no evento (todo evento, e toda correção dele,
-- muda estado_de_status) nem na baixa (toda baixa vem com o evento e o fim do gestor): cada gatilho
-- daqui tem um teste que cai sem ele.
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.ativo
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.placa_do_ativo
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.gestor_da_carteira
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.cr_do_ativo
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.placa_na_operacao
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.custodia
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.estado_de_status
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.composicao
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.cr
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.pessoa
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();
create constraint trigger t99_leitura_da_placa after insert or update on nucleo.operacao
  deferrable initially deferred for each row execute function nucleo.recalcular_pela_mudanca();

-- Reconstrução total (preenchimento inicial e reparo) e o recálculo das linhas vencidas.
create function nucleo.reconstruir_leitura_das_placas()
returns integer
language plpgsql
security definer -- justificativa: reconstrói a leitura mantida inteira (só o dono do banco chama; sem grant); search_path vazio.
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_n integer := 0;
begin
  delete from nucleo.leitura_da_placa where ativo_id not in (select id from nucleo.ativo where excluido_em is null);
  for v_ativo in select id from nucleo.ativo where excluido_em is null loop
    perform nucleo.recalcular_so_a_linha(v_ativo);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function nucleo.reconstruir_leitura_das_placas() from public;

create function nucleo.recalcular_linhas_vencidas()
returns integer
language plpgsql
security definer -- justificativa: recálculo agendado da leitura mantida (vigências que começam ou acabam no futuro); sem grant; search_path vazio.
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_n integer := 0;
begin
  for v_ativo in select ativo_id from nucleo.leitura_da_placa where proximo_recalculo <= now() loop
    perform nucleo.recalcular_linha_da_placa(v_ativo);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function nucleo.recalcular_linhas_vencidas() from public;

-- As linhas que divergem do calculado agora (o teste de equivalência; só o dono do banco).
create function nucleo.linhas_divergentes()
returns table (ativo_id uuid, motivo text)
language sql
stable
set search_path = ''
as $$
  select a.id, case when l.ativo_id is null then 'falta a linha' else 'linha diferente do calculado' end
    from nucleo.ativo a
    left join nucleo.leitura_da_placa l on l.ativo_id = a.id
   where a.excluido_em is null
     and (l.ativo_id is null
          or (to_jsonb(l) - 'recalculado_em') is distinct from (to_jsonb(nucleo.linha_calculada_da_placa(a.id)) - 'recalculado_em'))
  union all
  select l.ativo_id, 'linha de ativo excluído'
    from nucleo.leitura_da_placa l
   where not exists (select 1 from nucleo.ativo a where a.id = l.ativo_id and a.excluido_em is null)
$$;
revoke all on function nucleo.linhas_divergentes() from public;

select nucleo.reconstruir_leitura_das_placas();

-- ---------------------------------------------------------------------------------------------
-- Escopo de leitura das placas do próprio usuário (uma vez por consulta, na RLS da tabela). Igual a
-- config.ve_ativo(ativo, {frota, operacional}, ver): provado no pgTAP 81, ativo por ativo.
-- ---------------------------------------------------------------------------------------------
create function config.ve_todas_as_placas()
returns boolean
language sql
stable
security definer -- justificativa: lê a permissão do perfil do próprio usuário (que ele não enxerga inteira), só por auth.uid(); search_path vazio.
set search_path = ''
as $$
  select exists (
    select 1 from nucleo.usuario u join config.permissao_do_perfil p on p.perfil = u.perfil
     where u.auth_user_id = (select auth.uid()) and u.ativo
       and p.modulo = any (array['frota', 'operacional']) and p.acao = 'ver' and p.escopo = 'tudo'
  )
$$;
revoke all on function config.ve_todas_as_placas() from public;

create function config.minha_carteira_de_placas()
returns uuid
language sql
stable
security definer -- justificativa: lê permissão e papel do próprio usuário, só por auth.uid(); search_path vazio.
set search_path = ''
as $$
  select u.pessoa_id from nucleo.usuario u
   where u.auth_user_id = (select auth.uid()) and u.ativo
     and exists (select 1 from config.permissao_do_perfil p
                  where p.perfil = u.perfil and p.modulo = any (array['frota', 'operacional']) and p.acao = 'ver' and p.escopo = 'minha_carteira')
     and exists (select 1 from nucleo.papel_da_pessoa pp where pp.pessoa_id = u.pessoa_id and pp.papel = 'gestor_de_frota')
$$;
revoke all on function config.minha_carteira_de_placas() from public;

create function config.minhas_operacoes_de_placas()
returns uuid[]
language sql
stable
security definer -- justificativa: lê permissão e operações do próprio usuário, só por auth.uid(); search_path vazio.
set search_path = ''
as $$
  select coalesce(array_agg(uo.operacao_id), '{}')
    from nucleo.usuario u join nucleo.usuario_operacao uo on uo.usuario_id = u.pessoa_id
   where u.auth_user_id = (select auth.uid()) and u.ativo
     and exists (select 1 from config.permissao_do_perfil p
                  where p.perfil = u.perfil and p.modulo = any (array['frota', 'operacional']) and p.acao = 'ver' and p.escopo = 'operacao')
$$;
revoke all on function config.minhas_operacoes_de_placas() from public;

create function config.minhas_filiais_de_placas()
returns uuid[]
language sql
stable
security definer -- justificativa: lê permissão e filiais do próprio usuário, só por auth.uid(); search_path vazio.
set search_path = ''
as $$
  select coalesce(array_agg(uf.filial_id), '{}')
    from nucleo.usuario u join nucleo.usuario_filial uf on uf.usuario_id = u.pessoa_id
   where u.auth_user_id = (select auth.uid()) and u.ativo
     and exists (select 1 from config.permissao_do_perfil p
                  where p.perfil = u.perfil and p.modulo = any (array['frota', 'operacional']) and p.acao = 'ver' and p.escopo = 'filial')
$$;
revoke all on function config.minhas_filiais_de_placas() from public;

create policy leitura_da_placa_ler on nucleo.leitura_da_placa for select to authenticated using (
  (select config.ve_todas_as_placas())
  or gestor_id = (select config.minha_carteira_de_placas())
  or operacao_id = any (coalesce((select config.minhas_operacoes_de_placas()), '{}'::uuid[]))
  or filial_da_custodia_id = any (coalesce((select config.minhas_filiais_de_placas()), '{}'::uuid[]))
);
grant select on nucleo.leitura_da_placa to authenticated;

-- ---------------------------------------------------------------------------------------------
-- A linha da lista passa a ler da tabela (mesmas colunas; a garagem entra no fim).
-- ---------------------------------------------------------------------------------------------
create or replace view nucleo.linha_de_placa with (security_invoker = true) as
  select
    l.ativo_id as id,
    l.placa,
    l.tipo,
    l.modelo,
    l.cavalo,
    l.implementos,
    l.gestor,
    l.operacao,
    l.cr,
    l.sigla,
    l.nome_da_situacao,
    l.grupo,
    l.desde,
    ((now() at time zone 'America/Sao_Paulo')::date - (l.desde at time zone 'America/Sao_Paulo')::date) as dias_no_status,
    nucleo.alertas_com_prazos(l.alertas_vigentes, l.inicio_do_pat, l.ultima_correcao_tardia_em, coalesce(l.baixada_em <= now(), false), now()) as alertas,
    l.valor_fipe,
    l.filial,
    l.ano,
    l.renavam,
    coalesce(l.baixada_em <= now(), false) as baixada,
    l.busca,
    l.garagem
  from nucleo.leitura_da_placa l;

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.alertas_vigentes_do_ativo(uuid,timestamp with time zone)', 'Alertas de vínculo sem prazo no relógio (a visão alerta_de_vinculo), com a RLS de quem consulta.'),
  ('nucleo.inicio_do_pat(uuid)', 'Base do alerta de parado no pátio (a visão alerta_de_vinculo), com a RLS de quem consulta.'),
  ('nucleo.ultima_correcao_tardia_em(uuid)', 'Base do alerta de correção tardia (a visão alerta_de_vinculo), com a RLS de quem consulta.'),
  ('nucleo.alerta_parado_em_patio(timestamp with time zone,timestamp with time zone)', 'Regra do alerta de parado no pátio, calculada na leitura (função pura e o parâmetro).'),
  ('nucleo.alerta_correcao_tardia(timestamp with time zone,timestamp with time zone)', 'Regra do alerta de correção tardia, calculada na leitura (função pura e o parâmetro).'),
  ('nucleo.alertas_com_prazos(text[],timestamp with time zone,timestamp with time zone,boolean,timestamp with time zone)', 'Junta os alertas guardados e os de prazo na leitura da placa.'),
  ('nucleo.alertas_do_ativo(uuid,timestamp with time zone)', 'Todos os alertas de vínculo do ativo (a visão alerta_de_vinculo), com a RLS de quem consulta.'),
  ('config.ve_todas_as_placas()', 'Escopo de leitura das placas do próprio usuário (RLS da leitura da placa).'),
  ('config.minha_carteira_de_placas()', 'Escopo de leitura das placas do próprio usuário (RLS da leitura da placa).'),
  ('config.minhas_operacoes_de_placas()', 'Escopo de leitura das placas do próprio usuário (RLS da leitura da placa).'),
  ('config.minhas_filiais_de_placas()', 'Escopo de leitura das placas do próprio usuário (RLS da leitura da placa).');
grant execute on function nucleo.alertas_vigentes_do_ativo(uuid, timestamptz) to authenticated;
grant execute on function nucleo.inicio_do_pat(uuid) to authenticated;
grant execute on function nucleo.ultima_correcao_tardia_em(uuid) to authenticated;
grant execute on function nucleo.alerta_parado_em_patio(timestamptz, timestamptz) to authenticated;
grant execute on function nucleo.alerta_correcao_tardia(timestamptz, timestamptz) to authenticated;
grant execute on function nucleo.alertas_com_prazos(text[], timestamptz, timestamptz, boolean, timestamptz) to authenticated;
grant execute on function nucleo.alertas_do_ativo(uuid, timestamptz) to authenticated;
grant execute on function config.ve_todas_as_placas() to authenticated;
grant execute on function config.minha_carteira_de_placas() to authenticated;
grant execute on function config.minhas_operacoes_de_placas() to authenticated;
grant execute on function config.minhas_filiais_de_placas() to authenticated;
