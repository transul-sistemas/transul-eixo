-- Cadastros › CRs (Nível 3; pgTAP 127): a lista dos CRs analíticos no contrato único das telas de painel,
-- com a placa vigente e a operação vigente de cada um (nucleo.operacao_do_cr_em, a função única do N1).
-- A linha leva à Ficha do CR (/cadastros/crs/<id>, lida por nucleo.historia_do_cr). Cadastros › ver, com a
-- permissão de quem chama (cr_ler). O agrupador (CR pai, analitico = false) fica de fora.

create function nucleo.lista_de_crs(
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
  perform p_mes; -- o contrato único do painel passa o mês; a lista de CRs é do momento, não do mês.
  if not config.pode('cadastros', 'ver') then
    raise exception 'Você não tem permissão para ver os CRs.' using errcode = '42501';
  end if;
  if v_filtro is not null and v_filtro not in ('com_placa', 'sem_placa', 'sem_operacao', 'bloqueados') then
    raise exception 'Filtro da lista de CRs desconhecido.' using errcode = '22023';
  end if;
  with c as materialized (
    select cr.id, cr.codigo, cr.nome, cr.codcencus, coalesce(cr.tipo::text, 'sem tipo') as tipo, cr.bloqueado, cr.ativo,
           cr.filial_do_cr, cr.unidade_gerencial,
           (select pa.placa from nucleo.cr_do_ativo v
              join nucleo.placa_do_ativo pa on pa.ativo_id = v.ativo_id and pa.fim is null and pa.excluido_em is null
             where v.cr_id = cr.id and v.excluido_em is null and v.periodo @> v_agora
             order by v.inicio desc, v.id limit 1) as placa,
           (select o.nome from nucleo.operacao o where o.id = nucleo.operacao_do_cr_em(cr.id, v_agora)) as operacao
      from nucleo.cr cr
     where cr.excluido_em is null and coalesce(cr.analitico, true)
  ),
  f as materialized (
    select * from c
     where (v_filtro is null
            or (v_filtro = 'com_placa' and c.placa is not null)
            or (v_filtro = 'sem_placa' and c.placa is null)
            or (v_filtro = 'sem_operacao' and c.operacao is null)
            or (v_filtro = 'bloqueados' and (c.bloqueado or not c.ativo)))
       and (v_busca is null
            or nucleo.texto_simples(c.codigo || ' ' || coalesce(c.nome, '') || ' ' || coalesce(c.codcencus::text, '') || ' '
                                    || coalesce(c.placa, '') || ' ' || coalesce(c.operacao, '')) like '%' || v_busca || '%')
  ),
  pg as (select nucleo.pagina_do_painel((select count(*) from f), p_pagina, v_tam) as pagina, (select count(*) from f) as total),
  por_tipo as (select tipo, count(*) as n from c group by tipo)
  select jsonb_build_object(
    'mes', null, 'meses', '[]'::jsonb,
    'kpis', jsonb_build_array(
      nucleo.kpi_do_painel('crs', 'CRs', to_jsonb((select count(*) from c)), 'inteiro', 'Analíticos, sem o agrupador'),
      nucleo.kpi_do_painel('com-placa', 'Com placa vigente', to_jsonb((select count(*) from c where placa is not null)), 'inteiro'),
      nucleo.kpi_do_painel('sem-operacao', 'Sem operação', to_jsonb((select count(*) from c where operacao is null)), 'inteiro'),
      nucleo.kpi_do_painel('bloqueados', 'Bloqueados ou inativos', to_jsonb((select count(*) from c where bloqueado or not ativo)), 'inteiro',
        'Continuam recebendo despesa')),
    'graficos', jsonb_build_array(
      jsonb_build_object('id', 'por-tipo', 'titulo', 'CRs por tipo', 'descricao', 'O tipo classifica o CR; o lançamento ganha tipo próprio depois (D0).',
        'tipo', 'barras', 'deitado', true, 'formato', 'inteiro', 'colunas', 12,
        'categorias', coalesce((select jsonb_agg(t.tipo order by t.n desc, t.tipo) from por_tipo t), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'CRs', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(t.n order by t.n desc, t.tipo) from por_tipo t), '[]'::jsonb))))),
    'chips', jsonb_build_array(
      jsonb_build_object('id', 'todos', 'nome', 'Todos', 'contagem', (select count(*) from c)),
      jsonb_build_object('id', 'com_placa', 'nome', 'Com placa', 'contagem', (select count(*) from c where placa is not null)),
      jsonb_build_object('id', 'sem_placa', 'nome', 'Sem placa', 'contagem', (select count(*) from c where placa is null)),
      jsonb_build_object('id', 'sem_operacao', 'nome', 'Sem operação', 'contagem', (select count(*) from c where operacao is null)),
      jsonb_build_object('id', 'bloqueados', 'nome', 'Bloqueados', 'contagem', (select count(*) from c where bloqueado or not ativo))),
    'tabela', nucleo.tabela_do_painel('CRs', 'CR',
      jsonb_build_array(
        jsonb_build_object('id', 'cr', 'rotulo', 'CR', 'formato', 'texto'),
        jsonb_build_object('id', 'nome', 'rotulo', 'Nome', 'formato', 'texto'),
        jsonb_build_object('id', 'tipo', 'rotulo', 'Tipo', 'formato', 'texto'),
        jsonb_build_object('id', 'placa', 'rotulo', 'Placa vigente', 'formato', 'placa'),
        jsonb_build_object('id', 'operacao', 'rotulo', 'Operação vigente', 'formato', 'texto'),
        jsonb_build_object('id', 'situacao', 'rotulo', 'Situação', 'formato', 'texto')),
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.id::text, 'item', 'CR ' || x.codigo, 'href', '/cadastros/crs/' || x.id,
          'celulas', jsonb_build_object('cr', x.codigo, 'nome', x.nome, 'tipo', x.tipo, 'placa', x.placa, 'operacao', x.operacao,
                                        'situacao', case when x.bloqueado then 'Bloqueado' when not x.ativo then 'Inativo' else 'Ativo' end),
          'detalhes', jsonb_build_array(
            jsonb_build_object('rotulo', 'Código do Sankhya', 'valor', x.codcencus, 'formato', 'inteiro'),
            jsonb_build_object('rotulo', 'Filial', 'valor', x.filial_do_cr, 'formato', 'texto'),
            jsonb_build_object('rotulo', 'Unidade gerencial', 'valor', x.unidade_gerencial, 'formato', 'texto')))
          order by x.codigo, x.id), '[]'::jsonb)
         from (select * from f order by f.codigo, f.id offset ((select pagina from pg) - 1) * v_tam limit v_tam) x),
      (select total from pg), (select pagina from pg), v_tam),
    'opcoes', '{}'::jsonb,
    'avisos', jsonb_build_array('Bloqueado ou inativo no Sankhya é informação, não filtro: o CR continua recebendo despesa.')
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.lista_de_crs(date, text, text, integer, integer) from public, anon;
comment on function nucleo.lista_de_crs(date, text, text, integer, integer) is
  'Cadastros › CRs, no contrato único do painel: os CRs analíticos com a placa e a operação vigentes, chips por situação, busca e página; a linha leva à Ficha do CR. Cadastros › ver.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.lista_de_crs(date,text,text,integer,integer)', 'Cadastros › CRs no contrato do painel, pela RLS de quem consulta (Cadastros › ver).');
grant execute on function nucleo.lista_de_crs(date, text, text, integer, integer) to authenticated;
