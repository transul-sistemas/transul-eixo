-- Resultados (Nível 2), na forma mais simples: Fechar e Reabrir o mês (inventário 34 e 35), Pedir ajuste (36),
-- as leituras de Fechamentos, Ajustes e Maturação.
--
--  * financeiro.fechamento_do_mes: a FOTO do mês (nucleo.resultado_por_operacao do momento, com o total da Visão
--    geral) gravada ao fechar; nunca muda. Um fechado por mês (índice único parcial). Reabrir marca a foto como
--    reaberta (fica no histórico) e fechar de novo grava foto nova. Só a Diretoria fecha e reabre (H6); reabrir pede
--    motivo. Só fecha mês cujo corte já passou (nucleo.ultimo_mes_que_pode_fechar, pelo calendário). Fechar o mesmo mês fechado e
--    reabrir o já reaberto não mudam nada (rodam duas vezes).
--  * financeiro.ajuste: o ajuste justificado (o fato do Sankhya nunca é editado), por mês, operação ou CR e linha
--    da cascata (receita, custo da frota, custo do serviço), com valor com sinal. Pede quem tem Resultados › criar;
--    decide só a Diretoria, e quem pede não decide. Nesta versão o ajuste aprovado NÃO entra na Visão geral nem na
--    foto: aparece em Resultados › Ajustes (hipótese).
--  * Maturação: os títulos de despesa do período (config.parametro maturacao_inicio e maturacao_fim; base =
--    dt_competencia, pois o staging da v1 não traz DTNEG nem a origem da renegociação), sem provisão nem invalidados:
--    negociado = valor líquido; pago = valor líquido dos baixados; saldo = negociado − pago; quitado = pago ÷
--    negociado (uma casa).
--  * Leitura: Resultados › ver (RLS nas tabelas; as funções de leitura rodam com a RLS de quem chama).

grant usage on schema financeiro to authenticated;

insert into config.parametro (chave, valor, descricao) values
  ('maturacao_inicio', '2025-05-01', 'Resultados › Maturação: primeiro dia do período dos títulos negociados (dívida antiga).'),
  ('maturacao_fim', '2026-06-01', 'Resultados › Maturação: dia seguinte ao último do período dos títulos negociados (fim exclusivo).');

-- ---------------------------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------------------------
create table financeiro.fechamento_do_mes (
  id uuid primary key default gen_random_uuid(),
  mes date not null check (mes = date_trunc('month', mes)::date),
  situacao text not null default 'fechado' check (situacao in ('fechado', 'reaberto')),
  foto jsonb not null,
  receita numeric(15, 2) not null,
  custo numeric(15, 2) not null,
  resultado numeric(15, 2) not null,
  fechado_por uuid references nucleo.pessoa (id),
  fechado_em timestamptz not null default now(),
  reaberto_por uuid references nucleo.pessoa (id),
  reaberto_em timestamptz,
  motivo_da_reabertura text,
  versao integer not null default 1,
  constraint fechamento_reaberto_com_motivo check (situacao = 'fechado' or length(btrim(coalesce(motivo_da_reabertura, ''))) > 0)
);
comment on table financeiro.fechamento_do_mes is
  'A foto de cada fechamento do mês (os totais do momento, que não mudam). Um fechado por mês; reabrir marca a foto como reaberta, com motivo, e ela fica no histórico.';
create unique index fechamento_do_mes_um_fechado_por_mes on financeiro.fechamento_do_mes (mes) where situacao = 'fechado';
create index fechamento_do_mes_mes_idx on financeiro.fechamento_do_mes (mes, fechado_em desc);
create index fechamento_do_mes_fechado_por_idx on financeiro.fechamento_do_mes (fechado_por);
create index fechamento_do_mes_reaberto_por_idx on financeiro.fechamento_do_mes (reaberto_por);
alter table financeiro.fechamento_do_mes enable row level security;
create trigger t30_versao before update on financeiro.fechamento_do_mes
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on financeiro.fechamento_do_mes
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on financeiro.fechamento_do_mes
  for each row execute function auditoria.registrar_mudanca('id');

