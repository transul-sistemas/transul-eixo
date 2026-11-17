-- Operacional › Análise e Pessoas › Análise (Nível 3; pgTAP 129 e 130): as duas análises no contrato único
-- das telas de painel, com a permissão de quem chama (a RLS recorta). Definições em docs/glossario.md.
--
-- Operacional: uma PASSAGEM é a sequência de eventos DOp, ACe, CAr e CAn da placa (camada atividade) que
-- termina no evento seguinte; só conta a que termina num ETc. O tempo de cada etapa vai do evento ao
-- próximo evento da placa; o ciclo, do primeiro evento da passagem ao ETc; a espera para carregar é
-- DOp + ACe. A passagem conta no mês do ETc ([início, fim) em São Paulo). A filial é a da garagem da base
-- da operação da placa no início da passagem (a mesma regra de nucleo.operacoes_da_escala).
--
-- Pessoas: o efetivo médio é a média, pelos dias do mês até hoje, das pessoas com vínculo vigente no dia;
-- ausência é o dia de férias (FE) ou atestado (AT) na escala; desligamento é o vínculo que termina no mês
-- sem outro que comece no mesmo dia; rotatividade = desligamentos ÷ efetivo médio × 100. O custo por pessoa
-- depende da folha, que ainda não chega: fica "Sem dados ainda".

