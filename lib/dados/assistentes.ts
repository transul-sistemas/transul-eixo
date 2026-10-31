import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import { normalizarPlaca, placaNormalizadaValida } from "@/lib/dominio/placa";
import type { DadosDosAssistentes, PlacaGravada } from "./escrita-tipos";

export type { DadosDosAssistentes };
import type { FonteDeEscrita } from "./fonte";

// O que a lista e a ficha entregam aos assistentes da Frota (tudo serializável, para ir à tela):
// o dia, os catálogos (o "+" e os campos de seleção) e, conforme o assistente pedido, a placa com a
// versão que a pessoa vê, o pedido de transferência e as placas a escolher.

export interface PedidoDosDados {
  /** O assistente pedido na URL (`?assistente=`), se houver. */
  assistente: string | null;
  /** A placa da URL (`?placa=`) ou a da ficha. */
  placa: string | null;
  hoje: string;
  /** Na ficha: carrega a placa, o pedido e os candidatos mesmo sem o assistente estar aberto. */
  carregarDaPlaca?: boolean;
}

export async function dadosDosAssistentes(
  fonte: FonteDeEscrita,
  { assistente, placa, hoje, carregarDaPlaca = false }: PedidoDosDados,
): Promise<DadosDosAssistentes> {
  const catalogos = await fonte.catalogos();
  const normalizada = placa !== null ? normalizarPlaca(placa) : null;
  const valida = normalizada !== null && placaNormalizadaValida(normalizada) ? normalizada : null;
  const quer = carregarDaPlaca || assistente === "receber-placa" || assistente === "disponibilizar";
  const placaAlvo = valida !== null && quer ? await fonte.placaParaAssistente(valida) : null;
  const pedido =
    placaAlvo !== null && (carregarDaPlaca || assistente === "receber-placa")
      ? await fonte.pedidoPendenteDa(placaAlvo.placa)
      : null;
  const candidatosDoConjunto =
    placaAlvo !== null && (carregarDaPlaca || assistente === "receber-placa")
      ? await fonte.candidatosDoConjunto(placaAlvo.placa)
      : [];
  const placasComPedido =
    assistente === "receber-placa" && placaAlvo === null
      ? await nomesDasPlacasComPedido(fonte)
      : [];
  const placasParaDisponibilizar =
    assistente === "disponibilizar" && placaAlvo === null
      ? await fonte.placasQuePodemSerDisponibilizadas()
      : [];
  return {
    hoje,
    anoAtual: Number(hoje.slice(0, 4)),
    catalogos,
    placaAlvo,
    pedido,
    candidatosDoConjunto,
    placasComPedido,
    placasParaDisponibilizar,
  };
}

async function nomesDasPlacasComPedido(fonte: FonteDeEscrita) {
  const pedidos = await fonte.pedidosPendentes();
  const achadas = await Promise.all(pedidos.map((p) => fonte.placaParaAssistente(p.placa)));
  return achadas
    .filter((p): p is PlacaGravada => p !== null)
    .map((p) => ({ placa: p.placa, nome: `${p.placa} · ${p.modelo}` }));
}
