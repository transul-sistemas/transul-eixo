-- Fase 3, fatia 3.5 (3 de 3): engatar, desatrelar e registrar a baixa como funções atômicas, e a
-- trava do tipo pela situação vigente.
--
--  * Engatar: confere que nenhum dos dois está baixado e que o implemento não está fora da frota
--    (ALU, EMP, VEN), encerra a atividade própria do implemento (ele
--    passa a herdar a do cavalo) e grava a composição; a estrutura é conferida no fim da transação.
--  * Desatrelar: fecha a composição (a operação na saída é gravada pelo banco), e o implemento solto
--    volta ao pátio (PÁT). Desatrelar o último implemento com o cavalo numa situação que exige
--    conjunto é recusado: o banco nunca muda a situação do cavalo sozinho.
--  * Registrar a baixa: fecha posse e gestor, grava a baixa e o evento da camada baixada, no mesmo
--    instante e na mesma transação.
--  * Mudar o tipo (3.4) passa a recusar também quando há situação vigente que o tipo novo não aceita.
--
-- Todas rodam com o usuário (a RLS vale); nenhuma é SECURITY DEFINER.

create function nucleo.engatar(p_cavalo_id uuid, p_implemento_id uuid, p_posicao smallint, p_em timestamptz)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_sigla text;
  v_camada text;
begin
  if exists (
    select 1 from nucleo.baixa_do_ativo
     where ativo_id in (p_cavalo_id, p_implemento_id) and excluido_em is null and em <= p_em
  ) then
    raise exception 'Ativo baixado não entra em conjunto.' using errcode = '23514';
  end if;

  -- Implemento baixado ou fora da frota (ALU, EMP, VEN) não entra em conjunto.
  select e.sigla, e.camada into v_sigla, v_camada
    from nucleo.estado_de_status e
   where e.ativo_id = p_implemento_id and e.camada in ('baixada', 'fora-da-frota')
     and e.excluido_em is null and e.periodo @> p_em
   order by e.camada
   limit 1;
  if v_camada = 'baixada' then
    raise exception 'Ativo baixado não entra em conjunto.' using errcode = '23514';
  elsif v_camada = 'fora-da-frota' then
    raise exception 'O implemento está em % (fora da frota): ele não entra em conjunto.', v_sigla using errcode = '23514';
  end if;

  if exists (
    select 1 from nucleo.estado_de_status
     where ativo_id = p_implemento_id and camada = 'atividade' and fim is null and excluido_em is null
  ) then
    perform nucleo.registrar_evento(
      p_implemento_id, null, p_em, 'derivado', 'informada',
      'Engatado: a atividade passa a ser a do cavalo', 'atividade'
    );
  end if;

  insert into nucleo.composicao (cavalo_id, implemento_id, posicao, inicio, inicio_origem)
  values (p_cavalo_id, p_implemento_id, p_posicao, p_em, 'informada')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function nucleo.engatar(uuid, uuid, smallint, timestamptz) from public;

