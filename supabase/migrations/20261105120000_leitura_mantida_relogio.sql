-- Fatia 3.9a, ajustes do checkpoint (03/11/2026): o relógio da leitura mantida vira parâmetro e as
-- linhas vencidas são recalculadas antes da leitura (plano B, sem agendador).
--  * A documentação do Supabase (Cron, Install, Quickstart, Extensions, Billing, Local development)
--    não confirma o pg_cron no plano gratuito nem no Supabase local: o recálculo agendado não depende
--    dele. A lista e o detalhe chamam nucleo.atualizar_leitura_vencida() antes de ler: recalcula, em
--    lote limitado e idempotente, as linhas cujo proximo_recalculo já venceu.
--  * p_em (padrão now()) em toda a cadeia do recálculo: os testes simulam o relógio por parâmetro.

drop function nucleo.recalcular_linhas_vencidas();
drop function nucleo.recalcular_linha_da_placa(uuid);
drop function nucleo.recalcular_so_a_linha(uuid);
drop function nucleo.linha_calculada_da_placa(uuid);
drop function nucleo.proximo_recalculo_do_ativo(uuid);

create function nucleo.proximo_recalculo_do_ativo(p_ativo_id uuid, p_em timestamptz default now())
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select min(t) from (
    select inicio as t from nucleo.cr_do_ativo where ativo_id = p_ativo_id and excluido_em is null and inicio > p_em
    union all select fim from nucleo.cr_do_ativo where ativo_id = p_ativo_id and excluido_em is null and fim > p_em
    union all select inicio from nucleo.gestor_da_carteira where ativo_id = p_ativo_id and excluido_em is null and inicio > p_em
    union all select fim from nucleo.gestor_da_carteira where ativo_id = p_ativo_id and excluido_em is null and fim > p_em
    union all select inicio from nucleo.custodia where ativo_id = p_ativo_id and excluido_em is null and inicio > p_em
    union all select fim from nucleo.custodia where ativo_id = p_ativo_id and excluido_em is null and fim > p_em
    union all select inicio from nucleo.placa_na_operacao where ativo_id = p_ativo_id and excluido_em is null and inicio > p_em
    union all select fim from nucleo.placa_na_operacao where ativo_id = p_ativo_id and excluido_em is null and fim > p_em
    union all select inicio from nucleo.placa_do_ativo where ativo_id = p_ativo_id and excluido_em is null and inicio > p_em
    union all select fim from nucleo.placa_do_ativo where ativo_id = p_ativo_id and excluido_em is null and fim > p_em
    union all select inicio from nucleo.estado_de_status where ativo_id = p_ativo_id and excluido_em is null and inicio > p_em
    union all select fim from nucleo.estado_de_status where ativo_id = p_ativo_id and excluido_em is null and fim > p_em
    union all select inicio from nucleo.composicao where (cavalo_id = p_ativo_id or implemento_id = p_ativo_id) and excluido_em is null and inicio > p_em
    union all select fim from nucleo.composicao where (cavalo_id = p_ativo_id or implemento_id = p_ativo_id) and excluido_em is null and fim > p_em
    union all select em from nucleo.baixa_do_ativo where ativo_id = p_ativo_id and excluido_em is null and em > p_em
  ) x
$$;

revoke all on function nucleo.proximo_recalculo_do_ativo(uuid, timestamptz) from public;

create function nucleo.linha_calculada_da_placa(p_ativo_id uuid, p_em timestamptz default now())
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
    nucleo.alertas_vigentes_do_ativo(a.id, p_em),
    a.valor_fipe,
    coalesce(a.ano_modelo, a.ano_fabricacao)::int,
    a.renavam,
    (select min(b.em) from nucleo.baixa_do_ativo b where b.ativo_id = a.id and b.excluido_em is null),
    nucleo.texto_simples(concat_ws(' ', pl.placa, mo.modelo, coalesce(gv.gestor, gu.gestor), op.operacao, crv.cr)),
    nucleo.proximo_recalculo_do_ativo(a.id, p_em),
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
        where c.implemento_id = a.id and c.excluido_em is null and c.periodo @> p_em
        limit 1) as cavalo,
      array(
        select pi.placa
          from nucleo.composicao c
          join nucleo.placa_do_ativo pi on pi.ativo_id = c.implemento_id and pi.excluido_em is null and pi.fim is null
         where c.cavalo_id = a.id and c.excluido_em is null and c.periodo @> p_em
         order by c.posicao
      ) as implementos
  ) cj on true
  left join lateral (
    select g.gestor_id, pe.nome as gestor
      from nucleo.gestor_da_carteira g
      join nucleo.pessoa pe on pe.id = g.gestor_id
     where g.ativo_id = a.id and g.excluido_em is null and g.periodo @> p_em
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
    select o.id as operacao_id, o.nome as operacao from nucleo.operacao o where o.id = nucleo.operacao_em(a.id, p_em)
  ) op on true
  left join lateral (
    select c.codigo as cr from nucleo.cr c where c.id = nucleo.cr_em(a.id, p_em)
  ) crv on true
  left join lateral (
    select g.rotulo as garagem from config.garagem g where g.id = nucleo.garagem_em(a.id, p_em)
  ) ga on true
  left join lateral (
    select f.rotulo as filial from config.filial_do_cr f where f.codigo = nucleo.filial_do_cr_em(a.id, p_em)
  ) fi on true
  left join lateral (
    select c.filial_id from nucleo.custodia c
     where c.ativo_id = a.id and c.com_quem = 'operacional' and c.excluido_em is null and c.periodo @> p_em
     limit 1
  ) cu on true
  cross join lateral nucleo.situacao_com_causa(a.id, p_em) s
  left join config.status st on st.sigla = s.sigla
  left join lateral (
    select e.inicio as desde
      from nucleo.estado_de_status e
     where e.ativo_id = s.causa_id and e.sigla = s.sigla and e.excluido_em is null and e.periodo @> p_em
     order by e.inicio desc
     limit 1
  ) de on true
  where a.id = p_ativo_id and a.excluido_em is null
