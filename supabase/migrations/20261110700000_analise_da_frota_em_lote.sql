-- Frota › Análise: a situação do fim de cada dia em lote (correção de desempenho).
-- A primeira versão chamava nucleo.situacao_no_dia por placa-dia, e cada consulta de estado e de
-- composição dentro dela passava pela RLS (config.ve_ativo por linha): 928 placas × 9 dias levavam
-- 26 s como usuário logado, acima do limite de 8 s do Supabase. Agora:
--  * nucleo.situacao_no_fim_dos_dias calcula a situação de várias placas e dias numa consulta só, com a
--    mesma regra de nucleo.situacao_com_causa (camadas por prioridade; o implemento engatado herda a
--    atividade do cavalo; impedimento do cavalo ou de outro implemento deixa o conjunto impedido). Não é
--    executável por authenticated: não filtra a visibilidade.
--  * nucleo.situacao_dos_dias_visiveis é a porta de entrada: SECURITY DEFINER, filtra as placas pedidas
--    uma vez por config.ve_ativo (a mesma regra das políticas de estado_de_status e composicao) e chama a
--    de cima, sem a RLS por linha.
--  * nucleo.analise_da_frota continua SECURITY INVOKER (o universo é o que a RLS de quem consulta deixa
--    ver em nucleo.leitura_da_placa), com os mesmos argumentos e o mesmo JSON de saída.

create function nucleo.situacao_no_fim_dos_dias(p_ativos uuid[], p_inicio date, p_ate date)
returns table (ativo_id uuid, dia date, sigla text)
language sql
stable
set search_path = ''
as $$
  -- Tudo em conjuntos (junções por igualdade de id e filtro de intervalo), sem subconsulta por linha:
  -- os estados e as composições da janela são lidos uma vez.
  with pedidos as materialized (
    select a.id as ativo_id, a.tipo, d.dia::date as dia, nucleo.instante_do_dia(d.dia::date) as em
      from nucleo.ativo a
     cross join generate_series(p_inicio, least(p_ate, nucleo.hoje_em_sao_paulo()), interval '1 day') d (dia)
     where a.id = any (p_ativos)
  ),
  janela as (
    select tstzrange(min(p.em), max(p.em), '[]') as faixa from pedidos p
  ),
  comp as materialized (
    select c.cavalo_id, c.implemento_id, c.posicao, c.periodo
      from nucleo.composicao c, janela j
     where c.excluido_em is null and c.periodo && j.faixa
  ),
  est as materialized (
    select e.ativo_id, e.camada, e.sigla, e.periodo
      from nucleo.estado_de_status e, janela j
     where e.excluido_em is null and e.periodo && j.faixa
  ),
  -- O cavalo do implemento engatado, e o mestre do conjunto em que o ativo está.
  contexto as materialized (
    select p.ativo_id, p.dia, p.em, cv.cavalo_id,
           coalesce(cv.cavalo_id, case when p.tipo = 'cavalo' and exists (
             select 1 from comp c where c.cavalo_id = p.ativo_id and c.periodo @> p.em
           ) then p.ativo_id end) as mestre
      from pedidos p
      left join comp cv on cv.implemento_id = p.ativo_id and cv.periodo @> p.em
  ),
  -- Os membros do conjunto (o mestre primeiro, depois os implementos pela posição), menos o próprio.
  membros as (
    select x.ativo_id, x.dia, x.em, x.mestre as membro, 0 as ordem
      from contexto x where x.mestre is not null
    union all
    select x.ativo_id, x.dia, x.em, c.implemento_id, c.posicao
      from contexto x join comp c on c.cavalo_id = x.mestre and c.periodo @> x.em
     where x.mestre is not null
  ),
  impedida_do_conjunto as (
    select distinct on (m.ativo_id, m.dia) m.ativo_id, m.dia, e.sigla
      from membros m
      join est e on e.ativo_id = m.membro and e.camada = 'impedida' and e.periodo @> m.em
     where m.membro <> m.ativo_id
     order by m.ativo_id, m.dia, m.ordem
  ),
  -- Candidatas por camada: a própria (menos a atividade do implemento engatado, que é a do cavalo), a
  -- atividade herdada do cavalo e, na camada impedida, a do conjunto depois da própria.
  candidatas as (
    select x.ativo_id, x.dia, e.camada, 0 as desempate, e.sigla
      from contexto x
      join est e on e.ativo_id = x.ativo_id and e.periodo @> x.em
     where not (e.camada = 'atividade' and x.cavalo_id is not null)
    union all
    select x.ativo_id, x.dia, 'atividade', 0, e.sigla
      from contexto x
      join est e on e.ativo_id = x.cavalo_id and e.camada = 'atividade' and e.periodo @> x.em
    union all
    select i.ativo_id, i.dia, 'impedida', 1, i.sigla from impedida_do_conjunto i
  ),
  escolhida as (
    select distinct on (c.ativo_id, c.dia) c.ativo_id, c.dia, c.sigla
      from candidatas c
      join config.camada_de_status cam on cam.codigo = c.camada
     order by c.ativo_id, c.dia, cam.prioridade, c.desempate
  )
  select p.ativo_id, p.dia, e.sigla
    from pedidos p
    left join escolhida e on e.ativo_id = p.ativo_id and e.dia = p.dia
