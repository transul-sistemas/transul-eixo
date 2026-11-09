-- Frota › Acompanhamento (primeira versão): a grade do mês, o lançamento da situação do dia, o modo
-- Agora e o Censo.
--
--  * A grade (placas × dias) e o Censo leem a situação calculada (nucleo.situacao_com_causa), a definição
--    única; a célula de um dia é a situação no fim daquele dia (ou agora, se o dia é hoje). O Agora lê a
--    linha mantida (nucleo.leitura_da_placa), que guarda a mesma situação calculada.
--  * O universo é o que a RLS de quem consulta deixa ver (leitura_da_placa e estado_de_status). A grade
--    mostra as placas que não são implemento (o implemento engatado herda a atividade do cavalo).
--  * Lançar a situação do dia grava pelo evento de status (nucleo.registrar_evento, pela política do
--    evento) e fecha as camadas de prioridade maior que estejam abertas, para o que se lança ser o que se
--    vê (hipótese da primeira versão). A baixa (VND, SUC) continua só pela ficha. Hoje: agora; dia
--    passado: 23:59 daquele dia; dia futuro: recusado.
--  * O banco entrega os totais prontos (Agora e Censo trazem a linha de total).
-- Nenhuma função aqui é SECURITY DEFINER.

-- O instante que representa um dia na leitura: o fim do dia em São Paulo, ou agora se o dia é hoje.
create function nucleo.instante_do_dia(p_dia date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select least(((p_dia + 1)::timestamp at time zone 'America/Sao_Paulo') - interval '1 microsecond', now())
$$;
revoke all on function nucleo.instante_do_dia(date) from public;
comment on function nucleo.instante_do_dia(date) is
  'O instante que representa o dia na leitura (fim do dia em São Paulo, ou agora se o dia é hoje).';

create function nucleo.hoje_em_sao_paulo()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;
revoke all on function nucleo.hoje_em_sao_paulo() from public;

-- ---------------------------------------------------------------------------------------------
-- Grade do mês
-- ---------------------------------------------------------------------------------------------

-- As placas da grade (sem implementos; as baixadas antes do mês saem), pelos filtros, com a RLS de
-- quem consulta.
create function nucleo.placas_da_grade(p_inicio date, p_busca text, p_tipos text[])
returns setof nucleo.leitura_da_placa
language sql
stable
set search_path = ''
as $$
  select l.*
    from nucleo.leitura_da_placa l
    cross join (
      select replace(replace(replace(nucleo.texto_simples(btrim(coalesce(p_busca, ''))), '\', '\\'), '%', '\%'), '_', '\_') as busca,
             upper(regexp_replace(coalesce(p_busca, ''), '[^A-Za-z0-9]', '', 'g')) as placa
    ) t
   where l.tipo <> 'implemento'
     and (l.baixada_em is null or l.baixada_em >= p_inicio::timestamp at time zone 'America/Sao_Paulo')
     and (cardinality(coalesce(p_tipos, '{}')) = 0 or l.tipo = any (p_tipos))
     and (t.busca = '' or l.busca like '%' || t.busca || '%' or (t.placa <> '' and l.placa like '%' || t.placa || '%'))
$$;
revoke all on function nucleo.placas_da_grade(date, text, text[]) from public;
comment on function nucleo.placas_da_grade(date, text, text[]) is
  'As placas da grade do Acompanhamento (sem implementos), pelos filtros, com a RLS de quem consulta.';

-- A situação de um ativo no fim de um dia (nula para dia futuro ou antes do ativo existir: sem estado
-- em nenhuma camada, o ativo ainda não tinha nascido, porque ele nasce com o evento inicial).
create function nucleo.situacao_no_dia(p_ativo_id uuid, p_dia date)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(nucleo.situacao_em(p_ativo_id, nucleo.instante_do_dia(p_dia)), 'pendente')
   where p_dia <= nucleo.hoje_em_sao_paulo()
$$;
revoke all on function nucleo.situacao_no_dia(uuid, date) from public;

create function nucleo.grade_do_acompanhamento(
  p_mes date, p_busca text default '', p_tipos text[] default '{}', p_pagina integer default 1, p_tam integer default 50
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_inicio date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_tam integer := least(greatest(coalesce(p_tam, 50), 1), 200);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_total integer;
  v_paginas integer;
  v_linhas jsonb;
begin
  if p_mes is null then
    raise exception 'Escolha o mês da grade.' using errcode = '22023';
  end if;
  select count(*) into v_total from nucleo.placas_da_grade(v_inicio, p_busca, p_tipos);
  v_paginas := greatest(ceil(v_total::numeric / v_tam)::integer, 1);
  v_pagina := least(v_pagina, v_paginas);

  select coalesce(jsonb_agg(p.linha order by p.placa, p.ativo_id), '[]'::jsonb) into v_linhas
    from (
      select g.placa, g.ativo_id, jsonb_build_object(
        'ativo_id', g.ativo_id, 'placa', g.placa, 'tipo', g.tipo, 'modelo', g.modelo,
        'operacao', g.operacao, 'gestor', g.gestor, 'sigla_atual', g.sigla, 'grupo_atual', g.grupo,
        'em_conjunto', nucleo.em_conjunto(g.ativo_id, now()),
        'dias', (
          select jsonb_agg(jsonb_build_object('dia', c.dia, 'sigla', c.sigla, 'grupo', s.chip, 'lancado', c.lancado)
                   order by c.dia)
            from (
              select d.dia, nucleo.situacao_no_dia(g.ativo_id, d.dia) as sigla,
                     exists (
                       select 1 from nucleo.evento_de_status e
                        where e.ativo_id = g.ativo_id and e.excluido_em is null
                          and e.em >= d.dia::timestamp at time zone 'America/Sao_Paulo'
                          and e.em < (d.dia + 1)::timestamp at time zone 'America/Sao_Paulo'
                     ) as lancado
                from (select generate_series(v_inicio, v_fim - 1, interval '1 day')::date as dia) d
            ) c
            left join config.status s on s.sigla = c.sigla
        )
      ) as linha
        from nucleo.placas_da_grade(v_inicio, p_busca, p_tipos) g
       order by g.placa, g.ativo_id
       offset (v_pagina - 1) * v_tam limit v_tam
    ) p;

  return jsonb_build_object(
    'mes', v_inicio, 'hoje', v_hoje, 'linhas', v_linhas,
    'total', v_total, 'pagina', v_pagina, 'paginas', v_paginas, 'tam', v_tam
  );
end;
$$;
revoke all on function nucleo.grade_do_acompanhamento(date, text, text[], integer, integer) from public;
comment on function nucleo.grade_do_acompanhamento(date, text, text[], integer, integer) is
  'A grade do Acompanhamento: as placas (sem implementos) × os dias do mês, com a situação no fim de cada dia e se houve lançamento; paginada no banco (ordem pela placa, desempate pelo id), com a RLS de quem consulta.';

-- ---------------------------------------------------------------------------------------------
-- Lançar a situação do dia
-- ---------------------------------------------------------------------------------------------
create function nucleo.lancar_situacao_do_dia(p_ativo_id uuid, p_sigla text, p_dia date, p_chave uuid default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_em timestamptz;
  v_camada text;
  v_prioridade smallint;
  v_id uuid;
  v_aberta text;
begin
  if not config.ve_ativo(p_ativo_id, array['frota', 'operacional'], 'criar') then
    raise exception 'Você não tem permissão para lançar a situação desta placa.' using errcode = '42501';
  end if;
  if p_dia is null or p_dia > v_hoje then
    raise exception 'Não se lança a situação de um dia que ainda não chegou. Escolha um dia até hoje.' using errcode = '22023';
  end if;
  select s.camada, c.prioridade into v_camada, v_prioridade
    from config.status s join config.camada_de_status c on c.codigo = s.camada
   where s.sigla = p_sigla;
  if not found then
    raise exception 'A situação % não existe na régua.', p_sigla using errcode = '23514';
  end if;
  if v_camada = 'baixada' then
    raise exception 'A baixa (venda ou sucata) se registra pela ficha da placa, não pela grade.' using errcode = '23514';
  end if;

  v_em := case when p_dia = v_hoje then now()
               else ((p_dia + 1)::timestamp at time zone 'America/Sao_Paulo') - interval '1 minute' end;

  v_id := auditoria.reservar_envio(p_chave, 'lancar_situacao_do_dia');
  if v_id is null then
    -- Fecha as camadas de prioridade maior abertas (menos a baixada, que nunca se encerra por evento).
    for v_aberta in
      select e.camada from nucleo.estado_de_status e join config.camada_de_status c on c.codigo = e.camada
       where e.ativo_id = p_ativo_id and e.fim is null and e.excluido_em is null
         and c.prioridade < v_prioridade and e.camada <> 'baixada'
       order by c.prioridade
    loop
      perform nucleo.registrar_evento(p_ativo_id, null, v_em, 'manual', 'informada',
        'Lançamento da situação do dia (Acompanhamento)', v_aberta);
    end loop;
    v_id := nucleo.registrar_evento(p_ativo_id, p_sigla, v_em, 'manual', 'informada',
      'Lançamento da situação do dia (Acompanhamento)');
    perform auditoria.concluir_envio(p_chave, v_id);
  end if;

  return jsonb_build_object(
    'ativo_id', p_ativo_id, 'dia', p_dia, 'evento_id', v_id,
    'sigla', nucleo.situacao_em(p_ativo_id, nucleo.instante_do_dia(p_dia))
  );
end;
$$;
revoke all on function nucleo.lancar_situacao_do_dia(uuid, text, date, uuid) from public;
comment on function nucleo.lancar_situacao_do_dia(uuid, text, date, uuid) is
  'Lança a situação do dia pela grade do Acompanhamento: fecha as camadas de prioridade maior abertas e registra o evento (pela política do evento); confere a permissão e a chave de envio. Devolve a situação do dia.';

-- ---------------------------------------------------------------------------------------------
-- Agora: a situação atual agregada
-- ---------------------------------------------------------------------------------------------
create function nucleo.agora_do_acompanhamento(p_agrupamento text, p_tipos text[] default '{}')
returns table (
  chave text, rotulo text, total bigint, em_atividade bigint, atencao bigint, impedida bigint,
  patio bigint, fora bigint, pendente bigint
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_agrupamento is null or p_agrupamento not in ('operacao', 'filial', 'gestor', 'tipo') then
    raise exception 'Agrupe por operação, filial, gestor ou tipo.' using errcode = '22023';
  end if;
  return query
  with base as (
    select case p_agrupamento
             when 'operacao' then l.operacao_id::text
             when 'filial' then l.filial
             when 'gestor' then l.gestor_id::text
             else l.tipo
           end as chave,
           case p_agrupamento
             when 'operacao' then coalesce(l.operacao, 'Sem operação')
             when 'filial' then coalesce(l.filial, 'Sem filial')
             when 'gestor' then coalesce(l.gestor, 'Sem gestor')
             else nucleo.nome_do_tipo(l.tipo::nucleo.tipo_de_ativo)
           end as rotulo,
           l.grupo
      from nucleo.leitura_da_placa l
     where l.baixada_em is null
       and (cardinality(coalesce(p_tipos, '{}')) = 0 or l.tipo = any (p_tipos))
  ),
  agregado as (
    select grouping(b.chave, b.rotulo) as nivel, b.chave, b.rotulo,
           count(*) as total,
           count(*) filter (where b.grupo = 'em-atividade') as em_atividade,
           count(*) filter (where b.grupo = 'atencao') as atencao,
           count(*) filter (where b.grupo = 'impedida') as impedida,
           count(*) filter (where b.grupo = 'patio') as patio,
           count(*) filter (where b.grupo = 'fora') as fora,
           count(*) filter (where b.grupo is null) as pendente
      from base b
     group by grouping sets ((b.chave, b.rotulo), ())
  )
  select a.chave, case when a.nivel = 0 then a.rotulo else 'Total' end,
         a.total, a.em_atividade, a.atencao, a.impedida, a.patio, a.fora, a.pendente
    from agregado a
   order by a.nivel, a.rotulo, a.chave;
  -- Sem placa nenhuma, o grouping set vazio ainda devolve a linha de total (com zeros).
end;
$$;
revoke all on function nucleo.agora_do_acompanhamento(text, text[]) from public;
comment on function nucleo.agora_do_acompanhamento(text, text[]) is
  'O modo Agora: quantas placas (não baixadas) em cada grupo de situação, por operação, filial, gestor ou tipo, com a linha de total; lê a linha mantida, com a RLS de quem consulta.';

-- ---------------------------------------------------------------------------------------------
-- Censo: a contagem por situação num dia
-- ---------------------------------------------------------------------------------------------
create function nucleo.censo_do_acompanhamento(p_dia date, p_tipos text[] default '{}')
returns table (sigla text, nome text, grupo text, quantidade bigint)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_em timestamptz;
begin
  if p_dia is null or p_dia > v_hoje then
    raise exception 'O censo é de um dia até hoje. Escolha outro dia.' using errcode = '22023';
  end if;
  v_em := nucleo.instante_do_dia(p_dia);
  return query
  with base as (
    select case when p_dia = v_hoje then nullif(l.sigla, 'pendente') else nucleo.situacao_no_dia(l.ativo_id, p_dia) end as sigla
      from nucleo.leitura_da_placa l
     where (l.baixada_em is null or l.baixada_em > v_em)
       and (cardinality(coalesce(p_tipos, '{}')) = 0 or l.tipo = any (p_tipos))
  ),
  agregado as (
    select grouping(b.sigla) as nivel, b.sigla, count(*) as quantidade
      from base b
     where b.sigla is not null
     group by grouping sets ((b.sigla), ())
  )
  select case when a.nivel = 0 then a.sigla end, s.nome, s.chip, a.quantidade
    from agregado a
    left join config.status s on s.sigla = a.sigla and a.nivel = 0
   order by a.nivel, coalesce(s.ordem, 999), a.sigla;
end;
$$;
revoke all on function nucleo.censo_do_acompanhamento(date, text[]) from public;
comment on function nucleo.censo_do_acompanhamento(date, text[]) is
  'O Censo: quantas placas em cada situação no fim do dia (hoje: agora), na ordem da régua e com a linha de total; com a RLS de quem consulta.';

-- ---------------------------------------------------------------------------------------------
-- O que o app executa (a lista de exceções, com o porquê de cada uma)
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.instante_do_dia(date)', 'Pura sobre o relógio: o instante que representa um dia na leitura do Acompanhamento.'),
  ('nucleo.hoje_em_sao_paulo()', 'Pura sobre o relógio: o dia de hoje em São Paulo.'),
  ('nucleo.placas_da_grade(date,text,text[])', 'As placas da grade do Acompanhamento, com a RLS de quem consulta.'),
  ('nucleo.situacao_no_dia(uuid,date)', 'A situação no fim de um dia, com a RLS de quem consulta.'),
  ('nucleo.grade_do_acompanhamento(date,text,text[],integer,integer)', 'A grade do Acompanhamento (placas × dias), com a RLS de quem consulta.'),
  ('nucleo.lancar_situacao_do_dia(uuid,text,date,uuid)', 'Lançar a situação do dia pela grade, pela política do evento de status; confere a permissão e a chave de envio.'),
  ('nucleo.agora_do_acompanhamento(text,text[])', 'O modo Agora do Acompanhamento (contagem por grupo de situação), com a RLS de quem consulta.'),
  ('nucleo.censo_do_acompanhamento(date,text[])', 'O Censo do Acompanhamento (contagem por situação num dia), com a RLS de quem consulta.');

grant execute on function nucleo.instante_do_dia(date) to authenticated;
grant execute on function nucleo.hoje_em_sao_paulo() to authenticated;
grant execute on function nucleo.placas_da_grade(date, text, text[]) to authenticated;
grant execute on function nucleo.situacao_no_dia(uuid, date) to authenticated;
grant execute on function nucleo.grade_do_acompanhamento(date, text, text[], integer, integer) to authenticated;
grant execute on function nucleo.lancar_situacao_do_dia(uuid, text, date, uuid) to authenticated;
grant execute on function nucleo.agora_do_acompanhamento(text, text[]) to authenticated;
grant execute on function nucleo.censo_do_acompanhamento(date, text[]) to authenticated;
