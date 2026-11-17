-- Início › Resumo do dia (Nível 3; pgTAP 128): a frota de hoje no contrato único das telas de painel. Lê a
-- leitura da placa (sigla, grupo e desde, já calculados) com a permissão de quem chama: a RLS recorta (o
-- gestor vê a carteira; o Operacional, a filial; o Administrador e a Diretoria, tudo). A régua vem de
-- config.status (sigla, grupo e ordem): uma definição só. A fila do totem são as chegadas sem saída.

create function nucleo.resumo_do_dia(
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
  v_agora timestamptz := now();
  v_resultado jsonb;
begin
  perform p_mes; -- o contrato único do painel passa o mês; o resumo é do momento.
  if not config.pode('inicio', 'ver') then
    raise exception 'Você não tem permissão para ver o resumo do dia.' using errcode = '42501';
  end if;
  if v_filtro is not null and v_filtro not in ('atencao', 'impedida', 'patio') then
    raise exception 'Filtro do resumo do dia desconhecido.' using errcode = '22023';
  end if;
  with p as materialized (
    select l.ativo_id, l.placa, l.sigla, l.grupo, l.desde, l.operacao, l.gestor, l.nome_da_situacao,
           greatest(0, floor(extract(epoch from (v_agora - l.desde)) / 60))::bigint as parada_min
      from nucleo.leitura_da_placa l
     where l.baixada_em is null or l.baixada_em > v_agora
  ),
  pedem as materialized (select * from p where p.grupo in ('atencao', 'impedida', 'patio')),
  f as materialized (
    select * from pedem
     where (v_filtro is null or pedem.grupo = v_filtro)
       and (v_busca is null
            or nucleo.texto_simples(pedem.placa || ' ' || coalesce(pedem.sigla, '') || ' ' || coalesce(pedem.operacao, '') || ' '
                                    || coalesce(pedem.gestor, '')) like '%' || v_busca || '%')
  ),
  pg as (select nucleo.pagina_do_painel((select count(*) from f), p_pagina, v_tam) as pagina, (select count(*) from f) as total),
  grupos(id, nome, ordem) as (values ('em-atividade', 'Em atividade', 1), ('atencao', 'Atenção', 2), ('impedida', 'Impedida', 3),
                                     ('patio', 'Pátio', 4), ('fora', 'Fora', 5)),
  por_operacao as (
    select coalesce(operacao, 'Sem operação') as operacao, count(*) as n
      from p where grupo = 'em-atividade' group by 1 order by 2 desc, 1 limit 12)
  select jsonb_build_object(
    'mes', null, 'meses', '[]'::jsonb,
    'kpis', jsonb_build_array(
      nucleo.kpi_do_painel('em-atividade', 'Placas em atividade', to_jsonb((select count(*) from p where grupo = 'em-atividade')), 'inteiro'),
      nucleo.kpi_do_painel('impedidas', 'Placas impedidas', to_jsonb((select count(*) from p where grupo = 'impedida')), 'inteiro'),
      nucleo.kpi_do_painel('patio', 'Placas no pátio', to_jsonb((select count(*) from p where grupo = 'patio')), 'inteiro'),
      nucleo.kpi_do_painel('fila', 'Fila do totem', to_jsonb((select count(*) from operacional.chegada c where c.saiu_em is null)), 'inteiro',
        'Chegadas sem saída'),
      nucleo.kpi_do_painel('pendencias', 'Pendências abertas', to_jsonb((select count(*) from pedem)), 'inteiro',
        'Atenção, impedida e pátio')),
    'graficos', jsonb_build_array(
      jsonb_build_object('id', 'regua', 'titulo', 'Placas por situação hoje', 'descricao', 'A régua de status inteira, com a contagem de cada sigla.',
        'tipo', 'barras', 'formato', 'inteiro', 'colunas', 12,
        'categorias', coalesce((select jsonb_agg(s.sigla order by s.ordem, s.sigla) from config.status s), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Placas', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg((select count(*) from p where p.sigla = s.sigla) order by s.ordem, s.sigla)
                                 from config.status s), '[]'::jsonb)))),
      jsonb_build_object('id', 'grupos', 'titulo', 'Por grupo da régua', 'tipo', 'rosca', 'formato', 'inteiro', 'colunas', 4,
        'categorias', (select jsonb_agg(g.nome order by g.ordem) from grupos g),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Placas', 'tipo', 'barra',
          'valores', (select jsonb_agg((select count(*) from p where p.grupo = g.id) order by g.ordem) from grupos g)))),
      jsonb_build_object('id', 'operacoes', 'titulo', 'Em atividade por operação', 'tipo', 'barras', 'deitado', true,
        'formato', 'inteiro', 'colunas', 8,
        'categorias', coalesce((select jsonb_agg(o.operacao order by o.n desc, o.operacao) from por_operacao o), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Em atividade', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(o.n order by o.n desc, o.operacao) from por_operacao o), '[]'::jsonb))))),
    'chips', jsonb_build_array(
      jsonb_build_object('id', 'todos', 'nome', 'Todos', 'contagem', (select count(*) from pedem)),
      jsonb_build_object('id', 'atencao', 'nome', 'Atenção', 'contagem', (select count(*) from pedem where grupo = 'atencao')),
      jsonb_build_object('id', 'impedida', 'nome', 'Impedida', 'contagem', (select count(*) from pedem where grupo = 'impedida')),
      jsonb_build_object('id', 'patio', 'nome', 'Pátio', 'contagem', (select count(*) from pedem where grupo = 'patio'))),
    'tabela', nucleo.tabela_do_painel('O que pede atenção hoje', 'pendência',
      jsonb_build_array(
        jsonb_build_object('id', 'placa', 'rotulo', 'Placa', 'formato', 'placa'),
        jsonb_build_object('id', 'situacao', 'rotulo', 'Situação', 'formato', 'texto'),
        jsonb_build_object('id', 'paradaHa', 'rotulo', 'Parada há', 'formato', 'duracao'),
        jsonb_build_object('id', 'operacao', 'rotulo', 'Operação', 'formato', 'texto'),
        jsonb_build_object('id', 'gestor', 'rotulo', 'Gestor', 'formato', 'texto')),
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.ativo_id::text, 'item', x.placa, 'href', '/frota/placas/' || x.placa,
          'celulas', jsonb_build_object('placa', x.placa,
                                        'situacao', coalesce(x.sigla, '—') || ' · ' || (select g.nome from grupos g where g.id = x.grupo),
                                        'paradaHa', x.parada_min, 'operacao', x.operacao, 'gestor', x.gestor),
          'detalhes', jsonb_build_array(
            jsonb_build_object('rotulo', 'Situação', 'valor', x.nome_da_situacao, 'formato', 'texto'),
            jsonb_build_object('rotulo', 'Desde', 'valor', x.desde, 'formato', 'data-e-hora')))
          order by x.parada_min desc, x.placa, x.ativo_id), '[]'::jsonb)
         from (select * from f order by f.parada_min desc, f.placa, f.ativo_id offset ((select pagina from pg) - 1) * v_tam limit v_tam) x),
      (select total from pg), (select pagina from pg), v_tam),
    'opcoes', '{}'::jsonb,
    'avisos', '[]'::jsonb
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.resumo_do_dia(date, text, text, integer, integer) from public, anon;
comment on function nucleo.resumo_do_dia(date, text, text, integer, integer) is
  'Início › Resumo do dia, no contrato único do painel: placas por grupo e por sigla (config.status), fila do totem e o que pede atenção hoje (a mais parada primeiro). Início › ver, pela RLS de quem consulta.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.resumo_do_dia(date,text,text,integer,integer)', 'Início › Resumo do dia no contrato do painel, pela RLS de quem consulta.');
grant execute on function nucleo.resumo_do_dia(date, text, text, integer, integer) to authenticated;
