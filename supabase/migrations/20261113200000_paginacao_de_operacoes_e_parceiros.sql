-- 10/11/2026 (Alexandre): as listas de Operações e de Parceiros passam a paginar no banco, com 20 linhas
-- por padrão, como Placas e Pessoas. Só se acrescentam p_pagina (padrão 1) e p_tam (padrão 20, teto
-- 100) no fim da assinatura: a chamada sem eles continua valendo (e traz a página 1). A resposta ganha
-- pagina, paginas, tam e total; página além do fim devolve a última (como nucleo.listar_placas).
-- Totais, chips e meses continuam sobre o conjunto filtrado inteiro. A ordem já desempatava pelo
-- nome e pelo id (a chave única); agora a página é cortada por essa mesma ordem.
--
-- O corpo é o de 20261111200000 (operações) e 20261111500000 (parceiros), sem mudar filtro, conta,
-- permissão nem RLS. Como a assinatura muda, a função antiga sai (drop) e a nova entra com os mesmos
-- grants, o mesmo security invoker e a mesma linha em config.funcao_executavel (só a assinatura muda).

-- ---------------------------------------------------------------------------------------------
-- Operações › lista
-- ---------------------------------------------------------------------------------------------
drop function nucleo.operacoes_do_mes(date, text, text[], text);

