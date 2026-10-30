import type { Sigla } from "./status";

// Quais ações do catálogo (`ACOES` em lib/navegacao/acoes.ts) combinam com a situação da placa.
// Regra provisória, até o módulo Operacional e os assistentes (2D) existirem: a custódia da placa
// vai do gestor de frota ao Operacional da filial, então a placa disponível no Operacional pede
// "Receber placa", e a placa no pátio pede "Disponibilizar ao Operacional". Baixada e as demais
// situações não têm ação por ora. Devolve só ids; quem mostra cruza com `ACOES` e com o perfil.
const POR_SIGLA: Partial<Record<Sigla, readonly string[]>> = {
  DOp: ["operacional.receber-placa"],
  PÁT: ["frota.disponibilizar-ao-operacional"],
};

export function idsDasAcoesDoMomento({ sigla }: { sigla: Sigla }): string[] {
  return [...(POR_SIGLA[sigla] ?? [])];
}
