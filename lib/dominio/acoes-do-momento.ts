import type { TipoDeAtivo } from "@/lib/dados/placas-tipos";
import { podeDisponibilizarPlaca, podeEntregar } from "./custodia";
import { SIGLAS_DE_BAIXA, type Sigla } from "./status";

// Quais ações do catálogo (`ACOES` em lib/navegacao/acoes.ts) combinam com a placa. Devolve só ids;
// quem mostra cruza com `ACOES` e com o perfil.
//
// - "Receber placa" e "Concluir recebimento": as duas etapas do pedido de transferência, só para o
//   gestor de destino (quem chama passa a etapa só se o pedido é para quem usa).
// - "Entregar ao Operacional": leva a placa de PÁT ou ETv para DOp, só cavalo ou caminhão.
// - "Disponibilizar placa": envia a outro gestor de frota, sem pedido aberto.
// - "Devolver placa": junto de "Concluir recebimento" (o destino recusa o pedido em conferência).
// - "Cancelar pedido": a origem, enquanto o destino não recebeu (quem chama diz se é o caso).
// - Placa baixada (VND e SUC): nenhuma ação.
export function idsDasAcoesDoMomento({
  sigla,
  tipo,
  etapa = null,
  pedidoAberto = false,
  cancelavel = false,
}: {
  sigla: Sigla;
  tipo: TipoDeAtivo;
  /** A etapa do pedido que espera por quem usa (só o destinatário recebe e conclui). */
  etapa?: "receber" | "concluir" | null;
  /** A placa já tem um pedido de transferência aberto (para qualquer pessoa). */
  pedidoAberto?: boolean;
  /** Quem usa é a origem de um pedido ainda pendente (pode cancelar). */
  cancelavel?: boolean;
}): string[] {
  if (SIGLAS_DE_BAIXA.includes(sigla)) return [];
  const ids: string[] = [];
  if (etapa === "receber") ids.push("frota.receber-placa");
  if (etapa === "concluir") ids.push("frota.concluir-recebimento", "frota.devolver-placa");
  if (cancelavel) ids.push("frota.cancelar-pedido");
  if (podeEntregar(sigla, tipo)) ids.push("frota.entregar-ao-operacional");
  if (podeDisponibilizarPlaca({ sigla, pedidoAberto: pedidoAberto || etapa !== null })) {
    ids.push("frota.disponibilizar-placa");
  }
  return ids;
}
