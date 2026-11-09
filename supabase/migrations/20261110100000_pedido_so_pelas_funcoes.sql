-- S2 (auditoria de 09/11/2026): o pedido de transferência e a carteira só mudam pelas funções.
-- authenticated tinha INSERT e UPDATE em nucleo.transferencia e nucleo.transferencia_pendencia, e as
-- políticas conferiam quem age, não o que muda: origem e destino trocavam a situação direto, reescreviam
-- motivo e datas, inseriam pedido com situação qualquer e respondiam pendência em nome de outro; quem
-- via o pedido (até o Operacional com a custódia) respondia pendência, e 'contestada' devolvia o pedido.
-- Na carteira, quem editava a placa trocava o gestor_id (doava a placa), mudava o início e inseria
-- vigência de outro gestor depois de fechar a sua.
--
--  * Saem os grants de INSERT e UPDATE diretos no pedido e nas pendências, e as políticas de criar e
--    alterar delas (sem grant, nada as usaria). A exclusão lógica do pedido deixa de existir pela API.
--  * As funções do pedido (disponibilizar, pedido_para_agir, receber, concluir) rodam como dono, com a
--    conferência que já tinham (ve_ativo na origem; o destino em pedido_para_agir). A resposta da
--    pendência grava respondida_por = config.usuario_atual().
--  * Novas: cancelar_pedido (a origem, enquanto pendente) e devolver_placa (o destino, em conferência,
--    com motivo; a placa fica com a origem).
--  * Carteira (D1: nem o Administrador mexe por fora do fluxo): sai o INSERT direto (o cadastro e a
--    conclusão da transferência inserem como dono); gestor_id, inicio e ativo_id da vigência não mudam.
--    O UPDATE de fim continua (registrar_baixa roda com o usuário); a cobertura (t95) segue valendo.
-- Teste: supabase/tests/84.

-- ---------------------------------------------------------------------------------------------
-- Colunas do cancelamento e da devolução
-- ---------------------------------------------------------------------------------------------
alter table nucleo.transferencia
  add column cancelada_em timestamptz,
  add column motivo_da_devolucao text;
comment on column nucleo.transferencia.cancelada_em is 'Quando a origem cancelou o pedido (só pendente).';
comment on column nucleo.transferencia.motivo_da_devolucao is
  'Por que o destino devolveu o pedido (devolver_placa), ou a nota da pendência contestada.';

-- Pedido cancelado antes desta migração (só por escrita direta): a data fica a da criação.
update nucleo.transferencia set cancelada_em = criado_em where situacao = 'cancelada' and cancelada_em is null;
alter table nucleo.transferencia
  add constraint transferencia_cancelada_com_data check ((situacao = 'cancelada') = (cancelada_em is not null));

-- ---------------------------------------------------------------------------------------------
-- Sem escrita direta no pedido nem nas pendências
-- ---------------------------------------------------------------------------------------------
revoke insert, update on nucleo.transferencia, nucleo.transferencia_pendencia from authenticated;
drop policy transferencia_criar on nucleo.transferencia;
drop policy transferencia_alterar on nucleo.transferencia;
drop policy transferencia_pendencia_criar on nucleo.transferencia_pendencia;
drop policy transferencia_pendencia_alterar on nucleo.transferencia_pendencia;

-- ---------------------------------------------------------------------------------------------
-- Carteira: só as funções inserem; a vigência não troca de gestor, de início nem de placa
-- ---------------------------------------------------------------------------------------------
revoke insert on nucleo.gestor_da_carteira from authenticated;
drop policy gestor_da_carteira_criar on nucleo.gestor_da_carteira;
create trigger t20_chave_imutavel before update on nucleo.gestor_da_carteira
  for each row execute function nucleo.proibir_mudanca_de_chave('ativo_id', 'gestor_id', 'inicio');