create table financeiro.ajuste (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  mes date not null check (mes = date_trunc('month', mes)::date),
  operacao_id uuid references nucleo.operacao (id),
  cr_id uuid references nucleo.cr (id),
  linha text not null check (linha in ('receita', 'custo_frota', 'custo_servico')),
  valor numeric(15, 2) not null check (valor <> 0),
  justificativa text not null check (length(btrim(justificativa)) > 0),
  situacao text not null default 'pedido' check (situacao in ('pedido', 'aprovado', 'recusado')),
  pedido_por uuid references nucleo.pessoa (id),
  pedido_em timestamptz not null default now(),
  decidido_por uuid references nucleo.pessoa (id),
  decidido_em timestamptz,
  motivo_da_decisao text,
  versao integer not null default 1,
  constraint ajuste_recusado_com_motivo check (situacao <> 'recusado' or length(btrim(coalesce(motivo_da_decisao, ''))) > 0),
  constraint ajuste_quem_pede_nao_decide check (decidido_por is null or decidido_por is distinct from pedido_por)
);
comment on table financeiro.ajuste is
  'O ajuste justificado sobre o resultado (o fato do Sankhya nunca é editado): mês, operação ou CR, linha da cascata e valor com sinal; aprovação pela Diretoria, e quem pede não decide.';
create index ajuste_mes_idx on financeiro.ajuste (mes, situacao);
create index ajuste_operacao_id_idx on financeiro.ajuste (operacao_id);
create index ajuste_cr_id_idx on financeiro.ajuste (cr_id);
create index ajuste_pedido_por_idx on financeiro.ajuste (pedido_por);
create index ajuste_decidido_por_idx on financeiro.ajuste (decidido_por);
create index ajuste_pedido_em_idx on financeiro.ajuste (pedido_em desc, numero desc);
alter table financeiro.ajuste enable row level security;
create trigger t30_versao before update on financeiro.ajuste
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on financeiro.ajuste
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on financeiro.ajuste
  for each row execute function auditoria.registrar_mudanca('id');

create policy fechamento_do_mes_ler on financeiro.fechamento_do_mes for select to authenticated
  using ((select config.pode('resultados', 'ver')));
create policy ajuste_ler on financeiro.ajuste for select to authenticated
  using ((select config.pode('resultados', 'ver')));
grant select on financeiro.fechamento_do_mes, financeiro.ajuste to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Fechar e reabrir o mês
-- ---------------------------------------------------------------------------------------------
-- O último mês que pode fechar pelo calendário: o mês M fecha quando passa o dia do corte do mês seguinte. (Não
-- usa nucleo.mes_fechado_mais_recente, que também olha o último mês completo do staging.)
create function nucleo.ultimo_mes_que_pode_fechar()
returns date
language sql
stable
set search_path = ''
as $$
  select (date_trunc('month', y.hoje::timestamp)
          - case when extract(day from y.hoje) > y.corte then interval '1 month' else interval '2 months' end)::date
    from (select nucleo.hoje_em_sao_paulo() as hoje, nucleo.dia_do_corte_da_competencia() as corte) y
$$;
revoke all on function nucleo.ultimo_mes_que_pode_fechar() from public, anon;
comment on function nucleo.ultimo_mes_que_pode_fechar() is
  'O último mês que pode fechar pelo calendário: o mês M fecha quando passa o dia do corte do mês seguinte.';

