-- Operacional (Nível 2): os KPIs do Pátio, das Ordens e do Totem prontos no banco, e o avanço em lote.
--
--  * nucleo.kpis_do_operacional() -> jsonb, pela RLS de quem consulta (as placas e as ordens que ele alcança):
--      no_patio      placas sob custódia do Operacional (nucleo.placas_do_patio);
--      na_fila       as que têm chegada aberta no totem;
--      maior_espera_min  minutos desde a chegada mais antiga ainda na fila (nulo sem fila);
--      tempo_medio_no_patio_min  média dos minutos desde a entrega ao Operacional (nulo sem placa);
--      por_situacao  DOp, ACe, CAr, CAn;
--      ordens_abertas (carregando + carregada), ordens_criadas_hoje, ordens_em_viagem_hoje (saíram hoje).
--  * nucleo.avancar_no_patio_em_lote(p_ativos, p_acao, p_motivo, p_chave) -> jsonb {lote_id, total, avancados,
--    recusados[{ativo_id, motivo, codigo}], repetido}: a mesma ação (aceitar, concluir, liberar, devolver) para
--    várias placas, tudo ou nada (como o Lançar o dia em lote). Cada placa passa por nucleo.avancar_no_patio, com
--    a conferência de permissão e de filial dela.

create function nucleo.kpis_do_operacional()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_inicio timestamptz := v_hoje::timestamp at time zone 'America/Sao_Paulo';
  v_resultado jsonb;
begin
  if not config.pode('operacional', 'ver') then
    raise exception 'Você não tem permissão para ver o Operacional. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  with p as (select * from nucleo.placas_do_patio())
  select jsonb_build_object(
    'no_patio', (select count(*) from p),
    'na_fila', (select count(*) from p where p.posicao is not null),
    'maior_espera_min', (select round(extract(epoch from now() - min(p.chegou_em)) / 60) from p where p.posicao is not null),
    'tempo_medio_no_patio_min', (select round(avg(extract(epoch from now() - p.desde)) / 60) from p where p.desde is not null),
    'por_situacao', jsonb_build_object(
      'DOp', (select count(*) from p where p.sigla = 'DOp'), 'ACe', (select count(*) from p where p.sigla = 'ACe'),
      'CAr', (select count(*) from p where p.sigla = 'CAr'), 'CAn', (select count(*) from p where p.sigla = 'CAn')),
    'ordens_abertas', (select count(*) from operacional.ordem_de_carregamento o where o.situacao in ('carregando', 'carregada')),
    'ordens_criadas_hoje', (select count(*) from operacional.ordem_de_carregamento o where o.criada_em >= v_inicio),
    'ordens_em_viagem_hoje', (select count(*) from operacional.ordem_de_carregamento o where o.saiu_em >= v_inicio)
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.kpis_do_operacional() from public, anon;
comment on function nucleo.kpis_do_operacional() is
  'Os KPIs do Pátio, do Totem e das Ordens (no pátio, na fila, maior espera, tempo médio no pátio, por situação, ordens abertas e do dia), prontos no banco, pela RLS e pela filial de quem consulta.';

create function nucleo.avancar_no_patio_em_lote(p_ativos uuid[], p_acao text, p_motivo text default null, p_chave uuid default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_recusados jsonb := '[]'::jsonb;
  v_avancados integer := 0;
  v_total integer := coalesce(cardinality(p_ativos), 0);
  v_lote uuid;
  v_em timestamptz := now();
begin
  if v_total = 0 then
    raise exception 'Escolha ao menos uma placa.' using errcode = '22023';
  end if;
  v_lote := auditoria.reservar_envio(p_chave, 'avancar_no_patio_em_lote');
  if v_lote is not null then
    return jsonb_build_object('lote_id', v_lote, 'total', v_total, 'avancados', null, 'recusados', '[]'::jsonb, 'repetido', true);
  end if;
  v_lote := gen_random_uuid();

  begin
    foreach v_ativo in array p_ativos loop
      begin
        perform nucleo.avancar_no_patio(v_ativo, p_acao, p_motivo, v_em, null);
        v_avancados := v_avancados + 1;
      exception when others then
        v_recusados := v_recusados || jsonb_build_object('ativo_id', v_ativo, 'motivo', sqlerrm, 'codigo', sqlstate);
      end;
    end loop;
    if jsonb_array_length(v_recusados) > 0 then
      raise exception 'lote recusado' using errcode = 'P0002';
    end if;
  exception when sqlstate 'P0002' then
    v_avancados := 0;
  end;

  if v_avancados > 0 then
    perform auditoria.concluir_envio(p_chave, v_lote);
  end if;
  return jsonb_build_object('lote_id', v_lote, 'total', v_total, 'avancados', v_avancados, 'recusados', v_recusados, 'repetido', false);
end;
$$;
revoke all on function nucleo.avancar_no_patio_em_lote(uuid[], text, text, uuid) from public, anon;
comment on function nucleo.avancar_no_patio_em_lote(uuid[], text, text, uuid) is
  'Pátio em lote: a mesma ação para várias placas, tudo ou nada; devolve "avançadas de total" e os recusados com o motivo. Cada placa passa pela conferência de nucleo.avancar_no_patio. Chave de envio.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.kpis_do_operacional()', 'Os KPIs do Pátio, do Totem e das Ordens, prontos no banco, pela RLS de quem consulta.'),
  ('nucleo.avancar_no_patio_em_lote(uuid[],text,text,uuid)', 'Pátio em lote (tudo ou nada), pela conferência de avancar_no_patio, com chave de envio.');
grant execute on function nucleo.kpis_do_operacional() to authenticated;
grant execute on function nucleo.avancar_no_patio_em_lote(uuid[], text, text, uuid) to authenticated;
