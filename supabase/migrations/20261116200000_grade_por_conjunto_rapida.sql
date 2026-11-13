-- Frota › Acompanhamento v2, fatia A1: a grade por conjunto com 100 linhas estourava o limite de tempo no CI
-- (código 57014, `/frota/acompanhamento?tam=100`). A causa: `dias_do_conjunto` refazia, para cada dia (31) e
-- cada conjunto (100), a situação do cavalo e das peças em dezenas de consultas, todas sob a RLS de quem
-- consulta (`config.ve_ativo` em cada linha lida): ~8,7 s com as 928 placas. Agora:
--  * `dias_dos_conjuntos(uuid[], date, date)` lê estados, peças engatadas e eventos do mês UMA vez para todos
--    os cavalos da página e monta a situação de cada dia por junções (mesmo resultado de `dias_do_conjunto`,
--    que continua como a definição de referência, comparada no pgTAP 112);
--  * `grade_por_conjunto` (mesma assinatura e mesmo formato) chama `conjuntos_da_grade` uma vez só (antes duas)
--    e usa os dias em lote.
-- Nenhuma tabela nova e nenhuma função é SECURITY DEFINER (vale a RLS de quem chama).

create function nucleo.dias_dos_conjuntos(p_cavalos uuid[], p_inicio date, p_fim date)
returns table (cavalo_id uuid, dias jsonb)
language sql
stable
set search_path = ''
as $$
  with
  dia as (
    select g::date as dia, nucleo.instante_do_dia(g::date) as ref
      from generate_series(p_inicio, p_fim - 1, interval '1 day') g
  ),
  cav as (
    select a.id, a.tipo from nucleo.ativo a where a.id = any (p_cavalos)
  ),
  comp as (
    select m.cavalo_id, m.implemento_id, m.posicao, m.periodo
      from nucleo.composicao m
     where m.cavalo_id = any (p_cavalos) and m.excluido_em is null
       and m.periodo && tstzrange(p_inicio::timestamp at time zone 'America/Sao_Paulo' - interval '1 day',
                                  p_fim::timestamp at time zone 'America/Sao_Paulo' + interval '1 day', '[)')
  ),
  est as (
    select e.ativo_id, e.camada, e.sigla, e.periodo
      from nucleo.estado_de_status e
     where e.excluido_em is null
       and e.ativo_id in (select unnest(p_cavalos) union select c.implemento_id from comp c)
       and e.periodo && tstzrange(p_inicio::timestamp at time zone 'America/Sao_Paulo' - interval '1 day',
                                  p_fim::timestamp at time zone 'America/Sao_Paulo' + interval '1 day', '[)')
  ),
  -- Candidatas à situação do dia, na ordem das camadas: o estado do próprio cavalo; e, na camada
  -- "impedida", sem estado próprio, a peça engatada impedida (a primeira pela posição).
  candidata as (
    select c.id, d.dia, k.prioridade, 0 as sub, 0::smallint as posicao, e.sigla, false as da_peca
      from cav c
      cross join dia d
      join est e on e.ativo_id = c.id and e.periodo @> d.ref
      join config.camada_de_status k on k.codigo = e.camada
     where d.dia <= nucleo.hoje_em_sao_paulo()
    union all
    select c.id, d.dia, k.prioridade, 1, m.posicao, e.sigla, true
      from cav c
      cross join dia d
      join comp m on m.cavalo_id = c.id and m.periodo @> d.ref
      join est e on e.ativo_id = m.implemento_id and e.camada = 'impedida' and e.periodo @> d.ref
      join config.camada_de_status k on k.codigo = 'impedida'
     where c.tipo = 'cavalo' and d.dia <= nucleo.hoje_em_sao_paulo()
  ),
  vencedora as (
    select distinct on (x.id, x.dia) x.id, x.dia, x.sigla, x.da_peca
      from candidata x
     order by x.id, x.dia, x.prioridade, x.sub, x.posicao
  ),
  causa as (
    select v.id, v.dia,
           jsonb_agg(jsonb_build_object('ativo_id', m.implemento_id, 'placa', l.placa, 'sigla', e.sigla)
                     order by m.posicao, l.placa) as causas
      from vencedora v
      join dia d on d.dia = v.dia
      join comp m on m.cavalo_id = v.id and m.periodo @> d.ref
      join est e on e.ativo_id = m.implemento_id and e.camada = 'impedida' and e.periodo @> d.ref
      join nucleo.leitura_da_placa l on l.ativo_id = m.implemento_id
     where v.da_peca
     group by v.id, v.dia
  ),
  ev as (
    select e.ativo_id, (e.em at time zone 'America/Sao_Paulo')::date as dia, count(*) as n,
           coalesce(bool_or(e.origem = 'manual'), false) as manual,
           coalesce(bool_or((e.registrado_em at time zone 'America/Sao_Paulo')::date > (e.em at time zone 'America/Sao_Paulo')::date), false) as tardia
      from nucleo.evento_de_status e
     where e.ativo_id = any (p_cavalos) and e.excluido_em is null
       and e.em >= p_inicio::timestamp at time zone 'America/Sao_Paulo'
       and e.em < p_fim::timestamp at time zone 'America/Sao_Paulo'
     group by e.ativo_id, (e.em at time zone 'America/Sao_Paulo')::date
  )
  select u.id,
         coalesce(jsonb_agg(jsonb_build_object(
           'dia', d.dia, 'sigla', nullif(v.sigla, 'pendente'), 'grupo', st.chip,
           'causas', coalesce(ca.causas, '[]'::jsonb),
           'eventos', coalesce(ev.n, 0), 'manual', coalesce(ev.manual, false), 'tardia', coalesce(ev.tardia, false))
           order by d.dia), '[]'::jsonb)
    from unnest(p_cavalos) as u(id)
    cross join dia d
    left join vencedora v on v.id = u.id and v.dia = d.dia
    left join config.status st on st.sigla = nullif(v.sigla, 'pendente')
    left join causa ca on ca.id = u.id and ca.dia = d.dia
    left join ev on ev.ativo_id = u.id and ev.dia = d.dia
   group by u.id
