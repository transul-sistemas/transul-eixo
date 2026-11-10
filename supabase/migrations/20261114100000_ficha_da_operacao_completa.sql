-- Operações › ficha completa: o período (mês fechado ou acumulado), a comparação com o período
-- anterior, a evolução de 12 meses, a curva dia a dia, o custo por natureza, o contexto (pessoas,
-- linha do tempo, mapa e árvore). Só LEITURA, sobre o que já existe; nenhuma função existente muda.
--
-- Definições (hipóteses registradas em docs/decisoes.md, 10/11/2026):
--  * Mês fechado: o mês M fecha quando passa o dia do corte do mês seguinte (o título lançado até o dia
--    do corte ainda cai em M). É o mês padrão das telas de Operações (nucleo.mes_fechado_mais_recente).
--  * Receita, custo da Frota e de Serviço: as mesmas definições de nucleo.cascata_das_operacoes (a
--    competência gerencial de nucleo.competencia_gerencial; o CR de cada operação no mês vem de
--    nucleo.cr_da_operacao_no_mes). Aqui só se somam vários meses de uma vez.
--  * Dia da curva: a receita no dia da negociação; a despesa no dia da base (dt_competencia) quando a
--    competência é o mês da base, ou no dia do DTENTSAI quando a competência foi para o mês do lançamento.
--  * Placas do período: as placas distintas montadas na operação (nucleo.placa_na_operacao) em algum
--    momento do período. Receita por placa = receita ÷ placas do período (vazia sem placa).
--  * Pessoas: o vínculo vigente (pessoas.vinculo) hoje; nome só para quem tem Pessoas › ver.
--
-- Tudo security invoker: a RLS de quem chama vale em cada leitura. O dinheiro só volta para quem tem
-- Resultados › ver; sem ele, `ve_resultado` é falso e não há número.

-- ---------------------------------------------------------------------------------------------
-- O mês fechado mais recente
-- ---------------------------------------------------------------------------------------------
create function nucleo.mes_fechado_mais_recente(p_hoje date default null)
returns date
language sql
stable
set search_path = ''
as $$
  select (date_trunc('month', x.hoje::timestamp)
          - case when extract(day from x.hoje) > x.corte then interval '1 month' else interval '2 months' end)::date
    from (select coalesce(p_hoje, nucleo.hoje_em_sao_paulo()) as hoje, nucleo.dia_do_corte_da_competencia() as corte) x
$$;
revoke all on function nucleo.mes_fechado_mais_recente(date) from public, anon;
comment on function nucleo.mes_fechado_mais_recente(date) is
  'O mês fechado mais recente (primeiro dia): o mês M fecha quando passa o dia do corte da competência do mês seguinte. Em 10/11 com corte 10, é setembro; em 11/11, outubro.';