$$;

revoke all on function nucleo.linha_calculada_da_placa(uuid, timestamptz) from public;

create function nucleo.recalcular_so_a_linha(p_ativo_id uuid, p_em timestamptz default now())
returns void
language plpgsql
security definer -- justificativa: a linha junta tabelas que cada perfil só enxerga em parte (gestor, custódia, operação) e é gravada só por aqui, nunca pelo usuário; não devolve dados; search_path vazio.
set search_path = ''
as $$
declare
  v nucleo.leitura_da_placa;
begin
  if p_ativo_id is null then
    return;
  end if;
  v := nucleo.linha_calculada_da_placa(p_ativo_id, p_em);
  delete from nucleo.leitura_da_placa where ativo_id = p_ativo_id;
  if v.ativo_id is not null then
    insert into nucleo.leitura_da_placa values (v.*);
  end if;
exception when others then
  raise warning 'leitura da placa % não recalculada: %', p_ativo_id, sqlerrm;
  update nucleo.leitura_da_placa set proximo_recalculo = now() where ativo_id = p_ativo_id;
end;
$$;
revoke all on function nucleo.recalcular_so_a_linha(uuid, timestamptz) from public;

create function nucleo.recalcular_linha_da_placa(p_ativo_id uuid, p_em timestamptz default now())
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
  perform nucleo.recalcular_so_a_linha(p_ativo_id, p_em);
  for v_membro in
    select c.implemento_id from nucleo.composicao c
     where c.cavalo_id = p_ativo_id and c.excluido_em is null and c.periodo @> p_em
    union
    select c.cavalo_id from nucleo.composicao c
     where c.implemento_id = p_ativo_id and c.excluido_em is null and c.periodo @> p_em
    union
    select c2.implemento_id
      from nucleo.composicao c
      join nucleo.composicao c2 on c2.cavalo_id = c.cavalo_id and c2.excluido_em is null and c2.periodo @> p_em
     where c.implemento_id = p_ativo_id and c.excluido_em is null and c.periodo @> p_em
  loop
    if v_membro <> p_ativo_id then
      perform nucleo.recalcular_so_a_linha(v_membro, p_em);
    end if;
  end loop;
end;
$$;
revoke all on function nucleo.recalcular_linha_da_placa(uuid, timestamptz) from public;

-- As linhas vencidas (proximo_recalculo <= p_em), em lote limitado e sem disputa entre sessões.
create function nucleo.recalcular_linhas_vencidas(p_limite integer default 500, p_em timestamptz default now())
returns integer
language plpgsql
security definer -- justificativa: recálculo das linhas vencidas da leitura mantida; sem grant (o app usa atualizar_leitura_vencida, sem relógio); search_path vazio.
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_n integer := 0;
begin
  for v_ativo in
    select l.ativo_id from nucleo.leitura_da_placa l
     where l.proximo_recalculo <= p_em
     order by l.proximo_recalculo
     limit least(greatest(coalesce(p_limite, 500), 1), 1000)
     for update skip locked
  loop
    perform nucleo.recalcular_linha_da_placa(v_ativo, p_em);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function nucleo.recalcular_linhas_vencidas(integer, timestamptz) from public;

-- O que o app chama antes da lista e do detalhe: as linhas vencidas AGORA, até 200 por vez.
create function nucleo.atualizar_leitura_vencida()
returns integer
language sql
volatile
security definer -- justificativa: quem lê a lista não grava a leitura mantida; esta função só recalcula linhas já vencidas, agora (sem relógio escolhido por quem chama), em lote limitado e idempotente, e devolve só a quantidade (nenhum dado); search_path vazio.
set search_path = ''
as $$
  select nucleo.recalcular_linhas_vencidas(200, now())
$$;
revoke all on function nucleo.atualizar_leitura_vencida() from public;
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.atualizar_leitura_vencida()', 'Antes da lista e do detalhe: recalcula as linhas da leitura mantida que já venceram (vigência futura que chegou), em lote limitado; não devolve dados.');
grant execute on function nucleo.atualizar_leitura_vencida() to authenticated;
