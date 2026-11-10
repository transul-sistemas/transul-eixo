-- Resultados › Visão geral: o mês em números (receita, custo, resultado e margem), a série dos 12
-- meses, o resultado por operação, unidade gerencial ou filial com a linha de total, e as naturezas de
-- maior custo. Tudo calculado no banco, numa consulta só (sem subconsulta por linha).
--
-- Definições (docs/glossario.md, "Resultados"):
--  * Receita: o frete da empresa (staging.viagem.frete_empresa) dos CT-e e NFS-e válidos (status
--    vazio ou A; os que sumiram do Sankhya ficam fora), na competência pela data de negociação.
--  * Custo: o valor líquido das despesas (staging.despesa.valor_liquido), sem provisão e sem as
--    invalidadas, na competência gerencial (nucleo.competencia_gerencial). O rateio já vem dividido por
--    CR (uma linha por CR do título).
--  * Resultado = receita − custo. Margem = resultado ÷ receita, em pontos percentuais com uma casa
--    (vazia sem receita).
--  * Provisório: o staging não traz a DTNEG do título, só a competência já calculada pela v1
--    (dt_competencia). Ela entra como base da regra; a regra é idempotente sobre ela (nenhuma despesa
--    muda de mês ao reaplicar). A renegociação (títulos de origem) também não veio: quando a ponte
--    trouxer DTNEG e a origem, só a linha da despesa muda.
--  * Operação, filial (a garagem) e unidade são as do CR do lançamento (nucleo.cr). Lançamento de CR
--    fora do Eixo aparece em "Sem operação" e no aviso sem_cr, e sai quando se filtra filial ou operação.
--  * Permissão: Resultados › ver (administrador e diretoria); os outros perfis são recusados. SECURITY
--    INVOKER: a RLS do staging vale para quem consulta.

