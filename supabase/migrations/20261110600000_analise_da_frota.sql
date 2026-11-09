-- Frota › Análise (primeira versão), em quatro camadas (hipótese da primeira versão, a confirmar):
--  1. Retrato (agora): quantas placas em cada grupo de situação, por tipo, e o tempo parado no PÁT
--     (lê a linha mantida, nucleo.leitura_da_placa, como o modo Agora do Acompanhamento).
--  2. Disponibilidade no mês: placas em atividade ÷ placas na frota, dia a dia, pela situação calculada
--     no fim de cada dia (nucleo.situacao_no_dia, a mesma da grade). "Na frota" = com situação conhecida
--     e fora do grupo Fora (ALU, EMP, VEN, VND, SUC). A do mês pondera placa-dia.
--  3. Onde: o mesmo por operação, filial ou gestor (o agrupamento atual da placa).
--  4. Custo e consumo: próxima versão (depende do abastecimento e dos títulos do Sankhya).
--  * O universo é o que a RLS de quem consulta deixa ver hoje (a carteira do gestor, a filial do
--    Operacional, tudo para Diretoria e Administração). O banco entrega os totais prontos.
-- Nenhuma função aqui é SECURITY DEFINER.

create function nucleo.analise_da_frota(
  p_mes date, p_filial text default null, p_operacao_id uuid default null, p_agrupamento text default 'operacao'
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hoje date := nucleo.hoje_em_sao_paulo();
  v_inicio date;
  v_ate date;
  v_resultado jsonb;
begin
  if p_mes is null then
    raise exception 'Escolha o mês da análise.' using errcode = '22023';
  end if;
  v_inicio := date_trunc('month', p_mes)::date;
  if v_inicio > v_hoje then
    raise exception 'O mês da análise ainda não começou. Escolha um mês até o atual.' using errcode = '22023';
  end if;
  if p_agrupamento is null or p_agrupamento not in ('operacao', 'filial', 'gestor') then
    raise exception 'Agrupe por operação, filial ou gestor.' using errcode = '22023';
  end if;
  v_ate := least((date_trunc('month', p_mes) + interval '1 month - 1 day')::date, v_hoje);

  with universo as (
    select l.ativo_id, l.placa, l.tipo, l.operacao, l.filial, l.grupo, l.sigla, l.inicio_do_pat,
           l.baixada_em is null as ativa,
           case p_agrupamento
             when 'operacao' then l.operacao_id::text
             when 'filial' then l.filial
             else l.gestor_id::text
           end as chave,
           case p_agrupamento
             when 'operacao' then coalesce(l.operacao, 'Sem operação')
             when 'filial' then coalesce(l.filial, 'Sem filial')
             else coalesce(l.gestor, 'Sem gestor')
           end as rotulo
      from nucleo.leitura_da_placa l
     where (l.baixada_em is null or l.baixada_em >= v_inicio::timestamp at time zone 'America/Sao_Paulo')
       and (p_filial is null or l.filial = p_filial)
       and (p_operacao_id is null or l.operacao_id = p_operacao_id)
  ),
  agora as (
    select * from universo u where u.ativa
  ),
  dias as (
    select generate_series(v_inicio, v_ate, interval '1 day')::date as dia
  ),
  placa_dia as materialized (
    select u.ativo_id, u.chave, d.dia, s.chip
      from universo u
     cross join dias d
      join config.status s on s.sigla = nucleo.situacao_no_dia(u.ativo_id, d.dia)
  ),
  serie as (
    select d.dia,
           count(p.ativo_id) filter (where p.chip <> 'fora') as na_frota,
           count(p.ativo_id) filter (where p.chip = 'em-atividade') as em_atividade,
           count(p.ativo_id) filter (where p.chip = 'atencao') as atencao,
           count(p.ativo_id) filter (where p.chip = 'impedida') as impedida,
           count(p.ativo_id) filter (where p.chip = 'patio') as patio,
           count(p.ativo_id) filter (where p.chip = 'fora') as fora
      from dias d
      left join placa_dia p on p.dia = d.dia
     group by d.dia
  ),
  por_grupo_no_mes as (
    select p.chave,
           count(*) filter (where p.chip <> 'fora') as placa_dias,
           count(*) filter (where p.chip = 'em-atividade') as em_atividade
      from placa_dia p
     group by p.chave
  ),
  grupos as (
    select u.chave, u.rotulo,
           count(*) filter (where u.ativa) as total,
           count(*) filter (where u.ativa and u.grupo = 'em-atividade') as em_atividade,
           count(*) filter (where u.ativa and u.grupo = 'impedida') as impedida,
           count(*) filter (where u.ativa and u.grupo = 'patio') as patio,
           count(*) filter (where u.ativa and nucleo.alerta_parado_em_patio(u.inicio_do_pat, now())) as parados_no_pat
      from universo u
     group by u.chave, u.rotulo
  )
  select jsonb_build_object(
    'mes', v_inicio,
    'ate', v_ate,
    'agrupamento', p_agrupamento,
    'retrato', (
      select jsonb_build_object(
        'total', count(*),
        'em_atividade', count(*) filter (where a.grupo = 'em-atividade'),
        'atencao', count(*) filter (where a.grupo = 'atencao'),
        'impedida', count(*) filter (where a.grupo = 'impedida'),
        'patio', count(*) filter (where a.grupo = 'patio'),
        'fora', count(*) filter (where a.grupo = 'fora'),
        'pendente', count(*) filter (where a.grupo is null),
        'parados_no_pat', count(*) filter (where nucleo.alerta_parado_em_patio(a.inicio_do_pat, now())),
        'dias_medio_no_pat', round(avg(extract(epoch from now() - a.inicio_do_pat) / 86400.0)
                                     filter (where a.sigla = 'PÁT' and a.inicio_do_pat is not null), 1)
      )
        from agora a
    ),
    'tipos', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', t.tipo, 'total', t.total, 'em_atividade', t.em_atividade)
                                order by t.ordem), '[]'::jsonb)
        from (
          select a.tipo, count(*) as total, count(*) filter (where a.grupo = 'em-atividade') as em_atividade,
                 array_position(array['cavalo', 'implemento', 'caminhao', 'equipamento', 'apoio'], a.tipo) as ordem
            from agora a
           group by a.tipo
        ) t
    ),
    'mais_tempo_no_pat', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'ativo_id', m.ativo_id, 'placa', m.placa, 'tipo', m.tipo, 'operacao', m.operacao,
               'filial', m.filial, 'desde', m.inicio_do_pat,
               'dias', floor(extract(epoch from now() - m.inicio_do_pat) / 86400.0)::int
             ) order by m.inicio_do_pat, m.placa, m.ativo_id), '[]'::jsonb)
        from (
          select a.* from agora a
           where a.sigla = 'PÁT' and a.inicio_do_pat is not null
           order by a.inicio_do_pat, a.placa, a.ativo_id
           limit 10
        ) m
    ),
    'dias', (
      select jsonb_agg(jsonb_build_object(
               'dia', s.dia, 'na_frota', s.na_frota, 'em_atividade', s.em_atividade, 'atencao', s.atencao,
               'impedida', s.impedida, 'patio', s.patio, 'fora', s.fora,
               'disponibilidade', round(100.0 * s.em_atividade / nullif(s.na_frota, 0), 1)
             ) order by s.dia)
        from serie s
    ),
    'placa_dias', (select coalesce(sum(s.na_frota), 0) from serie s),
    'disponibilidade', (
      select round(100.0 * sum(s.em_atividade) / nullif(sum(s.na_frota), 0), 1) from serie s
    ),
    'grupos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'chave', g.chave, 'rotulo', g.rotulo, 'total', g.total, 'em_atividade', g.em_atividade,
               'impedida', g.impedida, 'patio', g.patio, 'parados_no_pat', g.parados_no_pat,
               'placa_dias', coalesce(m.placa_dias, 0),
               'disponibilidade', round(100.0 * m.em_atividade / nullif(m.placa_dias, 0), 1)
             ) order by g.rotulo, g.chave), '[]'::jsonb)
        from grupos g
        left join por_grupo_no_mes m on m.chave is not distinct from g.chave
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;
revoke all on function nucleo.analise_da_frota(date, text, uuid, text) from public;
comment on function nucleo.analise_da_frota(date, text, uuid, text) is
  'Frota › Análise: o retrato de agora, a disponibilidade dia a dia do mês e o mesmo por operação, filial ou gestor, com os totais prontos; com a RLS de quem consulta.';