create function nucleo.operacoes_do_mes(
  p_mes date default null,
  p_busca text default null,
  p_chips text[] default null,
  p_ordem text default 'nome',
  p_pagina integer default 1,
  p_tam integer default 20
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_vejo uuid[] := nucleo.operacoes_que_vejo();
  v_ve_resultado boolean := config.pode('resultados', 'ver');
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_ordem text := coalesce(nullif(btrim(p_ordem), ''), 'nome');
  v_campo text := ltrim(v_ordem, '-');
  v_desc boolean := v_ordem like '-%';
  v_tipos text[] := array(select c from unnest(coalesce(p_chips, '{}')) c
                           where c in ('operacao', 'parada', 'administrativa', 'holding', 'acionista'));
  v_filiais text[] := array(select c from unnest(coalesce(p_chips, '{}')) c
                             where c in (select g.codigo from config.garagem g));
  v_meses date[] := nucleo.meses_das_operacoes();
  v_mes date := date_trunc('month', coalesce(p_mes, v_meses[1], nucleo.hoje_em_sao_paulo()))::date;
  v_tam integer := least(greatest(coalesce(p_tam, 20), 1), 100);
  v_resultado jsonb;
begin
  if v_campo not in ('nome', 'placas', 'crs', 'receita', 'custo_frota', 'custo_servico', 'margem', 'margem_percentual') then
    raise exception 'Ordem da lista de operações desconhecida.' using errcode = '22023';
  end if;

  with base as (
    select o.id, o.nome, o.tipo, o.base_cidade, o.base_uf, g.codigo as filial_codigo, g.rotulo as filial
      from nucleo.operacao o
      left join config.garagem g on g.cidade = o.base_cidade and g.uf = o.base_uf
     where o.excluido_em is null
       and (v_vejo is null or o.id = any (v_vejo))
       and (v_busca is null or nucleo.texto_simples(o.nome) like '%' || nucleo.texto_simples(v_busca) || '%')
  ),
  placas as (
    select l.operacao_id, count(*)::integer as placas
      from nucleo.leitura_da_placa l
     where l.baixada_em is null and l.operacao_id is not null
     group by l.operacao_id
  ),
  linha as (
    select b.*, coalesce(p.placas, 0) as placas, coalesce(c.crs, 0) as crs,
           case when v_ve_resultado then coalesce(c.receita, 0) end as receita,
           case when v_ve_resultado then coalesce(c.documentos, 0) end as documentos,
           case when v_ve_resultado then coalesce(c.custo_frota, 0) end as custo_frota,
           case when v_ve_resultado then coalesce(c.custo_servico, 0) end as custo_servico,
           case when v_ve_resultado then coalesce(c.receita, 0) - coalesce(c.custo_frota, 0) - coalesce(c.custo_servico, 0) end as margem
      from base b
      left join placas p on p.operacao_id = b.id
      left join nucleo.cascata_das_operacoes(v_mes) c on c.operacao_id = b.id
  ),
  calculada as (
    select l.*, case when l.receita > 0 then round(l.margem / l.receita * 100, 1) end as margem_percentual,
           (cardinality(v_tipos) = 0 or l.tipo = any (v_tipos)) as no_tipo,
           (cardinality(v_filiais) = 0 or l.filial_codigo = any (v_filiais)) as na_filial
      from linha l
  ),
  filtrada as (
    select c.*,
           row_number() over (order by
             case when not v_desc then
               case v_campo when 'placas' then c.placas when 'crs' then c.crs when 'receita' then c.receita
                 when 'custo_frota' then c.custo_frota when 'custo_servico' then c.custo_servico
                 when 'margem' then c.margem when 'margem_percentual' then c.margem_percentual end
             end asc nulls last,
             case when v_desc then
               case v_campo when 'placas' then c.placas when 'crs' then c.crs when 'receita' then c.receita
                 when 'custo_frota' then c.custo_frota when 'custo_servico' then c.custo_servico
                 when 'margem' then c.margem when 'margem_percentual' then c.margem_percentual end
             end desc nulls last,
             case when v_campo = 'nome' and v_desc then c.nome end desc,
             c.nome asc, c.id asc) as n
      from calculada c
     where c.no_tipo and c.na_filial
  ),
  -- A página: além do fim, a última; menor que 1, a primeira.
  pagina as (
    select x.total, x.paginas, least(greatest(coalesce(p_pagina, 1), 1), x.paginas) as pagina
      from (select count(*)::integer as total,
                   greatest(1, ceil(count(*)::numeric / v_tam)::integer) as paginas
              from filtrada) x
  )
  select jsonb_build_object(
           'mes', v_mes,
           'meses', to_jsonb(v_meses),
           've_resultado', v_ve_resultado,
           'total', pg.total,
           'pagina', pg.pagina,
           'paginas', pg.paginas,
           'tam', v_tam,
           'linhas', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'base_cidade', f.base_cidade, 'base_uf', f.base_uf,
                      'filial', f.filial, 'filial_codigo', f.filial_codigo, 'placas', f.placas, 'crs', f.crs,
                      'receita', f.receita, 'documentos', f.documentos, 'custo_frota', f.custo_frota,
                      'custo_servico', f.custo_servico, 'margem', f.margem, 'margem_percentual', f.margem_percentual
                    ) order by f.n)
               from filtrada f
              where f.n > (pg.pagina - 1) * v_tam and f.n <= pg.pagina * v_tam), '[]'::jsonb),
           'totais', (
             select jsonb_build_object(
                      'operacoes', count(*), 'placas', coalesce(sum(f.placas), 0),
                      'receita', case when v_ve_resultado then coalesce(sum(f.receita), 0) end,
                      'custo_frota', case when v_ve_resultado then coalesce(sum(f.custo_frota), 0) end,
                      'custo_servico', case when v_ve_resultado then coalesce(sum(f.custo_servico), 0) end,
                      'margem', case when v_ve_resultado then coalesce(sum(f.margem), 0) end,
                      'margem_percentual', case when v_ve_resultado and sum(f.receita) > 0
                                                then round(sum(f.margem) / sum(f.receita) * 100, 1) end)
               from filtrada f),
           -- Cada grupo de chips conta ignorando a própria seleção.
           'chips', (
             select jsonb_build_object(
                      'operacao', count(*) filter (where c.na_filial and c.tipo = 'operacao'),
                      'parada', count(*) filter (where c.na_filial and c.tipo = 'parada'),
                      'administrativa', count(*) filter (where c.na_filial and c.tipo = 'administrativa'),
                      'holding', count(*) filter (where c.na_filial and c.tipo = 'holding'),
                      'matriz', count(*) filter (where c.no_tipo and c.filial_codigo = 'matriz'),
                      'cordeiropolis', count(*) filter (where c.no_tipo and c.filial_codigo = 'cordeiropolis'),
                      'parauapebas', count(*) filter (where c.no_tipo and c.filial_codigo = 'parauapebas'))
               from calculada c)
         )
    into v_resultado
    from pagina pg;

  return v_resultado;
