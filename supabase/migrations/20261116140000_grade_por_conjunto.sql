-- Frota › Acompanhamento v2, fatia A1: a grade por conjunto e a medida "X de Y conjuntos com lançamento hoje".
--
--  * A linha da grade passa a ser o conjunto: o cavalo que teve implemento engatado no mês, com os
--    implementos recuados embaixo. A situação do cavalo vale para o conjunto: o implemento engatado herda a
--    sigla do cavalo (a herança é calculada por nucleo.situacao_no_dia, nunca gravada). A célula de um dia
--    vale pelo fim do dia (hoje, agora): engatar de manhã põe o implemento no conjunto naquele dia;
--    desatrelar à tarde o tira naquele mesmo dia.
--  * O selo por célula conta os eventos do dia do cavalo (a herança dispensa contar os do implemento) e
--    marca se algum foi manual e se algum foi lançado depois do dia (correção tardia).
--  * "Fora de conjunto" lista, em página própria, o que não esteve em conjunto no mês: cavalo sem
--    implemento, caminhão, apoio, equipamento e implemento solto.
--  * Os totais (total de conjuntos, contagem dos chips, X e Y) saem prontos do banco.
--  * Sem motorista nesta fatia (A6). Nenhuma função aqui é SECURITY DEFINER: vale a RLS de quem chama.
-- Nenhuma tabela nova.

-- Os eventos de um ativo no dia (consulta quente da grade).
create index evento_de_status_ativo_em_idx on nucleo.evento_de_status (ativo_id, em) where excluido_em is null;

-- O CR do ativo no instante, só os tipos que a grade mostra: Frota (de ativo ou sem placa) e Acionista.
create function nucleo.tipos_de_cr_do_ativo(p_ativo_id uuid, p_em timestamptz)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(distinct case c.tipo when 'acionista' then 'acionista' else 'frota' end
                            order by case c.tipo when 'acionista' then 'acionista' else 'frota' end), '{}')
    from nucleo.cr_do_ativo v
    join nucleo.cr c on c.id = v.cr_id
   where v.ativo_id = p_ativo_id and v.excluido_em is null and v.periodo @> p_em
     and c.tipo in ('frota_de_ativo', 'frota_sem_placa', 'acionista')
$$;
revoke all on function nucleo.tipos_de_cr_do_ativo(uuid, timestamptz) from public;
comment on function nucleo.tipos_de_cr_do_ativo(uuid, timestamptz) is
  'Os tipos de CR (frota, acionista) vigentes do ativo no instante; a placa pode ter os dois ao mesmo tempo (regra de 06/11/2026).';

-- Os dias de um ativo no intervalo [p_inicio, p_fim): a situação no fim do dia, o grupo, quantos eventos
-- o dia teve, se algum foi manual e se algum foi lançado depois do dia (correção tardia).
create function nucleo.dias_do_ativo(p_ativo_id uuid, p_inicio date, p_fim date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'dia', d.dia, 'sigla', s.sigla, 'grupo', st.chip,
           'eventos', ev.n, 'manual', ev.manual, 'tardia', ev.tardia) order by d.dia), '[]'::jsonb)
    from (select g::date as dia from generate_series(p_inicio, p_fim - 1, interval '1 day') g) d
    cross join lateral (select nucleo.situacao_no_dia(p_ativo_id, d.dia) as sigla) s
    left join config.status st on st.sigla = s.sigla
    cross join lateral (
      select count(*) as n,
             coalesce(bool_or(e.origem = 'manual'), false) as manual,
             coalesce(bool_or((e.registrado_em at time zone 'America/Sao_Paulo')::date > d.dia), false) as tardia
        from nucleo.evento_de_status e
       where e.ativo_id = p_ativo_id and e.excluido_em is null
         and e.em >= d.dia::timestamp at time zone 'America/Sao_Paulo'
         and e.em < (d.dia + 1)::timestamp at time zone 'America/Sao_Paulo'
    ) ev
