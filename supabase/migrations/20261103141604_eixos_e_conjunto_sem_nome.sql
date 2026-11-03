-- Ajuste 3.4b (Alexandre, 04/11/2026): eixos do implemento de 1 a 6 e conjunto "sem nome definido".
--
--  * O implemento pode ter de 1 a 6 eixos por placa (no Sankhya há modelos de 4 eixos, como
--    "SR/LIBRELATO SRCA 4E"). O dolly entra nessa faixa: os 2 eixos do dolly são exigência do nome
--    Rodotrem (configuração `rodo`), não do cadastro do ativo.
--  * Estrutura que não bate com nenhuma configuração conhecida deixa de ser recusada: o conjunto fica
--    "sem nome definido" e gera o alerta conjunto_sem_nome. Continuam recusados: mais de três unidades,
--    dolly fora do meio entre dois semirreboques, três semirreboques sem dolly, conjunto misto e
--    semirreboques de eixos diferentes entre si (mensagens iguais às de `lib/dominio/composicao.ts`).
--
-- Migration nova: as anteriores não são editadas.

-- ---------------------------------------------------------------------------------------------
-- Eixos do implemento: de 1 a 6 (o dolly incluído)
-- ---------------------------------------------------------------------------------------------
alter table nucleo.ativo drop constraint ativo_eixos_do_implemento;
alter table nucleo.ativo drop constraint ativo_eixos_do_dolly;
alter table nucleo.ativo add constraint ativo_eixos_do_implemento
  check (tipo <> 'implemento' or eixos is null or eixos between 1 and 6);
comment on column nucleo.ativo.eixos is
  'Eixos da peça. No implemento (dolly incluído), de 1 a 6. Sem origem até a 3.7; nulo quer dizer "não informado" e deixa o nome do conjunto pendente.';