end;
$$;
revoke all on function nucleo.operacoes_do_mes(date, text, text[], text, integer, integer) from public, anon;
comment on function nucleo.operacoes_do_mes(date, text, text[], text, integer, integer) is
  'Operações › lista: cada operação com filial, CRs e placas vinculadas agora e a cascata do mês (receita, custo da Frota, custo de Serviço, margem), filtrada (busca, chips de tipo e filial), ordenada (desempate pelo nome e id) e paginada (p_pagina, p_tam de 1 a 100, padrão 20; além do fim, a última), com o total, os totais e as contagens dos chips do filtro inteiro.';
update config.funcao_executavel
   set assinatura = 'nucleo.operacoes_do_mes(date,text,text[],text,integer,integer)'
 where assinatura = 'nucleo.operacoes_do_mes(date,text,text[],text)';
grant execute on function nucleo.operacoes_do_mes(date, text, text[], text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Parceiros › lista
-- ---------------------------------------------------------------------------------------------
drop function nucleo.parceiros_do_mes(date, text, text[]);

create function nucleo.parceiros_do_mes(
  p_mes date default null,
  p_busca text default null,
  p_chips text[] default null,
  p_pagina integer default 1,
  p_tam integer default 20
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_tipos text[] := array(select c from unnest(coalesce(p_chips, '{}')) c where c in ('acionista', 'agregado', 'locador'));
  v_tam integer := least(greatest(coalesce(p_tam, 20), 1), 100);
  v_meses date[];
  v_mes date;
  v_resultado jsonb;
begin
  if not (config.pode('parceiros', 'ver') or config.pode('resultados', 'ver')) then
    raise exception 'Seu perfil não tem acesso aos parceiros.' using errcode = '42501';
  end if;
  v_meses := nucleo.meses_das_operacoes();
  v_mes := date_trunc('month', coalesce(p_mes, v_meses[1], nucleo.hoje_em_sao_paulo()))::date;

  with base as (
    select p.id, p.tipos, p.versao, p.cr_agrupador_id, s.nome, s.documento_mascarado, s.codparc,
           a.codigo as agrupador_codigo, a.nome as agrupador_nome
      from parceiros.parceiro p
      join nucleo.pessoa s on s.id = p.pessoa_id
      left join nucleo.cr a on a.id = p.cr_agrupador_id
     where p.excluido_em is null
       and (v_busca is null
            or nucleo.texto_simples(s.nome) like '%' || nucleo.texto_simples(v_busca) || '%'
            or s.codparc::text = v_busca)
  ),
  conciliacao as (
    select c.agrupador_id, sum(c.despesa) as despesa, sum(c.receita) as receita
      from nucleo.conciliacao_por_cr(v_mes) c group by c.agrupador_id
  ),
  placas as (
    select x.parceiro_id, count(distinct x.ativo_id)::integer as placas
      from nucleo.placas_dos_parceiros_agora() x group by x.parceiro_id
  ),
  locacao as (
    select l.parceiro_id, sum(l.valor_mensal) as valor
      from parceiros.locacao l
     where l.excluido_em is null and l.periodo @> nucleo.hoje_em_sao_paulo()
     group by l.parceiro_id
  ),
  linha as (
    select b.*, coalesce(pl.placas, 0) as placas, coalesce(c.despesa, 0) as despesa,
           coalesce(c.receita, 0) as receita, coalesce(l.valor, 0) as locacao_mensal,
           (cardinality(v_tipos) = 0 or b.tipos && v_tipos) as no_tipo
      from base b
      left join placas pl on pl.parceiro_id = b.id
      left join conciliacao c on c.agrupador_id = b.cr_agrupador_id
      left join locacao l on l.parceiro_id = b.id
  ),
  -- A ordem de sempre (nome e, no empate, o id) numera as linhas do filtro.
  filtrada as (
    select l.*, row_number() over (order by l.nome, l.id) as n
      from linha l where l.no_tipo
  ),
  -- A página: além do fim, a última; menor que 1, a primeira.
  pagina as (
    select x.total, x.paginas, least(greatest(coalesce(p_pagina, 1), 1), x.paginas) as pagina
      from (select count(*)::integer as total,
                   greatest(1, ceil(count(*)::numeric / v_tam)::integer) as paginas
              from filtrada) x
  )
  select jsonb_build_object(
           'mes', v_mes,
           'meses', to_jsonb(v_meses),
           'total', pg.total,
           'pagina', pg.pagina,
           'paginas', pg.paginas,
           'tam', v_tam,
           'linhas', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', l.id, 'nome', l.nome, 'documento_mascarado', l.documento_mascarado, 'codparc', l.codparc,
                      'tipos', to_jsonb(l.tipos), 'agrupador_codigo', l.agrupador_codigo, 'agrupador_nome', l.agrupador_nome,
                      'cr_agrupador_id', l.cr_agrupador_id, 'placas', l.placas, 'despesa', l.despesa, 'receita', l.receita,
                      'locacao_mensal', l.locacao_mensal, 'versao', l.versao
                    ) order by l.n)
               from filtrada l
              where l.n > (pg.pagina - 1) * v_tam and l.n <= pg.pagina * v_tam), '[]'::jsonb),
           'totais', (
             select jsonb_build_object(
                      'parceiros', count(*), 'placas', coalesce(sum(l.placas), 0),
                      'despesa', coalesce(sum(l.despesa), 0), 'receita', coalesce(sum(l.receita), 0),
                      'locacao_mensal', coalesce(sum(l.locacao_mensal), 0))
               from filtrada l),
           'chips', (
             select jsonb_build_object(
                      'acionista', count(*) filter (where 'acionista' = any (l.tipos)),
                      'agregado', count(*) filter (where 'agregado' = any (l.tipos)),
                      'locador', count(*) filter (where 'locador' = any (l.tipos)))
               from linha l),
           -- Os agrupadores do Sankhya que ainda não são de nenhum parceiro (para o assistente).
           'agrupadores_livres', coalesce((
             select jsonb_agg(jsonb_build_object('id', a.id, 'codigo', a.codigo, 'nome', a.nome, 'crs', a.crs)
                              order by a.nome, a.codigo)
               from (select g.id, g.codigo, g.nome, count(f.id)::integer as crs
                       from nucleo.cr g
                       join nucleo.cr f on f.cr_pai_id = g.id and f.tipo = 'acionista' and f.excluido_em is null
                      where g.excluido_em is null
                        and not exists (select 1 from parceiros.parceiro p
                                         where p.cr_agrupador_id = g.id and p.excluido_em is null)
                      group by g.id, g.codigo, g.nome) a), '[]'::jsonb)
         )
    into v_resultado
    from pagina pg;
  return v_resultado;
end;
$$;
revoke all on function nucleo.parceiros_do_mes(date, text, text[], integer, integer) from public, anon;
comment on function nucleo.parceiros_do_mes(date, text, text[], integer, integer) is
  'Parceiros › lista: cada parceiro com os tipos, o agrupador, as placas vinculadas agora, a despesa e a receita do mês nos CRs do agrupador e a locação mensal vigente, ordenado (nome e id) e paginado (p_pagina, p_tam de 1 a 100, padrão 20; além do fim, a última); o total, os totais e as contagens dos chips do filtro inteiro e os agrupadores ainda livres.';
update config.funcao_executavel
   set assinatura = 'nucleo.parceiros_do_mes(date,text,text[],integer,integer)'
 where assinatura = 'nucleo.parceiros_do_mes(date,text,text[])';
grant execute on function nucleo.parceiros_do_mes(date, text, text[], integer, integer) to authenticated;
