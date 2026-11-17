-- Conciliar o mês (decisão de Alexandre, 17/11/2026; pgTAP 125).
-- Wizard em dois passos:
--  (1) Justificar em lote as diferenças sem justificativa do acionista no mês (tudo ou nada), pela mesma
--      conferência da justificativa unitária (nucleo.justificar_diferenca).
--  (2) Só com zero pendências, marcar o mês do acionista (o agrupador do Sankhya) como conferido: o mês
--      trava. Depois de travado, nenhuma justificativa nova entra; a correção é só por ajuste de período
--      anterior, registrado (Resultados › Ajustes, financeiro.ajuste). Não há reabrir.
-- O fato importado do Sankhya continua intocado: a conferência só registra quem conferiu e quando.

create table parceiros.conferencia_do_mes (
  id uuid primary key default gen_random_uuid(),
  agrupador_id uuid not null references nucleo.cr (id),
  mes date not null check (mes = date_trunc('month', mes)::date),
  linhas integer not null check (linhas >= 0),
  conferida_por uuid,
  conferida_em timestamptz not null default now(),
  versao integer not null default 1,
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text
);
comment on table parceiros.conferencia_do_mes is
  'O mês do acionista (agrupador) conferido na Conciliação: só com zero diferenças sem justificativa. Trava o mês: justificativa nova é recusada e a correção vira ajuste de período anterior. Só a função grava.';
create unique index conferencia_do_mes_uma_por_agrupador_e_mes_idx on parceiros.conferencia_do_mes (agrupador_id, mes)
  where excluido_em is null;
create index conferencia_do_mes_agrupador_id_idx on parceiros.conferencia_do_mes (agrupador_id);
create index conferencia_do_mes_nao_excluida_idx on parceiros.conferencia_do_mes (mes) where excluido_em is null;
alter table parceiros.conferencia_do_mes enable row level security;
create trigger t30_versao before update on parceiros.conferencia_do_mes
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on parceiros.conferencia_do_mes
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on parceiros.conferencia_do_mes
  for each row execute function auditoria.registrar_mudanca('id');

-- Leitura: Parceiros › ver ou Resultados › ver (como a justificativa). Sem escrita direta.
create policy conferencia_do_mes_ler on parceiros.conferencia_do_mes for select to authenticated
  using ((select config.pode('parceiros', 'ver')) or (select config.pode('resultados', 'ver')));
grant select on parceiros.conferencia_do_mes to authenticated;

-- ---------------------------------------------------------------------------------------------
-- O mês travado? (uma definição só, usada pela justificativa e pela conferência)
-- ---------------------------------------------------------------------------------------------
create function nucleo.mes_do_acionista_conferido(p_agrupador uuid, p_mes date)
returns boolean
language sql
stable
security definer -- justificativa: a justificativa (security definer) precisa saber da trava mesmo para quem não lê a tabela; devolve só verdadeiro ou falso; search_path vazio.
set search_path = ''
as $$
  select exists (
    select 1 from parceiros.conferencia_do_mes c
     where c.agrupador_id = p_agrupador and c.mes = date_trunc('month', p_mes)::date and c.excluido_em is null);
$$;
revoke all on function nucleo.mes_do_acionista_conferido(uuid, date) from public, anon;
comment on function nucleo.mes_do_acionista_conferido(uuid, date) is
  'Verdadeiro quando o mês do acionista já foi conferido na Conciliação (o mês está travado).';

-- ---------------------------------------------------------------------------------------------
-- Justificar diferença: igual à de 20261111500000, mais a trava do mês conferido.
-- ---------------------------------------------------------------------------------------------
create or replace function nucleo.justificar_diferenca(p_cr_id uuid, p_mes date, p_motivo text, p_chave uuid default null)
returns jsonb
language plpgsql
security definer -- justificativa: a justificativa não tem escrita direta para authenticated; a função confere Parceiros › criar, a situação da linha e a trava do mês; search_path vazio.
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', p_mes)::date;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_situacao text;
  v_agrupador uuid;
  v_id uuid;
