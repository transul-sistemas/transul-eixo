-- O CR de frota é do ativo (placa ou equipamento, cuja chave é a série), não só da placa: o valor
-- frota_de_placa do tipo do CR passa a se chamar frota_de_ativo (Alexandre, 03/11/2026: os 49 CRs
-- "CAIXA..." de frota com veículo obrigatório e sem placa são equipamentos). Só o nome muda; as funções
-- que citam o valor no corpo são recriadas com o nome novo.
alter type nucleo.tipo_de_cr rename value 'frota_de_placa' to 'frota_de_ativo';
comment on type nucleo.tipo_de_cr is
  'Tipo do CR, derivado de AD_FROTA e VEICULO: servico, frota_de_ativo (o CR de um ativo: placa ou equipamento) ou frota_sem_placa (estoque, oficina, pneu, posto, manutenção).';


create or replace function nucleo.tipo_do_cr(p_participa_da_frota boolean, p_veiculo_obrigatorio boolean)
returns nucleo.tipo_de_cr
language sql
immutable
set search_path = ''
as $$
  select case
    when p_participa_da_frota is not true then 'servico'::nucleo.tipo_de_cr
    when p_veiculo_obrigatorio is true then 'frota_de_ativo'::nucleo.tipo_de_cr
    else 'frota_sem_placa'::nucleo.tipo_de_cr
  end
$$;

create or replace function nucleo.conferir_cr_de_placa()
returns trigger
language plpgsql
security definer -- justificativa: a regra precisa enxergar os vínculos do CR com todas as placas, inclusive as que o usuário não alcança pela RLS; só lê cr e cr_do_ativo, com search_path vazio.
set search_path = ''
as $$
begin
  if new.excluido_em is null
     and (select tipo from nucleo.cr where id = new.cr_id) = 'frota_de_ativo' then
    -- Duas transações não ligam o mesmo CR a placas diferentes ao mesmo tempo.
    perform pg_advisory_xact_lock(hashtextextended(new.cr_id::text, 0));
    if exists (
      select 1 from nucleo.cr_do_ativo
       where cr_id = new.cr_id and ativo_id <> new.ativo_id and excluido_em is null and id <> new.id
    ) then
      raise exception 'Este CR de frota já pertence a outro ativo: cada CR de ativo é de um ativo só, para sempre.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function nucleo.conferir_tipo_do_cr_de_placa()
returns trigger
language plpgsql
security definer -- justificativa: precisa contar os vínculos do CR com todas as placas, inclusive as fora do alcance do usuário; só lê cr_do_ativo, com search_path vazio.
set search_path = ''
as $$
begin
  if new.tipo = 'frota_de_ativo' and (
    select count(distinct ativo_id) from nucleo.cr_do_ativo where cr_id = new.id and excluido_em is null
  ) > 1 then
    raise exception 'Este CR de frota já pertence a outro ativo: cada CR de ativo é de um ativo só, para sempre.'
      using errcode = '23514';
  end if;
  return null;
end;
$$;