-- ---------------------------------------------------------------------------------------------
-- O resultado da operação em um período [início, fim) de meses inteiros
-- ---------------------------------------------------------------------------------------------
create function nucleo.resultado_da_operacao(p_operacao uuid, p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_vejo uuid[] := nucleo.operacoes_que_vejo();
  v_ini date := date_trunc('month', p_inicio::timestamp)::date;
  v_fim date := date_trunc('month', p_fim::timestamp)::date;
  v_n integer;
  v_ant_ini date;
  v_base date;
  v_corte integer := nucleo.dia_do_corte_da_competencia();
  v_resultado jsonb;
begin
  if p_inicio is null or p_fim is null or v_fim <= v_ini then
    raise exception 'Informe um período com pelo menos um mês.' using errcode = '22023';
  end if;
  v_n := ((extract(year from v_fim) - extract(year from v_ini)) * 12 + extract(month from v_fim) - extract(month from v_ini))::integer;
  if v_n > 60 then
    raise exception 'O período passa de 60 meses.' using errcode = '22023';
  end if;
  if v_vejo is not null and not (p_operacao = any (v_vejo)) then
    return null;
  end if;
  if not exists (select 1 from nucleo.operacao o where o.id = p_operacao and o.excluido_em is null) then
    return null;
  end if;
  if not config.pode('resultados', 'ver') then
    return jsonb_build_object('ve_resultado', false, 'inicio', v_ini, 'fim', v_fim);
  end if;

  v_ant_ini := (v_ini - make_interval(months => v_n))::date;
  -- A janela da evolução: doze meses terminando no último mês do período.
  v_base := least(v_ant_ini, (v_fim - interval '12 months')::date);

  with meses as (
    select g.m::date as mes
      from generate_series(v_base, (v_fim - interval '1 month')::date, interval '1 month') g (m)
  ),
  cr_mes as materialized (
    select ms.mes, c.codcencus, c.frota
      from meses ms
     cross join lateral nucleo.cr_da_operacao_no_mes(ms.mes) c
     where c.operacao_id = p_operacao
  ),
  codigos as (select distinct x.codcencus from cr_mes x),
  lanc as materialized (
    select nucleo.competencia_gerencial(v.dt_negociacao, null, v_corte) as competencia,
           v.dt_negociacao as dia, v.codcencus::text as codcencus, null::text as codnat,
           v.frete_empresa as receita, 0::numeric as custo, 1 as documentos
      from staging.viagem v
     where v.dt_negociacao >= v_base and v.dt_negociacao < v_fim
       and v.codcencus::text in (select x.codcencus from codigos x)
       and v.sumiu_do_sankhya_em is null
       and coalesce(v.status_cte, 'A') = 'A'
       and v.frete_empresa is not null
    union all
    select d.comp,
           case when d.comp = date_trunc('month', d.dt_competencia::timestamp)::date then d.dt_competencia else d.dtentsai end,
           d.codcencus::text, d.codnat::text, 0::numeric, d.valor_liquido, 0
      from (select s.dt_competencia, s.dtentsai, s.codcencus, s.codnat, s.valor_liquido,
                   nucleo.competencia_gerencial(s.dt_competencia, s.dtentsai, v_corte, null, s.provisao = 'PROVISAO') as comp
              from staging.despesa s
             where s.dt_competencia < v_fim
               and s.codcencus::text in (select x.codcencus from codigos x)
               and s.invalidado_em is null
               and s.valor_liquido is not null
               and s.dt_competencia is not null) d
     where d.comp >= v_base and d.comp < v_fim
  ),
  no_op as materialized (
    select l.*, c.frota
      from lanc l
      join cr_mes c on c.codcencus = l.codcencus and c.mes = l.competencia
  ),
  por_mes as (
    select ms.mes,
           coalesce(sum(n.receita), 0) as receita,
           coalesce(sum(n.documentos), 0)::integer as documentos,
           coalesce(sum(n.custo) filter (where n.frota), 0) as custo_frota,
           coalesce(sum(n.custo) filter (where not n.frota), 0) as custo_servico
      from meses ms
      left join no_op n on n.competencia = ms.mes
     group by ms.mes
  ),
  placas as (
    select (select count(distinct p.ativo_id)
              from nucleo.placa_na_operacao p
             where p.operacao_id = p_operacao and p.excluido_em is null
               and p.periodo && tstzrange(v_ini::timestamp at time zone 'America/Sao_Paulo',
                                          v_fim::timestamp at time zone 'America/Sao_Paulo', '[)'))::integer as atual,
           (select count(distinct p.ativo_id)
              from nucleo.placa_na_operacao p
             where p.operacao_id = p_operacao and p.excluido_em is null
               and p.periodo && tstzrange(v_ant_ini::timestamp at time zone 'America/Sao_Paulo',
                                          v_ini::timestamp at time zone 'America/Sao_Paulo', '[)'))::integer as anterior
  ),
  totais as (
    select t.periodo,
           sum(t.receita) as receita, sum(t.documentos)::integer as documentos,
           sum(t.custo_frota) as custo_frota, sum(t.custo_servico) as custo_servico
      from (select case when m.mes >= v_ini then 'atual' when m.mes >= v_ant_ini then 'anterior' end as periodo, m.*
              from por_mes m) t
     where t.periodo is not null
     group by t.periodo
  ),
  por_natureza as (
    select n.frota, coalesce(nat.descricao, 'Natureza ' || coalesce(n.codnat, 'sem código')) as natureza,
           sum(n.custo) as valor
      from no_op n
      left join staging.natureza nat on nat.codnat = n.codnat
     where n.competencia >= v_ini and n.custo <> 0
     group by 1, 2
  ),
  agrupada as (
    select p.frota, case when p.posicao <= 6 then p.natureza else 'Outras naturezas' end as natureza,
           sum(p.valor) as valor, min(p.posicao) as posicao
      from (select x.*, row_number() over (partition by x.frota order by x.valor desc, x.natureza) as posicao
              from por_natureza x) p
     group by 1, 2
  ),
  dias as (
    select g.d::date as dia,
           coalesce(sum(n.receita), 0) as receita,
           coalesce(sum(n.custo), 0) as custo
      from generate_series(v_ini, (v_fim - interval '1 day')::date, interval '1 day') g (d)
      left join no_op n on n.dia = g.d::date and n.competencia = v_ini
     where v_n = 1
     group by g.d
  )
  select jsonb_build_object(
    've_resultado', true,
    'inicio', v_ini, 'fim', v_fim, 'inicio_anterior', v_ant_ini,
    'atual', (select jsonb_build_object(
                'receita', coalesce(t.receita, 0), 'documentos', coalesce(t.documentos, 0),
                'custo_frota', coalesce(t.custo_frota, 0), 'custo_servico', coalesce(t.custo_servico, 0),
                'margem', coalesce(t.receita, 0) - coalesce(t.custo_frota, 0) - coalesce(t.custo_servico, 0),
                'margem_percentual', case when coalesce(t.receita, 0) > 0
                    then round((t.receita - t.custo_frota - t.custo_servico) / t.receita * 100, 1) end,
                'placas', p.atual,
                'receita_por_placa', case when p.atual > 0 then round(coalesce(t.receita, 0) / p.atual, 2) end)
                from placas p left join totais t on t.periodo = 'atual'),
    'anterior', (select jsonb_build_object(
                'receita', coalesce(t.receita, 0), 'documentos', coalesce(t.documentos, 0),
                'custo_frota', coalesce(t.custo_frota, 0), 'custo_servico', coalesce(t.custo_servico, 0),
                'margem', coalesce(t.receita, 0) - coalesce(t.custo_frota, 0) - coalesce(t.custo_servico, 0),
                'margem_percentual', case when coalesce(t.receita, 0) > 0
                    then round((t.receita - t.custo_frota - t.custo_servico) / t.receita * 100, 1) end,
                'placas', p.anterior,
                'receita_por_placa', case when p.anterior > 0 then round(coalesce(t.receita, 0) / p.anterior, 2) end)
                from placas p left join totais t on t.periodo = 'anterior'),
    'serie', (select coalesce(jsonb_agg(jsonb_build_object(
                'mes', m.mes, 'receita', m.receita, 'custo_frota', m.custo_frota, 'custo_servico', m.custo_servico,
                'margem', m.receita - m.custo_frota - m.custo_servico) order by m.mes), '[]'::jsonb)
                from por_mes m where m.mes >= (v_fim - interval '12 months')::date),
    'meses_do_periodo', (select coalesce(jsonb_agg(jsonb_build_object(
                'mes', m.mes, 'receita', m.receita, 'custo_frota', m.custo_frota, 'custo_servico', m.custo_servico,
                'margem', m.receita - m.custo_frota - m.custo_servico) order by m.mes), '[]'::jsonb)
                from por_mes m where m.mes >= v_ini),
    'dias', (select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'receita', d.receita, 'custo', d.custo) order by d.dia), '[]'::jsonb)
                from dias d),
    'frota_por_natureza', (select coalesce(jsonb_agg(jsonb_build_object('natureza', a.natureza, 'valor', a.valor) order by a.posicao), '[]'::jsonb)
                from agrupada a where a.frota),
    'servico_por_natureza', (select coalesce(jsonb_agg(jsonb_build_object('natureza', a.natureza, 'valor', a.valor) order by a.posicao), '[]'::jsonb)
                from agrupada a where not a.frota)
  ) into v_resultado;

  return v_resultado;