-- ---------------------------------------------------------------------------------------------
-- A conferência do conjunto, sem a recusa por estrutura desconhecida
-- ---------------------------------------------------------------------------------------------
create or replace function nucleo.conferir_conjunto(p_cavalo_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_instante timestamptz;
  v_n integer;
  v_funcoes text[];
  v_dollies integer;
  v_carrocerias integer;
  v_eixos_distintos integer;
begin
  for v_instante in
    select inicio from nucleo.composicao where cavalo_id = p_cavalo_id and excluido_em is null
    union
    select fim from nucleo.composicao where cavalo_id = p_cavalo_id and excluido_em is null and fim is not null
  loop
    select count(*)::int,
           array_agg(a.funcao::text order by c.posicao),
           count(*) filter (where a.funcao = 'dolly')::int,
           count(distinct a.carroceria_id) filter (where a.funcao = 'semirreboque')::int,
           count(distinct a.eixos) filter (where a.funcao = 'semirreboque')::int
      into v_n, v_funcoes, v_dollies, v_carrocerias, v_eixos_distintos
      from nucleo.composicao c
      join nucleo.ativo a on a.id = c.implemento_id
     where c.cavalo_id = p_cavalo_id and c.excluido_em is null and c.periodo @> v_instante;

    continue when v_n = 0;

    if v_n > 3 then
      raise exception 'O conjunto tem no máximo três unidades.' using errcode = '23514';
    end if;
    if v_dollies > 0 and not (v_n = 3 and v_dollies = 1 and v_funcoes[2] = 'dolly') then
      raise exception 'O dolly só entra no rodotrem, entre dois semirreboques.' using errcode = '23514';
    end if;
    if v_dollies = 0 and v_n = 3 then
      raise exception 'Três semirreboques sem dolly não formam um conjunto operado pela TranSul.' using errcode = '23514';
    end if;
    if v_carrocerias > 1 then
      raise exception 'Conjunto misto não pode: os semirreboques têm de ter a mesma carroceria.' using errcode = '23514';
    end if;
    if v_eixos_distintos > 1 then
      raise exception 'Os semirreboques do conjunto têm de ter o mesmo número de eixos.' using errcode = '23514';
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- O nome: estrutura sem configuração conhecida fica "sem nome definido"
-- ---------------------------------------------------------------------------------------------
create or replace function config.nome_do_conjunto(
  p_carroceria_id uuid,
  p_unidades integer,
  p_com_dolly boolean,
  p_eixos_dos_semirreboques integer,
  p_eixos_do_dolly integer
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_configuracao text;
  v_semirreboques integer := p_unidades - case when p_com_dolly then 1 else 0 end;
begin
  if p_carroceria_id is null then
    return null;
  end if;
  if p_eixos_dos_semirreboques is null then
    return 'pendente';
  end if;
  select codigo into v_configuracao
    from config.configuracao_de_conjunto
   where unidades = p_unidades
     and com_dolly = p_com_dolly
     and p_eixos_dos_semirreboques = any (eixos_dos_semirreboques)
     and eixos_do_dolly is not distinct from p_eixos_do_dolly;
  if v_configuracao is null then
    return 'sem nome definido';
  end if;
  if exists (select 1 from config.nomenclatura_de_conjunto where carroceria_id = p_carroceria_id) then
    return (select nome from config.nomenclatura_de_conjunto
             where carroceria_id = p_carroceria_id and configuracao = v_configuracao);
  end if;
  return (select nome from config.carroceria where id = p_carroceria_id)
    || ', ' || v_semirreboques
    || case when v_semirreboques = 1 then ' implemento' else ' implementos' end;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Alertas: acrescenta conjunto_sem_nome (no cavalo). A lista fechada está em docs/decisoes.md.
-- ---------------------------------------------------------------------------------------------
create or replace view nucleo.alerta_de_vinculo with (security_invoker = true) as
  with na_frota as (
    select a.id, a.tipo, a.eixos
      from nucleo.ativo a
     where a.excluido_em is null
       and not exists (
         select 1 from nucleo.baixa_do_ativo b
          where b.ativo_id = a.id and b.excluido_em is null and b.em <= now()
       )
  )
  select f.id as ativo_id, 'sem_cr'::text as alerta
    from na_frota f
   where not exists (
     select 1 from nucleo.cr_do_ativo v
      where v.ativo_id = f.id and v.excluido_em is null and v.periodo @> now()
   )
  union all
  select f.id, 'cr_sem_operacao'
    from na_frota f
    join nucleo.cr_do_ativo v on v.ativo_id = f.id and v.excluido_em is null and v.periodo @> now()
    join nucleo.cr c on c.id = v.cr_id
   where c.operacao_id is null
  union all
  select distinct f.id, 'buraco_em_cr'
    from na_frota f
    join (
      select ativo_id, fim, lead(inicio) over (partition by ativo_id order by inicio) as prox
        from nucleo.cr_do_ativo
       where excluido_em is null
    ) v on v.ativo_id = f.id
   where v.prox > v.fim
  union all
  select distinct f.id, 'buraco_em_custodia'
    from na_frota f
    join (
      select ativo_id, fim, lead(inicio) over (partition by ativo_id order by inicio) as prox
        from nucleo.custodia
       where excluido_em is null
    ) v on v.ativo_id = f.id
   where v.prox > v.fim
  union all
  select f.id, 'implemento_sem_eixos'
    from na_frota f
   where f.tipo = 'implemento' and f.eixos is null
  union all
  select f.id, 'conjunto_sem_nome'
    from na_frota f
   where f.tipo = 'cavalo' and nucleo.nome_do_conjunto(f.id) = 'sem nome definido';
comment on view nucleo.alerta_de_vinculo is
  'Pendências dos vínculos e do cadastro: sem_cr, cr_sem_operacao, buraco_em_cr, buraco_em_custodia, implemento_sem_eixos e conjunto_sem_nome (no cavalo). Ativo baixado não entra. Posse e gestor não aparecem aqui porque o banco proíbe o buraco neles.';
