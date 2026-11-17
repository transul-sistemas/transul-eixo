// Os pedidos de aprovação (inventário 37): a leitura e as duas gravações, com a sessão de quem usa. O
// banco decide quem vê (os próprios; a Diretoria e o Administrador veem todos), quem decide (só a
// Diretoria, e quem pede não decide) e a versão (edição concorrente).
//  nucleo.pedidos_de_aprovacao(p_situacao) · nucleo.pedir_aprovacao(...) · nucleo.decidir_aprovacao(...)

import type {
  EntradaDecidirAprovacao,
  EntradaPedirAprovacao,
} from "@/lib/dominio/esquemas/lider-e-aprovacao";
import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";
import type { PedidoDeAprovacao, PedidosDeAprovacao } from "./processos-tipos";

export type { PedidoDeAprovacao };

/** Os pedidos de aprovação na situação pedida (nula = todos), do mais novo ao mais antigo. */
export async function lerPedidosDeAprovacao(
  cliente: ClienteDeEscrita,
  situacao: PedidoDeAprovacao["situacao"] | null,
): Promise<PedidoDeAprovacao[]> {
  const { data, error } = await cliente
    .schema("nucleo")
    .rpc("pedidos_de_aprovacao", { p_situacao: situacao });
  if (error) throw new Error(`pedidos_de_aprovacao: ${error.message}`);
  return ((data as PedidosDeAprovacao | null)?.linhas ?? []) as PedidoDeAprovacao[];
}

export async function pedirAprovacao(
  cliente: ClienteDeEscrita,
  e: EntradaPedirAprovacao,
  chaveDeEnvio: string,
): Promise<ResultadoDaAcao<{ pedidoId: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc("pedir_aprovacao", {
    p_tipo: e.tipo,
    p_descricao: e.descricao,
    p_referencia: e.referencia,
    p_chave: chaveDeEnvio,
  });
  if (error) return resultadoDoErro(error);
  return sucesso({ pedidoId: data as string });
}

export async function decidirAprovacao(
  cliente: ClienteDeEscrita,
  e: EntradaDecidirAprovacao,
  chaveDeEnvio: string,
): Promise<ResultadoDaAcao<{ pedidoId: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc("decidir_aprovacao", {
    p_pedido_id: e.pedidoId,
    p_versao: e.versao,
    p_decisao: e.decisao,
    p_motivo: e.motivo === "" ? null : e.motivo,
    p_chave: chaveDeEnvio,
  });
  if (error) return resultadoDoErro(error);
  return sucesso({ pedidoId: data as string });
}