end;
$$;
revoke all on function nucleo.resultado_da_operacao(uuid, date, date) from public, anon;
comment on function nucleo.resultado_da_operacao(uuid, date, date) is
  'Ficha da operação: receita, custos, margem e placas do período [início, fim) e do período anterior de mesmo tamanho, a evolução de 12 meses, a curva dia a dia (só em um mês), os meses do período e o custo por natureza. Mesmas definições da cascata das Operações (competência gerencial); só para quem vê Resultados.';

-- ---------------------------------------------------------------------------------------------
-- O contexto da operação: pessoas e escala, linha do tempo, mapa e árvore (sem dinheiro)
-- ---------------------------------------------------------------------------------------------
create function nucleo.contexto_da_operacao(p_operacao uuid, p_mes date default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_vejo uuid[] := nucleo.operacoes_que_vejo();
  v_mes date := date_trunc('month', coalesce(p_mes, nucleo.mes_fechado_mais_recente())::timestamp)::date;
  v_agora timestamptz := now();
  v_ve_pessoas boolean := config.pode('pessoas', 'ver');
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_pessoas jsonb;
  v_linha jsonb;
  v_mapa jsonb;
  v_arvore jsonb;
begin
  if v_vejo is not null and not (p_operacao = any (v_vejo)) then
    return null;
  end if;
  if not exists (select 1 from nucleo.operacao o where o.id = p_operacao and o.excluido_em is null) then
    return null;
  end if;

  -- Pessoas: o vínculo vigente hoje, por função, com a escala do mês; nomes só para Pessoas › ver.
  select coalesce(jsonb_agg(jsonb_build_object(
           'funcao', x.funcao, 'nome_da_funcao', x.nome_da_funcao, 'pessoas', x.pessoas,
           'escala', x.escala, 'nomes', x.nomes) order by x.ordem, x.funcao), '[]'::jsonb)
    into v_pessoas
    from (
      select v.funcao, coalesce(f.nome, v.funcao) as nome_da_funcao, coalesce(f.ordem, 999) as ordem,
             count(distinct v.pessoa_id)::integer as pessoas,
             (select coalesce(jsonb_object_agg(e.sigla, e.n), '{}'::jsonb)
                from (select m.sigla, count(*)::integer as n
                        from pessoas.marcacao_da_escala m
                       where m.operacao_id = p_operacao
                         and m.dia >= v_mes and m.dia < (v_mes + interval '1 month')::date
                         and m.pessoa_id in (select v2.pessoa_id from pessoas.vinculo v2
                                              where v2.operacao_id = p_operacao and v2.funcao = v.funcao
                                                and v2.excluido_em is null and v2.periodo @> v_hoje)
                       group by m.sigla) e) as escala,
             case when v_ve_pessoas
                  then (select jsonb_agg(p.nome order by p.nome)
                          from nucleo.pessoa_para_leitura p
                         where p.id in (select v3.pessoa_id from pessoas.vinculo v3
                                         where v3.operacao_id = p_operacao and v3.funcao = v.funcao
                                           and v3.excluido_em is null and v3.periodo @> v_hoje))
             end as nomes
        from pessoas.vinculo v
        left join pessoas.funcao f on f.codigo = v.funcao
       where v.operacao_id = p_operacao and v.excluido_em is null and v.periodo @> v_hoje
       group by v.funcao, f.nome, f.ordem
    ) x;

  -- Linha do tempo: entradas e saídas de placas, CRs montados e pessoas vinculadas (sem nome de pessoa).
  select coalesce(jsonb_agg(jsonb_build_object(
           'quando', e.quando, 'tipo', e.tipo, 'objeto', e.objeto, 'detalhe', e.detalhe) order by e.quando desc, e.tipo, e.objeto), '[]'::jsonb)
    into v_linha
    from (
      select * from (
        select p.inicio as quando, 'placa_entrou' as tipo, l.placa as objeto, null::text as detalhe
          from nucleo.placa_na_operacao p
          join nucleo.leitura_da_placa l on l.ativo_id = p.ativo_id
         where p.operacao_id = p_operacao and p.excluido_em is null
        union all
        select p.fim, 'placa_saiu', l.placa, null
          from nucleo.placa_na_operacao p
          join nucleo.leitura_da_placa l on l.ativo_id = p.ativo_id
         where p.operacao_id = p_operacao and p.excluido_em is null and p.fim is not null
        union all
        select s.inicio, 'cr_montado', c.codigo, c.nome
          from nucleo.cr_de_servico_na_operacao s join nucleo.cr c on c.id = s.cr_id
         where s.operacao_id = p_operacao and s.excluido_em is null
        union all
        select s.fim, 'cr_desmontado', c.codigo, c.nome
          from nucleo.cr_de_servico_na_operacao s join nucleo.cr c on c.id = s.cr_id
         where s.operacao_id = p_operacao and s.excluido_em is null and s.fim is not null
        union all
        select v.inicio::timestamp at time zone 'America/Sao_Paulo', 'pessoa_vinculada', coalesce(f.nome, v.funcao), null
          from pessoas.vinculo v left join pessoas.funcao f on f.codigo = v.funcao
         where v.operacao_id = p_operacao and v.excluido_em is null
        union all
        select v.fim::timestamp at time zone 'America/Sao_Paulo', 'pessoa_desvinculada', coalesce(f.nome, v.funcao), null
          from pessoas.vinculo v left join pessoas.funcao f on f.codigo = v.funcao
         where v.operacao_id = p_operacao and v.excluido_em is null and v.fim is not null
      ) t
       where t.quando is not null and t.quando <= v_agora
       order by t.quando desc, t.tipo, t.objeto
       limit 80
    ) e;

  -- Mapa: a base da operação e as placas por filial (cidade/UF da garagem). Sem telemetria.
  select jsonb_build_object(
           'base', (select jsonb_build_object('cidade', o.base_cidade, 'uf', o.base_uf, 'filial', g.rotulo)
                      from nucleo.operacao o
                      left join config.garagem g on g.cidade = o.base_cidade and g.uf = o.base_uf
                     where o.id = p_operacao),
           'filiais', coalesce((
             select jsonb_agg(jsonb_build_object('filial', f.filial, 'cidade', f.cidade, 'uf', f.uf, 'placas', f.placas,
                                                  'em_atividade', f.em_atividade, 'impedidas', f.impedidas) order by f.placas desc, f.filial)
               from (select coalesce(g.rotulo, l.garagem, 'Sem filial') as filial, g.cidade, g.uf,
                            count(*)::integer as placas,
                            count(*) filter (where l.grupo = 'em_atividade')::integer as em_atividade,
                            count(*) filter (where l.grupo = 'impedida')::integer as impedidas
                       from nucleo.leitura_da_placa l
                       left join config.garagem g on g.rotulo = l.garagem
                      where l.operacao_id = p_operacao and l.baixada_em is null
                      group by 1, 2, 3) f), '[]'::jsonb))
    into v_mapa;

  -- Árvore: CRs (das placas da operação e dos CRs montados), as placas de cada um e as pessoas por função.
  with placas as (
    select l.ativo_id, l.placa
      from nucleo.leitura_da_placa l
     where l.operacao_id = p_operacao and l.baixada_em is null
  ),
  cr_das_placas as (
    select cd.cr_id, p.placa
      from placas p
      join nucleo.cr_do_ativo cd on cd.ativo_id = p.ativo_id and cd.excluido_em is null and cd.periodo @> v_agora
  ),
  crs as (
    select c.id, c.codigo, c.nome,
           coalesce(c.tipo in ('frota_de_ativo', 'frota_sem_placa'), false) as frota
      from nucleo.cr c
     where c.excluido_em is null
       and (c.id in (select cp.cr_id from cr_das_placas cp)
            or c.id in (select x.cr_id from nucleo.cr_da_operacao_no_mes(date_trunc('month', v_hoje::timestamp)::date) x
                         where x.operacao_id = p_operacao))
  )
  select jsonb_build_object(
           'crs', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'codigo', c.codigo, 'nome', c.nome, 'frota', c.frota,
                      'placas', coalesce((select jsonb_agg(cp.placa order by cp.placa)
                                            from (select cp2.placa from cr_das_placas cp2 where cp2.cr_id = c.id order by cp2.placa limit 60) cp), '[]'::jsonb),
                      'total_de_placas', (select count(*)::integer from cr_das_placas cp3 where cp3.cr_id = c.id))
                    order by c.frota desc, c.codigo)
               from crs c), '[]'::jsonb),
           'placas_sem_cr', (select count(*)::integer from placas p where p.placa not in (select cp.placa from cr_das_placas cp)))
    into v_arvore;

  return jsonb_build_object(
    'mes', v_mes, 've_pessoas', v_ve_pessoas,
    'pessoas', v_pessoas, 'linha_do_tempo', v_linha, 'mapa', v_mapa, 'arvore', v_arvore);
end;
$$;
revoke all on function nucleo.contexto_da_operacao(uuid, date) from public, anon;
comment on function nucleo.contexto_da_operacao(uuid, date) is
  'Ficha da operação, sem dinheiro: pessoas vigentes por função com a escala do mês (nome só para Pessoas › ver), a linha do tempo (placas, CRs e vínculos), as placas por filial (mapa, sem telemetria) e os CRs com as placas (árvore).';

-- ---------------------------------------------------------------------------------------------
-- O que o app executa
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.mes_fechado_mais_recente(date)', 'Operações: o mês fechado mais recente (regra do corte da competência), só aritmética de datas.'),
  ('nucleo.resultado_da_operacao(uuid,date,date)', 'Ficha da operação: o resultado do período, lido do staging pela RLS de quem chama.'),
  ('nucleo.contexto_da_operacao(uuid,date)', 'Ficha da operação: pessoas, linha do tempo, mapa e árvore, lidos pela RLS de quem chama.');
grant execute on function nucleo.mes_fechado_mais_recente(date) to authenticated;
grant execute on function nucleo.resultado_da_operacao(uuid, date, date) to authenticated;
grant execute on function nucleo.contexto_da_operacao(uuid, date) to authenticated;
