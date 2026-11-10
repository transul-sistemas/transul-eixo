-- Operações pela competência gerencial (regra 4: cada métrica tem uma definição só).
--
--  * A lista e a ficha da operação deixam de filtrar a despesa pela dt_competencia que veio da v1 e
--    passam a usar nucleo.competencia_gerencial (DTENTSAI a partir do dia corte + 1 do mês seguinte leva
--    a despesa ao mês do DTENTSAI), com o valor líquido, como a Visão geral dos Resultados e o glossário
--    ("Resultados": custo = valor líquido das despesas, sem provisão e sem as invalidadas).
--  * A despesa do mês pela competência fica numa função só (nucleo.despesa_na_competencia), lida pela
--    cascata e pelo custo por natureza da ficha.
--  * A Visão geral passa a pôr cada lançamento na operação pela mesma regra das Operações
--    (nucleo.cr_da_operacao_no_mes: a montagem do Eixo no mês da competência vence o rótulo do Sankhya).
--    Assim a ficha e a Visão geral dão o mesmo total para a mesma operação e mês.
--  * A receita continua pela data de negociação no mês, que é a competência gerencial da receita (sem
--    DTENTSAI a regra devolve o mês da DTNEG); o filtro por faixa usa o índice da data.

-- ---------------------------------------------------------------------------------------------
-- A despesa de cada CR no mês, pela competência gerencial (uma definição só)
-- ---------------------------------------------------------------------------------------------
create function nucleo.despesa_na_competencia(p_mes date)
returns table (codcencus text, codnat text, valor numeric)
language sql
stable
set search_path = ''
as $$
  select d.codcencus::text, d.codnat::text, sum(d.valor_liquido)
    from staging.despesa d
   where d.invalidado_em is null
     and d.valor_liquido is not null
     and d.dt_competencia is not null
     -- A competência nunca é antes do mês da base: corta pelo índice antes da regra.
     and d.dt_competencia < (p_mes + interval '1 month')::date
     and nucleo.competencia_gerencial(d.dt_competencia, d.dtentsai, (select nucleo.dia_do_corte_da_competencia()),
                                      null, d.provisao = 'PROVISAO') = date_trunc('month', p_mes::timestamp)::date
   group by d.codcencus, d.codnat
$$;
revoke all on function nucleo.despesa_na_competencia(date) from public, anon;
comment on function nucleo.despesa_na_competencia(date) is
  'A despesa de cada CR e natureza no mês pela competência gerencial (valor líquido, sem provisão nem invalidada). Fonte única do custo das Operações. Lê o staging pela RLS de quem chama.';

-- ---------------------------------------------------------------------------------------------
-- A cascata do mês por operação
-- ---------------------------------------------------------------------------------------------
create or replace function nucleo.cascata_das_operacoes(p_mes date)
returns table (operacao_id uuid, crs integer, receita numeric, documentos integer, custo_frota numeric, custo_servico numeric)
language sql
stable
set search_path = ''
as $$
  with cr as (select * from nucleo.cr_da_operacao_no_mes(p_mes)),
  receita as (
    select v.codcencus, sum(v.frete_empresa) as valor, count(*)::integer as documentos
      from staging.viagem v
     where v.dt_negociacao >= p_mes and v.dt_negociacao < (p_mes + interval '1 month')::date
       and v.sumiu_do_sankhya_em is null and coalesce(v.status_cte, 'A') = 'A'
     group by v.codcencus
  ),
  despesa as (
    select d.codcencus, sum(d.valor) as valor from nucleo.despesa_na_competencia(p_mes) d group by d.codcencus
  )
  select cr.operacao_id,
         count(*)::integer,
         coalesce(sum(r.valor), 0)::numeric(15, 2),
         coalesce(sum(r.documentos), 0)::integer,
         coalesce(sum(d.valor) filter (where cr.frota), 0)::numeric(15, 2),
         coalesce(sum(d.valor) filter (where not cr.frota), 0)::numeric(15, 2)
    from cr
    left join receita r on r.codcencus = cr.codcencus
    left join despesa d on d.codcencus = cr.codcencus
   group by cr.operacao_id