$$;
revoke all on function nucleo.dias_do_ativo(uuid, date, date) from public;
comment on function nucleo.dias_do_ativo(uuid, date, date) is
  'Os dias de um ativo: situação no fim do dia, grupo, eventos do dia e as marcas de manual e de correção tardia.';

-- Os dias de um implemento sob um cavalo: só os dias em que estava engatado nele (fim do dia); a sigla é a
-- que o implemento tem no conjunto (a atividade herdada do cavalo).
create function nucleo.dias_do_implemento(p_implemento_id uuid, p_cavalo_id uuid, p_inicio date, p_fim date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'dia', d.dia, 'engatado', e.engatado, 'sigla', s.sigla, 'grupo', st.chip) order by d.dia), '[]'::jsonb)
    from (select g::date as dia from generate_series(p_inicio, p_fim - 1, interval '1 day') g) d
    cross join lateral (
      select exists (
        select 1 from nucleo.composicao c
         where c.implemento_id = p_implemento_id and c.cavalo_id = p_cavalo_id and c.excluido_em is null
           and c.periodo @> nucleo.instante_do_dia(d.dia)
      ) as engatado
    ) e
    cross join lateral (
      select case when e.engatado then nucleo.situacao_no_dia(p_implemento_id, d.dia) end as sigla
    ) s
    left join config.status st on st.sigla = s.sigla
$$;
revoke all on function nucleo.dias_do_implemento(uuid, uuid, date, date) from public;
comment on function nucleo.dias_do_implemento(uuid, uuid, date, date) is
  'Os dias de um implemento sob um cavalo: engatado (pelo fim do dia) e a sigla herdada do cavalo; fora do conjunto, sem sigla.';

-- Os conjuntos da grade do mês: cavalos (sem baixa antes do mês) que tiveram composição no mês, pelos
-- filtros de busca (placa do cavalo ou de um implemento) e de tipo de CR; sem o filtro de grupo, para a
-- contagem dos chips. Com a RLS de quem consulta.
create function nucleo.conjuntos_da_grade(p_inicio date, p_busca text, p_tipo_de_cr text)
returns table (
  ativo_id uuid, placa text, modelo text, ano integer, operacao text, sigla text, grupo text, tipos_de_cr text[]
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
  select l.ativo_id, l.placa, l.modelo, l.ano, l.operacao, l.sigla, l.grupo, x.tipos
    from nucleo.leitura_da_placa l
    cross join t
    cross join lateral (select nucleo.tipos_de_cr_do_ativo(l.ativo_id, t.ref) as tipos) x
   where l.tipo = 'cavalo'
     and (l.baixada_em is null or l.baixada_em >= t.de)
     and exists (
       select 1 from nucleo.composicao c
        where c.cavalo_id = l.ativo_id and c.excluido_em is null and c.periodo && tstzrange(t.de, t.ate, '[)')
     )
     and (p_tipo_de_cr is null or p_tipo_de_cr = any (x.tipos))
     and (t.busca = ''
          or l.busca like '%' || t.busca || '%'
          or (t.placa <> '' and l.placa like '%' || t.placa || '%')
          or exists (
            select 1 from nucleo.composicao c
              join nucleo.leitura_da_placa i on i.ativo_id = c.implemento_id
             where c.cavalo_id = l.ativo_id and c.excluido_em is null and c.periodo && tstzrange(t.de, t.ate, '[)')
               and (i.busca like '%' || t.busca || '%' or (t.placa <> '' and i.placa like '%' || t.placa || '%'))
          ))
$$;
revoke all on function nucleo.conjuntos_da_grade(date, text, text) from public;
comment on function nucleo.conjuntos_da_grade(date, text, text) is
  'Os conjuntos (cavalos com composição no mês) da grade do Acompanhamento, pelos filtros, com a RLS de quem consulta.';

-- "X de Y conjuntos com lançamento": Y são os conjuntos ativos no dia (cavalo não baixado antes do dia, com
-- composição vigente em algum momento dele); X são os que têm ao menos um evento de situação do cavalo com a
-- hora naquele dia, de qualquer origem. Definição em docs/glossario.md.
create function nucleo.conjuntos_com_lancamento_no_dia(p_dia date)
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
             where e.ativo_id = a.ativo_id and e.excluido_em is null and e.em >= v_inicio and e.em < v_fim
          )))::bigint,
         count(*)::bigint
    from nucleo.leitura_da_placa a
   where a.tipo = 'cavalo'
     and (a.baixada_em is null or a.baixada_em >= v_inicio)
     and exists (
       select 1 from nucleo.composicao c
        where c.cavalo_id = a.ativo_id and c.excluido_em is null and c.periodo && tstzrange(v_inicio, v_fim, '[)')
     );