-- Desatrela os implementos indicados (ou todos) do cavalo, no instante dado. Devolve quantos saíram.
create function nucleo.desatrelar(p_cavalo_id uuid, p_em timestamptz, p_implementos uuid[] default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_alvo integer;
  v_restantes integer;
  v_sigla text;
  v_implemento uuid;
begin
  select count(*) filter (where p_implementos is null or implemento_id = any (p_implementos)),
         count(*) filter (where not (p_implementos is null or implemento_id = any (p_implementos)))
    into v_alvo, v_restantes
    from nucleo.composicao
   where cavalo_id = p_cavalo_id and excluido_em is null and fim is null and inicio < p_em;

  if v_alvo = 0 then
    raise exception 'Não há implemento engatado neste cavalo para desatrelar.' using errcode = '23514';
  end if;

  if v_restantes = 0 then
    v_sigla := nucleo.estado_em(p_cavalo_id, 'atividade', p_em);
    if v_sigla is not null and exists (select 1 from config.status where sigla = v_sigla and aplica_a = 'conjunto') then
      raise exception 'A situação % do cavalo exige conjunto: mude a situação do cavalo antes de desatrelar o último implemento.', v_sigla
        using errcode = '23514';
    end if;
  end if;

  for v_implemento in
    update nucleo.composicao
       set fim = p_em, fim_origem = 'informada'
     where cavalo_id = p_cavalo_id and excluido_em is null and fim is null and inicio < p_em
       and (p_implementos is null or implemento_id = any (p_implementos))
    returning implemento_id
  loop
    if not exists (
      select 1 from nucleo.estado_de_status
       where ativo_id = v_implemento and camada = 'atividade' and fim is null and excluido_em is null
    ) then
      perform nucleo.registrar_evento(v_implemento, 'PÁT', p_em, 'derivado', 'informada', 'Desatrelado: volta ao pátio');
    end if;
  end loop;

  return v_alvo;
end;
$$;
revoke all on function nucleo.desatrelar(uuid, timestamptz, uuid[]) from public;

-- Registra a venda (VND) ou a sucata (SUC): fecha posse e gestor no instante, grava a baixa e o evento
-- da camada baixada. O motivo vai para a auditoria.
create function nucleo.registrar_baixa(p_ativo_id uuid, p_sigla text, p_em timestamptz, p_motivo text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Registrar a baixa exige o motivo.' using errcode = '23514';
  end if;
  if nucleo.em_conjunto(p_ativo_id, p_em) then
    raise exception 'Desatrele o ativo antes de registrar a baixa.' using errcode = '23514';
  end if;

  perform set_config('eixo.motivo', p_motivo, true);
  update nucleo.posse_do_ativo
     set fim = p_em, fim_origem = 'informada'
   where ativo_id = p_ativo_id and fim is null and excluido_em is null;
  update nucleo.gestor_da_carteira
     set fim = p_em, fim_origem = 'informada'
   where ativo_id = p_ativo_id and fim is null and excluido_em is null;
  insert into nucleo.baixa_do_ativo (ativo_id, sigla, em) values (p_ativo_id, p_sigla, p_em);
  perform nucleo.registrar_evento(p_ativo_id, p_sigla, p_em, 'manual', 'informada', p_motivo);
  perform set_config('eixo.motivo', '', true);
end;
$$;
revoke all on function nucleo.registrar_baixa(uuid, text, timestamptz, text) from public;

-- A trava do tipo (3.4), acrescida: o tipo também não muda se há situação vigente que o tipo novo
-- não aceita.
create or replace function nucleo.travar_tipo_com_vinculo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sigla text;
begin
  if new.tipo is distinct from old.tipo then
    if coalesce(current_setting('eixo.mudanca_de_tipo', true), '') <> 'sim' then
      raise exception 'O tipo do ativo só muda pela função de mudança de tipo, com o motivo.'
        using errcode = '23514';
    end if;
    if exists (select 1 from nucleo.composicao where (cavalo_id = new.id or implemento_id = new.id)
                  and excluido_em is null and (fim is null or fim > now())) then
      raise exception 'O tipo do ativo não muda enquanto ele estiver num conjunto: desengate antes.'
        using errcode = '23514';
    end if;
    select e.sigla into v_sigla
      from nucleo.estado_de_status e
      join config.status s on s.sigla = e.sigla
     where e.ativo_id = new.id and e.excluido_em is null and e.fim is null
       and not (new.tipo = any (s.tipos_validos))
     order by s.ordem
     limit 1;
    if v_sigla is not null then
      raise exception 'A situação % vigente não vale para %: encerre-a antes de mudar o tipo.', v_sigla, nucleo.nome_do_tipo(new.tipo)
        using errcode = '23514';
    end if;
  end if;
  if new.funcao is distinct from old.funcao and exists (
       select 1 from nucleo.composicao where implemento_id = new.id and excluido_em is null and (fim is null or fim > now())
  ) then
    raise exception 'A função do implemento não muda enquanto ele estiver engatado: desengate antes.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
