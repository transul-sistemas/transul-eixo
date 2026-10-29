import type { Status } from "@/lib/visual/tons";

/** A régua única de status (CLAUDE.md), com a sigla exata de cada situação da placa. */
export const SIGLAS = [
  "ETc",
  "ETv",
  "CAr",
  "DEs",
  "DOp",
  "ACe",
  "ADe",
  "CAn",
  "MAc",
  "MAt",
  "MAv",
  "MAN",
  "REF",
  "SIN",
  "VAz",
  "FOg",
  "FEr",
  "SMo",
  "SDo",
  "PÁT",
  "DOC",
  "ALU",
  "EMP",
  "VEN",
  "SUC",
  "VND",
] as const;

export type Sigla = (typeof SIGLAS)[number];

/** O chip é só o agrupamento: a sigla exata continua visível na linha e no filtro avançado. */
const GRUPOS: Record<Sigla, Status> = {
  DOp: "em-atividade",
  ACe: "em-atividade",
  CAr: "em-atividade",
  CAn: "em-atividade",
  ETc: "em-atividade",
  ADe: "em-atividade",
  DEs: "em-atividade",
  ETv: "em-atividade",
  MAc: "impedida",
  MAt: "impedida",
  MAv: "impedida",
  MAN: "impedida",
  REF: "impedida",
  SIN: "impedida",
  SDo: "impedida",
  DOC: "impedida",
  SMo: "atencao",
  FOg: "atencao",
  FEr: "atencao",
  VAz: "atencao",
  PÁT: "patio",
  ALU: "fora",
  EMP: "fora",
  VEN: "fora",
  SUC: "fora",
  VND: "fora",
};

export const NOMES_DAS_SIGLAS: Record<Sigla, string> = {
  DOp: "Disponível no Operacional",
  ACe: "Aguardando carregamento",
  CAr: "Carregando",
  CAn: "Carregado aguardando nota",
  ETc: "Em trânsito carregado",
  ADe: "Aguardando descarga",
  DEs: "Descarregando",
  ETv: "Em trânsito vazio",
  MAc: "Manutenção / carregado",
  MAt: "Manutenção / tombado",
  MAv: "Manutenção / vazio",
  MAN: "Em manutenção",
  REF: "Em reforma",
  SIN: "Sinistro",
  VAz: "Vazio",
  FOg: "Folga",
  FEr: "Férias",
  SMo: "Sem motorista",
  SDo: "Sem documento",
  PÁT: "Pátio",
  DOC: "Problema documental",
  ALU: "Alugado a terceiro",
  EMP: "Emprestado",
  VEN: "Disponível para venda",
  SUC: "Sucata",
  VND: "Vendido",
};

/** Placas baixadas: ficam fora das listas, salvo se a pessoa pedir "inclui baixadas". */
export const SIGLAS_DE_BAIXA: readonly Sigla[] = ["VND", "SUC"];

export function grupoDaSigla(sigla: Sigla): Status {
  return GRUPOS[sigla];
}

export function ehBaixada(sigla: Sigla): boolean {
  return SIGLAS_DE_BAIXA.includes(sigla);
}

/** Os cinco chips de status, com o nome que a tela mostra. */
export const NOMES_DOS_CHIPS: Record<Status, string> = {
  "em-atividade": "Em atividade",
  atencao: "Atenção",
  impedida: "Impedida",
  patio: "Pátio",
  fora: "Fora",
};
