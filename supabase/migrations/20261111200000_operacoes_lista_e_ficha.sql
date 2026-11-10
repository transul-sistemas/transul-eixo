-- Operações › lista e ficha da operação (primeira versão), com a cascata Frota + Serviço do mês.
--
-- Definições (hipótese até o glossário, registrada no relatório da fatia):
--  * CR da operação no mês: a montagem do Eixo (CR de serviço na operação com vigência que toca o mês;
--    havendo mais de uma, a de início mais recente); sem montagem, o rótulo do Sankhya
--    (nucleo.cr.operacao_id). Vale para CR de frota e de serviço.
--  * Receita: o frete da empresa (frete_empresa) dos CT-e e NFS-e dos CRs da operação, pela data de
--    negociação no mês, só autorizados (status A ou sem status) e ainda presentes no Sankhya.
--  * Custo da Frota: as despesas dos CRs de frota (de ativo ou sem placa) da operação; custo de
--    Serviço: as dos demais CRs. Pela competência gerencial (já calculada no staging), sem provisão e
--    sem despesa invalidada. A folha não entra de novo no custo: o salário já chega como título
--    (natureza de salário) nas despesas; a folha só mostra as pessoas.
--  * Margem = receita − custo da Frota − custo de Serviço; margem percentual = margem ÷ receita, com uma
--    casa (vazia sem receita).
--  * Pessoas: os funcionários distintos e o salário bruto da folha (staging) dos CRs da operação no mês,
--    por departamento (sem nome nem CPF).
--  * Filial da operação: a garagem com a mesma cidade e UF da base.
--  * Mês padrão: o mais recente, até hoje, com viagem.
--
-- Permissão: quem não tem Operações › ver não lê (42501). Escopo "tudo" vê todas; o gestor de frota com
-- Operações por carteira (ainda não semeado) vê só as operações das placas da carteira dele. O
-- resultado em R$ e a folha só para quem tem Resultados › ver (o staging já exige isso pela RLS).
-- Tudo security invoker: a RLS de quem chama vale em cada leitura.
--
-- Editar a operação (assistente "Editar operação"): Operações › editar passa a valer junto com
-- Cadastros › editar na política operacao_alterar.

-- ---------------------------------------------------------------------------------------------
-- O escopo de Operações de quem chama: nulo = todas; senão, a lista que ele vê
-- ---------------------------------------------------------------------------------------------
create function nucleo.operacoes_que_vejo()
returns uuid[]
language plpgsql
stable
set search_path = ''
as $$
begin
  if not config.pode('operacoes', 'ver') then
    raise exception 'Seu perfil não tem acesso às operações.' using errcode = '42501';
  end if;
  if exists (
    select 1 from nucleo.usuario u join config.permissao_do_perfil p on p.perfil = u.perfil
     where u.auth_user_id = (select auth.uid()) and u.ativo
       and p.modulo = 'operacoes' and p.acao = 'ver' and p.escopo = 'tudo'
  ) then
    return null;
  end if;
  -- Por carteira: as operações das placas que a pessoa tem agora (a RLS da leitura já limita).
  return coalesce((
    select array_agg(distinct l.operacao_id)
      from nucleo.leitura_da_placa l
     where l.operacao_id is not null and l.baixada_em is null
       and l.gestor_id = (select config.usuario_atual())
  ), '{}'::uuid[]);
end;
$$;
revoke all on function nucleo.operacoes_que_vejo() from public, anon;
comment on function nucleo.operacoes_que_vejo() is
  'O escopo de Operações de quem chama: nulo para todas (escopo tudo); senão, as operações das placas da carteira. Sem Operações › ver, 42501.';

-- ---------------------------------------------------------------------------------------------
-- Os CRs de cada operação no mês (montagem do Eixo; sem ela, o rótulo do Sankhya)
-- ---------------------------------------------------------------------------------------------
create function nucleo.cr_da_operacao_no_mes(p_mes date)
returns table (cr_id uuid, codcencus text, frota boolean, operacao_id uuid)
language sql
stable
set search_path = ''
as $$
  with montagem as (
    select distinct on (s.cr_id) s.cr_id, s.operacao_id
      from nucleo.cr_de_servico_na_operacao s
     where s.excluido_em is null
       and s.periodo && tstzrange(p_mes::timestamp at time zone 'America/Sao_Paulo',
                                  (p_mes + interval '1 month')::timestamp at time zone 'America/Sao_Paulo', '[)')
     order by s.cr_id, s.inicio desc, s.id
  )
  select c.id, c.codcencus::text, coalesce(c.tipo in ('frota_de_ativo', 'frota_sem_placa'), false),
         coalesce(m.operacao_id, c.operacao_id)
    from nucleo.cr c
    left join montagem m on m.cr_id = c.id
   where c.excluido_em is null and coalesce(m.operacao_id, c.operacao_id) is not null
$$;
revoke all on function nucleo.cr_da_operacao_no_mes(date) from public, anon;
comment on function nucleo.cr_da_operacao_no_mes(date) is
  'Os CRs de cada operação no mês: a montagem do Eixo (CR de serviço na operação) vence o rótulo do Sankhya (nucleo.cr.operacao_id). frota = CR de frota (de ativo ou sem placa).';

-- ---------------------------------------------------------------------------------------------
-- A cascata do mês por operação (uma definição só, usada pela lista e pela ficha)
-- ---------------------------------------------------------------------------------------------
create function nucleo.cascata_das_operacoes(p_mes date)
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
    select d.codcencus, sum(d.valor_desdobramento) as valor
      from staging.despesa d
     where d.dt_competencia >= p_mes and d.dt_competencia < (p_mes + interval '1 month')::date
       and d.invalidado_em is null and d.provisao is distinct from 'PROVISAO'
     group by d.codcencus
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
revoke all on function nucleo.cascata_das_operacoes(date) from public, anon;
comment on function nucleo.cascata_das_operacoes(date) is
  'A cascata Frota + Serviço do mês por operação: receita (frete da empresa, CT-e/NFS-e autorizados), custo da Frota e de Serviço (despesas pela competência, sem provisão nem invalidada). Lê o staging pela RLS de quem chama.';

