-- Frota › Acompanhamento v2, fatia A1 (2º lote de ajustes, 12/11/2026):
--
--  * "Solta" vale a DATA, não o mês: é o ativo sem cavalo engatado na data de referência (hoje, no mês em
--    curso; o último dia do mês, num mês passado), mais o apoio e o equipamento. O implemento desatrelado
--    hoje aparece em Soltas hoje; o conjunto em que ele esteve no mês continua na aba Conjuntos, pelos dias
--    em que existiu (o chip dele mostra o período engatado). "X de Y soltas com situação no dia" usa a
--    própria data pedida: as soltas daquele dia, não as do mês.
--  * Com dois ou mais implementos impedidos no mesmo dia, a célula do conjunto lista TODAS as causas
--    (`causas`: placa e sigla de cada peça, na ordem da posição). A sigla do conjunto segue sendo a do
--    primeiro (a regra de `nucleo.situacao_com_causa` não muda).
-- Só redefine funções da migration anterior (mesmas assinaturas, mesmos grants); nenhuma tabela nova e
-- nenhuma função é SECURITY DEFINER.

-- Os dias do conjunto: troca `causa` (uma peça) por `causas` (todas as peças impedidas e engatadas no dia).
create or replace function nucleo.dias_do_conjunto(p_cavalo_id uuid, p_inicio date, p_fim date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'dia', d.dia, 'sigla', s.sigla, 'grupo', st.chip, 'causas', coalesce(s.causas, '[]'::jsonb),
           'eventos', ev.n, 'manual', ev.manual, 'tardia', ev.tardia) order by d.dia), '[]'::jsonb)
    from (select g::date as dia from generate_series(p_inicio, p_fim - 1, interval '1 day') g) d
    cross join lateral (select nucleo.instante_do_dia(d.dia) as ref) t
    left join lateral (
      select nullif(c.sigla, 'pendente') as sigla,
             case when c.causa_id is not null and c.causa_id <> p_cavalo_id
                  then (
                    select coalesce(jsonb_agg(jsonb_build_object(
                             'ativo_id', m.implemento_id, 'placa', l.placa,
                             'sigla', nucleo.estado_em(m.implemento_id, 'impedida', t.ref)
                           ) order by m.posicao, l.placa), '[]'::jsonb)
                      from nucleo.composicao m
                      join nucleo.leitura_da_placa l on l.ativo_id = m.implemento_id
                     where m.cavalo_id = p_cavalo_id and m.excluido_em is null and m.periodo @> t.ref
                       and nucleo.estado_em(m.implemento_id, 'impedida', t.ref) is not null
                  )
             end as causas
        from nucleo.situacao_com_causa(p_cavalo_id, t.ref) c
       where d.dia <= nucleo.hoje_em_sao_paulo()
    ) s on true
    left join config.status st on st.sigla = s.sigla
    cross join lateral (
      select count(*) as n,
             coalesce(bool_or(e.origem = 'manual'), false) as manual,
             coalesce(bool_or((e.registrado_em at time zone 'America/Sao_Paulo')::date > d.dia), false) as tardia
        from nucleo.evento_de_status e
       where e.ativo_id = p_cavalo_id and e.excluido_em is null
         and e.em >= d.dia::timestamp at time zone 'America/Sao_Paulo'
         and e.em < (d.dia + 1)::timestamp at time zone 'America/Sao_Paulo'
    ) ev
$$;
comment on function nucleo.dias_do_conjunto(uuid, date, date) is
  'Os dias de um conjunto: a situação do cavalo no fim do dia (impedida se um implemento engatado no dia está impedido, com TODAS as causas: placa e sigla de cada peça), o grupo, os eventos do dia e as marcas de manual e de correção tardia.';

