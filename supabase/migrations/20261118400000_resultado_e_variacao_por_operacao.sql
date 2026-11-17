-- Operações › Comparativo e Resultados › Por operação (UMA leitura) e Operações › Análise (variação mês a mês).
--
--  * nucleo.resultado_por_operacao(p_mes) -> jsonb. A cascata de cada operação é a de nucleo.cascata_das_operacoes
--    (a mesma da lista e da ficha; competência gerencial; receita em duas linhas, CT-e e NFS-e). Resultado =
--    receita − custo da frota − custo do serviço; margem = resultado ÷ receita (uma casa; vazia sem receita); peso na
--    receita = receita da operação ÷ receita das operações (uma casa). Ordem: da maior para a menor margem
--    (desempate pelo nome e pelo id). O custo por natureza e o total vêm de nucleo.visao_geral_dos_resultados, e a
--    diferença "fora das operações" (Visão geral − operações) vem explícita, para o total bater com a Visão geral.
--  * nucleo.variacao_das_operacoes(p_mes) -> jsonb: o mês contra o anterior, por operação (variação da receita, do
--    custo da frota, do custo do serviço e do resultado), as maiores variações primeiro, e a maior alta e a maior
--    queda (nulas quando não há).
--  * Só Resultados › ver recebe números (sem ele: ve_resultado falso). As operações são as que quem chama vê
--    (nucleo.operacoes_que_vejo). Security invoker: a RLS de quem chama vale.

create function nucleo.resultado_por_operacao(p_mes date default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', coalesce(p_mes, nucleo.mes_fechado_mais_recente())::timestamp)::date;
  v_vejo uuid[];
  v_vg jsonb;
  v_resultado jsonb;
begin
  if not config.pode('resultados', 'ver') then
    return jsonb_build_object('ve_resultado', false, 'mes', v_mes);
  end if;
  v_vejo := nucleo.operacoes_que_vejo();
  v_vg := nucleo.visao_geral_dos_resultados(v_mes, null, null, 'operacao', 6);
  with c as (
    select o.id, o.nome,
           coalesce(c.receita, 0) as receita, coalesce(c.receita_cte, 0) as receita_cte, coalesce(c.receita_nfse, 0) as receita_nfse,
           coalesce(c.custo_frota, 0) as custo_frota, coalesce(c.custo_servico, 0) as custo_servico
      from nucleo.cascata_das_operacoes(v_mes) c
      join nucleo.operacao o on o.id = c.operacao_id and o.excluido_em is null
     where v_vejo is null or o.id = any (v_vejo)
  ),
  t as (
    select coalesce(sum(receita), 0) as receita, coalesce(sum(receita_cte), 0) as receita_cte,
           coalesce(sum(receita_nfse), 0) as receita_nfse, coalesce(sum(custo_frota), 0) as custo_frota,
           coalesce(sum(custo_servico), 0) as custo_servico
      from c
  )
  select jsonb_build_object(
    've_resultado', true,
    'mes', v_mes,
    'kpis', (select jsonb_build_object(
               'receita', t.receita, 'receita_cte', t.receita_cte, 'receita_nfse', t.receita_nfse,
               'custo_frota', t.custo_frota, 'custo_servico', t.custo_servico, 'custo', t.custo_frota + t.custo_servico,
               'resultado', t.receita - t.custo_frota - t.custo_servico,
               'margem_percentual', round(100.0 * (t.receita - t.custo_frota - t.custo_servico) / nullif(t.receita, 0), 1))
               from t),
    'operacoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'operacao_id', c.id, 'nome', c.nome,
               'receita', c.receita, 'receita_cte', c.receita_cte, 'receita_nfse', c.receita_nfse,
               'custo_frota', c.custo_frota, 'custo_servico', c.custo_servico, 'custo', c.custo_frota + c.custo_servico,
               'resultado', c.receita - c.custo_frota - c.custo_servico,
               'margem_percentual', round(100.0 * (c.receita - c.custo_frota - c.custo_servico) / nullif(c.receita, 0), 1),
               'peso_na_receita', round(100.0 * c.receita / nullif(t.receita, 0), 1))
             order by round(100.0 * (c.receita - c.custo_frota - c.custo_servico) / nullif(c.receita, 0), 1) desc nulls last, c.nome, c.id)
        from c, t), '[]'::jsonb),
    'visao_geral', jsonb_build_object('receita', coalesce((v_vg->'kpis'->>'receita')::numeric, 0),
                                      'custo', coalesce((v_vg->'kpis'->>'custo')::numeric, 0),
                                      'resultado', coalesce((v_vg->'kpis'->>'resultado')::numeric, 0)),
    'fora_das_operacoes', case when v_vejo is null then (select jsonb_build_object(
        'receita', coalesce((v_vg->'kpis'->>'receita')::numeric, 0) - t.receita,
        'custo', coalesce((v_vg->'kpis'->>'custo')::numeric, 0) - t.custo_frota - t.custo_servico,
        'resultado', coalesce((v_vg->'kpis'->>'resultado')::numeric, 0) - (t.receita - t.custo_frota - t.custo_servico)) from t) end,
    'custo_por_natureza', coalesce(v_vg->'naturezas', '[]'::jsonb),
    'outras_naturezas', v_vg->'outras'
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.resultado_por_operacao(date) from public, anon;
comment on function nucleo.resultado_por_operacao(date) is
  'Resultado de cada operação no mês (Comparativo e Resultados › Por operação): receita em duas linhas, custo da frota e do serviço, resultado, margem e peso na receita, os KPIs somados no banco, o custo por natureza e a diferença "fora das operações" para bater com a Visão geral. Só Resultados › ver.';