-- Os meses com viagem até hoje, do mais recente ao mais antigo (no máximo 24).
create function nucleo.meses_das_operacoes()
returns date[]
language sql
stable
set search_path = ''
as $$
  with recursive mes (m) as (
    select date_trunc('month', max(v.dt_negociacao))::date
      from staging.viagem v where v.dt_negociacao <= nucleo.hoje_em_sao_paulo()
    union all
    select (select date_trunc('month', max(v.dt_negociacao))::date
              from staging.viagem v where v.dt_negociacao < mes.m)
      from mes where mes.m is not null
  )
  select coalesce(array_agg(m order by m desc), '{}'::date[])
    from (select m from mes where m is not null limit 24) x
$$;
revoke all on function nucleo.meses_das_operacoes() from public, anon;
comment on function nucleo.meses_das_operacoes() is
  'Os meses com viagem até hoje (no máximo 24, o mais recente primeiro), por salto no índice da data de negociação.';

-- ---------------------------------------------------------------------------------------------
-- Operações › lista
-- ---------------------------------------------------------------------------------------------
create function nucleo.operacoes_do_mes(
  p_mes date default null,
  p_busca text default null,
  p_chips text[] default null,
  p_ordem text default 'nome'
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
  )
  select jsonb_build_object(
           'mes', v_mes,
           'meses', to_jsonb(v_meses),
           've_resultado', v_ve_resultado,
           'linhas', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'base_cidade', f.base_cidade, 'base_uf', f.base_uf,
                      'filial', f.filial, 'filial_codigo', f.filial_codigo, 'placas', f.placas, 'crs', f.crs,
                      'receita', f.receita, 'documentos', f.documentos, 'custo_frota', f.custo_frota,
                      'custo_servico', f.custo_servico, 'margem', f.margem, 'margem_percentual', f.margem_percentual
                    ) order by f.n)
               from filtrada f), '[]'::jsonb),
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
    into v_resultado;

  return v_resultado;
end;
$$;
revoke all on function nucleo.operacoes_do_mes(date, text, text[], text) from public, anon;
comment on function nucleo.operacoes_do_mes(date, text, text[], text) is
  'Operações › lista: cada operação com filial, CRs e placas vinculadas agora e a cascata do mês (receita, custo da Frota, custo de Serviço, margem), filtrada (busca, chips de tipo e filial), ordenada (desempate pelo nome e id) e com os totais e as contagens dos chips prontos.';

-- ---------------------------------------------------------------------------------------------
-- Operações › ficha
-- ---------------------------------------------------------------------------------------------
create function nucleo.ficha_da_operacao(p_operacao uuid, p_mes date default null)
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
             sum(d.valor_desdobramento) as valor
        from staging.despesa d
        join cr on cr.codcencus = d.codcencus
        left join staging.natureza n on n.codnat = d.codnat
       where d.dt_competencia >= v_mes and d.dt_competencia < (v_mes + interval '1 month')::date
         and d.invalidado_em is null and d.provisao is distinct from 'PROVISAO'
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
revoke all on function nucleo.ficha_da_operacao(uuid, date) from public, anon;
comment on function nucleo.ficha_da_operacao(uuid, date) is
  'Operações › ficha: a operação (com a versão), a cascata do mês com o custo por natureza, as placas vinculadas agora e as pessoas da folha dos CRs da operação. Nula se a operação não existe ou está fora do escopo de quem chama.';

-- ---------------------------------------------------------------------------------------------
-- Funções que o app executa (com o porquê) e os grants
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.operacoes_que_vejo()', 'Operações: o escopo de quem chama (todas ou as da carteira), lido com a RLS dele.'),
  ('nucleo.cr_da_operacao_no_mes(date)', 'Operações: os CRs de cada operação no mês (montagem do Eixo ou rótulo do Sankhya), com a RLS de quem chama.'),
  ('nucleo.cascata_das_operacoes(date)', 'Operações: a cascata Frota + Serviço do mês, lida do staging pela RLS de quem chama.'),
  ('nucleo.meses_das_operacoes()', 'Operações: os meses com viagem, lidos do staging pela RLS de quem chama.'),
  ('nucleo.operacoes_do_mes(date,text,text[],text)', 'Operações › lista: as operações com a cascata do mês e os totais prontos.'),
  ('nucleo.ficha_da_operacao(uuid,date)', 'Operações › ficha: a operação, a cascata do mês, as placas e as pessoas.');

grant execute on function nucleo.operacoes_que_vejo() to authenticated;
grant execute on function nucleo.cr_da_operacao_no_mes(date) to authenticated;
grant execute on function nucleo.cascata_das_operacoes(date) to authenticated;
grant execute on function nucleo.meses_das_operacoes() to authenticated;
grant execute on function nucleo.operacoes_do_mes(date, text, text[], text) to authenticated;
grant execute on function nucleo.ficha_da_operacao(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Editar a operação: Operações › editar ou Cadastros › editar
-- ---------------------------------------------------------------------------------------------
alter policy operacao_alterar on nucleo.operacao
  using ((select config.pode('cadastros', 'editar')) or (select config.pode('operacoes', 'editar')))
  with check ((select config.pode('cadastros', 'editar')) or (select config.pode('operacoes', 'editar')));