-- As opções do contexto da Análise (filiais e operações das placas que quem consulta vê).
create function nucleo.opcoes_da_analise()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'filiais', (
      select coalesce(jsonb_agg(f.filial order by f.filial), '[]'::jsonb)
        from (select distinct l.filial from nucleo.leitura_da_placa l
               where l.baixada_em is null and l.filial is not null) f
    ),
    'operacoes', (
      select coalesce(jsonb_agg(jsonb_build_object('id', o.operacao_id, 'nome', o.operacao) order by o.operacao, o.operacao_id), '[]'::jsonb)
        from (select distinct l.operacao_id, l.operacao from nucleo.leitura_da_placa l
               where l.baixada_em is null and l.operacao_id is not null) o
    )
  )
$$;
revoke all on function nucleo.opcoes_da_analise() from public;
comment on function nucleo.opcoes_da_analise() is
  'As filiais e as operações das placas que quem consulta vê (o contexto da Análise da Frota).';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.analise_da_frota(date,text,uuid,text)', 'A Análise da Frota (retrato, disponibilidade do mês e por grupo), com a RLS de quem consulta.'),
  ('nucleo.opcoes_da_analise()', 'As filiais e operações do contexto da Análise, com a RLS de quem consulta.');

grant execute on function nucleo.analise_da_frota(date, text, uuid, text) to authenticated;
grant execute on function nucleo.opcoes_da_analise() to authenticated;