create function nucleo.variacao_das_operacoes(p_mes date default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', coalesce(p_mes, nucleo.mes_fechado_mais_recente())::timestamp)::date;
  v_ant date;
  v_vejo uuid[];
  v_resultado jsonb;
begin
  v_ant := (v_mes - interval '1 month')::date;
  if not config.pode('resultados', 'ver') then
    return jsonb_build_object('ve_resultado', false, 'mes', v_mes, 'mes_anterior', v_ant);
  end if;
  v_vejo := nucleo.operacoes_que_vejo();
  with atual as (select * from nucleo.cascata_das_operacoes(v_mes)),
  anterior as (select * from nucleo.cascata_das_operacoes(v_ant)),
  v as (
    select o.id, o.nome,
           coalesce(a.receita, 0) - coalesce(b.receita, 0) as variacao_receita,
           coalesce(a.custo_frota, 0) - coalesce(b.custo_frota, 0) as variacao_custo_frota,
           coalesce(a.custo_servico, 0) - coalesce(b.custo_servico, 0) as variacao_custo_servico,
           coalesce(a.receita - a.custo_frota - a.custo_servico, 0) as resultado,
           coalesce(b.receita - b.custo_frota - b.custo_servico, 0) as resultado_anterior
      from nucleo.operacao o
      left join atual a on a.operacao_id = o.id
      left join anterior b on b.operacao_id = o.id
     where o.excluido_em is null and (a.operacao_id is not null or b.operacao_id is not null)
       and (v_vejo is null or o.id = any (v_vejo))
  ),
  w as (select v.*, v.resultado - v.resultado_anterior as variacao from v)
  select jsonb_build_object(
    've_resultado', true,
    'mes', v_mes,
    'mes_anterior', v_ant,
    'kpis', jsonb_build_object(
      'resultado', (select coalesce(sum(resultado), 0) from w),
      'resultado_anterior', (select coalesce(sum(resultado_anterior), 0) from w),
      'variacao', (select coalesce(sum(variacao), 0) from w),
      'maior_alta', (select jsonb_build_object('operacao_id', w.id, 'nome', w.nome, 'variacao', w.variacao)
                       from w where w.variacao > 0 order by w.variacao desc, w.nome, w.id limit 1),
      'maior_queda', (select jsonb_build_object('operacao_id', w.id, 'nome', w.nome, 'variacao', w.variacao)
                        from w where w.variacao < 0 order by w.variacao, w.nome, w.id limit 1)),
    'cascata', (select jsonb_build_object(
                  'resultado_anterior', coalesce(sum(resultado_anterior), 0),
                  'variacao_receita', coalesce(sum(variacao_receita), 0),
                  'variacao_custo_frota', coalesce(sum(variacao_custo_frota), 0),
                  'variacao_custo_servico', coalesce(sum(variacao_custo_servico), 0),
                  'resultado', coalesce(sum(resultado), 0)) from w),
    'operacoes', coalesce((select jsonb_agg(jsonb_build_object(
                    'operacao_id', w.id, 'nome', w.nome, 'resultado', w.resultado, 'resultado_anterior', w.resultado_anterior,
                    'variacao', w.variacao, 'variacao_receita', w.variacao_receita,
                    'variacao_custo_frota', w.variacao_custo_frota, 'variacao_custo_servico', w.variacao_custo_servico)
                  order by abs(w.variacao) desc, w.nome, w.id) from w), '[]'::jsonb)
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.variacao_das_operacoes(date) from public, anon;
comment on function nucleo.variacao_das_operacoes(date) is
  'Operações › Análise: o resultado do mês contra o anterior, por operação, com a cascata da variação (receita, custo da frota, custo do serviço), as maiores variações primeiro e a maior alta e a maior queda. Só Resultados › ver.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.resultado_por_operacao(date)', 'Comparativo e Resultados › Por operação: a cascata por operação e o total da Visão geral, pela RLS de quem chama.'),
  ('nucleo.variacao_das_operacoes(date)', 'Operações › Análise: a variação mês a mês por operação, pela RLS de quem chama.');
grant execute on function nucleo.resultado_por_operacao(date) to authenticated;
grant execute on function nucleo.variacao_das_operacoes(date) to authenticated;