$$;
revoke all on function nucleo.situacao_no_fim_dos_dias(uuid[], date, date) from public;
comment on function nucleo.situacao_no_fim_dos_dias(uuid[], date, date) is
  'A situação no fim de cada dia (ou agora, se o dia é hoje) de várias placas, numa consulta só; a mesma regra de nucleo.situacao_no_dia (sigla nula = pendente). Sem filtro de visibilidade: só para as funções do banco.';

create function nucleo.situacao_dos_dias_visiveis(p_ativos uuid[], p_inicio date, p_ate date)
returns table (ativo_id uuid, dia date, sigla text)
language plpgsql
stable
security definer -- justificativa: a RLS avaliava config.ve_ativo em cada linha de estado e de composição (26 s no mês); aqui a visibilidade é conferida uma vez por placa pedida, com config.ve_ativo do auth.uid() (a mesma regra das políticas), e só essas placas são calculadas; search_path vazio.
set search_path = ''
as $$
begin
  if p_inicio is null or p_ate is null or p_ate < p_inicio or p_ate - p_inicio > 366 then
    raise exception 'Escolha um período de até um ano.' using errcode = '22023';
  end if;
  return query
    select s.ativo_id, s.dia, s.sigla
      from nucleo.situacao_no_fim_dos_dias(
             array(select distinct a from unnest(p_ativos) a
                    where config.ve_ativo(a, array['frota', 'operacional'], 'ver')),
             p_inicio, p_ate) s;
end;
$$;
revoke all on function nucleo.situacao_dos_dias_visiveis(uuid[], date, date) from public;
comment on function nucleo.situacao_dos_dias_visiveis(uuid[], date, date) is
  'A situação no fim de cada dia das placas pedidas que quem consulta vê (config.ve_ativo), em lote; a mesma regra de nucleo.situacao_no_dia.';