$$;
revoke all on function nucleo.dias_dos_conjuntos(uuid[], date, date) from public;
comment on function nucleo.dias_dos_conjuntos(uuid[], date, date) is
  'Os dias de vários conjuntos de uma vez (o mesmo resultado de dias_do_conjunto para cada cavalo, em consultas únicas): situação do dia, grupo, causas, eventos e marcas, com a RLS de quem consulta.';
grant execute on function nucleo.dias_dos_conjuntos(uuid[], date, date) to authenticated;

-- A grade por conjunto, agora com o conjunto numa peça só: os implementos são chips (sem células próprias).
create or replace function nucleo.grade_por_conjunto(
  p_mes date, p_filtros jsonb default '{}'::jsonb, p_pagina integer default 1, p_tam integer default 20
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_inicio date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_de timestamptz := v_inicio::timestamp at time zone 'America/Sao_Paulo';
  v_ate timestamptz := v_fim::timestamp at time zone 'America/Sao_Paulo';
  v_busca text := btrim(coalesce(p_filtros->>'busca', ''));
  v_tipo text := nullif(p_filtros->>'tipo_de_cr', '');
  v_grupo text := nullif(p_filtros->>'grupo', '');
  v_tam integer := least(greatest(coalesce(p_tam, 20), 1), 200);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_total integer;
  v_paginas integer;
  v_linhas jsonb;
  v_chips jsonb;
  v_conjuntos jsonb;
  v_ids uuid[];
  v_dias jsonb;
  v_x bigint;
  v_y bigint;
begin
  if p_mes is null or v_inicio > date_trunc('month', v_hoje)::date then
    raise exception 'Escolha um mês até o atual.' using errcode = '22023';
  end if;
  if v_tipo is not null and v_tipo not in ('frota', 'acionista') then
    raise exception 'O tipo de CR é frota ou acionista.' using errcode = '22023';
  end if;
  if v_grupo is not null and v_grupo not in ('em-atividade', 'atencao', 'impedida', 'patio', 'fora') then
    raise exception 'O grupo de situação não existe.' using errcode = '22023';
  end if;

  -- Os conjuntos (uma só consulta, a mais cara) e a contagem dos chips (a de cada grupo ignora o filtro de grupo).
  select coalesce(jsonb_agg(to_jsonb(c) order by c.placa, c.ativo_id), '[]'::jsonb)
    into v_conjuntos
    from nucleo.conjuntos_da_grade(v_inicio, v_busca, v_tipo) c;
  select count(*) filter (where v_grupo is null or c.grupo = v_grupo)::integer,
         jsonb_build_object(
           'todos', count(*),
           'em-atividade', count(*) filter (where c.grupo = 'em-atividade'),
           'atencao', count(*) filter (where c.grupo = 'atencao'),
           'impedida', count(*) filter (where c.grupo = 'impedida'),
           'patio', count(*) filter (where c.grupo = 'patio'),
           'fora', count(*) filter (where c.grupo = 'fora'))
    into v_total, v_chips
    from jsonb_to_recordset(v_conjuntos) as c(grupo text);
  v_paginas := greatest(ceil(v_total::numeric / v_tam)::integer, 1);
  v_pagina := least(v_pagina, v_paginas);

  -- A página (placa, desempate pelo id) e os dias dos conjuntos dela, de uma vez só.
  select coalesce(array_agg(p.ativo_id order by p.ord), '{}'::uuid[]) into v_ids
    from (
      select (e.j ->> 'ativo_id')::uuid as ativo_id, e.ord
        from jsonb_array_elements(v_conjuntos) with ordinality as e(j, ord)
       where v_grupo is null or e.j ->> 'grupo' = v_grupo
       order by e.ord
       offset (v_pagina - 1) * v_tam limit v_tam
    ) p;
  select coalesce(jsonb_object_agg(d.cavalo_id::text, d.dias), '{}'::jsonb) into v_dias
    from nucleo.dias_dos_conjuntos(v_ids, v_inicio, v_fim) d;

  select coalesce(jsonb_agg(p.linha order by p.placa, p.ativo_id), '[]'::jsonb) into v_linhas
    from (
      select c.placa, c.ativo_id, jsonb_build_object(
        'ativo_id', c.ativo_id, 'placa', c.placa, 'modelo', c.modelo, 'ano', c.ano, 'operacao', c.operacao,
        'sigla_atual', c.sigla, 'grupo_atual', c.grupo, 'tipos_de_cr', to_jsonb(c.tipos_de_cr),
        'nome_do_conjunto', case
          when exists (
            select 1 from nucleo.composicao m
             where m.cavalo_id = c.ativo_id and m.excluido_em is null and m.periodo && tstzrange(v_de, v_ate, '[)')
          ) then coalesce(nucleo.nome_do_conjunto(c.ativo_id, nucleo.instante_do_dia(least(v_fim - 1, v_hoje))), 'Sem implemento')
          else 'Caminhão'
        end,
        'dias', coalesce(v_dias -> c.ativo_id::text, '[]'::jsonb),
        'implementos', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'ativo_id', i.implemento_id, 'placa', li.placa, 'modelo', li.modelo, 'funcao', a.funcao,
                   'posicao', i.posicao, 'engatado_de', i.de, 'engatado_ate', i.ate,
                   'sigla_atual', li.sigla, 'grupo_atual', li.grupo
                 ) order by i.posicao, li.placa), '[]'::jsonb)
            from (
              -- O dia vale pelo fim do dia: engatado de manhã conta no dia; desatrelado à tarde já saiu no dia.
              select m.implemento_id, min(m.posicao) as posicao,
                     greatest((min(m.inicio) at time zone 'America/Sao_Paulo')::date, v_inicio) as de,
                     case when bool_or(m.fim is null or m.fim >= v_ate) then null
                          else (max(m.fim) at time zone 'America/Sao_Paulo')::date - 1 end as ate
                from nucleo.composicao m
               where m.cavalo_id = c.ativo_id and m.excluido_em is null and m.periodo && tstzrange(v_de, v_ate, '[)')
               group by m.implemento_id
            ) i
            join nucleo.leitura_da_placa li on li.ativo_id = i.implemento_id
            join nucleo.ativo a on a.id = i.implemento_id
        )
      ) as linha
        from jsonb_to_recordset(v_conjuntos) as c(
               ativo_id uuid, placa text, modelo text, ano integer, operacao text, sigla text, grupo text, tipos_de_cr text[])
       where c.ativo_id = any (v_ids)
    ) p;

  select r.x, r.y into v_x, v_y from nucleo.conjuntos_com_lancamento_no_dia(v_hoje) r;

  return jsonb_build_object(
    'mes', v_inicio, 'hoje', v_hoje, 'dias_no_mes', v_fim - v_inicio,
    'linhas', v_linhas, 'total', v_total, 'pagina', v_pagina, 'paginas', v_paginas, 'tam', v_tam,
    'chips', v_chips,
    'lancamento_hoje', jsonb_build_object('x', v_x, 'y', v_y)
  );
end;
$$;
comment on function nucleo.grade_por_conjunto(date, jsonb, integer, integer) is
  'A grade do Acompanhamento por conjunto, numa peça só: uma linha por cavalo ou caminhão (os implementos engatados no mês viram chips, e a célula do dia traz a causa quando um implemento engatado impede o conjunto), a contagem dos chips e o X de Y de hoje; paginada no banco (placa, desempate pelo id), com a RLS de quem consulta.';