-- ---------------------------------------------------------------------------------------------
-- As funções do pedido rodam como dono
-- ---------------------------------------------------------------------------------------------
-- justificativa: sem INSERT direto no pedido; a função confere config.ve_ativo(frota, editar) para o auth.uid() antes de tudo, abre o pedido do gestor vigente, com search_path vazio.
alter function nucleo.disponibilizar_placa(uuid, uuid, text, text[], integer, timestamptz, uuid) security definer;
-- justificativa: trava o pedido e confere que quem chama é o gestor de destino (config.usuario_atual()), sem depender da RLS de quem chama; search_path vazio.
alter function nucleo.pedido_para_agir(uuid, text) security definer;
-- justificativa: sem UPDATE direto no pedido; a função confere em pedido_para_agir que quem chama é o destino, e a versão; search_path vazio.
alter function nucleo.receber_placa(uuid, integer, timestamptz, uuid) security definer;
-- justificativa: sem UPDATE direto nas pendências; a função confere em pedido_para_agir que quem chama é o destino e grava respondida_por = config.usuario_atual(); search_path vazio.
alter function nucleo.concluir_recebimento(uuid, integer, jsonb, timestamptz, uuid) security definer;

-- Contestar uma pendência devolve o pedido ao remetente; a nota vira o motivo da devolução.
create or replace function nucleo.devolver_pedido_contestado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.resposta = 'contestada'
     and (tg_op = 'INSERT' or old.resposta is distinct from 'contestada') then
    update nucleo.transferencia
       set situacao = 'devolvida', devolvida_em = new.respondida_em, motivo_da_devolucao = new.nota
     where id = new.transferencia_id and situacao = 'em_conferencia';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Cancelar pedido: a origem, enquanto o destino não recebeu
-- ---------------------------------------------------------------------------------------------
create function nucleo.cancelar_pedido(
  p_transferencia_id uuid, p_versao integer, p_em timestamptz default now(), p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: sem UPDATE direto no pedido; a função confere que quem chama é o gestor de origem (config.usuario_atual()), a versão e que o pedido está pendente; search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
  v_de uuid;
  v_situacao text;
  v_versao integer;
  v_criado timestamptz;
begin
  select de_gestor_id, situacao, versao, criado_em
    into v_de, v_situacao, v_versao, v_criado
    from nucleo.transferencia
   where id = p_transferencia_id and excluido_em is null
     for update;
  if not found or config.usuario_atual() is distinct from v_de then
    raise exception 'Só o gestor de origem cancela este pedido.' using errcode = '42501';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'cancelar_pedido');
  if v_id is not null then
    return v_id;
  end if;

  if p_versao is null or p_versao <> v_versao then
    raise exception 'Este registro mudou desde que você o abriu. Veja a versão atual e confira de novo.' using errcode = '40001';
  end if;
  if v_situacao <> 'pendente' then
    raise exception 'Este pedido já está %: só se cancela um pedido que o destino ainda não recebeu.',
      replace(v_situacao, '_', ' ') using errcode = '23514';
  end if;
  if coalesce(p_em, now()) < v_criado then
    raise exception 'O cancelamento não pode ser antes do pedido.' using errcode = '23514';
  end if;

  update nucleo.transferencia
     set situacao = 'cancelada', cancelada_em = coalesce(p_em, now())
   where id = p_transferencia_id;

  perform auditoria.concluir_envio(p_chave, p_transferencia_id);
  return p_transferencia_id;
end;
$$;
revoke all on function nucleo.cancelar_pedido(uuid, integer, timestamptz, uuid) from public;
comment on function nucleo.cancelar_pedido(uuid, integer, timestamptz, uuid) is
  '"Cancelar pedido": a origem desiste do pedido pendente (o destino ainda não recebeu); confere a versão e a chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Devolver placa: o destino recusa o pedido em conferência, com o motivo; a placa fica com a origem