create function nucleo.fechar_mes(p_mes date, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: a foto do fechamento não tem escrita direta; a função confere por dentro o perfil Diretoria (H6) e que o corte do mês já passou, calcula a foto pela leitura única (nucleo.resultado_por_operacao) e grava só o fechamento deste mês; search_path vazio.
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', p_mes::timestamp)::date;
  v_id uuid;
  v_foto jsonb;
begin
  if config.usuario_atual() is null or config.perfil_atual() is distinct from 'diretoria' then
    raise exception 'Só a Diretoria fecha o mês.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'fechar_mes');
  if v_id is not null then
    return v_id;
  end if;
  if v_mes is null or v_mes > nucleo.ultimo_mes_que_pode_fechar() then
    raise exception 'O mês só fecha depois do dia do corte do mês seguinte.' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtext('fechar_mes'), (extract(year from v_mes) * 100 + extract(month from v_mes))::integer);
  select f.id into v_id from financeiro.fechamento_do_mes f where f.mes = v_mes and f.situacao = 'fechado';
  if v_id is null then
    v_foto := jsonb_build_object('por_operacao', nucleo.resultado_por_operacao(v_mes));
    insert into financeiro.fechamento_do_mes (mes, foto, receita, custo, resultado, fechado_por)
    values (v_mes, v_foto,
            coalesce((v_foto->'por_operacao'->'visao_geral'->>'receita')::numeric, 0),
            coalesce((v_foto->'por_operacao'->'visao_geral'->>'custo')::numeric, 0),
            coalesce((v_foto->'por_operacao'->'visao_geral'->>'resultado')::numeric, 0),
            config.usuario_atual())
    returning id into v_id;
  end if;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.fechar_mes(date, uuid) from public, anon;
comment on function nucleo.fechar_mes(date, uuid) is
  'Fecha o mês (só a Diretoria, depois do corte): grava a foto dos totais do momento, que não muda. O mês já fechado devolve o mesmo fechamento.';

