// Conciliar o mês (decisão de Alexandre, 17/11/2026): a conferência é por acionista (o agrupador do
// Sankhya) e mês. Pendente = linha com diferença ou sem lançamento que ainda não tem justificativa; o mês
// só trava com zero pendentes. Regra pura: o banco confere de novo (nucleo.conferir_mes_do_acionista).

type Situacao = "confere" | "diferenca" | "sem_lancamento" | "justificada";

interface LinhaDoAcionista {
  readonly agrupadorId: string;
  readonly situacao: Situacao;
}

const PENDENTE: ReadonlySet<Situacao> = new Set(["diferenca", "sem_lancamento"]);

/** As linhas do acionista que ainda pedem justificativa, na ordem em que chegaram. */
export function pendentesDoAcionista<L extends LinhaDoAcionista>(
  linhas: readonly L[],
  agrupadorId: string | null,
): L[] {
  if (!agrupadorId) return [];
  return linhas.filter((l) => l.agrupadorId === agrupadorId && PENDENTE.has(l.situacao));
}

export interface ResumoDoAcionista {
  linhas: number;
  conferem: number;
  justificadas: number;
  pendentes: number;
}

/** Quantas linhas o acionista tem no mês e em que situação (o resumo do assistente). */
export function resumoDoAcionista(
  linhas: readonly LinhaDoAcionista[],
  agrupadorId: string,
): ResumoDoAcionista {
  const doAcionista = linhas.filter((l) => l.agrupadorId === agrupadorId);
  return {
    linhas: doAcionista.length,
    conferem: doAcionista.filter((l) => l.situacao === "confere").length,
    justificadas: doAcionista.filter((l) => l.situacao === "justificada").length,
    pendentes: doAcionista.filter((l) => PENDENTE.has(l.situacao)).length,
  };
}
