-- Dados provisórios da v1 (staging) e a leitura de Frota › Abastecimento.
--
--  * O schema `staging` guarda, PROVISORIAMENTE, cópias dos dados do Sankhya que a v1 já trazia
--    (despesas, naturezas, viagens e CT-e, folha, operações e o roster das operações, e os
--    abastecimentos), para as telas de Abastecimento, Operações e Resultados terem número real até a
--    ponte do Sankhya funcionar. Quando a ponte entrar, estas tabelas saem (o Sankhya é dono do fato).
--  * A migration cria só a estrutura, vazia. Quem carrega é o script local `importacao/` (fora do Git),
--    e só no banco local: nunca na nuvem, nunca com dado de desenvolvimento.
--  * Minimização: sem CPF, sem nome de pessoa e sem texto livre (histórico); a folha vem por código de
--    funcionário, e os eventos da folha já agregados por referência × empresa × CR × evento.
--  * Ninguém grava pelo app (sem INSERT, UPDATE nem DELETE para authenticated); anon não tem nada. A
--    leitura passa pela RLS com a permissão do módulo (Frota para o abastecimento; Resultados para
--    despesas, naturezas, viagens e folha; Operações para operações e roster).

create schema staging;
comment on schema staging is
  'Provisório até a ponte do Sankhya: cópias locais dos dados da v1 (despesas, viagens/CT-e, folha, roster das operações, abastecimento). Só estrutura nas migrations; carga pelo script local de importação.';

revoke all on schema staging from public, anon;
grant usage on schema staging to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Abastecimento (na v1: fuel_registros). Um registro por abastecimento, com o hodômetro do trecho.
-- ---------------------------------------------------------------------------------------------
create table staging.abastecimento (
  id bigint generated always as identity primary key,
  origem_id text not null unique,
  placa text not null,
  data date not null,
  km_inicial numeric(12, 1),
  km_final numeric(12, 1),
  litros numeric(12, 3) not null check (litros >= 0),
  valor_total numeric(15, 2),
  combustivel text,
  origem text,
  carregado_em timestamptz not null default now()
);
comment on table staging.abastecimento is
  'Provisório até a ponte do Sankhya (TCFABT/TCFABTITE): os abastecimentos da v1, um por linha, com o hodômetro inicial e final do trecho.';
create index abastecimento_placa_data_idx on staging.abastecimento (placa, data);
create index abastecimento_data_idx on staging.abastecimento (data);

-- ---------------------------------------------------------------------------------------------
-- Naturezas e despesas (na v1: natureza_dre e despesas_sankhya)
-- ---------------------------------------------------------------------------------------------
create table staging.natureza (
  codnat text primary key,
  descricao text not null,
  carregado_em timestamptz not null default now()
);
comment on table staging.natureza is 'Provisório até a ponte do Sankhya (TGFNAT): as naturezas da v1.';

create table staging.despesa (
  id bigint generated always as identity primary key,
  origem_id text not null unique,
  nufin text not null,
  desdobramento text,
  nunota text,
  placa text,
  codcencus text,
  codnat text,
  dt_competencia date,
  dtentsai date,
  dt_vencimento date,
  dhbaixa timestamptz,
  baixado boolean,
  provisao text,
  valor_baixa numeric(15, 2),
  valor_liquido numeric(15, 2),
  valor_desdobramento numeric(15, 2),
  invalidado_em timestamptz,
  carregado_em timestamptz not null default now()
);
comment on table staging.despesa is
  'Provisório até a ponte do Sankhya (TGFFIN/TGFRAT): as despesas da v1, com a competência gerencial já calculada pela v1 (dt_competencia).';
create index despesa_competencia_idx on staging.despesa (dt_competencia);
create index despesa_placa_idx on staging.despesa (placa);
create index despesa_codcencus_idx on staging.despesa (codcencus);
create index despesa_codnat_idx on staging.despesa (codnat);

