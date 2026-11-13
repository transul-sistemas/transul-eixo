-- S4, Baixa de placa com quatro olhos (inventário 10; plano S4). Decisão de Alexandre: baixa por motivo, SEM
-- sigla nova. Hipótese (docs/decisoes.md): venda e devolução gravam VND; sucata e sinistro gravam SUC.
--
--  * nucleo.pedido_de_baixa: o pedido (ativo, motivo, data, justificativa, documento no Storage), com a
--    situação pedida, aprovada, recusada ou cancelada; um aberto por placa. Comprador e valor NÃO entram (ficam
--    no documento). Só leitura pelo app (pedido_de_baixa_ler).
--  * Até a aprovação a placa continua ativa ("baixa pedida"). Ao aprovar: nucleo.registrar_baixa (posse,
--    gestor, baixa e evento) e, na mesma data, o vínculo com o CR e a montagem na operação se encerram.
--
-- Funções (assinaturas que a tela usa):
--  * nucleo.sigla_da_baixa(p_motivo) -> text
--  * nucleo.pedir_baixa(p_ativo_id, p_motivo, p_em, p_justificativa, p_documento, p_chave) -> uuid (o pedido)
--  * nucleo.aprovar_baixa(p_pedido_id, p_versao, p_chave) -> uuid
--  * nucleo.recusar_baixa(p_pedido_id, p_motivo, p_versao, p_chave) -> uuid
--  * nucleo.cancelar_pedido_de_baixa(p_pedido_id, p_chave) -> uuid
--  * nucleo.impacto_da_baixa(p_ativo_id, p_em) -> jsonb (passo Conferir)
--  * nucleo.pedidos_de_baixa(p_situacao) -> setof (a caixa da Diretoria e a ficha da placa), com o prazo

insert into config.parametro (chave, valor, descricao) values
  ('prazo_da_baixa_dias', '5', 'Baixa de placa: dias que a Diretoria tem para decidir o pedido (prazo vencido sinaliza e nunca cancela).')
on conflict (chave) do nothing;

