import type { Sigla } from "./status";

// Custódia da placa entre gestores de frota e a passagem ao Operacional (regras puras).
//
// - Disponibilizar ao Operacional (módulo Frota): a placa de PÁT, VAz ou ETv vai para DOp, com a
//   filial escolhida. DOp para ACe (alocar a um lote) é do módulo Operacional e fica fora daqui.
// - Receber placa (módulo Frota): transferência entre gestores de frota. Quem envia deixa o motivo
//   e as pendências conhecidas (um pedido); quem recebe confere, define o que muda e conclui.

export const SIGLAS_QUE_PODEM_DISPONIBILIZAR = [
  "PÁT",
  "VAz",
  "ETv",
] as const satisfies readonly Sigla[];

export function podeDisponibilizar(sigla: Sigla): boolean {
  return (SIGLAS_QUE_PODEM_DISPONIBILIZAR as readonly Sigla[]).includes(sigla);
}

export type SituacaoDoPedido = "pendente" | "concluido" | "cancelado";

/** Pedido de transferência de uma placa de um gestor de frota para outro. */
export interface PedidoDeTransferencia {
  id: string;
  /** Placa normalizada. */
  placa: string;
  deGestorId: string;
  paraGestorId: string;
  /** Por que o gestor que envia está transferindo. */
  motivo: string;
  /** O que o gestor que envia já sabe estar pendente; quem recebe resolve cada uma. */
  pendenciasConhecidas: readonly { id: string; texto: string }[];
  situacao: SituacaoDoPedido;
  /** Sobe a cada mudança do pedido (edição concorrente). */
  versao: number;
}

export type RecusaDoRecebimento = "pedido_encerrado" | "nao_e_o_destinatario";

/** Só o gestor de destino recebe, e só um pedido ainda pendente (se alguém já resolveu, avisa). */
export function podeReceberPedido(
  pedido: PedidoDeTransferencia,
  gestorId: string,
): { ok: true } | { ok: false; motivo: RecusaDoRecebimento } {
  if (pedido.situacao !== "pendente") return { ok: false, motivo: "pedido_encerrado" };
  if (pedido.paraGestorId !== gestorId) return { ok: false, motivo: "nao_e_o_destinatario" };
  return { ok: true };
}
