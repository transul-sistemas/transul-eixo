import {
  grupoDaSigla,
  NOMES_DAS_SIGLAS,
  NOMES_DOS_CHIPS,
  type Sigla,
  SIGNIFICADOS_DAS_SIGLAS,
  type TomDeStatus,
  tomDaSigla,
} from "./status";

// A legenda "Legenda e siglas" (A5): gerada da régua de status, nunca digitada. Aqui só fica a ordem
// e o agrupamento de tela (os grupos aprovados no protótipo); nome, significado, chip e tom vêm da régua.

export interface GrupoDaLegenda {
  readonly id: string;
  readonly nome: string;
  readonly siglas: readonly Sigla[];
}

export const GRUPOS_DA_LEGENDA: readonly GrupoDaLegenda[] = [
  { id: "em-operacao", nome: "Em operação", siglas: ["ETc", "ETv", "CAr", "DEs"] },
  { id: "aguardando", nome: "Aguardando", siglas: ["ACe", "ADe", "CAn"] },
  { id: "operacional-e-patio", nome: "Operacional e pátio", siglas: ["DOp", "PÁT"] },
  {
    id: "impedimentos",
    nome: "Manutenção e impedimentos",
    siglas: ["MAc", "MAt", "MAv", "MAN", "REF", "SIN", "DOC", "SDo"],
  },
  {
    id: "sem-motorista",
    nome: "Parado por falta de motorista",
    siglas: ["FOg", "FEr", "SMo"],
  },
  { id: "fora-da-frota", nome: "Fora da frota", siglas: ["ALU", "EMP", "VEN", "SUC", "VND"] },
];

const NASCE_DA_POSSE = "Nasce da posse e da baixa, não do lançamento do dia.";

/** Observações que a pessoa precisa ler junto da sigla (de onde ela nasce). */
const AVISOS: Partial<Record<Sigla, string>> = {
  DOp: "DOp não é lançada no dia: nasce da entrega ao Operacional.",
  ALU: NASCE_DA_POSSE,
  EMP: NASCE_DA_POSSE,
  VEN: NASCE_DA_POSSE,
  SUC: NASCE_DA_POSSE,
  VND: NASCE_DA_POSSE,
};

export interface EntradaDaLegenda {
  readonly sigla: Sigla;
  readonly nome: string;
  readonly significado: string;
  /** O nome do chip (Em atividade, Impedida...). */
  readonly chip: string;
  readonly tom: TomDeStatus;
  readonly aviso?: string;
}

export interface GrupoMontado {
  readonly id: string;
  readonly nome: string;
  readonly entradas: readonly EntradaDaLegenda[];
}

export function entradaDaSigla(sigla: Sigla): EntradaDaLegenda {
  const aviso = AVISOS[sigla];
  return {
    sigla,
    nome: NOMES_DAS_SIGLAS[sigla],
    significado: SIGNIFICADOS_DAS_SIGLAS[sigla],
    chip: NOMES_DOS_CHIPS[grupoDaSigla(sigla)],
    tom: tomDaSigla(sigla),
    ...(aviso ? { aviso } : {}),
  };
}

export function montarLegenda(): readonly GrupoMontado[] {
  return GRUPOS_DA_LEGENDA.map((g) => ({
    id: g.id,
    nome: g.nome,
    entradas: g.siglas.map(entradaDaSigla),
  }));
}

/** Minúscula, sem acento e sem espaço nas pontas: "PÁT " vira "pat". */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function combina(entrada: EntradaDaLegenda, termos: readonly string[]): boolean {
  const palheiro = normalizarBusca(
    `${entrada.sigla} ${entrada.nome} ${entrada.significado} ${entrada.chip}`,
  );
  return termos.every((t) => palheiro.includes(t));
}

/** A busca por sigla ou palavra; cada palavra digitada precisa aparecer. Só ficam os grupos com resultado. */
export function filtrarLegenda(
  legenda: readonly GrupoMontado[],
  busca: string,
): readonly GrupoMontado[] {
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return legenda;
  return legenda
    .map((g) => ({ ...g, entradas: g.entradas.filter((e) => combina(e, termos)) }))
    .filter((g) => g.entradas.length > 0);
}