create function nucleo.visao_geral_dos_resultados(
  p_mes date default null,
  p_garagem_id uuid default null,
  p_operacao_id uuid default null,
  p_agrupamento text default 'operacao',
  p_top integer default 10
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_agrupamento text := coalesce(nullif(btrim(p_agrupamento), ''), 'operacao');
  v_top integer := least(greatest(coalesce(p_top, 10), 1), 50);
  v_corte integer := nucleo.dia_do_corte_da_competencia();
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_resultado jsonb;
begin
  if not config.pode('resultados', 'ver') then
    raise exception 'Seu perfil não vê Resultados. Peça o acesso a quem administra o sistema.' using errcode = '42501';
  end if;
  if v_agrupamento not in ('operacao', 'unidade', 'filial') then
    raise exception 'Agrupe por operação, unidade ou filial.' using errcode = '22023';
  end if;

  with crs as materialized (
    select distinct on (c.codcencus) c.codcencus::text as codcencus, c.operacao_id, o.nome as operacao,
           c.garagem_id, g.rotulo as garagem, c.unidade_gerencial, u.rotulo as unidade, u.ordem as ordem_da_unidade
      from nucleo.cr c
      left join nucleo.operacao o on o.id = c.operacao_id
      left join config.garagem g on g.id = c.garagem_id
      left join config.unidade_gerencial u on u.codigo = c.unidade_gerencial
     where c.codcencus is not null
     order by c.codcencus, c.excluido_em nulls first, c.criado_em desc
  ),
  -- Todos os lançamentos com a competência, uma vez (receita positiva, custo positivo).
  lancamentos as materialized (
    select nucleo.competencia_gerencial(v.dt_negociacao, null, v_corte) as competencia,
           date_trunc('month', v.dt_negociacao::timestamp)::date as base,
           false as sem_dtentsai,
           v.codcencus, null::text as codnat, v.frete_empresa as receita, 0::numeric as custo
      from staging.viagem v
     where v.sumiu_do_sankhya_em is null
       and coalesce(v.status_cte, 'A') = 'A'
       and v.frete_empresa is not null
       and v.dt_negociacao is not null
    union all
    select nucleo.competencia_gerencial(d.dt_competencia, d.dtentsai, v_corte, null, d.provisao = 'PROVISAO'),
           date_trunc('month', d.dt_competencia::timestamp)::date,
           d.dtentsai is null,
           d.codcencus, d.codnat, 0::numeric, d.valor_liquido
      from staging.despesa d
     where d.invalidado_em is null
       and d.valor_liquido is not null
       and d.dt_competencia is not null
  ),
  meses as (
    select l.competencia as mes, sum(l.receita) as receita
      from lancamentos l
     where l.competencia is not null and l.competencia <= v_hoje
     group by l.competencia
  ),
  alvo as (
    select coalesce(
             date_trunc('month', p_mes::timestamp)::date,
             (select max(m.mes) from meses m where m.receita > 0),
             (select max(m.mes) from meses m),
             date_trunc('month', v_hoje::timestamp)::date
           ) as mes
  ),
  janela as (
    select a.mes, (a.mes - interval '11 months')::date as inicio from alvo a
  ),
  -- Os lançamentos dos 12 meses, no contexto (filial e operação), com o grupo.
  no_contexto as materialized (
    select l.*, c.codcencus is not null as com_cr,
           case v_agrupamento
             when 'operacao' then c.operacao_id::text
             when 'filial' then c.garagem_id::text
             else c.unidade_gerencial
           end as chave,
           case v_agrupamento
             when 'operacao' then coalesce(c.operacao, 'Sem operação')
             when 'filial' then coalesce(c.garagem, 'Sem filial')
             else coalesce(c.unidade, 'Sem unidade')
           end as rotulo,
           case v_agrupamento when 'unidade' then c.ordem_da_unidade else 0 end as ordem
      from lancamentos l
      cross join janela j
      left join crs c on c.codcencus = l.codcencus
     where l.competencia between j.inicio and j.mes
       and (p_garagem_id is null or c.garagem_id = p_garagem_id)
       and (p_operacao_id is null or c.operacao_id = p_operacao_id)
  ),
  do_mes as materialized (
    select n.* from no_contexto n, janela j where n.competencia = j.mes
  ),
  total as (
    select coalesce(sum(m.receita), 0) as receita, coalesce(sum(m.custo), 0) as custo from do_mes m
  ),
  grupos as (
    select m.chave, m.rotulo, m.ordem, sum(m.receita) as receita, sum(m.custo) as custo
      from do_mes m
     group by m.chave, m.rotulo, m.ordem
  ),
  por_natureza as (
    select m.codnat, coalesce(nat.descricao, 'Natureza ' || m.codnat, 'Sem natureza') as descricao,
           sum(m.custo) as valor,
           row_number() over (order by sum(m.custo) desc, m.codnat nulls last) as n
      from do_mes m
      left join staging.natureza nat on nat.codnat = m.codnat
     where m.custo <> 0
     group by m.codnat, nat.descricao
  ),
  serie as (
    select s.mes::date as mes,
           coalesce(sum(n.receita), 0) as receita,
           coalesce(sum(n.custo), 0) as custo
      from janela j
     cross join generate_series(j.inicio, j.mes, interval '1 month') s (mes)
      left join no_contexto n on n.competencia = s.mes::date
     group by s.mes
  )
  select jsonb_build_object(
    'mes', (select j.mes from janela j),
    'agrupamento', v_agrupamento,
    'dia_do_corte', v_corte,
    'meses', (select coalesce(jsonb_agg(m.mes order by m.mes desc), '[]'::jsonb) from meses m),
    'kpis', (
      select jsonb_build_object(
        'receita', t.receita,
        'custo', t.custo,
        'resultado', t.receita - t.custo,
        'margem', round(100.0 * (t.receita - t.custo) / nullif(t.receita, 0), 1),
        'mudaram_de_mes', (select jsonb_build_object('lancamentos', count(*), 'valor', coalesce(sum(m.custo + m.receita), 0))
                             from do_mes m where m.competencia <> m.base),
        'sem_dtentsai', (select jsonb_build_object('lancamentos', count(*), 'valor', coalesce(sum(m.custo), 0))
                           from do_mes m where m.sem_dtentsai and m.custo <> 0),
        'sem_cr', (select jsonb_build_object('lancamentos', count(*), 'valor', coalesce(sum(m.custo + m.receita), 0))
                     from do_mes m where not m.com_cr)
      )
        from total t
    ),
    'serie', (
      select jsonb_agg(jsonb_build_object(
               'mes', s.mes, 'receita', s.receita, 'custo', s.custo, 'resultado', s.receita - s.custo,
               'margem', round(100.0 * (s.receita - s.custo) / nullif(s.receita, 0), 1)
             ) order by s.mes)
        from serie s
    ),
    'grupos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'chave', g.chave, 'rotulo', g.rotulo, 'receita', g.receita, 'custo', g.custo,
               'resultado', g.receita - g.custo,
               'margem', round(100.0 * (g.receita - g.custo) / nullif(g.receita, 0), 1)
             ) order by g.chave is null, g.ordem, g.rotulo, g.chave), '[]'::jsonb)
        from grupos g
    ),
    'total', (
      select jsonb_build_object(
        'receita', t.receita, 'custo', t.custo, 'resultado', t.receita - t.custo,
        'margem', round(100.0 * (t.receita - t.custo) / nullif(t.receita, 0), 1))
        from total t
    ),
    'naturezas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'codnat', p.codnat, 'descricao', p.descricao, 'valor', p.valor,
               'participacao', round(100.0 * p.valor / nullif(t.custo, 0), 1)
             ) order by p.n), '[]'::jsonb)
        from por_natureza p, total t
       where p.n <= v_top
    ),
    'outras', (
      select jsonb_build_object(
        'naturezas', count(p.codnat),
        'valor', coalesce(sum(p.valor), 0),
        'participacao', round(100.0 * coalesce(sum(p.valor), 0) / nullif(max(t.custo), 0), 1))
        from total t
        left join por_natureza p on p.n > v_top
    ),
    'opcoes', jsonb_build_object(
      'filiais', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.rotulo) order by g.rotulo), '[]'::jsonb)
                    from config.garagem g),
      'operacoes', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'nome', o.nome) order by o.nome, o.id), '[]'::jsonb)
                      from nucleo.operacao o where o.excluido_em is null)
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;
revoke all on function nucleo.visao_geral_dos_resultados(date, uuid, uuid, text, integer) from public;
comment on function nucleo.visao_geral_dos_resultados(date, uuid, uuid, text, integer) is
  'Resultados › Visão geral: receita, custo, resultado e margem do mês (competência gerencial), a série de 12 meses, por operação/unidade/filial com o total, e as naturezas de maior custo. Só para quem vê Resultados; lê o staging provisório pela RLS de quem chama.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.visao_geral_dos_resultados(date,uuid,uuid,text,integer)',
   'Resultados › Visão geral: os totais do mês, a série e os agrupamentos, calculados no banco com a RLS de quem consulta.');

grant execute on function nucleo.visao_geral_dos_resultados(date, uuid, uuid, text, integer) to authenticated;
