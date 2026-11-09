import { normalizarPlaca, placaNormalizadaValida } from "@/lib/dominio/placa";
import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import type { DadosDosAssistentes, PlacaAEscolher } from "./escrita-tipos";
import type { FonteDeEscrita } from "./fonte";

export type { DadosDosAssistentes };

// O que a lista e a ficha entregam aos assistentes da Frota (tudo serializável, para ir à tela):
// o dia, os catálogos (o "+" e os campos de seleção) e, conforme o assistente pedido, a placa com a
// versão que a pessoa vê, o pedido de transferência aberto e as placas a escolher.

/** Os assistentes da Frota que agem sobre uma placa que já existe (precisam da placa alvo). */
const SOBRE_A_PLACA = [
  "receber-placa",
  "concluir-recebimento",
  "entregar-ao-operacional",
  "disponibilizar-placa",
  "mudar-situacao",
  "engatar-implemento",
  "desatrelar-implemento",
  "corrigir-placa",
];

export interface PedidoDosDados {
  /** O assistente pedido na URL (`?assistente=`), se houver. */
  assistente: string | null;
  /** A placa da URL (`?placa=`) ou a da ficha. */
  placa: string | null;
  hoje: string;
  /** Na ficha: carrega a placa e o pedido mesmo sem o assistente estar aberto. */
  carregarDaPlaca?: boolean;
  /** Quem usa (o id do usuário da sessão): a chave dos rascunhos. */
  usuario: string;
  /** O gestor de frota (a pessoa) de quem usa, ou nulo sem vínculo de pessoa. */
  gestorId: string | null;
}

const paraEscolher = (pedidos: PedidoDeTransferencia[]): PlacaAEscolher[] =>
  pedidos.map((p) => ({ placa: p.placa, nome: `${p.placa} · de ${p.deGestor}` }));

export async function dadosDosAssistentes(
  fonte: FonteDeEscrita,
  { assistente, placa, hoje, carregarDaPlaca = false, usuario, gestorId }: PedidoDosDados,
): Promise<DadosDosAssistentes> {
  const catalogos = await fonte.catalogos();
  const normalizada = placa !== null ? normalizarPlaca(placa) : null;
  const valida = normalizada !== null && placaNormalizadaValida(normalizada) ? normalizada : null;
  const quer = carregarDaPlaca || (assistente !== null && SOBRE_A_PLACA.includes(assistente));
  const placaAlvo = valida !== null && quer ? await fonte.placaParaAssistente(valida) : null;
  const pedido = placaAlvo !== null ? await fonte.pedidoAbertoDa(placaAlvo.placa) : null;
  const conjuntoDaPlaca = placaAlvo !== null ? await fonte.conjuntoDaPlaca(placaAlvo.placa) : null;
  const implementosLivres =
    assistente === "engatar-implemento" ? await fonte.implementosLivres() : [];
  const semPlaca = placaAlvo === null && valida === null;
  const precisaDosPedidos =
    semPlaca && (assistente === "receber-placa" || assistente === "concluir-recebimento");
  const pedidos = precisaDosPedidos && gestorId ? await fonte.pedidosParaReceber(gestorId) : [];
  const placasParaEntregar =
    semPlaca && assistente === "entregar-ao-operacional"
      ? await fonte.placasQuePodemSerEntregues()
      : [];
  return {
    usuario,
    gestorId,
    hoje,
    anoAtual: Number(hoje.slice(0, 4)),
    catalogos,
    criaveis: fonte.criaveis,
    placaAlvo,
    pedido,
    placasParaReceber: paraEscolher(pedidos.filter((p) => p.situacao === "pendente")),
    placasParaConcluir: paraEscolher(pedidos.filter((p) => p.situacao === "em_conferencia")),
    placasParaEntregar,
    conjuntoDaPlaca,
    implementosLivres,
  };
}