-- ---------------------------------------------------------------------------------------------
create function nucleo.devolver_placa(
  p_transferencia_id uuid, p_versao integer, p_motivo text, p_em timestamptz default now(), p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: sem UPDATE direto no pedido; a função confere em pedido_para_agir que quem chama é o destino, a versão, a situação e o motivo; search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
  v record;
  v_recebida timestamptz;
begin
  select * into v from nucleo.pedido_para_agir(p_transferencia_id, 'Só o gestor de destino devolve esta placa.');

  v_id := auditoria.reservar_envio(p_chave, 'devolver_placa');
  if v_id is not null then
    return v_id;
  end if;

  if p_versao is null or p_versao <> v.versao then
    raise exception 'Este registro mudou desde que você o abriu. Veja a versão atual e confira de novo.' using errcode = '40001';
  end if;
  if v.situacao <> 'em_conferencia' then
    raise exception 'Só se devolve um pedido em conferência: receba a placa antes de devolvê-la.' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Diga o motivo de devolver a placa.' using errcode = '23514';
  end if;
  select recebida_em into v_recebida from nucleo.transferencia where id = p_transferencia_id;
  if coalesce(p_em, now()) < v_recebida then
    raise exception 'A devolução não pode ser antes do recebimento.' using errcode = '23514';
  end if;

  update nucleo.transferencia
     set situacao = 'devolvida', devolvida_em = coalesce(p_em, now()), motivo_da_devolucao = btrim(p_motivo)
   where id = p_transferencia_id;

  perform auditoria.concluir_envio(p_chave, p_transferencia_id);
  return p_transferencia_id;
end;
$$;
revoke all on function nucleo.devolver_placa(uuid, integer, text, timestamptz, uuid) from public;
comment on function nucleo.devolver_placa(uuid, integer, text, timestamptz, uuid) is
  '"Devolver placa": o destino recusa o pedido em conferência, com o motivo; o gestor não muda. Confere a versão e a chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- O que o app executa
-- ---------------------------------------------------------------------------------------------
update config.funcao_executavel set justificativa = case assinatura
  when 'nucleo.disponibilizar_placa(uuid,uuid,text,text[],integer,timestamp with time zone,uuid)'
    then 'Disponibilizar placa (envio a outro gestor): roda como dono; confere ve_ativo(frota, editar), a versão e a chave de envio.'
  when 'nucleo.pedido_para_agir(uuid,text)'
    then 'Trava o pedido e confere que quem age é o gestor de destino (roda como dono).'
  when 'nucleo.receber_placa(uuid,integer,timestamp with time zone,uuid)'
    then 'Receber placa (registra a chegada): roda como dono; confere que é o destino, a versão e a chave de envio.'
  when 'nucleo.concluir_recebimento(uuid,integer,jsonb,timestamp with time zone,uuid)'
    then 'Concluir recebimento (responde as pendências em nome de quem chama e troca o gestor): roda como dono; confere que é o destino, a versão e a chave de envio.'
  end
 where assinatura in (
   'nucleo.disponibilizar_placa(uuid,uuid,text,text[],integer,timestamp with time zone,uuid)',
   'nucleo.pedido_para_agir(uuid,text)',
   'nucleo.receber_placa(uuid,integer,timestamp with time zone,uuid)',
   'nucleo.concluir_recebimento(uuid,integer,jsonb,timestamp with time zone,uuid)');

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.cancelar_pedido(uuid,integer,timestamp with time zone,uuid)',
   'Cancelar pedido: a origem desiste do pedido pendente; roda como dono e confere quem cancela, a versão e a chave de envio.'),
  ('nucleo.devolver_placa(uuid,integer,text,timestamp with time zone,uuid)',
   'Devolver placa: o destino recusa o pedido em conferência, com motivo; roda como dono e confere quem devolve, a versão e a chave de envio.');

grant execute on function nucleo.cancelar_pedido(uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function nucleo.devolver_placa(uuid, integer, text, timestamptz, uuid) to authenticated;