create function nucleo.sigla_da_baixa(p_motivo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_motivo when 'venda' then 'VND' when 'devolucao' then 'VND'
                       when 'sucata' then 'SUC' when 'sinistro' then 'SUC' end
$$;
revoke all on function nucleo.sigla_da_baixa(text) from public;
comment on function nucleo.sigla_da_baixa(text) is
  'A sigla da régua que o motivo da baixa grava, sem sigla nova: venda e devolução, VND; sucata e sinistro, SUC.';

create table nucleo.pedido_de_baixa (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  motivo text not null check (motivo in ('venda', 'sinistro', 'sucata', 'devolucao')),
  sigla text not null check (sigla in ('VND', 'SUC')),
  em timestamptz not null,
  justificativa text not null check (length(btrim(justificativa)) > 0),
  documento text,
  situacao text not null default 'pedida' check (situacao in ('pedida', 'aprovada', 'recusada', 'cancelada')),
  pedido_por uuid not null references nucleo.pessoa (id),
  pedido_em timestamptz not null default now(),
  decidido_por uuid references nucleo.pessoa (id),
  decidido_em timestamptz,
  motivo_da_decisao text,
  versao integer not null default 1,
  constraint pedido_de_baixa_decisao check ((situacao = 'pedida') = (decidido_em is null)),
  constraint pedido_de_baixa_quatro_olhos check (decidido_por is null or situacao = 'cancelada' or decidido_por <> pedido_por)
);
comment on table nucleo.pedido_de_baixa is
  'O pedido de baixa de placa (venda, sinistro, sucata, devolução), com quatro olhos: o gestor pede, a Diretoria aprova ou recusa, e quem pede não aprova. Comprador e valor ficam no documento, nunca aqui.';
create unique index pedido_de_baixa_um_aberto_por_placa on nucleo.pedido_de_baixa (ativo_id) where situacao = 'pedida';
create index pedido_de_baixa_ativo_id_idx on nucleo.pedido_de_baixa (ativo_id);
create index pedido_de_baixa_pedido_por_idx on nucleo.pedido_de_baixa (pedido_por);
create index pedido_de_baixa_decidido_por_idx on nucleo.pedido_de_baixa (decidido_por);
create index pedido_de_baixa_situacao_idx on nucleo.pedido_de_baixa (situacao, pedido_em);
alter table nucleo.pedido_de_baixa enable row level security;
create trigger t30_versao before update on nucleo.pedido_de_baixa
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.pedido_de_baixa
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.pedido_de_baixa
  for each row execute function auditoria.registrar_mudanca('id');
grant select on nucleo.pedido_de_baixa to authenticated;
create policy pedido_de_baixa_ler on nucleo.pedido_de_baixa for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota'], 'ver') or pedido_por = config.usuario_atual());

-- ---------------------------------------------------------------------------------------------
-- Pedir
-- ---------------------------------------------------------------------------------------------
create function nucleo.pedir_baixa(
  p_ativo_id uuid, p_motivo text, p_em timestamptz, p_justificativa text, p_documento text, p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: o gestor não tem grant de escrita no pedido; a função confere por dentro que quem chama é o gestor vigente da carteira (Frota › criar na carteira), confere transferência e pedido abertos (que ele não enxerga por inteiro) e só grava o pedido desta placa; search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.usuario_atual();
  v_id uuid;
begin
  if v_eu is null
     or not config.ve_ativo(p_ativo_id, array['frota'], 'criar')
     or not exists (select 1 from nucleo.gestor_da_carteira g
                     where g.ativo_id = p_ativo_id and g.gestor_id = v_eu and g.excluido_em is null and g.periodo @> now()) then
    raise exception 'Só o gestor da carteira pede a baixa desta placa.' using errcode = '42501';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'pedir_baixa');
  if v_id is not null then
    return v_id;
  end if;

  if nucleo.sigla_da_baixa(p_motivo) is null then
    raise exception 'Escolha o motivo da baixa: venda, sinistro, sucata ou devolução.' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_justificativa, '')), '') is null then
    raise exception 'A baixa pede a justificativa.' using errcode = '23514';
  end if;
  if p_em is null then
    raise exception 'Informe a data da baixa.' using errcode = '23514';
  end if;
  if exists (select 1 from nucleo.baixa_do_ativo where ativo_id = p_ativo_id and excluido_em is null) then
    raise exception 'Esta placa já foi baixada.' using errcode = '23514';
  end if;
  if exists (select 1 from nucleo.pedido_de_baixa where ativo_id = p_ativo_id and situacao = 'pedida') then
    raise exception 'Já existe um pedido de baixa aberto para esta placa.' using errcode = '23514';
  end if;
  if exists (select 1 from nucleo.transferencia where ativo_id = p_ativo_id and excluido_em is null
              and situacao in ('pendente', 'em_conferencia')) then
    raise exception 'A placa está sendo enviada a outro gestor: resolva a transferência antes de pedir a baixa.' using errcode = '23514';
  end if;
  if nucleo.em_conjunto(p_ativo_id, least(p_em, now())) then
    raise exception 'Desatrele a placa antes de pedir a baixa.' using errcode = '23514';
  end if;

  insert into nucleo.pedido_de_baixa (ativo_id, motivo, sigla, em, justificativa, documento, pedido_por)
  values (p_ativo_id, p_motivo, nucleo.sigla_da_baixa(p_motivo), p_em, btrim(p_justificativa),
          nullif(btrim(coalesce(p_documento, '')), ''), v_eu)
  returning id into v_id;

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.pedir_baixa(uuid, text, timestamptz, text, text, uuid) from public;

-- A decisão (aprovar e recusar): só a Diretoria, e nunca quem pediu.
create function nucleo.conferir_decisao_da_baixa(p_pedido_id uuid, p_versao integer)
returns nucleo.pedido_de_baixa
language plpgsql
security definer -- justificativa: confere a decisão do pedido de baixa (perfil Diretoria, quem pede não decide, situação e versão) lendo o pedido sem a RLS; não grava nada, com search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.usuario_atual();
  v nucleo.pedido_de_baixa;
begin
  select * into v from nucleo.pedido_de_baixa where id = p_pedido_id for update;
  if not found or v_eu is null or config.perfil_atual() is distinct from 'diretoria' then
    raise exception 'Só a Diretoria decide o pedido de baixa.' using errcode = '42501';
  end if;
  if v.pedido_por = v_eu then
    raise exception 'Quem pede a baixa não a decide: outra pessoa da Diretoria aprova.' using errcode = '42501';
  end if;
  if v.situacao <> 'pedida' then
    raise exception 'Este pedido já está %.', v.situacao using errcode = '23514';
  end if;
  if p_versao is distinct from v.versao then
    raise exception 'O pedido mudou desde que você abriu: confira e decida de novo.' using errcode = '40001';
  end if;
  return v;
end;
$$;
revoke all on function nucleo.conferir_decisao_da_baixa(uuid, integer) from public;