-- ---------------------------------------------------------------------------------------------
-- Viagens e CT-e (na v1: viagens_sankhya), sem motorista
-- ---------------------------------------------------------------------------------------------
create table staging.viagem (
  nunota bigint primary key,
  codemp integer,
  numnota bigint,
  serie text,
  tipo_documento text,
  status_cte text,
  dt_negociacao date,
  ordemcarga bigint,
  codcencus text,
  codnat text,
  codtipoper integer,
  placa text,
  frete_empresa numeric(15, 2),
  frete_frota_terceiro numeric(15, 2),
  icms numeric(15, 2),
  pis_cofins numeric(15, 2),
  pedagio numeric(15, 2),
  iss numeric(15, 2),
  irf numeric(15, 2),
  sumiu_do_sankhya_em timestamptz,
  carregado_em timestamptz not null default now()
);
comment on table staging.viagem is
  'Provisório até a ponte do Sankhya (TGFCAB/TMSORDAFT/TGFMDFE): as viagens e CT-e da v1, sem motorista.';
create index viagem_dt_negociacao_idx on staging.viagem (dt_negociacao);
create index viagem_placa_idx on staging.viagem (placa);
create index viagem_codcencus_idx on staging.viagem (codcencus);

-- ---------------------------------------------------------------------------------------------
-- Folha (na v1: folha_total_sankhya e eventos_folha_sankhya), sem nome nem CPF
-- ---------------------------------------------------------------------------------------------
create table staging.folha (
  chave_folha text primary key,
  referencia date not null,
  tipfolha text,
  codemp integer,
  codfunc integer,
  codcencus text,
  departamento text,
  salario_bruto numeric(15, 2),
  salario_liquido numeric(15, 2),
  salario_base numeric(15, 2),
  carregado_em timestamptz not null default now()
);
comment on table staging.folha is
  'Provisório até a ponte do Sankhya (TFPFUN/TFPFOL): o total da folha por funcionário e referência, só pelo código do funcionário (sem nome nem CPF).';
create index folha_referencia_idx on staging.folha (referencia);
create index folha_codcencus_idx on staging.folha (codcencus);

create table staging.evento_da_folha (
  referencia text not null,
  tipfolha text not null,
  codemp integer not null,
  codcencus text not null,
  codevento integer not null,
  descricao text,
  tipevento integer,
  funcionarios integer not null,
  valor numeric(15, 2) not null,
  carregado_em timestamptz not null default now(),
  primary key (referencia, tipfolha, codemp, codcencus, codevento)
);
comment on table staging.evento_da_folha is
  'Provisório até a ponte do Sankhya (TFPFOL): os eventos da folha já somados por referência × empresa × CR × evento (sem funcionário).';
create index evento_da_folha_codcencus_idx on staging.evento_da_folha (codcencus);

-- ---------------------------------------------------------------------------------------------
-- Operações e o roster mensal (na v1: operacoes e operacao_frota_mensal)
-- ---------------------------------------------------------------------------------------------
create table staging.operacao (
  id uuid primary key,
  nome text not null,
  ativa boolean not null,
  data_inicio date,
  data_fim_prevista date,
  carregado_em timestamptz not null default now()
);
comment on table staging.operacao is 'Provisório até o cadastro de operações do Eixo: as operações da v1.';

create table staging.roster (
  id uuid primary key,
  operacao_id uuid not null references staging.operacao (id),
  mes date not null,
  codcencus text,
  placa text,
  data_inicio date,
  data_fim date,
  ativo boolean not null,
  sem_placa boolean,
  origem text,
  carregado_em timestamptz not null default now()
);
comment on table staging.roster is
  'Provisório até o roster do Eixo: a frota de cada operação por mês na v1 (operação × mês × CR).';
create index roster_operacao_id_idx on staging.roster (operacao_id, mes);
create index roster_placa_idx on staging.roster (placa);
create index roster_codcencus_idx on staging.roster (codcencus);

