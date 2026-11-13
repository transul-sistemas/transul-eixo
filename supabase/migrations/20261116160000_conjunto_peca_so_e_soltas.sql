-- Frota › Acompanhamento v2, fatia A1 (ajustes de 12/11/2026, depois da prévia):
--
--  * O conjunto é UMA PEÇA SÓ: uma linha e um só conjunto de células. O cavalo (ou o caminhão) é a cara; os
--    implementos engatados no mês viram chips (placa, engatado de/até), sem células próprias. A situação do
--    dia é a do cavalo, exceto quando um implemento engatado NAQUELE dia está impedido: aí o conjunto fica
--    impedido (isso já é a regra de `nucleo.situacao_com_causa`) e a célula traz a causa: a placa do
--    implemento. Troca `grade_por_conjunto` (mesma assinatura, formato novo) e tira `dias_do_implemento`.
--  * A seção "Fora de conjunto" vira a aba "Soltas": implemento sem cavalo engatado no mês, apoio e
--    equipamento, com a própria grade, os chips por grupo e a medida "X de Y soltas com situação hoje".
-- Nenhuma tabela nova; nenhuma função é SECURITY DEFINER (vale a RLS de quem chama).

-- Os dias do conjunto: a situação do cavalo no fim do dia (com a herança do impedimento de um implemento
-- engatado), o grupo, a causa (o implemento que impede, ou nulo), os eventos do dia e as marcas de manual e de
-- correção tardia.
create function nucleo.dias_do_conjunto(p_cavalo_id uuid, p_inicio date, p_fim date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'dia', d.dia, 'sigla', s.sigla, 'grupo', st.chip, 'causa', s.causa,
           'eventos', ev.n, 'manual', ev.manual, 'tardia', ev.tardia) order by d.dia), '[]'::jsonb)
    from (select g::date as dia from generate_series(p_inicio, p_fim - 1, interval '1 day') g) d
    left join lateral (
      select nullif(c.sigla, 'pendente') as sigla,
             case when c.causa_id is not null and c.causa_id <> p_cavalo_id
                  then jsonb_build_object(
                         'ativo_id', c.causa_id,
                         'placa', (select l.placa from nucleo.leitura_da_placa l where l.ativo_id = c.causa_id))
             end as causa
        from nucleo.situacao_com_causa(p_cavalo_id, nucleo.instante_do_dia(d.dia)) c
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
revoke all on function nucleo.dias_do_conjunto(uuid, date, date) from public;
comment on function nucleo.dias_do_conjunto(uuid, date, date) is
  'Os dias de um conjunto: a situação do cavalo no fim do dia (impedida se um implemento engatado no dia está impedido, com a causa), o grupo, os eventos do dia e as marcas de manual e de correção tardia.';

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

  -- Os conjuntos e a contagem dos chips (a de cada grupo ignora o filtro de grupo).
  select count(*) filter (where v_grupo is null or c.grupo = v_grupo)::integer,
         jsonb_build_object(
           'todos', count(*),
           'em-atividade', count(*) filter (where c.grupo = 'em-atividade'),
           'atencao', count(*) filter (where c.grupo = 'atencao'),
           'impedida', count(*) filter (where c.grupo = 'impedida'),
           'patio', count(*) filter (where c.grupo = 'patio'),
           'fora', count(*) filter (where c.grupo = 'fora'))
    into v_total, v_chips
    from nucleo.conjuntos_da_grade(v_inicio, v_busca, v_tipo) c;
  v_paginas := greatest(ceil(v_total::numeric / v_tam)::integer, 1);
  v_pagina := least(v_pagina, v_paginas);

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
        'dias', nucleo.dias_do_conjunto(c.ativo_id, v_inicio, v_fim),
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
        from nucleo.conjuntos_da_grade(v_inicio, v_busca, v_tipo) c
       where v_grupo is null or c.grupo = v_grupo
       order by c.placa, c.ativo_id
       offset (v_pagina - 1) * v_tam limit v_tam
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

-- As soltas do mês: implemento sem cavalo engatado no mês, apoio e equipamento (que já existiam até o fim do
-- mês e não foram baixados antes dele), pelos filtros, sem o de grupo (para a contagem dos chips).
create function nucleo.soltas_da_grade(p_inicio date, p_busca text, p_tipo_de_cr text)
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
          and c.excluido_em is null and c.periodo && tstzrange(t.de, t.ate, '[)')
     )
     and (p_tipo_de_cr is null or p_tipo_de_cr = any (x.tipos))
     and (t.busca = '' or l.busca like '%' || t.busca || '%' or (t.placa <> '' and l.placa like '%' || t.placa || '%'))
$$;
revoke all on function nucleo.soltas_da_grade(date, text, text) from public;
comment on function nucleo.soltas_da_grade(date, text, text) is
  'As soltas do mês (implemento sem cavalo engatado, apoio e equipamento), pelos filtros, com a RLS de quem consulta.';

-- "X de Y soltas com situação hoje": Y são as soltas ativas no dia (as do mês do dia, não baixadas antes dele e
-- já existentes nele); X são as que têm ao menos um evento de situação da própria placa naquele dia.
create function nucleo.soltas_com_situacao_no_dia(p_dia date)
returns table (x bigint, y bigint)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_inicio timestamptz;
  v_fim timestamptz;
