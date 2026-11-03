import type { TipoDeAtivo } from "@/lib/dados/placas-tipos";
import { type Sigla, siglaAceitaOTipo } from "./status";

// Custódia da placa entre gestores de frota e a passagem ao Operacional (regras puras).
//
// - Disponibilizar ao Operacional (módulo Frota): a placa de PÁT ou ETv vai para DOp, com a
//   filial escolhida. DOp para ACe (alocar a um lote) é do módulo Operacional e fica fora daqui.
// - Receber placa (módulo Frota): transferência entre gestores de frota. Quem envia deixa o motivo
//   e as pendências conhecidas (um pedido); quem recebe confere, define o que muda e conclui.

export const SIGLAS_QUE_PODEM_DISPONIBILIZAR = ["PÁT", "ETv"] as const satisfies readonly Sigla[];

export const MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA =
  "Só cavalo ou caminhão podem ser disponibilizados ao Operacional.";
export const MENSAGEM_DE_SIGLA_QUE_NAO_DISPONIBILIZA =
  "Só dá para disponibilizar placa em PÁT ou ETv.";

/**
 * Por que a placa não pode ir ao Operacional, ou `null` se pode. Duas condições: o tipo tem de aceitar
 * DOp (o catálogo da régua: hoje, cavalo e caminhão; carreta, apoio e equipamento nunca) e a
 * situação de origem tem de ser PÁT ou ETv. O tipo vem primeiro: não adianta mudar de situação.
 */
export function motivoDeNaoDisponibilizar({
  sigla,
  tipo,
}: {
  sigla: Sigla;
  tipo: TipoDeAtivo;
}): string | null {
  if (!siglaAceitaOTipo("DOp", tipo)) return MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA;
  if (!(SIGLAS_QUE_PODEM_DISPONIBILIZAR as readonly Sigla[]).includes(sigla)) {
    return MENSAGEM_DE_SIGLA_QUE_NAO_DISPONIBILIZA;
  }
  return null;
}

export function podeDisponibilizar(sigla: Sigla, tipo: TipoDeAtivo): boolean {
  return motivoDeNaoDisponibilizar({ sigla, tipo }) === null;
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
