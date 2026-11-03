-- Fase 3, fatia 3.5 (2 de 3): a situação calculada.
--
-- A situação de um ativo num instante é a sigla da camada de maior prioridade com estado vigente. A
-- herança no conjunto é calculada na consulta e nunca gravada:
--  * o implemento engatado herda só a camada de atividade do cavalo; baixada, fora da frota, impedida
--    e sem motorista são dele;
--  * qualquer membro impedido (o cavalo ou um implemento engatado, por manutenção, SDo, DOC...) deixa o
--    conjunto inteiro impedido; o banco nunca desengata sozinho.
-- Nada presumido: sem estado em nenhuma camada, a situação é "pendente". O espelho em TypeScript é
-- `lib/dominio/situacao.ts`.

-- A sigla do estado vigente de uma camada, ou nula.
create function nucleo.estado_em(p_ativo_id uuid, p_camada text, p_em timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select sigla from nucleo.estado_de_status
   where ativo_id = p_ativo_id and camada = p_camada and excluido_em is null and periodo @> p_em
$$;
revoke all on function nucleo.estado_em(uuid, text, timestamptz) from public;

-- A situação e o ativo que a determinou (o próprio, o cavalo ou um implemento do conjunto).
create function nucleo.situacao_com_causa(p_ativo_id uuid, p_em timestamptz)
returns table (sigla text, causa_id uuid)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tipo nucleo.tipo_de_ativo;
  v_cavalo uuid;
  v_mestre uuid;
  v_camada text;
  v_sigla text;
  v_causa uuid;
begin
  select a.tipo into v_tipo from nucleo.ativo a where a.id = p_ativo_id;
  if not found then
    return;
  end if;

  -- O cavalo do implemento engatado, e o mestre do conjunto em que o ativo está.
  select c.cavalo_id into v_cavalo
    from nucleo.composicao c
   where c.implemento_id = p_ativo_id and c.excluido_em is null and c.periodo @> p_em;
  if v_cavalo is not null then
    v_mestre := v_cavalo;
  elsif v_tipo = 'cavalo' and exists (
    select 1 from nucleo.composicao c
     where c.cavalo_id = p_ativo_id and c.excluido_em is null and c.periodo @> p_em
  ) then
    v_mestre := p_ativo_id;
  end if;

  for v_camada in select codigo from config.camada_de_status order by prioridade loop
    if v_camada = 'atividade' and v_cavalo is not null then
      v_sigla := nucleo.estado_em(v_cavalo, 'atividade', p_em);
      v_causa := v_cavalo;
    else
      v_sigla := nucleo.estado_em(p_ativo_id, v_camada, p_em);
      v_causa := p_ativo_id;
    end if;

    if v_sigla is null and v_camada = 'impedida' and v_mestre is not null then
      select nucleo.estado_em(m.id, 'impedida', p_em), m.id
        into v_sigla, v_causa
        from (
          select v_mestre as id, 0 as ordem
          union all
          select c.implemento_id, c.posicao
            from nucleo.composicao c
           where c.cavalo_id = v_mestre and c.excluido_em is null and c.periodo @> p_em
        ) m
       where m.id <> p_ativo_id and nucleo.estado_em(m.id, 'impedida', p_em) is not null
       order by m.ordem
       limit 1;
    end if;

    if v_sigla is not null then
      sigla := v_sigla;
      causa_id := v_causa;
      return next;
      return;
    end if;
  end loop;

  sigla := 'pendente';
  causa_id := null;
  return next;
end;
$$;
revoke all on function nucleo.situacao_com_causa(uuid, timestamptz) from public;

create function nucleo.situacao_em(p_ativo_id uuid, p_em timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select s.sigla from nucleo.situacao_com_causa(p_ativo_id, p_em) s
$$;
revoke all on function nucleo.situacao_em(uuid, timestamptz) from public;

create function nucleo.situacao_atual(p_ativo_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select nucleo.situacao_em(p_ativo_id, now())
$$;
revoke all on function nucleo.situacao_atual(uuid) from public;

-- A situação do conjunto é a do cavalo (com a herança), com a causa: o próprio cavalo ou o implemento
-- que deixou o conjunto impedido.
create function nucleo.situacao_do_conjunto(p_cavalo_id uuid, p_em timestamptz)
returns table (sigla text, causa_id uuid)
language sql
stable
set search_path = ''
as $$
  select s.sigla, s.causa_id
    from nucleo.ativo a
    cross join lateral nucleo.situacao_com_causa(a.id, p_em) s
   where a.id = p_cavalo_id and a.tipo = 'cavalo'
$$;
revoke all on function nucleo.situacao_do_conjunto(uuid, timestamptz) from public;