end;
$$;
revoke all on function nucleo.conjuntos_com_lancamento_no_dia(date) from public;
comment on function nucleo.conjuntos_com_lancamento_no_dia(date) is
  'X de Y conjuntos com lançamento no dia (Y: conjuntos ativos; X: os com evento de situação do cavalo naquele dia), com a RLS de quem consulta.';

-- A grade por conjunto. Filtros (jsonb, todos opcionais): busca, tipo_de_cr (frota ou acionista), grupo (um
-- dos cinco chips) e fora_pagina (página da seção "fora de conjunto").
create function nucleo.grade_por_conjunto(
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
  v_fora_pagina integer := greatest(coalesce(nullif(p_filtros->>'fora_pagina', '')::integer, 1), 1);
  v_total integer;
  v_paginas integer;
  v_fora_total integer;
  v_fora_paginas integer;
  v_linhas jsonb;
  v_fora jsonb;
  v_chips jsonb;
  v_x bigint;
  v_y bigint;
  v_placa text := upper(regexp_replace(v_busca, '[^A-Za-z0-9]', '', 'g'));
  v_texto text := replace(replace(replace(nucleo.texto_simples(v_busca), '\', '\\'), '%', '\%'), '_', '\_');
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
        'nome_do_conjunto', nucleo.nome_do_conjunto(c.ativo_id, nucleo.instante_do_dia(least(v_fim - 1, v_hoje))),
        'dias', nucleo.dias_do_ativo(c.ativo_id, v_inicio, v_fim),
        'implementos', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'ativo_id', i.implemento_id, 'placa', li.placa, 'modelo', li.modelo, 'funcao', a.funcao,
                   'posicao', i.posicao, 'dias', nucleo.dias_do_implemento(i.implemento_id, c.ativo_id, v_inicio, v_fim)
                 ) order by i.posicao, li.placa), '[]'::jsonb)
            from (
              select m.implemento_id, min(m.posicao) as posicao
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

  -- Fora de conjunto: o que não esteve em conjunto no mês (cavalo ou implemento sem composição no mês).
  select count(*)::integer into v_fora_total
    from nucleo.leitura_da_placa l
   where (l.baixada_em is null or l.baixada_em >= v_de)
     and not exists (
       select 1 from nucleo.composicao c
        where (c.cavalo_id = l.ativo_id or c.implemento_id = l.ativo_id)
          and c.excluido_em is null and c.periodo && tstzrange(v_de, v_ate, '[)')
     )
     and (v_tipo is null or v_tipo = any (nucleo.tipos_de_cr_do_ativo(l.ativo_id, nucleo.instante_do_dia(least(v_fim - 1, v_hoje)))))
     and (v_busca = '' or l.busca like '%' || v_texto || '%' or (v_placa <> '' and l.placa like '%' || v_placa || '%'));
  v_fora_paginas := greatest(ceil(v_fora_total::numeric / v_tam)::integer, 1);
  v_fora_pagina := least(v_fora_pagina, v_fora_paginas);

  select coalesce(jsonb_agg(p.linha order by p.placa, p.ativo_id), '[]'::jsonb) into v_fora
    from (
      select l.placa, l.ativo_id, jsonb_build_object(
        'ativo_id', l.ativo_id, 'placa', l.placa, 'tipo', l.tipo, 'modelo', l.modelo, 'ano', l.ano,
        'operacao', l.operacao, 'sigla_atual', l.sigla, 'grupo_atual', l.grupo,
        'tipos_de_cr', to_jsonb(nucleo.tipos_de_cr_do_ativo(l.ativo_id, nucleo.instante_do_dia(least(v_fim - 1, v_hoje)))),
        'dias', nucleo.dias_do_ativo(l.ativo_id, v_inicio, v_fim)
      ) as linha
        from nucleo.leitura_da_placa l
       where (l.baixada_em is null or l.baixada_em >= v_de)
         and not exists (
           select 1 from nucleo.composicao c
            where (c.cavalo_id = l.ativo_id or c.implemento_id = l.ativo_id)
              and c.excluido_em is null and c.periodo && tstzrange(v_de, v_ate, '[)')
         )
         and (v_tipo is null or v_tipo = any (nucleo.tipos_de_cr_do_ativo(l.ativo_id, nucleo.instante_do_dia(least(v_fim - 1, v_hoje)))))
         and (v_busca = '' or l.busca like '%' || v_texto || '%' or (v_placa <> '' and l.placa like '%' || v_placa || '%'))
       order by l.placa, l.ativo_id
       offset (v_fora_pagina - 1) * v_tam limit v_tam
    ) p;

  select r.x, r.y into v_x, v_y from nucleo.conjuntos_com_lancamento_no_dia(v_hoje) r;

  return jsonb_build_object(
    'mes', v_inicio, 'hoje', v_hoje, 'dias_no_mes', v_fim - v_inicio,
    'linhas', v_linhas, 'total', v_total, 'pagina', v_pagina, 'paginas', v_paginas, 'tam', v_tam,
    'chips', v_chips,
    'lancamento_hoje', jsonb_build_object('x', v_x, 'y', v_y),
    'fora', jsonb_build_object('linhas', v_fora, 'total', v_fora_total, 'pagina', v_fora_pagina, 'paginas', v_fora_paginas)
  );
end;
$$;
revoke all on function nucleo.grade_por_conjunto(date, jsonb, integer, integer) from public;
comment on function nucleo.grade_por_conjunto(date, jsonb, integer, integer) is
  'A grade do Acompanhamento por conjunto: uma linha por cavalo com composição no mês (implementos recuados, herdando a situação do cavalo), a seção fora de conjunto, a contagem dos chips e o X de Y de hoje; paginada no banco (placa, desempate pelo id), com a RLS de quem consulta.';

-- ---------------------------------------------------------------------------------------------
-- O que o app executa (a lista de exceções, com o porquê de cada uma)
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.tipos_de_cr_do_ativo(uuid,timestamp with time zone)', 'Os tipos de CR (frota, acionista) vigentes do ativo; a grade por conjunto, com a RLS de quem consulta.'),
  ('nucleo.dias_do_ativo(uuid,date,date)', 'Os dias de um ativo na grade (situação, eventos e marcas), com a RLS de quem consulta.'),
  ('nucleo.dias_do_implemento(uuid,uuid,date,date)', 'Os dias de um implemento sob o cavalo na grade por conjunto, com a RLS de quem consulta.'),
  ('nucleo.conjuntos_da_grade(date,text,text)', 'Os conjuntos da grade do Acompanhamento, pelos filtros, com a RLS de quem consulta.'),
  ('nucleo.conjuntos_com_lancamento_no_dia(date)', 'X de Y conjuntos com lançamento no dia, com a RLS de quem consulta.'),
  ('nucleo.grade_por_conjunto(date,jsonb,integer,integer)', 'A grade do Acompanhamento por conjunto, com a RLS de quem consulta.');

grant execute on function nucleo.tipos_de_cr_do_ativo(uuid, timestamptz) to authenticated;
grant execute on function nucleo.dias_do_ativo(uuid, date, date) to authenticated;
grant execute on function nucleo.dias_do_implemento(uuid, uuid, date, date) to authenticated;
grant execute on function nucleo.conjuntos_da_grade(date, text, text) to authenticated;
grant execute on function nucleo.conjuntos_com_lancamento_no_dia(date) to authenticated;
grant execute on function nucleo.grade_por_conjunto(date, jsonb, integer, integer) to authenticated;
