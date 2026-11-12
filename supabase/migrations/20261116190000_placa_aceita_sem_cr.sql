-- Meu dia, rodada 2 (Alexandre, 12/11/2026): placa aceita sem CR vigente vira a exceção "placa_sem_cr".
-- O protótipo diz "sem CR vigente: vira tarefa de cadastro". Quem decide o lote é o gestor de destino,
-- que não tem permissão de escrever na fila de exceções (só Cadastros altera); por isso a abertura é uma
-- função atômica própria, que confere por dentro quem chama.
--
-- nucleo.registrar_placa_aceita_sem_cr(pedido, chave): chamada pelo lote depois de concluir o recebimento
-- (aceitar ou aceitar com pendências).
--  * Só o gestor de destino do pedido, e só com o pedido concluído.
--  * Sem CR vigente hoje: abre UMA exceção "placa_sem_cr" para a placa (a que já está aberta basta).
--  * Com CR vigente hoje: FECHA a exceção "placa_sem_cr" aberta da placa (a função fecha o que abriu,
--    com a resolução escrita). Nada se apaga; reabrir depois cria uma exceção nova.
--  * Idempotente: rodar duas vezes não muda as contagens; a mesma chave de envio devolve o mesmo
--    resultado. Auditável: a fila já tem o gatilho de auditoria, que guarda quem fez.

create function nucleo.registrar_placa_aceita_sem_cr(p_transferencia_id uuid, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: o gestor de destino não tem permissão de escrever na fila de exceções (só Cadastros altera); a função confere por dentro que quem chama é o gestor de destino do pedido já concluído (config.usuario_atual), só abre ou fecha a exceção placa_sem_cr da placa desse pedido e não apaga nada, com search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
  v record;
begin
  select t.ativo_id, t.para_gestor_id, t.situacao into v
    from nucleo.transferencia t
   where t.id = p_transferencia_id and t.excluido_em is null;
  if not found or config.usuario_atual() is distinct from v.para_gestor_id then
    raise exception 'Só o gestor de destino registra a placa aceita.' using errcode = '42501';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'registrar_placa_aceita_sem_cr');
  if v_id is not null then
    return v_id;
  end if;

  if v.situacao <> 'concluida' then
    raise exception 'Aceite a placa antes de registrar a falta do CR.' using errcode = '23514';
  end if;

  if exists (
    select 1 from nucleo.cr_do_ativo c
     where c.ativo_id = v.ativo_id and c.excluido_em is null and c.periodo @> now()
  ) then
    update nucleo.fila_de_excecoes
       set resolvida_em = now(),
           resolucao = 'A placa passou a ter CR vigente.'
     where ativo_id = v.ativo_id and assunto = 'placa_sem_cr' and resolvida_em is null;
  else
    insert into nucleo.fila_de_excecoes (ativo_id, assunto, descricao)
    values (v.ativo_id, 'placa_sem_cr',
            'A placa foi aceita sem CR vigente. Vincule o CR da placa no cadastro.')
    on conflict (ativo_id, assunto) where resolvida_em is null and ativo_id is not null and assunto is not null do nothing;
  end if;

  perform auditoria.concluir_envio(p_chave, p_transferencia_id);
  return p_transferencia_id;
end;
$$;
revoke all on function nucleo.registrar_placa_aceita_sem_cr(uuid, uuid) from public;
comment on function nucleo.registrar_placa_aceita_sem_cr(uuid, uuid) is
  'Meu dia: depois de aceitar a placa, abre a exceção placa_sem_cr se ela não tem CR vigente (uma aberta por placa) e fecha a aberta se passou a ter. Só o gestor de destino do pedido concluído; idempotente.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.registrar_placa_aceita_sem_cr(uuid,uuid)', 'Meu dia, Receber placas: a placa aceita sem CR vigente vira exceção na fila (e fecha quando ganha CR). Security definer: o gestor não escreve na fila; confere por dentro que é o gestor de destino do pedido concluído e tem chave de envio.');
grant execute on function nucleo.registrar_placa_aceita_sem_cr(uuid, uuid) to authenticated;
