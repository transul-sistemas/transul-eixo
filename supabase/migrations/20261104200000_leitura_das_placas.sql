-- Fatia 3.9a: a leitura das placas pelo banco (lista, chips, detalhe e história), com a sessão do
-- próprio usuário. Tudo SECURITY INVOKER: a RLS de cada tabela decide o que cada perfil vê (o gestor
-- só a carteira dele; o Operacional só o que foi entregue à filial dele). Nada aqui grava.
-- A situação vem de nucleo.situacao_com_causa, linha por linha (a medição de 5.000 ativos decide, no
-- checkpoint, se fica assim ou se vira uma tabela mantida por gatilho).

-- Minúscula e sem acento: a busca não depende de caixa nem de acento.
create function nucleo.texto_simples(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(translate(
    p_texto,
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
  ))
$$;
revoke all on function nucleo.texto_simples(text) from public;
comment on function nucleo.texto_simples(text) is 'Minúscula e sem acento, para a busca não depender de caixa nem de acento.';

-- A linha da lista de placas: uma por ativo não excluído, com o que a tela mostra, calculado agora.
create view nucleo.linha_de_placa with (security_invoker = true) as
  select
    a.id,
    coalesce(pl.placa, a.numero_de_serie, '') as placa,
    a.tipo::text as tipo,
    mo.modelo,
    cj.cavalo,
    cj.implementos,
    ge.gestor,
    op.operacao,
    crv.cr,
    s.sigla,
    st.nome as nome_da_situacao,
    st.chip as grupo,
    de.desde,
    ((now() at time zone 'America/Sao_Paulo')::date - (de.desde at time zone 'America/Sao_Paulo')::date) as dias_no_status,
    al.alertas,
    a.valor_fipe,
    fi.filial,
    coalesce(a.ano_modelo, a.ano_fabricacao)::int as ano,
    a.renavam,
    exists (
      select 1 from nucleo.baixa_do_ativo b
       where b.ativo_id = a.id and b.excluido_em is null and b.em <= now()
    ) as baixada,
    nucleo.texto_simples(concat_ws(' ', pl.placa, mo.modelo, ge.gestor, op.operacao, crv.cr)) as busca
  from nucleo.ativo a
  left join lateral (
    select p.placa from nucleo.placa_do_ativo p
     where p.ativo_id = a.id and p.excluido_em is null
     order by p.fim is null desc, p.inicio desc
     limit 1
  ) pl on true
  left join lateral (
    select case when m.id is null then 'Modelo a definir' else btrim(coalesce(ma.nome, '') || ' ' || m.nome) end as modelo
      from (select 1) x
      left join config.modelo m on m.id = a.modelo_id
      left join config.marca ma on ma.id = m.marca_id
  ) mo on true
  left join lateral (
    select
      (select pc.placa
         from nucleo.composicao c
         join nucleo.placa_do_ativo pc on pc.ativo_id = c.cavalo_id and pc.excluido_em is null and pc.fim is null
        where c.implemento_id = a.id and c.excluido_em is null and c.periodo @> now()
        limit 1) as cavalo,
      array(
        select pi.placa
          from nucleo.composicao c
          join nucleo.placa_do_ativo pi on pi.ativo_id = c.implemento_id and pi.excluido_em is null and pi.fim is null
         where c.cavalo_id = a.id and c.excluido_em is null and c.periodo @> now()
         order by c.posicao
      ) as implementos
  ) cj on true
  left join lateral (
    select pe.nome as gestor
      from nucleo.gestor_da_carteira g
      join nucleo.pessoa pe on pe.id = g.gestor_id
     where g.ativo_id = a.id and g.excluido_em is null
     order by g.fim is null desc, g.inicio desc
     limit 1
  ) ge on true
  left join lateral (
    select o.nome as operacao from nucleo.operacao o where o.id = nucleo.operacao_em(a.id, now())
  ) op on true
  left join lateral (
    select c.codigo as cr from nucleo.cr c where c.id = nucleo.cr_em(a.id, now())
  ) crv on true
  cross join lateral nucleo.situacao_com_causa(a.id, now()) s
  left join config.status st on st.sigla = s.sigla
  left join lateral (
    select e.inicio as desde
      from nucleo.estado_de_status e
     where e.ativo_id = s.causa_id and e.sigla = s.sigla and e.excluido_em is null and e.periodo @> now()
     order by e.inicio desc
     limit 1
  ) de on true
  left join lateral (
    select array(select v.alerta from nucleo.alerta_de_vinculo v where v.ativo_id = a.id order by v.alerta) as alertas
  ) al on true
  left join lateral (
    select f.rotulo as filial from config.filial_do_cr f where f.codigo = nucleo.filial_do_cr_em(a.id, now())
  ) fi on true
  where a.excluido_em is null;
comment on view nucleo.linha_de_placa is
  'A linha da lista de placas, calculada agora, com a RLS de quem consulta (security_invoker).';

-- As placas que passam pelos filtros da lista (a base da lista e das contagens dos chips).
create function nucleo.placas_filtradas(
  p_busca text, p_grupos text[], p_tipos text[], p_siglas text[], p_baixadas boolean
)
returns setof nucleo.linha_de_placa
language sql
stable
set search_path = ''
as $$
  with t as (
    select
      replace(replace(replace(nucleo.texto_simples(btrim(coalesce(p_busca, ''))), '\', '\\'), '%', '\%'), '_', '\_') as busca,
      upper(regexp_replace(coalesce(p_busca, ''), '[^A-Za-z0-9]', '', 'g')) as placa
  )
  select v.*
    from nucleo.linha_de_placa v, t
   where (coalesce(p_baixadas, false) or not v.baixada)
     and (coalesce(cardinality(p_siglas), 0) = 0 or v.sigla = any (p_siglas))
     and (coalesce(cardinality(p_grupos), 0) = 0 or v.grupo = any (p_grupos))
     and (coalesce(cardinality(p_tipos), 0) = 0 or v.tipo = any (p_tipos))
     and (t.busca = '' or v.busca like '%' || t.busca || '%' or (t.placa <> '' and v.placa like '%' || t.placa || '%'))
$$;
revoke all on function nucleo.placas_filtradas(text, text[], text[], text[], boolean) from public;
comment on function nucleo.placas_filtradas(text, text[], text[], text[], boolean) is
  'As placas que passam pelos filtros da lista (busca sem acento, situação, chips e baixadas), com a RLS de quem consulta.';

-- A página da lista: ordem de uma lista fechada (vazio no fim, desempate pelo id), no máximo 100 por
-- página, e a página pedida além da última vira a última.
create function nucleo.listar_placas(
  p_busca text, p_grupos text[], p_tipos text[], p_siglas text[], p_baixadas boolean,
  p_ordem text, p_decrescente boolean, p_pagina integer, p_tam integer
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tam integer := least(greatest(coalesce(p_tam, 25), 1), 100);
  v_total integer;
  v_paginas integer;
  v_pagina integer;
  v_linhas jsonb;
  v_expr text := case p_ordem
    when 'tipo' then 'f.tipo'
    when 'modelo' then 'nucleo.texto_simples(f.modelo)'
    when 'conjunto' then 'case when f.cavalo is null and cardinality(f.implementos) = 0 then null else concat_ws('' '', coalesce(f.cavalo, f.placa), array_to_string(f.implementos, '' '')) end'
    when 'gestor' then 'nucleo.texto_simples(f.gestor)'
    when 'operacao' then 'nucleo.texto_simples(f.operacao)'
    when 'situacao' then 'f.sigla'
    when 'alertas' then 'cardinality(f.alertas)'
    when 'cr' then 'f.cr'
    when 'fipe' then 'f.valor_fipe'
    when 'dias' then 'f.dias_no_status'
    when 'filial' then 'nucleo.texto_simples(f.filial)'
    when 'km' then 'null::integer'
    when 'motorista' then 'null::text'
    when 'crlv' then 'null::date'
    else 'f.placa'
  end;
  v_sentido text := case when coalesce(p_decrescente, false) then 'desc' else 'asc' end;
begin
  select count(*) into v_total from nucleo.placas_filtradas(p_busca, p_grupos, p_tipos, p_siglas, p_baixadas);
  v_paginas := greatest(1, ceil(v_total::numeric / v_tam)::integer);
  v_pagina := least(greatest(coalesce(p_pagina, 1), 1), v_paginas);
  execute format(
    $q$
      select coalesce(jsonb_agg(
               (to_jsonb(v) - 'busca' - 'desde' - 'n')
               || jsonb_build_object('desde', to_char(v.desde at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'))
               order by v.n), '[]'::jsonb)
        from (
          select f.*, row_number() over (order by %1$s %2$s nulls last, f.id) as n
            from nucleo.placas_filtradas($1, $2, $3, $4, $5) f
           order by %1$s %2$s nulls last, f.id
          offset $6 limit $7
        ) v
    $q$,
    v_expr, v_sentido
  )
  into v_linhas
  using p_busca, p_grupos, p_tipos, p_siglas, p_baixadas, (v_pagina - 1) * v_tam, v_tam;
  return jsonb_build_object('linhas', v_linhas, 'total', v_total, 'pagina', v_pagina, 'paginas', v_paginas, 'tam', v_tam);
end;
$$;
revoke all on function nucleo.listar_placas(text, text[], text[], text[], boolean, text, boolean, integer, integer) from public;
comment on function nucleo.listar_placas(text, text[], text[], text[], boolean, text, boolean, integer, integer) is
  'Uma página da lista de placas: filtros, ordem de uma lista fechada (vazio no fim, desempate pelo id) e o total, com a RLS de quem consulta.';

-- A contagem dos chips: a de cada grupo (situação, tipo) ignora a seleção do próprio grupo.
create function nucleo.contar_chips_de_placas(
  p_busca text, p_grupos text[], p_tipos text[], p_siglas text[], p_baixadas boolean
)
returns table (chip text, quantidade bigint)
language sql
stable
set search_path = ''
as $$
  select v.grupo, count(*)
    from nucleo.placas_filtradas(p_busca, '{}', p_tipos, p_siglas, p_baixadas) v
   where v.grupo is not null
   group by v.grupo
  union all
  select v.tipo, count(*)
    from nucleo.placas_filtradas(p_busca, p_grupos, '{}', p_siglas, p_baixadas) v
   group by v.tipo
$$;
revoke all on function nucleo.contar_chips_de_placas(text, text[], text[], text[], boolean) from public;
comment on function nucleo.contar_chips_de_placas(text, text[], text[], text[], boolean) is
  'A contagem dos chips da lista de placas; a de cada grupo ignora a seleção do próprio grupo.';

-- O ativo de uma placa (a vigente, ou a última que ele teve), que quem consulta enxerga.
create function nucleo.ativo_da_placa(p_placa text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select p.ativo_id
    from nucleo.placa_do_ativo p
   where p.placa = upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g'))
     and p.excluido_em is null
   order by p.fim is null desc, p.inicio desc
   limit 1
$$;
revoke all on function nucleo.ativo_da_placa(text) from public;
comment on function nucleo.ativo_da_placa(text) is 'O ativo de uma placa (a vigente, ou a última), com a RLS de quem consulta.';

-- O detalhe da placa (painel e ficha): a linha e as vigências de CR. Nulo se não existe ou não se vê.
create function nucleo.detalhe_da_placa(p_placa text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select (to_jsonb(v) - 'busca' - 'desde')
         || jsonb_build_object(
              'desde', to_char(v.desde at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'),
              'crs', coalesce((
                select jsonb_agg(jsonb_build_object(
                         'codigo', c.codigo, 'nome', coalesce(c.nome, c.codigo),
                         'inicio', to_char(ca.inicio at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
                         'fim', to_char(ca.fim at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'))
                         order by ca.inicio)
                  from nucleo.cr_do_ativo ca join nucleo.cr c on c.id = ca.cr_id
                 where ca.ativo_id = v.id and ca.excluido_em is null), '[]'::jsonb),
              'crs_vigentes', coalesce((
                select jsonb_agg(jsonb_build_object(
                         'codigo', c.codigo, 'nome', coalesce(c.nome, c.codigo),
                         'inicio', to_char(ca.inicio at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
                         'fim', to_char(ca.fim at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'))
                         order by ca.inicio)
                  from nucleo.cr_do_ativo ca join nucleo.cr c on c.id = ca.cr_id
                 where ca.ativo_id = v.id and ca.excluido_em is null and ca.periodo @> now()), '[]'::jsonb)
            )
    from nucleo.linha_de_placa v
   where v.id = nucleo.ativo_da_placa(p_placa)
$$;
revoke all on function nucleo.detalhe_da_placa(text) from public;
comment on function nucleo.detalhe_da_placa(text) is
  'O detalhe da placa (a linha da lista e as vigências de CR), com a RLS de quem consulta; nulo se não existe ou não se vê.';

-- A história da placa: a situação em cada instante em que ela pode ter mudado (os eventos da placa e,
-- engatada, os do cavalo), só onde mudou. A situação é sempre a de nucleo.situacao_em.
create function nucleo.historia_da_placa(p_placa text)
returns table (sigla text, em text)
language sql
stable
set search_path = ''
as $$
  with alvo as (
    select nucleo.ativo_da_placa(p_placa) as id
  ),
  instantes as (
    select e.em from nucleo.evento_de_status e, alvo
     where e.ativo_id = alvo.id and e.excluido_em is null
    union
    select e.em
      from nucleo.composicao c
      join nucleo.evento_de_status e on e.ativo_id = c.cavalo_id and e.camada = 'atividade' and e.excluido_em is null
      join alvo on c.implemento_id = alvo.id
     where c.excluido_em is null and c.periodo @> e.em
  ),
  situacoes as (
    select i.em, nucleo.situacao_em(alvo.id, i.em) as sigla from instantes i, alvo where alvo.id is not null
  ),
  mudancas as (
    select s.em, s.sigla, lag(s.sigla) over (order by s.em) as anterior from situacoes s
  )
  select m.sigla, to_char(m.em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI')
    from mudancas m
   where m.sigla is distinct from m.anterior and m.sigla <> 'pendente'
   order by m.em
$$;
revoke all on function nucleo.historia_da_placa(text) from public;
comment on function nucleo.historia_da_placa(text) is
  'A história de situações da placa (só onde mudou), com a RLS de quem consulta.';

-- ---------------------------------------------------------------------------------------------
-- Acesso: leitura para quem entrou; a RLS das tabelas decide as linhas.
-- ---------------------------------------------------------------------------------------------
grant select on nucleo.linha_de_placa to authenticated;

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.texto_simples(text)', 'Busca sem acento nem caixa (função pura, sem tabela).'),
  ('nucleo.placas_filtradas(text,text[],text[],text[],boolean)', 'Base da lista de placas e dos chips, com a RLS de quem consulta.'),
  ('nucleo.listar_placas(text,text[],text[],text[],boolean,text,boolean,integer,integer)', 'Página da lista de placas, com a RLS de quem consulta.'),
  ('nucleo.contar_chips_de_placas(text,text[],text[],text[],boolean)', 'Contagem dos chips da lista de placas, com a RLS de quem consulta.'),
  ('nucleo.ativo_da_placa(text)', 'Ativo de uma placa (painel e ficha), com a RLS de quem consulta.'),
  ('nucleo.detalhe_da_placa(text)', 'Detalhe da placa (painel e ficha), com a RLS de quem consulta.'),
  ('nucleo.historia_da_placa(text)', 'História de situações da placa (ficha), com a RLS de quem consulta.');
grant execute on function nucleo.texto_simples(text) to authenticated;
grant execute on function nucleo.placas_filtradas(text, text[], text[], text[], boolean) to authenticated;
grant execute on function nucleo.listar_placas(text, text[], text[], text[], boolean, text, boolean, integer, integer) to authenticated;
grant execute on function nucleo.contar_chips_de_placas(text, text[], text[], text[], boolean) to authenticated;
grant execute on function nucleo.ativo_da_placa(text) to authenticated;
grant execute on function nucleo.detalhe_da_placa(text) to authenticated;
grant execute on function nucleo.historia_da_placa(text) to authenticated;