create or replace function nucleo.analise_da_frota(
  p_mes date, p_filial text default null, p_operacao_id uuid default null, p_agrupamento text default 'operacao'
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_inicio date;
  v_ate date;
  v_resultado jsonb;
begin
  if p_mes is null then
    raise exception 'Escolha o mês da análise.' using errcode = '22023';
  end if;
  v_inicio := date_trunc('month', p_mes)::date;
  if v_inicio > v_hoje then
    raise exception 'O mês da análise ainda não começou. Escolha um mês até o atual.' using errcode = '22023';
  end if;
  if p_agrupamento is null or p_agrupamento not in ('operacao', 'filial', 'gestor') then
    raise exception 'Agrupe por operação, filial ou gestor.' using errcode = '22023';
  end if;
  v_ate := least((date_trunc('month', p_mes) + interval '1 month - 1 day')::date, v_hoje);

  with universo as materialized (
    select l.ativo_id, l.placa, l.tipo, l.operacao, l.filial, l.grupo, l.sigla, l.inicio_do_pat,
           l.baixada_em is null as ativa,
           case p_agrupamento
             when 'operacao' then l.operacao_id::text
             when 'filial' then l.filial
             else l.gestor_id::text
           end as chave,
           case p_agrupamento
             when 'operacao' then coalesce(l.operacao, 'Sem operação')
             when 'filial' then coalesce(l.filial, 'Sem filial')
             else coalesce(l.gestor, 'Sem gestor')
           end as rotulo
      from nucleo.leitura_da_placa l
     where (l.baixada_em is null or l.baixada_em >= v_inicio::timestamp at time zone 'America/Sao_Paulo')
       and (p_filial is null or l.filial = p_filial)
       and (p_operacao_id is null or l.operacao_id = p_operacao_id)
  ),
  agora as (
    select * from universo u where u.ativa
  ),
  dias as (
    select generate_series(v_inicio, v_ate, interval '1 day')::date as dia
  ),
  situacoes as materialized (
    select s.ativo_id, s.dia, s.sigla
      from nucleo.situacao_dos_dias_visiveis((select array_agg(u.ativo_id) from universo u), v_inicio, v_ate) s
  ),
  placa_dia as materialized (
    select u.ativo_id, u.chave, si.dia, st.chip
      from universo u
      join situacoes si on si.ativo_id = u.ativo_id
      join config.status st on st.sigla = si.sigla
  ),
  serie as (
    select d.dia,
           count(p.ativo_id) filter (where p.chip <> 'fora') as na_frota,
           count(p.ativo_id) filter (where p.chip = 'em-atividade') as em_atividade,
           count(p.ativo_id) filter (where p.chip = 'atencao') as atencao,
           count(p.ativo_id) filter (where p.chip = 'impedida') as impedida,
           count(p.ativo_id) filter (where p.chip = 'patio') as patio,
           count(p.ativo_id) filter (where p.chip = 'fora') as fora
      from dias d
      left join placa_dia p on p.dia = d.dia
     group by d.dia
  ),
  por_grupo_no_mes as (
    select p.chave,
           count(*) filter (where p.chip <> 'fora') as placa_dias,
           count(*) filter (where p.chip = 'em-atividade') as em_atividade
      from placa_dia p
     group by p.chave
  ),
  grupos as (
    select u.chave, u.rotulo,
           count(*) filter (where u.ativa) as total,
           count(*) filter (where u.ativa and u.grupo = 'em-atividade') as em_atividade,
           count(*) filter (where u.ativa and u.grupo = 'impedida') as impedida,
           count(*) filter (where u.ativa and u.grupo = 'patio') as patio,
           count(*) filter (where u.ativa and nucleo.alerta_parado_em_patio(u.inicio_do_pat, now())) as parados_no_pat
      from universo u
     group by u.chave, u.rotulo
  )
  select jsonb_build_object(
    'mes', v_inicio,
    'ate', v_ate,
    'agrupamento', p_agrupamento,
    'retrato', (
      select jsonb_build_object(
        'total', count(*),
        'em_atividade', count(*) filter (where a.grupo = 'em-atividade'),
        'atencao', count(*) filter (where a.grupo = 'atencao'),
        'impedida', count(*) filter (where a.grupo = 'impedida'),
        'patio', count(*) filter (where a.grupo = 'patio'),
        'fora', count(*) filter (where a.grupo = 'fora'),
        'pendente', count(*) filter (where a.grupo is null),
        'parados_no_pat', count(*) filter (where nucleo.alerta_parado_em_patio(a.inicio_do_pat, now())),
        'dias_medio_no_pat', round(avg(extract(epoch from now() - a.inicio_do_pat) / 86400.0)
                                     filter (where a.sigla = 'PÁT' and a.inicio_do_pat is not null), 1)
      )
        from agora a
    ),
    'tipos', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', t.tipo, 'total', t.total, 'em_atividade', t.em_atividade)
                                order by t.ordem), '[]'::jsonb)
        from (
          select a.tipo, count(*) as total, count(*) filter (where a.grupo = 'em-atividade') as em_atividade,
                 array_position(array['cavalo', 'implemento', 'caminhao', 'equipamento', 'apoio'], a.tipo) as ordem
            from agora a
           group by a.tipo
        ) t
    ),
    'mais_tempo_no_pat', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'ativo_id', m.ativo_id, 'placa', m.placa, 'tipo', m.tipo, 'operacao', m.operacao,
               'filial', m.filial, 'desde', m.inicio_do_pat,
               'dias', floor(extract(epoch from now() - m.inicio_do_pat) / 86400.0)::int
             ) order by m.inicio_do_pat, m.placa, m.ativo_id), '[]'::jsonb)
        from (
          select a.* from agora a
           where a.sigla = 'PÁT' and a.inicio_do_pat is not null
           order by a.inicio_do_pat, a.placa, a.ativo_id
           limit 10
        ) m
    ),
    'dias', (
      select jsonb_agg(jsonb_build_object(
               'dia', s.dia, 'na_frota', s.na_frota, 'em_atividade', s.em_atividade, 'atencao', s.atencao,
               'impedida', s.impedida, 'patio', s.patio, 'fora', s.fora,
               'disponibilidade', round(100.0 * s.em_atividade / nullif(s.na_frota, 0), 1)
             ) order by s.dia)
        from serie s
    ),
    'placa_dias', (select coalesce(sum(s.na_frota), 0) from serie s),
    'disponibilidade', (
      select round(100.0 * sum(s.em_atividade) / nullif(sum(s.na_frota), 0), 1) from serie s
    ),
    'grupos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'chave', g.chave, 'rotulo', g.rotulo, 'total', g.total, 'em_atividade', g.em_atividade,
               'impedida', g.impedida, 'patio', g.patio, 'parados_no_pat', g.parados_no_pat,
               'placa_dias', coalesce(m.placa_dias, 0),
               'disponibilidade', round(100.0 * m.em_atividade / nullif(m.placa_dias, 0), 1)
             ) order by g.rotulo, g.chave), '[]'::jsonb)
        from grupos g
        left join por_grupo_no_mes m on m.chave is not distinct from g.chave
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.situacao_dos_dias_visiveis(uuid[],date,date)', 'A situação no fim de cada dia, em lote, das placas que quem consulta vê (a Análise da Frota).');

grant execute on function nucleo.situacao_dos_dias_visiveis(uuid[], date, date) to authenticated;