create function nucleo.reabrir_mes(p_mes date, p_motivo text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: reabrir muda a foto (sem escrita direta); a função confere por dentro o perfil Diretoria e o motivo e só marca o fechamento deste mês como reaberto; search_path vazio.
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', p_mes::timestamp)::date;
  v_id uuid;
begin
  if config.usuario_atual() is null or config.perfil_atual() is distinct from 'diretoria' then
    raise exception 'Só a Diretoria reabre o mês.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'reabrir_mes');
  if v_id is not null then
    return v_id;
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Reabrir o mês pede o motivo.' using errcode = '23514';
  end if;
  select f.id into v_id from financeiro.fechamento_do_mes f where f.mes = v_mes and f.situacao = 'fechado' for update;
  if v_id is null then
    -- Já reaberto: não muda nada (roda duas vezes).
    select f.id into v_id from financeiro.fechamento_do_mes f
     where f.mes = v_mes and f.situacao = 'reaberto' order by f.reaberto_em desc, f.id limit 1;
    if v_id is null then
      raise exception 'Este mês não está fechado.' using errcode = '23514';
    end if;
  else
    update financeiro.fechamento_do_mes
       set situacao = 'reaberto', reaberto_por = config.usuario_atual(), reaberto_em = now(), motivo_da_reabertura = btrim(p_motivo)
     where id = v_id;
  end if;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.reabrir_mes(date, text, uuid) from public, anon;
comment on function nucleo.reabrir_mes(date, text, uuid) is
  'Reabre o mês fechado (só a Diretoria, com motivo): a foto fica no histórico como reaberta. Reabrir o já reaberto não muda nada.';

create function nucleo.fechamentos_do_resultado()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_ultimo financeiro.fechamento_do_mes;
  v_vivo numeric;
  v_resultado jsonb;
begin
  if not config.pode('resultados', 'ver') then
    raise exception 'Você não tem permissão para ver os fechamentos.' using errcode = '42501';
  end if;
  select * into v_ultimo from financeiro.fechamento_do_mes f where f.situacao = 'fechado' order by f.mes desc, f.fechado_em desc limit 1;
  if v_ultimo.id is not null then
    v_vivo := coalesce((nucleo.visao_geral_dos_resultados(v_ultimo.mes, null, null, 'operacao', 6)->'kpis'->>'resultado')::numeric, 0);
  end if;
  select jsonb_build_object(
    'mes_que_pode_fechar', nucleo.ultimo_mes_que_pode_fechar(),
    'kpis', jsonb_build_object(
      'fechados', (select count(*) from financeiro.fechamento_do_mes f where f.situacao = 'fechado'),
      'ultimo', case when v_ultimo.id is not null then jsonb_build_object(
                  'mes', v_ultimo.mes, 'fechado_em', v_ultimo.fechado_em,
                  'fechado_por', (select p.nome from nucleo.pessoa p where p.id = v_ultimo.fechado_por)) end,
      'diferenca_contra_o_vivo', case when v_ultimo.id is not null then v_vivo - v_ultimo.resultado end,
      'reaberturas', (select count(*) from financeiro.fechamento_do_mes f where f.situacao = 'reaberto')),
    'linhas', coalesce((select jsonb_agg(jsonb_build_object(
                'id', f.id, 'versao', f.versao, 'mes', f.mes, 'situacao', f.situacao,
                'receita', f.receita, 'custo', f.custo, 'resultado', f.resultado,
                'fechado_em', f.fechado_em, 'fechado_por', pf.nome,
                'reaberto_em', f.reaberto_em, 'reaberto_por', pr.nome, 'motivo_da_reabertura', f.motivo_da_reabertura)
              order by f.mes desc, f.fechado_em desc, f.id)
              from financeiro.fechamento_do_mes f
              left join nucleo.pessoa pf on pf.id = f.fechado_por
              left join nucleo.pessoa pr on pr.id = f.reaberto_por), '[]'::jsonb)
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.fechamentos_do_resultado() from public, anon;
comment on function nucleo.fechamentos_do_resultado() is
  'Resultados › Fechamentos: meses fechados, último fechamento, diferença contra o vivo (resultado da Visão geral hoje − foto do último fechado), reaberturas e o histórico das fotos. Pela RLS de quem chama (Resultados › ver).';

-- ---------------------------------------------------------------------------------------------
-- Ajustes
-- ---------------------------------------------------------------------------------------------
create function nucleo.pedir_ajuste(
  p_mes date, p_operacao_id uuid, p_cr_id uuid, p_linha text, p_valor numeric, p_justificativa text, p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: o ajuste não tem escrita direta; a função confere por dentro Resultados › criar, o mês, a linha, o valor e a justificativa, e grava só o pedido (o fato do Sankhya nunca é editado); search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if config.usuario_atual() is null or not config.pode('resultados', 'criar') then
    raise exception 'Você não tem permissão para pedir ajuste.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'pedir_ajuste');
  if v_id is not null then
    return v_id;
  end if;
  if p_mes is null or date_trunc('month', p_mes::timestamp)::date > date_trunc('month', nucleo.hoje_em_sao_paulo()::timestamp)::date then
    raise exception 'O ajuste é de um mês até o atual.' using errcode = '22023';
  end if;
  if p_linha is null or p_linha not in ('receita', 'custo_frota', 'custo_servico') then
    raise exception 'Escolha a linha: receita, custo da frota ou custo do serviço.' using errcode = '22023';
  end if;
  if p_valor is null or p_valor = 0 then
    raise exception 'Informe o valor do ajuste (com sinal; diferente de zero).' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_justificativa, '')), '') is null then
    raise exception 'O ajuste pede a justificativa.' using errcode = '23514';
  end if;
  insert into financeiro.ajuste (mes, operacao_id, cr_id, linha, valor, justificativa, pedido_por)
  values (date_trunc('month', p_mes::timestamp)::date, p_operacao_id, p_cr_id, p_linha, round(p_valor, 2), btrim(p_justificativa),
          config.usuario_atual())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.pedir_ajuste(date, uuid, uuid, text, numeric, text, uuid) from public, anon;
comment on function nucleo.pedir_ajuste(date, uuid, uuid, text, numeric, text, uuid) is
  'Pedir ajuste: mês, operação ou CR, linha da cascata, valor com sinal e justificativa (Resultados › criar). Fica pedido até a Diretoria decidir. Chave de envio.';

