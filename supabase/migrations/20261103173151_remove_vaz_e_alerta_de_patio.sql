-- Ajuste 3.6b (Alexandre, 05/11/2026): a sigla VAz (Vazio) sai da régua, que passa de 26 para 25
-- siglas. O PÁT (pátio) cobre qualquer ativo parado (cavalo, caminhão, implemento, equipamento e
-- apoio); o ETv (em trânsito vazio) continua. O sinal de "atenção" que o VAz dava passa a ser o alerta
-- parado_em_patio: ativo em PÁT há mais dias que o parâmetro dias_parado_em_patio (15 por enquanto).
--
-- Migration nova: as anteriores não são editadas.

-- O VAz é catálogo sem dado real: se algum evento ou estado o usasse, a remoção para aqui.
do $$
begin
  if exists (select 1 from nucleo.evento_de_status where sigla = 'VAz')
     or exists (select 1 from nucleo.estado_de_status where sigla = 'VAz') then
    raise exception 'Há evento ou estado com VAz: troque por PÁT ou DOp antes de remover a sigla.';
  end if;
end;
$$;

delete from config.status where sigla = 'VAz';

-- A ordem da régua fica contínua (1 a 25): as siglas depois do VAz sobem uma posição. Em dois passos,
-- para não colidir com a unicidade da ordem no meio da troca.
update config.status set ordem = -ordem where ordem > 15;
update config.status set ordem = -ordem - 1 where ordem < 0;

-- ---------------------------------------------------------------------------------------------
-- Alertas: acrescenta parado_em_patio. A lista fechada está em docs/decisoes.md e tem teste.
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
  ),
  prazos as (
    select
      (select valor::int from config.parametro where chave = 'prazo_de_correcao_de_status_dias') as prazo,
      (select valor::int from config.parametro where chave = 'dias_do_alerta_de_correcao') as dias,
      (select valor::int from config.parametro where chave = 'dias_parado_em_patio') as parado
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
   where f.tipo = 'cavalo' and nucleo.nome_do_conjunto(f.id) = 'sem nome definido'
  union all
  select distinct f.id, 'correcao_tardia_de_status'
    from na_frota f
    cross join prazos p
    join nucleo.evento_de_status e on e.ativo_id = f.id
   where e.excluido_em is not null
     and e.excluido_em - e.em > make_interval(days => p.prazo)
     and e.excluido_em >= now() - make_interval(days => p.dias)
  union all
  select f.id, 'parado_em_patio'
    from na_frota f
    cross join prazos p
    join nucleo.estado_de_status e
      on e.ativo_id = f.id and e.camada = 'atividade' and e.sigla = 'PÁT'
     and e.fim is null and e.excluido_em is null
   where e.inicio < now() - make_interval(days => p.parado);
comment on view nucleo.alerta_de_vinculo is
  'Pendências: sem_cr, cr_sem_operacao, buraco_em_cr, buraco_em_custodia, implemento_sem_eixos, conjunto_sem_nome (no cavalo), correcao_tardia_de_status e parado_em_patio (em PÁT há mais que o parâmetro). Ativo baixado não entra.';
