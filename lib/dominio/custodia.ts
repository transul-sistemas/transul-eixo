import type { TipoDeAtivo } from "@/lib/dados/placas-tipos";
import { SIGLAS_DE_BAIXA, type Sigla, siglaAceitaOTipo } from "./status";

// Custódia da placa entre gestores de frota e a passagem ao Operacional (regras puras).
//
// Terminologia (opção 1, 03/11/2026): "Entregar ao Operacional" leva a placa à custódia do
// Operacional da filial; "Disponibilizar placa" envia a placa a outro gestor de frota (a
// transferência). Receber tem duas etapas (opção B): "Receber placa" registra a chegada (o gestor
// não muda) e "Concluir recebimento" responde cada pendência e troca o gestor.

export const SIGLAS_QUE_PODEM_ENTREGAR = ["PÁT", "ETv"] as const satisfies readonly Sigla[];

/** As mesmas mensagens de `nucleo.entregar_ao_operacional` (a tela e o banco dizem o mesmo). */
export const MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA =
  "Só cavalo ou caminhão podem ser entregues ao Operacional.";
export const MENSAGEM_DE_SIGLA_QUE_NAO_ENTREGA =
  "Só dá para entregar ao Operacional a placa em PÁT ou ETv.";

/**
 * Por que a placa não pode ir ao Operacional, ou `null` se pode. Duas condições: o tipo tem de aceitar
 * DOp (o catálogo da régua: hoje, cavalo e caminhão; carreta, apoio e equipamento nunca) e a
 * situação de origem tem de ser PÁT ou ETv. O tipo vem primeiro: não adianta mudar de situação.
 */
export function motivoDeNaoEntregar({
  sigla,
  tipo,
}: {
  sigla: Sigla;
  tipo: TipoDeAtivo;
}): string | null {
  if (!siglaAceitaOTipo("DOp", tipo)) return MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA;
  if (!(SIGLAS_QUE_PODEM_ENTREGAR as readonly Sigla[]).includes(sigla)) {
    return MENSAGEM_DE_SIGLA_QUE_NAO_ENTREGA;
  }
  return null;
}

export function podeEntregar(sigla: Sigla, tipo: TipoDeAtivo): boolean {
  return motivoDeNaoEntregar({ sigla, tipo }) === null;
}

/** Disponibilizar placa (enviar a outro gestor): qualquer tipo, fora da baixa e sem pedido aberto. */
export function podeDisponibilizarPlaca({
  sigla,
  pedidoAberto,
}: {
  sigla: Sigla;
  pedidoAberto: boolean;
}): boolean {
  return !SIGLAS_DE_BAIXA.includes(sigla) && !pedidoAberto;
}

export type SituacaoDoPedido =
  "pendente" | "em_conferencia" | "concluido" | "devolvido" | "cancelado";

/** Pedido de transferência de uma placa de um gestor de frota para outro. */
export interface PedidoDeTransferencia {
  id: string;
  /** Placa normalizada. */
  placa: string;
  deGestorId: string;
  deGestor: string;
  paraGestorId: string;
  paraGestor: string;
  /** Por que o gestor que envia está disponibilizando. */
  motivo: string;
  /** O que o gestor que envia já sabe estar pendente; quem recebe responde cada uma ao concluir. */
  pendenciasConhecidas: readonly { id: string; texto: string }[];
  situacao: SituacaoDoPedido;
  /** Sobe a cada mudança do pedido (edição concorrente). */
  versao: number;
}

export type RecusaDoRecebimento = "pedido_encerrado" | "nao_e_o_destinatario";

/** Receber placa: só o gestor de destino, e só um pedido ainda pendente. */
export function podeReceberPedido(
  pedido: PedidoDeTransferencia,
  gestorId: string,
): { ok: true } | { ok: false; motivo: RecusaDoRecebimento } {
  if (pedido.situacao !== "pendente") return { ok: false, motivo: "pedido_encerrado" };
  if (pedido.paraGestorId !== gestorId) return { ok: false, motivo: "nao_e_o_destinatario" };
  return { ok: true };
}

/** Concluir recebimento: só o gestor de destino, e só um pedido já recebido (em conferência). */
export function podeConcluirRecebimento(
  pedido: PedidoDeTransferencia,
  gestorId: string,
): { ok: true } | { ok: false; motivo: RecusaDoRecebimento | "pedido_nao_recebido" } {
  if (pedido.situacao === "pendente") return { ok: false, motivo: "pedido_nao_recebido" };
  if (pedido.situacao !== "em_conferencia") return { ok: false, motivo: "pedido_encerrado" };
  if (pedido.paraGestorId !== gestorId) return { ok: false, motivo: "nao_e_o_destinatario" };
  return { ok: true };
}

/** Qual das duas etapas o pedido espera: receber (pendente), concluir (em conferência) ou nenhuma. */
export function etapaDoRecebimento(
  pedido: PedidoDeTransferencia | null,
): "receber" | "concluir" | null {
  if (pedido?.situacao === "pendente") return "receber";
  if (pedido?.situacao === "em_conferencia") return "concluir";
  return null;
}

/** Pedido aberto: ainda espera uma das duas etapas. */
export function pedidoAberto(pedido: PedidoDeTransferencia | null): boolean {
  return etapaDoRecebimento(pedido) !== null;
}
