-- Meu dia, rodada 2 (Alexandre, 12/11/2026): o lote de "Receber placas" mostra "há N dias" e o prazo
-- vencido em vermelho suave. Para isso a leitura precisa da data de envio do pedido e do prazo.
--  * Parâmetro novo: prazo_da_transferencia_dias (hipótese H4 de docs/gerenciador-de-processos.md:
--    receber placa em 5 dias). Não havia parâmetro de prazo da transferência. Editável só pelo
--    Administrador (a política de config.parametro já é essa), com auditoria. Prazo vencido sinaliza e
--    nunca cancela o pedido.
--  * nucleo.pedidos_do_meu_dia(p_todos): os pedidos abertos de pedidos_para_receber, cada um com
--    'enviada_em' (UTC, formato fixo) e 'prazo_dias'. Função de leitura, security invoker: a RLS de quem
--    chama vale. Por padrão só os que esperam o usuário; com p_todos, todos os abertos que a RLS deixa
--    ver (o Administrador lê a fila em modo leitura; quem decide é só o gestor de destino).

insert into config.parametro (chave, valor, descricao) values
  ('prazo_da_transferencia_dias', '5',
   'Dias, a partir do envio, em que o gestor de destino deve receber a placa. Passado o prazo, o Meu dia sinaliza em vermelho suave; nunca cancela o pedido (hipótese H4, padrão provisório).')
on conflict (chave) do nothing;

create function nucleo.pedidos_do_meu_dia(p_todos boolean default false)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with prazo as (
    select coalesce(
             (select case when p.valor ~ '^[0-9]{1,4}$' and p.valor::int > 0 then p.valor::int end
                from config.parametro p where p.chave = 'prazo_da_transferencia_dias'),
             5) as dias
  ),
  abertos as (
    select t.id, t.criado_em, nucleo.pedido_em_json(t.id) as pedido
      from nucleo.transferencia t
     where t.situacao in ('pendente', 'em_conferencia')
       and t.excluido_em is null
       and (coalesce(p_todos, false) or t.para_gestor_id = config.usuario_atual())
  )
  select coalesce(jsonb_agg(
           a.pedido || jsonb_build_object(
             'enviada_em', to_char(a.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
             'prazo_dias', p.dias)
           order by a.criado_em, a.id), '[]'::jsonb)
    from abertos a cross join prazo p
   where a.pedido is not null
$$;
revoke all on function nucleo.pedidos_do_meu_dia(boolean) from public;
comment on function nucleo.pedidos_do_meu_dia(boolean) is
  'Os pedidos de transferência abertos do Meu dia, do mais antigo ao mais novo, com a data de envio (UTC) e o prazo em dias. Por padrão só os que esperam o usuário; com p_todos, todos os que a RLS deixa ver. Security invoker.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.pedidos_do_meu_dia(boolean)', 'Meu dia, Receber placas: os pedidos abertos com a data de envio e o prazo da transferência, com a RLS de quem consulta.');
grant execute on function nucleo.pedidos_do_meu_dia(boolean) to authenticated;