create function nucleo.decidir_ajuste(p_ajuste_id uuid, p_versao integer, p_decisao text, p_motivo text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: decidir grava o ajuste (sem escrita direta); a função confere por dentro o perfil Diretoria, que quem decide não pediu, a versão e o motivo da recusa, e só muda este ajuste; search_path vazio.
set search_path = ''
as $$
declare
  v financeiro.ajuste;
  v_id uuid;
begin
  select * into v from financeiro.ajuste where id = p_ajuste_id for update;
  if not found or config.usuario_atual() is null or config.perfil_atual() is distinct from 'diretoria' then
    raise exception 'Só a Diretoria decide o ajuste.' using errcode = '42501';
  end if;
  if v.pedido_por = config.usuario_atual() then
    raise exception 'Quem pede o ajuste não decide: outra pessoa da Diretoria decide.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'decidir_ajuste');
  if v_id is not null then
    return v_id;
  end if;
  if p_decisao is null or p_decisao not in ('aprovado', 'recusado') then
    raise exception 'Decida: aprovado ou recusado.' using errcode = '22023';
  end if;
  if v.situacao = p_decisao then
    perform auditoria.concluir_envio(p_chave, v.id);
    return v.id;
  end if;
  if v.situacao <> 'pedido' then
    raise exception 'Este ajuste já foi %.', v.situacao using errcode = '23514';
  end if;
  if p_versao is distinct from v.versao then
    raise exception 'O ajuste mudou desde que você abriu: confira e decida de novo.' using errcode = '40001';
  end if;
  if p_decisao = 'recusado' and nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Recusar o ajuste pede o motivo.' using errcode = '23514';
  end if;
  update financeiro.ajuste
     set situacao = p_decisao, decidido_por = config.usuario_atual(), decidido_em = now(),
         motivo_da_decisao = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = v.id;
  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.decidir_ajuste(uuid, integer, text, text, uuid) from public, anon;
comment on function nucleo.decidir_ajuste(uuid, integer, text, text, uuid) is
  'Aprova ou recusa (com motivo) o ajuste: só a Diretoria, e quem pede não decide. Versão; a mesma decisão de novo não muda nada.';

create function nucleo.ajustes_do_resultado(p_mes date default null, p_situacao text default null, p_pagina integer default 1, p_tam integer default 50)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', p_mes::timestamp)::date;
  v_tam integer := least(greatest(coalesce(p_tam, 50), 1), 200);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_total integer;
  v_resultado jsonb;
begin
  if not config.pode('resultados', 'ver') then
    raise exception 'Você não tem permissão para ver os ajustes.' using errcode = '42501';
  end if;
  if p_situacao is not null and p_situacao not in ('pedido', 'aprovado', 'recusado') then
    raise exception 'Filtre os ajustes por pedido, aprovado ou recusado.' using errcode = '22023';
  end if;
  select count(*) into v_total from financeiro.ajuste a
   where (v_mes is null or a.mes = v_mes) and (p_situacao is null or a.situacao = p_situacao);
  v_pagina := least(v_pagina, greatest(ceil(v_total::numeric / v_tam)::integer, 1));
  with doperiodo as (select * from financeiro.ajuste a where v_mes is null or a.mes = v_mes)
  select jsonb_build_object(
    'mes', v_mes,
    'kpis', jsonb_build_object(
      'pendentes', (select count(*) from doperiodo where situacao = 'pedido'),
      'aprovados_no_mes', (select count(*) from doperiodo where situacao = 'aprovado'),
      'recusados', (select count(*) from doperiodo where situacao = 'recusado'),
      'valor_ajustado', (select coalesce(sum(valor), 0) from doperiodo where situacao = 'aprovado')),
    'contagens', jsonb_build_object(
      'todas', (select count(*) from doperiodo), 'pedido', (select count(*) from doperiodo where situacao = 'pedido'),
      'aprovado', (select count(*) from doperiodo where situacao = 'aprovado'),
      'recusado', (select count(*) from doperiodo where situacao = 'recusado')),
    'por_situacao', coalesce((select jsonb_agg(jsonb_build_object('situacao', x.situacao, 'n', x.n, 'valor', x.valor) order by x.situacao)
                                from (select situacao, count(*) as n, sum(valor) as valor from doperiodo group by situacao) x), '[]'::jsonb),
    'por_operacao', coalesce((select jsonb_agg(jsonb_build_object('operacao', x.nome, 'n', x.n, 'valor', x.valor) order by x.n desc, x.nome)
                                from (select coalesce(o.nome, 'Sem operação') as nome, count(*) as n, sum(d.valor) as valor
                                        from doperiodo d left join nucleo.operacao o on o.id = d.operacao_id group by 1) x), '[]'::jsonb),
    'por_linha', coalesce((select jsonb_agg(jsonb_build_object('linha', x.linha, 'n', x.n, 'valor', x.valor) order by x.linha)
                             from (select linha, count(*) as n, sum(valor) as valor from doperiodo group by linha) x), '[]'::jsonb),
    'linhas', coalesce((select jsonb_agg(x.l order by x.pedido_em desc, x.numero desc) from (
                select a.pedido_em, a.numero, jsonb_build_object(
                         'id', a.id, 'versao', a.versao, 'numero', a.numero, 'mes', a.mes, 'operacao_id', a.operacao_id,
                         'operacao', o.nome, 'cr', c.codigo, 'linha', a.linha, 'valor', a.valor, 'justificativa', a.justificativa,
                         'situacao', a.situacao, 'pedido_por', pp.nome, 'pedido_em', a.pedido_em,
                         'decidido_por', pd.nome, 'decidido_em', a.decidido_em, 'motivo_da_decisao', a.motivo_da_decisao) as l
                  from financeiro.ajuste a
                  left join nucleo.operacao o on o.id = a.operacao_id
                  left join nucleo.cr c on c.id = a.cr_id
                  left join nucleo.pessoa pp on pp.id = a.pedido_por
                  left join nucleo.pessoa pd on pd.id = a.decidido_por
                 where (v_mes is null or a.mes = v_mes) and (p_situacao is null or a.situacao = p_situacao)
                 order by a.pedido_em desc, a.numero desc
                offset (v_pagina - 1) * v_tam limit v_tam) x), '[]'::jsonb),
    'total', v_total, 'pagina', v_pagina, 'paginas', greatest(ceil(v_total::numeric / v_tam)::integer, 1), 'tam', v_tam
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.ajustes_do_resultado(date, text, integer, integer) from public, anon;
comment on function nucleo.ajustes_do_resultado(date, text, integer, integer) is
  'Resultados › Ajustes: pendentes, aprovados e recusados do mês, valor ajustado (aprovados), por situação, operação e linha, e a lista paginada (mais novos primeiro, desempate pelo número). Pela RLS de quem chama.';

-- ---------------------------------------------------------------------------------------------
-- Maturação
-- ---------------------------------------------------------------------------------------------
create function nucleo.maturacao_da_divida(p_pagina integer default 1, p_tam integer default 50)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_inicio date := coalesce((select p.valor::date from config.parametro p where p.chave = 'maturacao_inicio'), '2025-05-01');
  v_fim date := coalesce((select p.valor::date from config.parametro p where p.chave = 'maturacao_fim'), '2026-06-01');
  v_tam integer := least(greatest(coalesce(p_tam, 50), 1), 200);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_resultado jsonb;
begin
  if not config.pode('resultados', 'ver') then
    raise exception 'Você não tem permissão para ver a maturação.' using errcode = '42501';
  end if;
  with t as materialized (
    select d.nufin, d.codcencus, d.dt_competencia, d.valor_liquido, coalesce(d.baixado, false) as baixado, d.dhbaixa
      from staging.despesa d
     where d.dt_competencia >= v_inicio and d.dt_competencia < v_fim
       and d.invalidado_em is null and d.valor_liquido is not null
       and coalesce(d.provisao, '') <> 'PROVISAO'
  ),
  k as (
    select coalesce(sum(valor_liquido), 0) as negociado,
           coalesce(sum(valor_liquido) filter (where baixado), 0) as pago
      from t
  ),
  op as (
    select c.codcencus::text as codcencus, o.nome
      from nucleo.cr c
      left join nucleo.operacao o on o.id = nucleo.operacao_do_cr_em(c.id, now())
     where c.codcencus::text in (select distinct t.codcencus from t)
  ),
  titulo as (
    select t.nufin, min(t.dt_competencia) as negociado_em, max(op.nome) as operacao,
           sum(t.valor_liquido) as valor, coalesce(sum(t.valor_liquido) filter (where not t.baixado), 0) as saldo
      from t left join op on op.codcencus = t.codcencus
     group by t.nufin
  )
  select jsonb_build_object(
    'inicio', v_inicio, 'fim', v_fim,
    'kpis', (select jsonb_build_object('negociado', k.negociado, 'pago', k.pago, 'saldo', k.negociado - k.pago,
                                       'percentual', round(100.0 * k.pago / nullif(k.negociado, 0), 1)) from k),
    'pago_por_mes', coalesce((select jsonb_agg(jsonb_build_object('mes', x.mes, 'valor', x.valor) order by x.mes)
                                from (select date_trunc('month', t.dhbaixa at time zone 'America/Sao_Paulo')::date as mes, sum(t.valor_liquido) as valor
                                        from t where t.baixado and t.dhbaixa is not null group by 1) x), '[]'::jsonb),
    'saldo_por_operacao', coalesce((select jsonb_agg(jsonb_build_object('operacao', x.operacao, 'saldo', x.saldo) order by x.saldo desc, x.operacao)
                                      from (select coalesce(ti.operacao, 'Sem operação') as operacao, sum(ti.saldo) as saldo
                                              from titulo ti group by 1 having sum(ti.saldo) <> 0) x), '[]'::jsonb),
    'titulos_com_saldo', (select count(*) from titulo where saldo <> 0),
    'linhas', coalesce((select jsonb_agg(jsonb_build_object('titulo', x.nufin, 'operacao', x.operacao, 'negociado_em', x.negociado_em,
                                                            'valor', x.valor, 'saldo', x.saldo) order by x.saldo desc, x.nufin)
                          from (select * from titulo where saldo <> 0 order by saldo desc, nufin
                                offset (v_pagina - 1) * v_tam limit v_tam) x), '[]'::jsonb),
    'pagina', v_pagina, 'tam', v_tam
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.maturacao_da_divida(integer, integer) from public, anon;
comment on function nucleo.maturacao_da_divida(integer, integer) is
  'Resultados › Maturação: negociado, pago, saldo e quitado dos títulos de despesa do período (parâmetros maturacao_inicio e maturacao_fim; base dt_competencia, provisório até a ponte trazer DTNEG e a renegociação), pago por mês, saldo por operação e os títulos com saldo, paginados. Pela RLS de quem chama.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.ultimo_mes_que_pode_fechar()', 'Fechar o mês: o último mês que pode fechar pelo calendário (o assistente mostra).'),
  ('nucleo.fechar_mes(date,uuid)', 'Fechar o mês: só a Diretoria, conferência por dentro, chave de envio.'),
  ('nucleo.reabrir_mes(date,text,uuid)', 'Reabrir o mês: só a Diretoria, com motivo, conferência por dentro.'),
  ('nucleo.fechamentos_do_resultado()', 'Resultados › Fechamentos, pela RLS de quem chama.'),
  ('nucleo.pedir_ajuste(date,uuid,uuid,text,numeric,text,uuid)', 'Pedir ajuste: Resultados › criar, conferência por dentro e chave de envio.'),
  ('nucleo.decidir_ajuste(uuid,integer,text,text,uuid)', 'Decidir ajuste: só a Diretoria, quem pede não decide, versão.'),
  ('nucleo.ajustes_do_resultado(date,text,integer,integer)', 'Resultados › Ajustes, pela RLS de quem chama.'),
  ('nucleo.maturacao_da_divida(integer,integer)', 'Resultados › Maturação, pela RLS de quem chama.');
grant execute on function nucleo.ultimo_mes_que_pode_fechar() to authenticated;
grant execute on function nucleo.fechar_mes(date, uuid) to authenticated;
grant execute on function nucleo.reabrir_mes(date, text, uuid) to authenticated;
grant execute on function nucleo.fechamentos_do_resultado() to authenticated;
grant execute on function nucleo.pedir_ajuste(date, uuid, uuid, text, numeric, text, uuid) to authenticated;
grant execute on function nucleo.decidir_ajuste(uuid, integer, text, text, uuid) to authenticated;
grant execute on function nucleo.ajustes_do_resultado(date, text, integer, integer) to authenticated;
grant execute on function nucleo.maturacao_da_divida(integer, integer) to authenticated;
