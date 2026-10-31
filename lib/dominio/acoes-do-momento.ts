import { SIGLAS_DE_BAIXA, type Sigla } from "./status";

// Quais ações do catálogo (`ACOES` em lib/navegacao/acoes.ts) combinam com a placa. Regra provisória,
// até os assistentes (2D) e o banco existirem. Devolve só ids; quem mostra cruza com `ACOES` e com o
// perfil.
//
// - "Disponibilizar ao Operacional" (módulo Frota): leva a placa de PÁT, VAz ou ETv para DOp, com a
//   filial escolhida. DOp para ACe (alocar a um lote) é do módulo Operacional e não entra aqui.
// - "Receber placa" (módulo Frota): é a transferência entre gestores de frota; não depende da
//   situação, e sim de haver um pedido de transferência pendente para a placa.
// - Placa baixada (VND e SUC): nenhuma ação.
const PODEM_DISPONIBILIZAR: readonly Sigla[] = ["PÁT", "VAz", "ETv"];

export function idsDasAcoesDoMomento({
  sigla,
  pedidoPendente = false,
}: {
  sigla: Sigla;
  /** Há um pedido de transferência pendente para esta placa (Receber placa). */
  pedidoPendente?: boolean;
}): string[] {
  if (SIGLAS_DE_BAIXA.includes(sigla)) return [];
  const ids: string[] = [];
  if (pedidoPendente) ids.push("frota.receber-placa");
  if (PODEM_DISPONIBILIZAR.includes(sigla)) ids.push("frota.disponibilizar-ao-operacional");
  return ids;
}