begin
  if not config.pode('parceiros', 'criar') then
    raise exception 'Você não tem permissão para justificar a conciliação. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  if length(v_motivo) < 10 or length(v_motivo) > 500 then
    raise exception 'Explique o motivo da diferença (de 10 a 500 caracteres).' using errcode = '23514';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'justificar_diferenca');
  if v_id is not null then
    return jsonb_build_object('justificativa_id', v_id);
  end if;
  select c.situacao, c.agrupador_id into v_situacao, v_agrupador
    from nucleo.conciliacao_por_cr(v_mes) c where c.cr_id = p_cr_id;
  if v_agrupador is not null and nucleo.mes_do_acionista_conferido(v_agrupador, v_mes) then
    raise exception 'O mês deste acionista já foi conferido e está travado: corrija por um ajuste de período anterior em Resultados › Ajustes.'
      using errcode = '55000';
  end if;
  if v_situacao is null or v_situacao = 'confere' then
    raise exception 'Esta linha não tem diferença no mês: não há o que justificar.' using errcode = '23514';
  end if;
  if exists (select 1 from parceiros.justificativa_da_conciliacao j
              where j.cr_id = p_cr_id and j.mes = v_mes and j.excluido_em is null) then
    raise exception 'Esta diferença já foi justificada neste mês.' using errcode = '23505';
  end if;
  insert into parceiros.justificativa_da_conciliacao (cr_id, mes, situacao_justificada, motivo, criada_por)
  values (p_cr_id, v_mes, v_situacao, v_motivo, auth.uid())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return jsonb_build_object('justificativa_id', v_id, 'situacao_justificada', v_situacao);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Passo 1: justificar em lote (tudo ou nada; devolve "gravadas de total" e as recusadas com o motivo)