-- ---------------------------------------------------------------------------------------------
-- RLS: só leitura, pela permissão do módulo
-- ---------------------------------------------------------------------------------------------
alter table staging.abastecimento enable row level security;
alter table staging.natureza enable row level security;
alter table staging.despesa enable row level security;
alter table staging.viagem enable row level security;
alter table staging.folha enable row level security;
alter table staging.evento_da_folha enable row level security;
alter table staging.operacao enable row level security;
alter table staging.roster enable row level security;

-- O abastecimento é da Frota: quem vê a frota inteira vê tudo; o gestor de frota, só as placas que
-- ele enxerga agora na leitura das placas (a carteira vigente).
create policy staging_abastecimento_ler on staging.abastecimento for select to authenticated using (
  (select config.pode('frota', 'ver'))
  and (
    (select config.ve_todas_as_placas())
    or exists (select 1 from nucleo.leitura_da_placa l where l.placa = abastecimento.placa)
  )
);
create policy staging_natureza_ler on staging.natureza for select to authenticated
  using ((select config.pode('resultados', 'ver')));
create policy staging_despesa_ler on staging.despesa for select to authenticated
  using ((select config.pode('resultados', 'ver')));
create policy staging_viagem_ler on staging.viagem for select to authenticated
  using ((select config.pode('resultados', 'ver')));
create policy staging_folha_ler on staging.folha for select to authenticated
  using ((select config.pode('resultados', 'ver')));
create policy staging_evento_da_folha_ler on staging.evento_da_folha for select to authenticated
  using ((select config.pode('resultados', 'ver')));
create policy staging_operacao_ler on staging.operacao for select to authenticated
  using ((select config.pode('operacoes', 'ver')));
create policy staging_roster_ler on staging.roster for select to authenticated
  using ((select config.pode('operacoes', 'ver')));