-- ---------------------------------------------------------------------------------------------
-- Operacional › Análise
-- ---------------------------------------------------------------------------------------------
create function nucleo.analise_do_operacional(
  p_mes date default null, p_filtro text default null, p_busca text default null, p_pagina integer default 1, p_tam integer default 20
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_filtro text := nullif(nullif(btrim(coalesce(p_filtro, '')), ''), 'todos');
  v_busca text := nucleo.texto_simples(nullif(btrim(coalesce(p_busca, '')), ''));
  v_tam integer := nucleo.tam_do_painel(p_tam);
  v_mes date := date_trunc('month', coalesce(p_mes, nucleo.hoje_em_sao_paulo()))::date;
  v_primeiro date := (date_trunc('month', coalesce(p_mes, nucleo.hoje_em_sao_paulo())) - interval '11 months')::date;
  v_de_serie timestamptz;
  v_ate timestamptz;
  v_resultado jsonb;
begin
  if not config.pode('operacional', 'ver') then
    raise exception 'Você não tem permissão para ver a análise do Operacional.' using errcode = '42501';
  end if;
  if v_filtro is not null and v_filtro <> 'sem-filial'
     and not exists (select 1 from config.filial f where f.excluido_em is null and f.id::text = v_filtro) then
    raise exception 'Filtro da análise do Operacional desconhecido.' using errcode = '22023';
  end if;
  v_de_serie := v_primeiro::timestamp at time zone 'America/Sao_Paulo';
  v_ate := (v_mes + interval '1 month')::timestamp at time zone 'America/Sao_Paulo';

  with ev as materialized (
    -- A ilha conta os eventos fora do Operacional até aqui: os eventos de uma passagem têm a mesma ilha.
    select e.ativo_id, e.sigla, e.em,
           lead(e.em) over w as prox_em, lead(e.sigla) over w as prox_sigla,
           count(*) filter (where e.sigla not in ('DOp', 'ACe', 'CAr', 'CAn')) over w as ilha
      from nucleo.evento_de_status e
     where e.excluido_em is null and e.camada = 'atividade'
       and e.em >= v_de_serie - interval '31 days' and e.em < v_ate
    window w as (partition by e.ativo_id order by e.em, e.id)
  ),
  pas as materialized (
    select ev.ativo_id, min(ev.em) as inicio,
           (array_agg(ev.prox_em order by ev.em desc))[1] as fim,
           (array_agg(ev.prox_sigla order by ev.em desc))[1] as fim_sigla,
           round(coalesce(sum(extract(epoch from ev.prox_em - ev.em)) filter (where ev.sigla = 'DOp'), 0) / 60)::bigint as t_dop,
           round(coalesce(sum(extract(epoch from ev.prox_em - ev.em)) filter (where ev.sigla = 'ACe'), 0) / 60)::bigint as t_ace,
           round(coalesce(sum(extract(epoch from ev.prox_em - ev.em)) filter (where ev.sigla = 'CAr'), 0) / 60)::bigint as t_car,
           round(coalesce(sum(extract(epoch from ev.prox_em - ev.em)) filter (where ev.sigla = 'CAn'), 0) / 60)::bigint as t_can
      from ev
     where ev.sigla in ('DOp', 'ACe', 'CAr', 'CAn')
     group by ev.ativo_id, ev.ilha
  ),
  c as materialized (
    select p.ativo_id, p.inicio, p.fim, p.t_dop, p.t_ace, p.t_car, p.t_can,
           round(extract(epoch from p.fim - p.inicio) / 60)::bigint as ciclo,
           p.t_dop + p.t_ace as espera,
           date_trunc('month', p.fim at time zone 'America/Sao_Paulo')::date as mes_do_fim,
           nucleo.operacao_em(p.ativo_id, p.inicio) as operacao_id
      from pas p
     where p.fim_sigla = 'ETc' and p.fim >= v_de_serie and p.fim < v_ate
  ),
  d as materialized (
    select c.*, o.nome as operacao, fl.id as filial_id, fl.nome as filial, pl.placa,
           case greatest(c.t_dop, c.t_ace, c.t_car, c.t_can)
             when c.t_car then 'CAr' when c.t_ace then 'ACe' when c.t_dop then 'DOp' else 'CAn' end as etapa
      from c
      left join nucleo.operacao o on o.id = c.operacao_id
      left join lateral (
        select f.id, f.nome
          from config.garagem g join config.filial f on f.garagem_id = g.id and f.excluido_em is null
         where g.cidade = o.base_cidade and g.uf = o.base_uf
         order by f.nome, f.id limit 1) fl on true
      left join lateral (
        select pa.placa from nucleo.placa_do_ativo pa
         where pa.ativo_id = c.ativo_id and pa.excluido_em is null
         order by pa.fim is null desc, pa.inicio desc limit 1) pl on true
  ),
  m as materialized (
    select d.*, coalesce(d.filial_id::text, 'sem-filial') as chip, coalesce(d.filial, 'Sem filial') as nome_da_filial
      from d where d.mes_do_fim = v_mes
  ),
  f as materialized (
    select * from m
     where (v_filtro is null or m.chip = v_filtro)
       and (v_busca is null
            or nucleo.texto_simples(coalesce(m.placa, '') || ' ' || coalesce(m.operacao, '') || ' ' || m.nome_da_filial)
               like '%' || v_busca || '%')
  ),
  pg as (select nucleo.pagina_do_painel((select count(*) from f), p_pagina, v_tam) as pagina, (select count(*) from f) as total),
  filiais as (select m.chip as id, m.nome_da_filial as nome, count(*) as n from m group by 1, 2),
  etapas(sigla, ordem) as (values ('DOp', 1), ('ACe', 2), ('CAr', 3), ('CAn', 4)),
  serie as (select (v_primeiro + make_interval(months => k))::date as mes from generate_series(0, 11) k),
  por_operacao as (
    select coalesce(m.operacao, 'Sem operação') as operacao, round(avg(m.t_car))::bigint as n
      from m group by 1 order by 2 desc, 1 limit 10)
  select jsonb_build_object(
    'mes', to_char(v_mes, 'YYYY-MM-DD'),
    'meses', coalesce((
      select jsonb_agg(to_char(x.mes, 'YYYY-MM-DD') order by x.mes desc)
        from (select date_trunc('month', e.em at time zone 'America/Sao_Paulo')::date as mes
                from nucleo.evento_de_status e
               where e.excluido_em is null and e.sigla = 'ETc' and e.em >= now() - interval '24 months'
              union select v_mes) x), '[]'::jsonb),
    'kpis', jsonb_build_array(
      nucleo.kpi_do_painel('espera-media', 'Espera média para carregar',
        coalesce(to_jsonb((select round(avg(m.espera))::bigint from m)), 'null'::jsonb), 'duracao', 'DOp e ACe, até o carregamento'),
      nucleo.kpi_do_painel('maior-espera', 'Maior espera para carregar',
        coalesce(to_jsonb((select max(m.espera) from m)), 'null'::jsonb), 'duracao'),
      nucleo.kpi_do_painel('passagens', 'Passagens concluídas', to_jsonb((select count(*) from m)), 'inteiro', 'Até o ETc no mês'),
      nucleo.kpi_do_painel('ciclo', 'Ciclo médio até o ETc',
        coalesce(to_jsonb((select round(avg(m.ciclo))::bigint from m)), 'null'::jsonb), 'duracao', 'Do primeiro evento ao ETc')),
    'graficos', jsonb_build_array(
      jsonb_build_object('id', 'etapas', 'titulo', 'Tempo de cada etapa (minutos)',
        'descricao', 'DOp, ACe, CAr e CAn: a média de cada etapa, por filial.', 'tipo', 'barras', 'formato', 'inteiro', 'colunas', 12,
        'categorias', (select jsonb_agg(e.sigla order by e.ordem) from etapas e),
        'series', coalesce((
          select jsonb_agg(jsonb_build_object('nome', fi.nome, 'tipo', 'barra', 'valores', (
                   select jsonb_agg((select round(avg(case e.sigla when 'DOp' then x.t_dop when 'ACe' then x.t_ace
                                                                   when 'CAr' then x.t_car else x.t_can end))::bigint
                                       from m x where x.chip = fi.id) order by e.ordem)
                     from etapas e)) order by fi.nome)
            from filiais fi), '[]'::jsonb)),
      jsonb_build_object('id', 'por-filial', 'titulo', 'Ciclo por filial (minutos)', 'descricao', 'Tempo médio do ciclo.',
        'tipo', 'barras', 'deitado', true, 'formato', 'inteiro', 'colunas', 4,
        'categorias', coalesce((select jsonb_agg(fi.nome order by fi.nome) from filiais fi), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Ciclo', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg((select round(avg(x.ciclo))::bigint from m x where x.chip = fi.id) order by fi.nome)
                                 from filiais fi), '[]'::jsonb)))),
      jsonb_build_object('id', 'por-operacao', 'titulo', 'Carregamento por operação (minutos)', 'descricao', 'Quem mais demora a carregar.',
        'tipo', 'barras', 'deitado', true, 'formato', 'inteiro', 'colunas', 4,
        'categorias', coalesce((select jsonb_agg(o.operacao order by o.n desc, o.operacao) from por_operacao o), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'CAr', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(o.n order by o.n desc, o.operacao) from por_operacao o), '[]'::jsonb)))),
      jsonb_build_object('id', 'evolucao', 'titulo', 'Evolução mensal (minutos)', 'descricao', 'O ciclo médio mês a mês.',
        'tipo', 'barras', 'formato', 'inteiro', 'colunas', 4,
        'categorias', (select jsonb_agg(to_char(s.mes, 'MM/YYYY') order by s.mes) from serie s),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Ciclo', 'tipo', 'linha',
          'valores', (select jsonb_agg((select round(avg(x.ciclo))::bigint from d x where x.mes_do_fim = s.mes) order by s.mes)
                        from serie s))))),
    'chips', jsonb_build_array(jsonb_build_object('id', 'todos', 'nome', 'Todos', 'contagem', (select count(*) from m)))
             || coalesce((select jsonb_agg(jsonb_build_object('id', fi.id, 'nome', fi.nome, 'contagem', fi.n) order by fi.nome)
                            from filiais fi), '[]'::jsonb),
    'tabela', nucleo.tabela_do_painel('Passagens pelo Operacional', 'passagem',
      jsonb_build_array(
        jsonb_build_object('id', 'placa', 'rotulo', 'Placa', 'formato', 'placa'),
        jsonb_build_object('id', 'filial', 'rotulo', 'Filial', 'formato', 'texto'),
        jsonb_build_object('id', 'operacao', 'rotulo', 'Operação', 'formato', 'texto'),
        jsonb_build_object('id', 'etapa', 'rotulo', 'Etapa mais longa', 'formato', 'texto'),
        jsonb_build_object('id', 'espera', 'rotulo', 'Espera para carregar', 'formato', 'duracao'),
        jsonb_build_object('id', 'ciclo', 'rotulo', 'Ciclo até o ETc', 'formato', 'duracao')),
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.ativo_id::text || '@' || extract(epoch from x.inicio)::bigint::text,
          'item', coalesce(x.placa, 'Placa'), 'grupo', x.chip,
          'href', case when x.placa is not null then '/frota/placas/' || x.placa end,
          'celulas', jsonb_build_object('placa', x.placa, 'filial', x.nome_da_filial, 'operacao', x.operacao,
                                        'etapa', x.etapa, 'espera', x.espera, 'ciclo', x.ciclo),
          'detalhes', jsonb_build_array(
            jsonb_build_object('rotulo', 'Tempo em DOp', 'valor', x.t_dop, 'formato', 'duracao'),
            jsonb_build_object('rotulo', 'Tempo em ACe', 'valor', x.t_ace, 'formato', 'duracao'),
            jsonb_build_object('rotulo', 'Tempo em CAr', 'valor', x.t_car, 'formato', 'duracao'),
            jsonb_build_object('rotulo', 'Tempo em CAn', 'valor', x.t_can, 'formato', 'duracao'),
            jsonb_build_object('rotulo', 'Início', 'valor', x.inicio, 'formato', 'data-e-hora'),
            jsonb_build_object('rotulo', 'ETc', 'valor', x.fim, 'formato', 'data-e-hora')))
          order by x.fim desc, x.placa, x.ativo_id), '[]'::jsonb)
         from (select * from f order by f.fim desc, f.placa, f.ativo_id
                offset ((select pagina from pg) - 1) * v_tam limit v_tam) x),
      (select total from pg), (select pagina from pg), v_tam),
    'opcoes', '{}'::jsonb,
    'avisos', '[]'::jsonb
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.analise_do_operacional(date, text, text, integer, integer) from public, anon;
comment on function nucleo.analise_do_operacional(date, text, text, integer, integer) is
  'Operacional › Análise, no contrato único do painel: passagens pelo Operacional (DOp, ACe, CAr e CAn até o ETc) no mês do ETc, tempo de cada etapa, espera para carregar e ciclo, por filial e operação. Operacional › ver, pela RLS do evento.';