-- ---------------------------------------------------------------------------------------------
create function nucleo.justificar_diferencas_em_lote(p_mes date, p_itens jsonb, p_chave uuid default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_cr uuid;
  v_recusadas jsonb := '[]'::jsonb;
  v_gravadas integer := 0;
  v_total integer := case when jsonb_typeof(p_itens) = 'array' then jsonb_array_length(p_itens) else 0 end;
  v_lote uuid;
begin
  if v_total = 0 then
    raise exception 'Escolha ao menos uma diferença para justificar.' using errcode = '22023';
  end if;
  v_lote := auditoria.reservar_envio(p_chave, 'justificar_diferencas_em_lote');
  if v_lote is not null then
    return jsonb_build_object('lote_id', v_lote, 'total', v_total, 'gravadas', null, 'recusadas', '[]'::jsonb, 'repetido', true);
  end if;
  v_lote := gen_random_uuid();

  begin
    for v_item in select * from jsonb_array_elements(p_itens) loop
      v_cr := nullif(v_item->>'cr_id', '')::uuid;
      begin
        perform nucleo.justificar_diferenca(v_cr, p_mes, v_item->>'motivo', null);
        v_gravadas := v_gravadas + 1;
      exception when others then
        v_recusadas := v_recusadas || jsonb_build_object('cr_id', v_cr, 'motivo', sqlerrm, 'codigo', sqlstate);
      end;
    end loop;
    if jsonb_array_length(v_recusadas) > 0 then
      raise exception 'lote recusado' using errcode = 'P0002';
    end if;
  exception when sqlstate 'P0002' then
    v_gravadas := 0;
  end;

  if v_gravadas > 0 then
    perform auditoria.concluir_envio(p_chave, v_lote);
  end if;
  return jsonb_build_object('lote_id', v_lote, 'total', v_total, 'gravadas', v_gravadas, 'recusadas', v_recusadas, 'repetido', false);
end;
$$;
revoke all on function nucleo.justificar_diferencas_em_lote(date, jsonb, uuid) from public, anon;
comment on function nucleo.justificar_diferencas_em_lote(date, jsonb, uuid) is
  'Conciliar o mês, passo 1: justifica várias diferenças do mês ([{cr_id, motivo}]), tudo ou nada; cada uma passa por nucleo.justificar_diferenca (permissão, situação e trava do mês). Chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Passo 2: marcar o mês do acionista como conferido (só com zero pendências); trava o mês
-- ---------------------------------------------------------------------------------------------
create function nucleo.conferir_mes_do_acionista(p_agrupador uuid, p_mes date, p_chave uuid default null)
returns jsonb
language plpgsql
security definer -- justificativa: a conferência não tem escrita direta para authenticated; a função confere Parceiros › editar e as pendências do mês pela mesma conciliação da tela; search_path vazio.
set search_path = ''
as $$
declare
  v_mes date := date_trunc('month', p_mes)::date;
  v_linhas integer;
  v_pendentes integer;
  v_id uuid;
begin
  if not config.pode('parceiros', 'editar') then
    raise exception 'Você não tem permissão para conferir o mês da conciliação. Peça a quem administra o acesso.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'conferir_mes_do_acionista');
  if v_id is not null then
    return jsonb_build_object('conferencia_id', v_id, 'repetido', true);
  end if;
  if nucleo.mes_do_acionista_conferido(p_agrupador, v_mes) then
    raise exception 'O mês deste acionista já foi conferido.' using errcode = '23505';
  end if;
  select count(*)::integer,
         count(*) filter (where c.situacao <> 'confere' and not exists (
           select 1 from parceiros.justificativa_da_conciliacao j
            where j.cr_id = c.cr_id and j.mes = v_mes and j.excluido_em is null))::integer
    into v_linhas, v_pendentes
    from nucleo.conciliacao_por_cr(v_mes, p_agrupador) c;
  if v_linhas = 0 then
    raise exception 'Este acionista não tem linhas na conciliação do mês: não há o que conferir.' using errcode = '23514';
  end if;
  if v_pendentes > 0 then
    raise exception 'Ainda há % diferença(s) sem justificativa neste mês: justifique todas antes de conferir.', v_pendentes
      using errcode = '23514';
  end if;
  insert into parceiros.conferencia_do_mes (agrupador_id, mes, linhas, conferida_por)
  values (p_agrupador, v_mes, v_linhas, auth.uid())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return jsonb_build_object('conferencia_id', v_id, 'mes', v_mes, 'agrupador_id', p_agrupador, 'linhas', v_linhas, 'repetido', false);
end;
$$;
revoke all on function nucleo.conferir_mes_do_acionista(uuid, date, uuid) from public, anon;
comment on function nucleo.conferir_mes_do_acionista(uuid, date, uuid) is
  'Conciliar o mês, passo 2: com zero diferenças sem justificativa, marca o mês do acionista como conferido e trava. Parceiros › editar. Chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Leitura: os acionistas com o mês conferido (a tela mostra o selo e esconde as ações)
-- ---------------------------------------------------------------------------------------------
create function nucleo.conferencias_da_conciliacao(p_mes date)
returns table (agrupador_id uuid, conferida_em timestamptz, linhas integer)
language sql
stable
set search_path = ''
as $$
  select c.agrupador_id, c.conferida_em, c.linhas
    from parceiros.conferencia_do_mes c
   where c.mes = date_trunc('month', p_mes)::date and c.excluido_em is null
   order by c.agrupador_id;
$$;
revoke all on function nucleo.conferencias_da_conciliacao(date) from public, anon;
comment on function nucleo.conferencias_da_conciliacao(date) is
  'Os meses de acionista conferidos na Conciliação (pela RLS de quem consulta: Parceiros ou Resultados).';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.mes_do_acionista_conferido(uuid,date)', 'A trava do mês conferido da Conciliação (só verdadeiro ou falso).'),
  ('nucleo.justificar_diferencas_em_lote(date,jsonb,uuid)', 'Conciliar o mês, passo 1: justificar em lote (tudo ou nada), pela justificativa unitária.'),
  ('nucleo.conferir_mes_do_acionista(uuid,date,uuid)', 'Conciliar o mês, passo 2: conferir e travar o mês do acionista, só com zero pendências.'),
  ('nucleo.conferencias_da_conciliacao(date)', 'Os meses de acionista conferidos, pela RLS de quem consulta.');
grant execute on function nucleo.mes_do_acionista_conferido(uuid, date) to authenticated;
grant execute on function nucleo.justificar_diferencas_em_lote(date, jsonb, uuid) to authenticated;
grant execute on function nucleo.conferir_mes_do_acionista(uuid, date, uuid) to authenticated;
grant execute on function nucleo.conferencias_da_conciliacao(date) to authenticated;