grant select on all tables in schema staging to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Frota › Abastecimento: o consumo por placa no mês, com os totais prontos
--
-- Definições (hipótese até o glossário, registrada no relatório da fatia):
--  * litros do mês: a soma dos litros de todos os abastecimentos da placa no mês (pela data);
--  * km rodado: a soma de (km_final − km_inicial) só dos abastecimentos com hodômetro válido
--    (os dois preenchidos e o final maior que o inicial);
--  * km/l: km rodado ÷ litros dos mesmos abastecimentos com hodômetro válido (nunca dos inválidos);
--    sem nenhum válido, vazio. O km/l da frota é a mesma conta somada sobre as placas filtradas.
-- ---------------------------------------------------------------------------------------------
create function nucleo.abastecimento_do_mes(
  p_mes date default null,
  p_busca text default null,
  p_ordem text default 'placa',
  p_pagina integer default 1,
  p_tam integer default 50
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_tam integer := least(greatest(coalesce(p_tam, 50), 1), 500);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_ordem text := coalesce(nullif(btrim(p_ordem), ''), 'placa');
  v_campo text := ltrim(v_ordem, '-');
  v_desc boolean := v_ordem like '-%';
  v_meses jsonb;
  v_mes date;
  v_resultado jsonb;
begin
  if v_campo not in ('placa', 'litros', 'km', 'km_por_litro', 'valor', 'abastecimentos') then
    raise exception 'Ordem do abastecimento desconhecida.' using errcode = '22023';
  end if;

  -- Os meses com abastecimento que o usuário enxerga (o mais recente primeiro).
  select coalesce(jsonb_agg(m order by m desc), '[]'::jsonb) into v_meses
    from (select distinct date_trunc('month', a.data)::date as m from staging.abastecimento a) x;
  v_mes := date_trunc('month', coalesce(p_mes, (v_meses->>0)::date, nucleo.hoje_em_sao_paulo()))::date;

  with por_placa as (
    select a.placa,
           count(*)::integer as abastecimentos,
           sum(a.litros) as litros,
           coalesce(sum(a.km_final - a.km_inicial) filter (where a.km_final > a.km_inicial), 0) as km,
           coalesce(sum(a.litros) filter (where a.km_final > a.km_inicial), 0) as litros_validos,
           (count(*) filter (where a.km_inicial is null or a.km_final is null or a.km_final <= a.km_inicial))::integer as sem_hodometro,
           sum(a.valor_total) as valor
      from staging.abastecimento a
     where a.data >= v_mes and a.data < (v_mes + interval '1 month')::date
       and (v_busca is null or a.placa ilike '%' || replace(replace(upper(v_busca), '-', ''), ' ', '') || '%')
     group by a.placa
  ),
  calculada as (
    select p.*, case when p.litros_validos > 0 then round(p.km / p.litros_validos, 2) end as km_por_litro
      from por_placa p
  ),
  ordenada as (
    select c.*,
           row_number() over (order by
             case when not v_desc then
               case v_campo when 'litros' then c.litros when 'km' then c.km when 'km_por_litro' then c.km_por_litro
                 when 'valor' then c.valor when 'abastecimentos' then c.abastecimentos end
             end asc nulls last,
             case when v_desc then
               case v_campo when 'litros' then c.litros when 'km' then c.km when 'km_por_litro' then c.km_por_litro
                 when 'valor' then c.valor when 'abastecimentos' then c.abastecimentos end
             end desc nulls last,
             case when v_campo = 'placa' and v_desc then c.placa end desc,
             c.placa asc) as n,
           count(*) over () as filtradas
      from calculada c
  ),
  paginada as (
    select o.*, least(v_pagina, greatest(ceil(o.filtradas::numeric / v_tam)::integer, 1)) as pagina
      from ordenada o
  )
  select jsonb_build_object(
           'mes', v_mes,
           'meses', v_meses,
           'linhas', coalesce(jsonb_agg(jsonb_build_object(
                       'placa', p.placa, 'ativo_id', l.ativo_id, 'tipo', l.tipo, 'modelo', l.modelo,
                       'abastecimentos', p.abastecimentos, 'litros', p.litros, 'km', p.km,
                       'km_por_litro', p.km_por_litro, 'valor', p.valor, 'sem_hodometro', p.sem_hodometro
                     ) order by p.n) filter (where p.n > (p.pagina - 1) * v_tam and p.n <= p.pagina * v_tam), '[]'::jsonb),
           'totais', jsonb_build_object(
             'placas', count(p.placa),
             'abastecimentos', coalesce(sum(p.abastecimentos), 0),
             'litros', coalesce(sum(p.litros), 0),
             'km', coalesce(sum(p.km), 0),
             'km_por_litro', case when sum(p.litros_validos) > 0 then round(sum(p.km) / sum(p.litros_validos), 2) end,
             'valor', coalesce(sum(p.valor), 0),
             'sem_hodometro', coalesce(sum(p.sem_hodometro), 0)
           ),
           'filtradas', count(p.placa),
           'pagina', coalesce(max(p.pagina), 1),
           'paginas', greatest(ceil(count(p.placa)::numeric / v_tam)::integer, 1),
           'tam', v_tam
         )
    into v_resultado
    from paginada p
    left join lateral (
      select lp.ativo_id, lp.tipo, lp.modelo from nucleo.leitura_da_placa lp
       where lp.placa = p.placa order by lp.baixada_em nulls first, lp.ativo_id limit 1
    ) l on true;

  return v_resultado;
end;
$$;
revoke all on function nucleo.abastecimento_do_mes(date, text, text, integer, integer) from public;
comment on function nucleo.abastecimento_do_mes(date, text, text, integer, integer) is
  'Frota › Abastecimento: litros, km rodado (só hodômetro válido) e km/l por placa no mês, paginado e ordenado no banco (desempate pela placa), com os totais do mês e os meses com dados. Lê o staging provisório pela RLS de quem chama.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.abastecimento_do_mes(date,text,text,integer,integer)',
   'Frota › Abastecimento: o consumo por placa no mês e os totais, lidos do staging pela RLS de quem chama.');

grant execute on function nucleo.abastecimento_do_mes(date, text, text, integer, integer) to authenticated;