-- As soltas: sem cavalo engatado na data de referência (hoje, ou o último dia do mês num mês passado).
create or replace function nucleo.soltas_da_grade(p_inicio date, p_busca text, p_tipo_de_cr text)
returns table (
  ativo_id uuid, placa text, tipo text, modelo text, ano integer, operacao text, sigla text, grupo text,
  tipos_de_cr text[], baixada_em timestamptz
)
language sql
stable
set search_path = ''
as $$
  with t as (
    select replace(replace(replace(nucleo.texto_simples(btrim(coalesce(p_busca, ''))), '\', '\\'), '%', '\%'), '_', '\_') as busca,
           upper(regexp_replace(coalesce(p_busca, ''), '[^A-Za-z0-9]', '', 'g')) as placa,
           p_inicio::timestamp at time zone 'America/Sao_Paulo' as de,
           (p_inicio + interval '1 month')::timestamp at time zone 'America/Sao_Paulo' as ate,
           nucleo.instante_do_dia(least((p_inicio + interval '1 month')::date - 1, nucleo.hoje_em_sao_paulo())) as ref
  )
  select l.ativo_id, l.placa, l.tipo, l.modelo, l.ano, l.operacao, l.sigla, l.grupo, x.tipos, l.baixada_em
    from nucleo.leitura_da_placa l
    cross join t
    cross join lateral (select nucleo.tipos_de_cr_do_ativo(l.ativo_id, t.ref) as tipos) x
   where l.tipo not in ('cavalo', 'caminhao')
     and (l.baixada_em is null or l.baixada_em >= t.de)
     and exists (
       select 1 from nucleo.evento_de_status e
        where e.ativo_id = l.ativo_id and e.excluido_em is null and e.em < t.ate
     )
     and not exists (
       select 1 from nucleo.composicao c
        where (c.cavalo_id = l.ativo_id or c.implemento_id = l.ativo_id)
          and c.excluido_em is null and c.periodo @> t.ref
     )
     and (p_tipo_de_cr is null or p_tipo_de_cr = any (x.tipos))
     and (t.busca = '' or l.busca like '%' || t.busca || '%' or (t.placa <> '' and l.placa like '%' || t.placa || '%'))
$$;
comment on function nucleo.soltas_da_grade(date, text, text) is
  'As soltas na data de referência do mês (hoje no mês em curso; o último dia num mês passado): ativo sem cavalo engatado nela, apoio e equipamento, pelos filtros, com a RLS de quem consulta.';

-- "X de Y soltas com situação no dia": as soltas DAQUELE dia (sem cavalo engatado no fim dele, já existentes
-- e não baixadas antes dele); X são as com ao menos um evento de situação da própria placa no dia.
create or replace function nucleo.soltas_com_situacao_no_dia(p_dia date)
returns table (x bigint, y bigint)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_inicio timestamptz;
  v_fim timestamptz;
  v_ref timestamptz;
begin
  if p_dia is null or p_dia > nucleo.hoje_em_sao_paulo() then
    raise exception 'A medida é de um dia até hoje. Escolha outro dia.' using errcode = '22023';
  end if;
  v_inicio := p_dia::timestamp at time zone 'America/Sao_Paulo';
  v_fim := (p_dia + 1)::timestamp at time zone 'America/Sao_Paulo';
  v_ref := nucleo.instante_do_dia(p_dia);
  return query
  select (count(*) filter (where exists (
            select 1 from nucleo.evento_de_status e
             where e.ativo_id = l.ativo_id and e.excluido_em is null and e.em >= v_inicio and e.em < v_fim
          )))::bigint,
         count(*)::bigint
    from nucleo.leitura_da_placa l
   where l.tipo not in ('cavalo', 'caminhao')
     and (l.baixada_em is null or l.baixada_em >= v_inicio)
     and exists (
       select 1 from nucleo.evento_de_status e
        where e.ativo_id = l.ativo_id and e.excluido_em is null and e.em < v_fim
     )
     and not exists (
       select 1 from nucleo.composicao c
        where (c.cavalo_id = l.ativo_id or c.implemento_id = l.ativo_id)
          and c.excluido_em is null and c.periodo @> v_ref
     );
end;
$$;
comment on function nucleo.soltas_com_situacao_no_dia(date) is
  'X de Y soltas com situação no dia (Y: as soltas daquele dia, sem cavalo engatado no fim dele; X: as com evento de situação da própria placa no dia), com a RLS de quem consulta.';