create function nucleo.aprovar_baixa(p_pedido_id uuid, p_versao integer, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: a aprovação encerra posse, gestor, CR e montagem da placa, que a Diretoria grava só por esta tarefa (H6); a função confere por dentro (nucleo.conferir_decisao_da_baixa) o perfil Diretoria e que quem aprova não pediu, e só mexe na placa do pedido; search_path vazio.
set search_path = ''
as $$
declare
  v nucleo.pedido_de_baixa;
  v_id uuid;
begin
  v_id := auditoria.reservar_envio(p_chave, 'aprovar_baixa');
  if v_id is not null then
    return v_id;
  end if;
  v := nucleo.conferir_decisao_da_baixa(p_pedido_id, p_versao);
  if nucleo.em_conjunto(v.ativo_id, v.em) then
    raise exception 'A placa está engatada na data da baixa: desatrele antes de aprovar.' using errcode = '23514';
  end if;

  perform nucleo.registrar_baixa(v.ativo_id, v.sigla, v.em, 'Baixa aprovada (' || v.motivo || '): ' || v.justificativa);

  perform set_config('eixo.motivo', 'Baixa aprovada (' || v.motivo || ')', true);
  update nucleo.cr_do_ativo set fim = v.em, fim_origem = 'informada'
   where ativo_id = v.ativo_id and excluido_em is null and inicio < v.em and (fim is null or fim > v.em);
  update nucleo.placa_na_operacao set fim = v.em, fim_origem = 'informada'
   where ativo_id = v.ativo_id and excluido_em is null and inicio < v.em and (fim is null or fim > v.em);
  perform set_config('eixo.motivo', '', true);

  update nucleo.pedido_de_baixa
     set situacao = 'aprovada', decidido_por = config.usuario_atual(), decidido_em = now()
   where id = v.id;

  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.aprovar_baixa(uuid, integer, uuid) from public;

create function nucleo.recusar_baixa(p_pedido_id uuid, p_motivo text, p_versao integer, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: a Diretoria não grava o pedido direto (H6); a função confere por dentro (nucleo.conferir_decisao_da_baixa) o perfil e os quatro olhos, e só muda a situação do pedido, com o motivo; search_path vazio.
set search_path = ''
as $$
declare
  v nucleo.pedido_de_baixa;
  v_id uuid;
begin
  v_id := auditoria.reservar_envio(p_chave, 'recusar_baixa');
  if v_id is not null then
    return v_id;
  end if;
  v := nucleo.conferir_decisao_da_baixa(p_pedido_id, p_versao);
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Recusar a baixa pede o motivo.' using errcode = '23514';
  end if;
  update nucleo.pedido_de_baixa
     set situacao = 'recusada', decidido_por = config.usuario_atual(), decidido_em = now(), motivo_da_decisao = btrim(p_motivo)
   where id = v.id;
  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.recusar_baixa(uuid, text, integer, uuid) from public;

create function nucleo.cancelar_pedido_de_baixa(p_pedido_id uuid, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: quem pediu não tem grant de escrita no pedido; a função confere por dentro que quem chama é quem pediu e que o pedido segue aberto, e só muda a situação dele; search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.usuario_atual();
  v nucleo.pedido_de_baixa;
  v_id uuid;
begin
  select * into v from nucleo.pedido_de_baixa where id = p_pedido_id for update;
  if not found or v_eu is null or v.pedido_por <> v_eu then
    raise exception 'Só quem pediu cancela o pedido de baixa.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'cancelar_pedido_de_baixa');
  if v_id is not null then
    return v_id;
  end if;
  if v.situacao <> 'pedida' then
    raise exception 'Este pedido já está %.', v.situacao using errcode = '23514';
  end if;
  update nucleo.pedido_de_baixa
     set situacao = 'cancelada', decidido_por = v_eu, decidido_em = now(), motivo_da_decisao = 'Cancelado por quem pediu'
   where id = v.id;
  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.cancelar_pedido_de_baixa(uuid, uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- Leituras (security invoker)
-- ---------------------------------------------------------------------------------------------
create function nucleo.impacto_da_baixa(p_ativo_id uuid, p_em timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'ja_baixada', exists (select 1 from nucleo.baixa_do_ativo b where b.ativo_id = p_ativo_id and b.excluido_em is null),
    'pedido_aberto', exists (select 1 from nucleo.pedido_de_baixa p where p.ativo_id = p_ativo_id and p.situacao = 'pedida'),
    'transferencia_aberta', exists (select 1 from nucleo.transferencia t where t.ativo_id = p_ativo_id and t.excluido_em is null
                                      and t.situacao in ('pendente', 'em_conferencia')),
    'em_conjunto', nucleo.em_conjunto(p_ativo_id, least(p_em, now())),
    'operacao', (select o.nome from nucleo.operacao o where o.id = nucleo.operacao_em(p_ativo_id, p_em)),
    'crs_que_encerram', coalesce((
      select jsonb_agg(jsonb_build_object('cr_id', c.id, 'codigo', c.codigo, 'tipo', c.tipo) order by c.codigo)
        from nucleo.cr_do_ativo v join nucleo.cr c on c.id = v.cr_id
       where v.ativo_id = p_ativo_id and v.excluido_em is null and v.periodo @> p_em), '[]'::jsonb)
  )
$$;
revoke all on function nucleo.impacto_da_baixa(uuid, timestamptz) from public;
comment on function nucleo.impacto_da_baixa(uuid, timestamptz) is
  'O passo Conferir da baixa: o que impede (já baixada, pedido aberto, transferência, engatada) e o que se encerra na data (CRs e a operação).';

create function nucleo.pedidos_de_baixa(p_situacao text default null)
returns table (
  id uuid, versao integer, ativo_id uuid, placa text, motivo text, sigla text, em timestamptz, justificativa text,
  documento text, situacao text, pedido_por uuid, pedido_por_nome text, pedido_em timestamptz,
  decidido_por_nome text, decidido_em timestamptz, motivo_da_decisao text, prazo_ate timestamptz, atrasado boolean
)
language sql
stable
set search_path = ''
as $$
  select p.id, p.versao, p.ativo_id, l.placa, p.motivo, p.sigla, p.em, p.justificativa, p.documento, p.situacao,
         p.pedido_por, pp.nome, p.pedido_em, pd.nome, p.decidido_em, p.motivo_da_decisao,
         p.pedido_em + make_interval(days => coalesce((select valor::int from config.parametro where chave = 'prazo_da_baixa_dias'), 5)),
         p.situacao = 'pedida' and now() > p.pedido_em
           + make_interval(days => coalesce((select valor::int from config.parametro where chave = 'prazo_da_baixa_dias'), 5))
    from nucleo.pedido_de_baixa p
    left join nucleo.leitura_da_placa l on l.ativo_id = p.ativo_id
    left join nucleo.pessoa pp on pp.id = p.pedido_por
    left join nucleo.pessoa pd on pd.id = p.decidido_por
   where p_situacao is null or p.situacao = p_situacao
   order by p.pedido_em, p.id
$$;
revoke all on function nucleo.pedidos_de_baixa(text) from public;
comment on function nucleo.pedidos_de_baixa(text) is
  'Os pedidos de baixa (todos ou de uma situação), com a placa, quem pediu e decidiu, o prazo (parâmetro) e se está atrasado; com a RLS de quem consulta.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.sigla_da_baixa(text)', 'Baixa: a sigla que o motivo grava (pura).'),
  ('nucleo.pedir_baixa(uuid,text,timestamp with time zone,text,text,uuid)', 'Baixa com quatro olhos: o gestor pede. Roda com os direitos do dono; confere por dentro o gestor vigente da carteira, com chave de envio.'),
  ('nucleo.aprovar_baixa(uuid,integer,uuid)', 'Baixa com quatro olhos: a Diretoria aprova (quem pede não aprova); encerra posse, gestor, CR e montagem na data. Roda com os direitos do dono, com a conferência por dentro, versão e chave de envio.'),
  ('nucleo.recusar_baixa(uuid,text,integer,uuid)', 'Baixa com quatro olhos: a Diretoria recusa, com motivo. Conferência por dentro, versão e chave de envio.'),
  ('nucleo.cancelar_pedido_de_baixa(uuid,uuid)', 'Baixa: quem pediu cancela enquanto o pedido está aberto. Conferência por dentro e chave de envio.'),
  ('nucleo.impacto_da_baixa(uuid,timestamp with time zone)', 'Baixa: o passo Conferir (somente leitura), com a RLS de quem consulta.'),
  ('nucleo.pedidos_de_baixa(text)', 'Baixa: os pedidos com prazo, com a RLS de quem consulta.');
grant execute on function nucleo.sigla_da_baixa(text) to authenticated;
grant execute on function nucleo.pedir_baixa(uuid, text, timestamptz, text, text, uuid) to authenticated;
grant execute on function nucleo.aprovar_baixa(uuid, integer, uuid) to authenticated;
grant execute on function nucleo.recusar_baixa(uuid, text, integer, uuid) to authenticated;
grant execute on function nucleo.cancelar_pedido_de_baixa(uuid, uuid) to authenticated;
grant execute on function nucleo.impacto_da_baixa(uuid, timestamptz) to authenticated;
grant execute on function nucleo.pedidos_de_baixa(text) to authenticated;
