-- Administração › Auditoria (Nível 3; pgTAP 126): quem mudou o quê, quando e por quê, no contrato único das
-- telas de painel (lib/dados/painel-tipos.ts). Lê auditoria.evento pela política auditoria_evento_ler
-- (Administração › ver), com a permissão de quem chama. O mês é [início, fim) no horário de São Paulo.
-- Mostra só os NOMES dos campos alterados, nunca os valores (coluna sensível já não entra no evento).

-- O módulo de uma tabela auditada (uma definição só; a tela agrupa e filtra por ele).
create function nucleo.modulo_da_tabela(p_tabela text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tabela like 'pessoas.%' or p_tabela in ('nucleo.pessoa', 'nucleo.pessoa_documento') then 'Pessoas'
    when p_tabela like 'parceiros.%' then 'Parceiros'
    when p_tabela like 'operacional.%' or p_tabela in ('nucleo.custodia', 'nucleo.chegada') then 'Operacional'
    when p_tabela like 'financeiro.%' then 'Resultados'
    when p_tabela like 'config.%' or p_tabela in ('nucleo.cr', 'nucleo.classificacao_de_centro', 'nucleo.dono_de_problema') then 'Cadastros'
    when p_tabela in ('nucleo.operacao', 'nucleo.placa_na_operacao', 'nucleo.cr_de_servico_na_operacao', 'nucleo.cr_na_operacao') then 'Operações'
    when p_tabela in ('nucleo.usuario', 'nucleo.delegacao', 'nucleo.reatribuicao_de_tarefa', 'nucleo.pedido_de_aprovacao') then 'Administração'
    else 'Frota'
  end
$$;
revoke all on function nucleo.modulo_da_tabela(text) from public, anon;
comment on function nucleo.modulo_da_tabela(text) is
  'O módulo do Eixo de uma tabela auditada (esquema.tabela), para a Auditoria agrupar e filtrar.';

create function nucleo.eventos_de_auditoria(
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
  v_de timestamptz := (v_mes::timestamp) at time zone 'America/Sao_Paulo';
  v_ate timestamptz := ((v_mes + interval '1 month')::timestamp) at time zone 'America/Sao_Paulo';
  v_resultado jsonb;
begin
  if not config.pode('admin', 'ver') then
    raise exception 'Você não tem permissão para ver a auditoria.' using errcode = '42501';
  end if;
  if v_filtro is not null and v_filtro not in ('inclusao', 'edicao', 'exclusao') then
    raise exception 'Filtro da auditoria desconhecido.' using errcode = '22023';
  end if;
  with e as materialized (
    select ev.id, ev.tabela, ev.operacao, ev.registro_id, ev.usuario_id, ev.em, ev.motivo,
           (ev.em at time zone 'America/Sao_Paulo')::date as dia,
           nucleo.modulo_da_tabela(ev.tabela) as modulo,
           case ev.operacao when 'INSERT' then 'inclusao' when 'UPDATE' then 'edicao' else 'exclusao' end as chip,
           case ev.operacao when 'INSERT' then 'inclusão' when 'UPDATE' then 'edição' else 'exclusão' end as acao,
           coalesce(ps.nome, case when ev.usuario_id is null then 'Sistema (carga ou rotina)' else 'Pessoa sem cadastro' end) as pessoa,
           case when ev.operacao = 'UPDATE' then (
             select string_agg(k, ', ' order by k)
               from (select jsonb_object_keys(coalesce(ev.antes, '{}'::jsonb) || coalesce(ev.depois, '{}'::jsonb)) as k) ks
              where k <> 'versao' and (ev.antes -> k) is distinct from (ev.depois -> k)) end as campos
      from auditoria.evento ev
      left join nucleo.usuario u on u.auth_user_id = ev.usuario_id
      left join nucleo.pessoa ps on ps.id = u.pessoa_id
     where ev.em >= v_de and ev.em < v_ate
  ),
  f as materialized (
    select * from e
     where (v_filtro is null or e.chip = v_filtro)
       and (v_busca is null
            or nucleo.texto_simples(e.tabela || ' ' || coalesce(e.registro_id, '') || ' ' || e.pessoa || ' ' || e.modulo) like '%' || v_busca || '%')
  ),
  pg as (select nucleo.pagina_do_painel((select count(*) from f), p_pagina, v_tam) as pagina, (select count(*) from f) as total),
  por_dia as (select dia, count(*) as n from e group by dia),
  por_modulo as (select modulo, count(*) as n from e group by modulo),
  por_acao as (select acao, count(*) as n from e group by acao)
  select jsonb_build_object(
    'mes', to_char(v_mes, 'YYYY-MM-DD'),
    'meses', coalesce((
      select jsonb_agg(to_char(m, 'YYYY-MM-DD') order by m desc)
        from (select distinct date_trunc('month', (x.em at time zone 'America/Sao_Paulo'))::date as m
                from auditoria.evento x
               where x.em >= v_de - interval '24 months') ms), '[]'::jsonb),
    'kpis', jsonb_build_array(
      nucleo.kpi_do_painel('eventos', 'Eventos no mês', to_jsonb((select count(*) from e)), 'inteiro'),
      nucleo.kpi_do_painel('pessoas', 'Pessoas ativas', to_jsonb((select count(distinct usuario_id) from e where usuario_id is not null)), 'inteiro'),
      nucleo.kpi_do_painel('alteracoes', 'Alterações', to_jsonb((select count(*) from e where chip = 'edicao')), 'inteiro'),
      nucleo.kpi_do_painel('recusas', 'Acessos recusados', 'null'::jsonb, 'inteiro', 'Sem dados ainda: depende do registro de acesso recusado')),
    'graficos', jsonb_build_array(
      jsonb_build_object('id', 'por-dia', 'titulo', 'Eventos por dia', 'descricao', 'Quem fez o quê, quando e por quê.',
        'tipo', 'barras', 'formato', 'inteiro', 'colunas', 12,
        'categorias', coalesce((select jsonb_agg(to_char(d.dia, 'DD/MM') order by d.dia) from por_dia d), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Eventos', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(d.n order by d.dia) from por_dia d), '[]'::jsonb)))),
      jsonb_build_object('id', 'modulo', 'titulo', 'Por módulo', 'descricao', 'Onde mais se mexe.',
        'tipo', 'barras', 'deitado', true, 'formato', 'inteiro', 'colunas', 6,
        'categorias', coalesce((select jsonb_agg(m.modulo order by m.n desc, m.modulo) from por_modulo m), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Eventos', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(m.n order by m.n desc, m.modulo) from por_modulo m), '[]'::jsonb)))),
      jsonb_build_object('id', 'acao', 'titulo', 'Por ação', 'tipo', 'rosca', 'formato', 'inteiro', 'colunas', 6,
        'categorias', coalesce((select jsonb_agg(a.acao order by a.acao) from por_acao a), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Eventos', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(a.n order by a.acao) from por_acao a), '[]'::jsonb))))),
    'chips', jsonb_build_array(
      jsonb_build_object('id', 'todos', 'nome', 'Todos', 'contagem', (select count(*) from e)),
      jsonb_build_object('id', 'inclusao', 'nome', 'Inclusões', 'contagem', (select count(*) from e where chip = 'inclusao')),
      jsonb_build_object('id', 'edicao', 'nome', 'Edições', 'contagem', (select count(*) from e where chip = 'edicao')),
      jsonb_build_object('id', 'exclusao', 'nome', 'Exclusões', 'contagem', (select count(*) from e where chip = 'exclusao'))),
    'tabela', nucleo.tabela_do_painel('Eventos', 'evento',
      jsonb_build_array(
        jsonb_build_object('id', 'quando', 'rotulo', 'Quando', 'formato', 'data-e-hora'),
        jsonb_build_object('id', 'pessoa', 'rotulo', 'Pessoa', 'formato', 'texto'),
        jsonb_build_object('id', 'modulo', 'rotulo', 'Módulo', 'formato', 'texto'),
        jsonb_build_object('id', 'acao', 'rotulo', 'Ação', 'formato', 'texto'),
        jsonb_build_object('id', 'registro', 'rotulo', 'Registro', 'formato', 'texto')),
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.id::text, 'item', x.acao || ' em ' || x.tabela,
          'celulas', jsonb_build_object('quando', x.em, 'pessoa', x.pessoa, 'modulo', x.modulo, 'acao', x.acao,
                                        'registro', x.tabela || coalesce(' · ' || x.registro_id, '')),
          'detalhes', jsonb_build_array(
            jsonb_build_object('rotulo', 'Tabela', 'valor', x.tabela, 'formato', 'texto'),
            jsonb_build_object('rotulo', 'Registro', 'valor', x.registro_id, 'formato', 'texto'),
            jsonb_build_object('rotulo', 'Motivo', 'valor', x.motivo, 'formato', 'texto'))
            || case when x.campos is not null
                 then jsonb_build_array(jsonb_build_object('rotulo', 'Campos alterados', 'valor', x.campos, 'formato', 'texto'))
                 else '[]'::jsonb end)
          order by x.em desc, x.id desc), '[]'::jsonb)
         from (select * from f order by f.em desc, f.id desc offset ((select pagina from pg) - 1) * v_tam limit v_tam) x),
      (select total from pg), (select pagina from pg), v_tam),
    'opcoes', '{}'::jsonb,
    'avisos', jsonb_build_array('Só os nomes dos campos alterados aparecem aqui; os valores ficam no registro de auditoria.')
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.eventos_de_auditoria(date, text, text, integer, integer) from public, anon;
comment on function nucleo.eventos_de_auditoria(date, text, text, integer, integer) is
  'Administração › Auditoria, no contrato único do painel: eventos do mês ([início, fim) em São Paulo), por dia, módulo e ação; chips por ação; a página dos eventos com os nomes dos campos alterados. Administração › ver, pela política auditoria_evento_ler.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.modulo_da_tabela(text)', 'O módulo de uma tabela auditada (só texto, sem dado).'),
  ('nucleo.eventos_de_auditoria(date,text,text,integer,integer)', 'A Auditoria no contrato do painel, pela política auditoria_evento_ler (Administração › ver).');
grant execute on function nucleo.modulo_da_tabela(text) to authenticated;
grant execute on function nucleo.eventos_de_auditoria(date, text, text, integer, integer) to authenticated;