-- ---------------------------------------------------------------------------------------------
-- Pessoas › Análise
-- ---------------------------------------------------------------------------------------------
create function nucleo.analise_das_pessoas(
  p_mes date default null, p_filtro text default null, p_busca text default null, p_pagina integer default 1, p_tam integer default 20
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_vejo uuid[] := nucleo.operacoes_da_escala('ver');
  v_filtro text := nullif(nullif(btrim(coalesce(p_filtro, '')), ''), 'todos');
  v_busca text := nucleo.texto_simples(nullif(btrim(coalesce(p_busca, '')), ''));
  v_tam integer := nucleo.tam_do_painel(p_tam);
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_mes date := date_trunc('month', coalesce(p_mes, nucleo.hoje_em_sao_paulo()))::date;
  v_fim date;
  v_primeiro date;
  v_resultado jsonb;
begin
  if v_vejo is not null and cardinality(v_vejo) = 0 then
    raise exception 'Você não tem permissão para ver a análise de Pessoas.' using errcode = '42501';
  end if;
  if v_filtro is not null and not exists (select 1 from pessoas.funcao fu where fu.codigo = v_filtro) then
    raise exception 'Filtro da análise de Pessoas desconhecido.' using errcode = '22023';
  end if;
  v_fim := (v_mes + interval '1 month')::date;
  v_primeiro := (v_mes - interval '11 months')::date;

  with vin as materialized (
    select v.pessoa_id, v.operacao_id, v.funcao, v.inicio, v.fim, v.periodo
      from pessoas.vinculo v
      join nucleo.pessoa p on p.id = v.pessoa_id and p.excluido_em is null
     where v.excluido_em is null and v.periodo && daterange(v_primeiro, v_fim + 1, '[)')
  ),
  dias as (
    select d::date as dia, date_trunc('month', d)::date as mes
      from generate_series(v_primeiro, least(v_fim - 1, v_hoje), interval '1 day') d
  ),
  efetivo as (
    select di.mes, avg((select count(*) from vin vi where vi.periodo @> di.dia)) as media
      from dias di group by di.mes
  ),
  esc as materialized (
    select m.pessoa_id, m.operacao_id, m.sigla, date_trunc('month', m.dia)::date as mes
      from pessoas.marcacao_da_escala m
     where m.dia >= v_primeiro and m.dia < v_fim
  ),
  deslig as (
    select count(distinct vi.pessoa_id) as n
      from vin vi
     where vi.fim >= v_mes and vi.fim < v_fim
       and not exists (select 1 from vin o where o.pessoa_id = vi.pessoa_id and o.periodo @> vi.fim)
  ),
  pm as (
    select distinct on (vi.pessoa_id) vi.pessoa_id, vi.funcao, vi.operacao_id
      from vin vi where vi.periodo && daterange(v_mes, v_fim, '[)')
     order by vi.pessoa_id, vi.inicio desc
  ),
  linhas as materialized (
    select pm.pessoa_id, p.nome, pm.funcao, fu.nome as nome_da_funcao, fu.ordem as ordem_da_funcao, o.nome as operacao,
           count(e.sigla) filter (where e.sigla = 'T') as dias,
           count(e.sigla) filter (where e.sigla in ('FE', 'AT')) as ausencias,
           count(e.sigla) filter (where e.sigla = 'F') as folgas
      from pm
      join nucleo.pessoa p on p.id = pm.pessoa_id
      join pessoas.funcao fu on fu.codigo = pm.funcao
      left join nucleo.operacao o on o.id = pm.operacao_id
      left join esc e on e.pessoa_id = pm.pessoa_id and e.mes = v_mes
     group by pm.pessoa_id, p.nome, pm.funcao, fu.nome, fu.ordem, o.nome
  ),
  f as materialized (
    select * from linhas l
     where (v_filtro is null or l.funcao = v_filtro)
       and (v_busca is null
            or nucleo.texto_simples(l.nome || ' ' || l.nome_da_funcao || ' ' || coalesce(l.operacao, '')) like '%' || v_busca || '%')
  ),
  pg as (select nucleo.pagina_do_painel((select count(*) from f), p_pagina, v_tam) as pagina, (select count(*) from f) as total),
  serie as (select (v_primeiro + make_interval(months => k))::date as mes from generate_series(0, 11) k),
  funcoes as (
    select l.funcao as id, l.nome_da_funcao as nome, l.ordem_da_funcao as ordem, count(*) as n
      from linhas l group by 1, 2, 3),
  por_operacao as (
    select coalesce(o.nome, 'Sem operação') as operacao, count(*) as n
      from esc e left join nucleo.operacao o on o.id = e.operacao_id
     where e.mes = v_mes and e.sigla in ('FE', 'AT')
     group by 1 order by 2 desc, 1 limit 10),
  marcacoes(sigla, nome, ordem) as (values ('T', 'Trabalho', 1), ('F', 'Folga', 2), ('FE', 'Férias', 3), ('AT', 'Atestado', 4))
  select jsonb_build_object(
    'mes', to_char(v_mes, 'YYYY-MM-DD'),
    'meses', (select jsonb_agg(to_char(s.mes, 'YYYY-MM-DD') order by s.mes desc)
                from (select (date_trunc('month', v_hoje) - make_interval(months => k))::date as mes from generate_series(0, 23) k
                      union select v_mes) s),
    'kpis', jsonb_build_array(
      nucleo.kpi_do_painel('efetivo', 'Efetivo médio',
        coalesce(to_jsonb((select round(e.media)::bigint from efetivo e where e.mes = v_mes)), 'null'::jsonb), 'inteiro',
        'Pessoas com vínculo, média por dia'),
      nucleo.kpi_do_painel('ausencias', 'Ausências',
        to_jsonb((select count(*) from esc e where e.mes = v_mes and e.sigla in ('FE', 'AT'))), 'inteiro', 'Dias de férias e atestado'),
      nucleo.kpi_do_painel('rotatividade', 'Rotatividade',
        coalesce(to_jsonb((select round((select n from deslig) * 100.0 / nullif(e.media, 0), 1) from efetivo e where e.mes = v_mes)),
                 'null'::jsonb), 'percentual', 'Desligamentos ÷ efetivo médio'),
      nucleo.kpi_do_painel('custo', 'Custo por pessoa', 'null'::jsonb, 'moeda', 'Sem dados ainda: depende da folha')),
    'graficos', jsonb_build_array(
      jsonb_build_object('id', 'por-mes', 'titulo', 'Efetivo e ausências por mês',
        'descricao', 'O efetivo médio e os dias de ausência, mês a mês.', 'tipo', 'barras', 'formato', 'inteiro', 'colunas', 12,
        'categorias', (select jsonb_agg(to_char(s.mes, 'MM/YYYY') order by s.mes) from serie s),
        'series', jsonb_build_array(
          jsonb_build_object('nome', 'Efetivo', 'tipo', 'barra',
            'valores', (select jsonb_agg((select round(e.media)::bigint from efetivo e where e.mes = s.mes) order by s.mes) from serie s)),
          jsonb_build_object('nome', 'Ausências', 'tipo', 'linha', 'cor', 'negativo',
            'valores', (select jsonb_agg((select count(*) from esc e where e.mes = s.mes and e.sigla in ('FE', 'AT')) order by s.mes)
                          from serie s)))),
      jsonb_build_object('id', 'funcao', 'titulo', 'Por função', 'tipo', 'barras', 'deitado', true, 'formato', 'inteiro', 'colunas', 4,
        'categorias', coalesce((select jsonb_agg(fu.nome order by fu.ordem, fu.nome) from funcoes fu), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Pessoas', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(fu.n order by fu.ordem, fu.nome) from funcoes fu), '[]'::jsonb)))),
      jsonb_build_object('id', 'operacao', 'titulo', 'Ausências por operação', 'tipo', 'barras', 'deitado', true, 'formato', 'inteiro',
        'colunas', 4,
        'categorias', coalesce((select jsonb_agg(o.operacao order by o.n desc, o.operacao) from por_operacao o), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Ausências', 'tipo', 'barra', 'cor', 'negativo',
          'valores', coalesce((select jsonb_agg(o.n order by o.n desc, o.operacao) from por_operacao o), '[]'::jsonb)))),
      jsonb_build_object('id', 'marcacao', 'titulo', 'Dias da escala por marcação', 'tipo', 'rosca', 'formato', 'inteiro', 'colunas', 4,
        'categorias', (select jsonb_agg(mc.nome order by mc.ordem) from marcacoes mc),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Dias', 'tipo', 'barra',
          'valores', (select jsonb_agg((select count(*) from esc e where e.mes = v_mes and e.sigla = mc.sigla) order by mc.ordem)
                        from marcacoes mc))))),
    'chips', jsonb_build_array(jsonb_build_object('id', 'todos', 'nome', 'Todos', 'contagem', (select count(*) from linhas)))
             || coalesce((select jsonb_agg(jsonb_build_object('id', fu.id, 'nome', fu.nome, 'contagem', fu.n) order by fu.ordem, fu.nome)
                            from funcoes fu), '[]'::jsonb),
    'tabela', nucleo.tabela_do_painel('Variações por pessoa', 'pessoa',
      jsonb_build_array(
        jsonb_build_object('id', 'pessoa', 'rotulo', 'Pessoa', 'formato', 'texto'),
        jsonb_build_object('id', 'funcao', 'rotulo', 'Função', 'formato', 'texto'),
        jsonb_build_object('id', 'operacao', 'rotulo', 'Operação', 'formato', 'texto'),
        jsonb_build_object('id', 'dias', 'rotulo', 'Dias trabalhados', 'formato', 'inteiro'),
        jsonb_build_object('id', 'folgas', 'rotulo', 'Folgas', 'formato', 'inteiro'),
        jsonb_build_object('id', 'ausencias', 'rotulo', 'Ausências', 'formato', 'inteiro')),
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.pessoa_id::text, 'item', x.nome, 'grupo', x.funcao, 'href', '/pessoas/lista/' || x.pessoa_id::text,
          'celulas', jsonb_build_object('pessoa', x.nome, 'funcao', x.nome_da_funcao, 'operacao', x.operacao,
                                        'dias', x.dias, 'folgas', x.folgas, 'ausencias', x.ausencias))
          order by x.ausencias desc, x.nome, x.pessoa_id), '[]'::jsonb)
         from (select * from f order by f.ausencias desc, f.nome, f.pessoa_id
                offset ((select pagina from pg) - 1) * v_tam limit v_tam) x),
      (select total from pg), (select pagina from pg), v_tam),
    'opcoes', '{}'::jsonb,
    'avisos', '[]'::jsonb
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.analise_das_pessoas(date, text, text, integer, integer) from public, anon;
comment on function nucleo.analise_das_pessoas(date, text, text, integer, integer) is
  'Pessoas › Análise, no contrato único do painel: efetivo médio, ausências (FE e AT na escala), rotatividade e as variações por pessoa no mês. Pessoas › ver alcança todas; o Operacional, as operações da filial (pela RLS do vínculo e da escala).';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.analise_do_operacional(date,text,text,integer,integer)', 'Operacional › Análise no contrato do painel, pela RLS de quem consulta.'),
  ('nucleo.analise_das_pessoas(date,text,text,integer,integer)', 'Pessoas › Análise no contrato do painel, pela RLS de quem consulta.');
grant execute on function nucleo.analise_do_operacional(date, text, text, integer, integer) to authenticated;
grant execute on function nucleo.analise_das_pessoas(date, text, text, integer, integer) to authenticated;