$$;
comment on function nucleo.cascata_das_operacoes(date) is
  'A cascata Frota + Serviço do mês por operação: receita (frete da empresa, CT-e/NFS-e autorizados, pela data de negociação), custo da Frota e de Serviço (valor líquido pela competência gerencial, nucleo.despesa_na_competencia). Lê o staging pela RLS de quem chama.';

-- ---------------------------------------------------------------------------------------------
-- Operações › ficha: o custo por natureza pela mesma despesa da cascata
-- ---------------------------------------------------------------------------------------------
create or replace function nucleo.ficha_da_operacao(p_operacao uuid, p_mes date default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_vejo uuid[] := nucleo.operacoes_que_vejo();
  v_ve_resultado boolean := config.pode('resultados', 'ver');
  v_meses date[] := nucleo.meses_das_operacoes();
  v_mes date := date_trunc('month', coalesce(p_mes, v_meses[1], nucleo.hoje_em_sao_paulo()))::date;
  v_operacao jsonb;
  v_cascata jsonb;
  v_pessoas jsonb;
  v_placas jsonb;
begin
  if v_vejo is not null and not (p_operacao = any (v_vejo)) then
    return null;
  end if;

  select jsonb_build_object(
           'id', o.id, 'nome', o.nome, 'tipo', o.tipo, 'base_cidade', o.base_cidade, 'base_uf', o.base_uf,
           'filial', g.rotulo, 'filial_codigo', g.codigo, 'versao', o.versao)
    into v_operacao
    from nucleo.operacao o
    left join config.garagem g on g.cidade = o.base_cidade and g.uf = o.base_uf
   where o.id = p_operacao and o.excluido_em is null;
  if v_operacao is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'ativo_id', l.ativo_id, 'placa', l.placa, 'tipo', l.tipo, 'modelo', l.modelo, 'sigla', l.sigla,
           'grupo', l.grupo, 'nome_da_situacao', l.nome_da_situacao, 'cr', l.cr, 'gestor', l.gestor, 'desde', l.desde
         ) order by l.placa, l.ativo_id), '[]'::jsonb)
    into v_placas
    from nucleo.leitura_da_placa l
   where l.operacao_id = p_operacao and l.baixada_em is null;

  if v_ve_resultado then
    with cr as (
      select c.codcencus, c.frota from nucleo.cr_da_operacao_no_mes(v_mes) c where c.operacao_id = p_operacao
    ),
    por_natureza as (
      select cr.frota, coalesce(n.descricao, 'Natureza ' || coalesce(d.codnat, 'sem código')) as natureza,
             sum(d.valor) as valor
        from nucleo.despesa_na_competencia(v_mes) d
        join cr on cr.codcencus = d.codcencus
        left join staging.natureza n on n.codnat = d.codnat
       group by 1, 2
    ),
    -- As seis maiores naturezas de cada lado; o resto vira "Outras naturezas".
    agrupada as (
      select p.frota, case when p.posicao <= 6 then p.natureza else 'Outras naturezas' end as natureza,
             sum(p.valor) as valor, min(p.posicao) as posicao
        from (select x.*, row_number() over (partition by x.frota order by x.valor desc, x.natureza) as posicao
                from por_natureza x) p
       group by 1, 2
    )
    select jsonb_build_object(
             'receita', c.receita, 'documentos', c.documentos, 'custo_frota', c.custo_frota,
             'custo_servico', c.custo_servico, 'margem', c.receita - c.custo_frota - c.custo_servico,
             'margem_percentual', case when c.receita > 0 then round((c.receita - c.custo_frota - c.custo_servico) / c.receita * 100, 1) end,
             'crs', c.crs,
             'frota_por_natureza', coalesce((select jsonb_agg(jsonb_build_object('natureza', a.natureza, 'valor', a.valor) order by a.posicao)
                                               from agrupada a where a.frota), '[]'::jsonb),
             'servico_por_natureza', coalesce((select jsonb_agg(jsonb_build_object('natureza', a.natureza, 'valor', a.valor) order by a.posicao)
                                                 from agrupada a where not a.frota), '[]'::jsonb))
      into v_cascata
      from (select coalesce(max(x.crs), 0) as crs, coalesce(max(x.receita), 0) as receita,
                   coalesce(max(x.documentos), 0) as documentos, coalesce(max(x.custo_frota), 0) as custo_frota,
                   coalesce(max(x.custo_servico), 0) as custo_servico
              from nucleo.cascata_das_operacoes(v_mes) x where x.operacao_id = p_operacao) c;

    with cr as (
      select c.codcencus from nucleo.cr_da_operacao_no_mes(v_mes) c where c.operacao_id = p_operacao
    ),
    folha as (
      select f.codfunc, coalesce(nullif(btrim(f.departamento), ''), 'Sem departamento') as departamento, f.salario_bruto
        from staging.folha f join cr on cr.codcencus = f.codcencus
       where f.referencia >= v_mes and f.referencia < (v_mes + interval '1 month')::date
    )
    select jsonb_build_object(
             'funcionarios', (select count(distinct codfunc) from folha),
             'salario_bruto', (select coalesce(sum(salario_bruto), 0) from folha),
             'por_departamento', coalesce((
               select jsonb_agg(jsonb_build_object('departamento', d.departamento, 'funcionarios', d.funcionarios,
                                                   'salario_bruto', d.salario_bruto)
                                order by d.salario_bruto desc, d.departamento)
                 from (select departamento, count(distinct codfunc) as funcionarios, coalesce(sum(salario_bruto), 0) as salario_bruto
                         from folha group by departamento) d), '[]'::jsonb))
      into v_pessoas;
  end if;

  return jsonb_build_object(
    'operacao', v_operacao,
    'mes', v_mes,
    'meses', to_jsonb(v_meses),
    've_resultado', v_ve_resultado,
    'cascata', v_cascata,
    'placas', v_placas,
    'pessoas', v_pessoas
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Resultados › Visão geral: a operação de cada lançamento pela regra das Operações
-- ---------------------------------------------------------------------------------------------
create or replace function nucleo.visao_geral_dos_resultados(
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
    select distinct on (c.codcencus) c.codcencus::text as codcencus,
           c.garagem_id, g.rotulo as garagem, c.unidade_gerencial, u.rotulo as unidade, u.ordem as ordem_da_unidade
      from nucleo.cr c
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
  -- A operação de cada CR em cada mês da janela: a mesma regra das Operações (montagem ou rótulo).
  operacao_no_mes as materialized (
    select m.mes::date as mes, x.codcencus, x.operacao_id, o.nome as operacao
      from janela j
     cross join generate_series(j.inicio, j.mes, interval '1 month') m (mes)
     cross join lateral nucleo.cr_da_operacao_no_mes(m.mes::date) x
      left join nucleo.operacao o on o.id = x.operacao_id
  ),
  -- Os lançamentos dos 12 meses, no contexto (filial e operação), com o grupo.
  no_contexto as materialized (
    select l.*, c.codcencus is not null as com_cr,
           case v_agrupamento
             when 'operacao' then om.operacao_id::text
             when 'filial' then c.garagem_id::text
             else c.unidade_gerencial
           end as chave,
           case v_agrupamento
             when 'operacao' then coalesce(om.operacao, 'Sem operação')
             when 'filial' then coalesce(c.garagem, 'Sem filial')
             else coalesce(c.unidade, 'Sem unidade')
           end as rotulo,
           case v_agrupamento when 'unidade' then c.ordem_da_unidade else 0 end as ordem
      from lancamentos l
      cross join janela j
      left join crs c on c.codcencus = l.codcencus
      left join operacao_no_mes om on om.codcencus = l.codcencus and om.mes = l.competencia
     where l.competencia between j.inicio and j.mes
       and (p_garagem_id is null or c.garagem_id = p_garagem_id)
       and (p_operacao_id is null or om.operacao_id = p_operacao_id)
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
comment on function nucleo.visao_geral_dos_resultados(date, uuid, uuid, text, integer) is
  'Resultados › Visão geral: receita, custo, resultado e margem do mês (competência gerencial), a série de 12 meses, por operação (a regra das Operações: montagem do Eixo no mês ou rótulo do Sankhya), unidade ou filial com o total, e as naturezas de maior custo. Só para quem vê Resultados; lê o staging provisório pela RLS de quem chama.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.despesa_na_competencia(date)',
   'Operações: a despesa de cada CR no mês pela competência gerencial, lida do staging pela RLS de quem chama.');
grant execute on function nucleo.despesa_na_competencia(date) to authenticated;