begin
  if p_dia is null or p_dia > nucleo.hoje_em_sao_paulo() then
    raise exception 'A medida é de um dia até hoje. Escolha outro dia.' using errcode = '22023';
  end if;
  v_inicio := p_dia::timestamp at time zone 'America/Sao_Paulo';
  v_fim := (p_dia + 1)::timestamp at time zone 'America/Sao_Paulo';
  return query
  select (count(*) filter (where exists (
            select 1 from nucleo.evento_de_status e
             where e.ativo_id = s.ativo_id and e.excluido_em is null and e.em >= v_inicio and e.em < v_fim
          )))::bigint,
         count(*)::bigint
    from nucleo.soltas_da_grade(date_trunc('month', p_dia)::date, '', null) s
   where (s.baixada_em is null or s.baixada_em >= v_inicio)
     and exists (
       select 1 from nucleo.evento_de_status e
        where e.ativo_id = s.ativo_id and e.excluido_em is null and e.em < v_fim
     );
end;
$$;
revoke all on function nucleo.soltas_com_situacao_no_dia(date) from public;
comment on function nucleo.soltas_com_situacao_no_dia(date) is
  'X de Y soltas com situação no dia (Y: soltas ativas; X: as com evento de situação da própria placa naquele dia), com a RLS de quem consulta.';

-- A grade de soltas. Filtros (jsonb, todos opcionais): busca, tipo_de_cr (frota ou acionista) e grupo.
create function nucleo.grade_de_soltas(
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
  v_busca text := btrim(coalesce(p_filtros->>'busca', ''));
  v_tipo text := nullif(p_filtros->>'tipo_de_cr', '');
  v_grupo text := nullif(p_filtros->>'grupo', '');
  v_tam integer := least(greatest(coalesce(p_tam, 20), 1), 200);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_total integer;
  v_paginas integer;
  v_linhas jsonb;
  v_chips jsonb;
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

  select count(*) filter (where v_grupo is null or s.grupo = v_grupo)::integer,
         jsonb_build_object(
           'todos', count(*),
           'em-atividade', count(*) filter (where s.grupo = 'em-atividade'),
           'atencao', count(*) filter (where s.grupo = 'atencao'),
           'impedida', count(*) filter (where s.grupo = 'impedida'),
           'patio', count(*) filter (where s.grupo = 'patio'),
           'fora', count(*) filter (where s.grupo = 'fora'))
    into v_total, v_chips
    from nucleo.soltas_da_grade(v_inicio, v_busca, v_tipo) s;
  v_paginas := greatest(ceil(v_total::numeric / v_tam)::integer, 1);
  v_pagina := least(v_pagina, v_paginas);

  select coalesce(jsonb_agg(p.linha order by p.placa, p.ativo_id), '[]'::jsonb) into v_linhas
    from (
      select s.placa, s.ativo_id, jsonb_build_object(
        'ativo_id', s.ativo_id, 'placa', s.placa, 'tipo', s.tipo, 'modelo', s.modelo, 'ano', s.ano,
        'operacao', s.operacao, 'sigla_atual', s.sigla, 'grupo_atual', s.grupo,
        'tipos_de_cr', to_jsonb(s.tipos_de_cr),
        'dias', nucleo.dias_do_ativo(s.ativo_id, v_inicio, v_fim)
      ) as linha
        from nucleo.soltas_da_grade(v_inicio, v_busca, v_tipo) s
       where v_grupo is null or s.grupo = v_grupo
       order by s.placa, s.ativo_id
       offset (v_pagina - 1) * v_tam limit v_tam
    ) p;

  select r.x, r.y into v_x, v_y from nucleo.soltas_com_situacao_no_dia(v_hoje) r;

  return jsonb_build_object(
    'mes', v_inicio, 'hoje', v_hoje, 'dias_no_mes', v_fim - v_inicio,
    'linhas', v_linhas, 'total', v_total, 'pagina', v_pagina, 'paginas', v_paginas, 'tam', v_tam,
    'chips', v_chips,
    'situacao_hoje', jsonb_build_object('x', v_x, 'y', v_y)
  );
end;
$$;
revoke all on function nucleo.grade_de_soltas(date, jsonb, integer, integer) from public;
comment on function nucleo.grade_de_soltas(date, jsonb, integer, integer) is
  'A grade da aba Soltas (implemento sem cavalo engatado no mês, apoio e equipamento): uma linha por placa, a contagem dos chips e o X de Y de hoje; paginada no banco (placa, desempate pelo id), com a RLS de quem consulta.';

-- ---------------------------------------------------------------------------------------------
-- O que o app executa
-- ---------------------------------------------------------------------------------------------
drop function nucleo.dias_do_implemento(uuid, uuid, date, date);
delete from config.funcao_executavel where assinatura = 'nucleo.dias_do_implemento(uuid,uuid,date,date)';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.dias_do_conjunto(uuid,date,date)', 'Os dias de um conjunto na grade (situação com a causa do implemento impedido, eventos e marcas), com a RLS de quem consulta.'),
  ('nucleo.soltas_da_grade(date,text,text)', 'As soltas da grade do Acompanhamento, pelos filtros, com a RLS de quem consulta.'),
  ('nucleo.soltas_com_situacao_no_dia(date)', 'X de Y soltas com situação no dia, com a RLS de quem consulta.'),
  ('nucleo.grade_de_soltas(date,jsonb,integer,integer)', 'A grade da aba Soltas do Acompanhamento, com a RLS de quem consulta.');

grant execute on function nucleo.dias_do_conjunto(uuid, date, date) to authenticated;
grant execute on function nucleo.soltas_da_grade(date, text, text) to authenticated;
grant execute on function nucleo.soltas_com_situacao_no_dia(date) to authenticated;
grant execute on function nucleo.grade_de_soltas(date, jsonb, integer, integer) to authenticated;
