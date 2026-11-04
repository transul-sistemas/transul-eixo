import type { TipoDeAtivo } from "@/lib/dados/placas-tipos";
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

/**
 * As cinco camadas da régua, da que vence à que perde (decisão 7, 31/10/2026). O espelho do
 * catálogo `config.camada_de_status` do banco (o teste confere os dois).
 */
export const CAMADAS_DE_STATUS = [
  "baixada",
  "fora-da-frota",
  "impedida",
  "sem-motorista",
  "atividade",
] as const;
export type CamadaDeStatus = (typeof CAMADAS_DE_STATUS)[number];

/**
 * A marca "válida para conjunto, solo ou ambos" do CLAUDE.md: descreve a placa mestre em relação ao
 * implemento. `conjunto` = cavalo com implemento engatado (ou o próprio implemento engatado);
 * `solo` = placa sem composição; `ambos` = com ou sem.
 */
export type AplicaA = "conjunto" | "solo" | "ambos";

export interface RegraDaSigla {
  camada: CamadaDeStatus;
  aplicaA: AplicaA;
  /** Os tipos de ativo que podem receber a sigla. O caminhão (que nunca tem composição) só depende disto. */
  tiposValidos: readonly TipoDeAtivo[];
}

const TODOS_OS_TIPOS: readonly TipoDeAtivo[] = [
  "cavalo",
  "implemento",
  "equipamento",
  "caminhao",
  "apoio",
];
const CAVALO_E_CAMINHAO: readonly TipoDeAtivo[] = ["cavalo", "caminhao"];
const CAVALO_E_IMPLEMENTO: readonly TipoDeAtivo[] = ["cavalo", "implemento"];

/**
 * O Apêndice A do plano da Fase 3, aprovado por Alexandre em 31/10/2026: camada, `aplica_a` e tipos
 * válidos de cada uma das 25 siglas. O VAz saiu da régua em 03/11/2026 (o PÁT cobre o ativo parado).
 * É o espelho do `supabase/seed.sql`: `lib/qualidade/catalogo-de-status.test.ts` confere os dois.
 */
export const REGRAS_DAS_SIGLAS: Record<Sigla, RegraDaSigla> = {
  VND: { camada: "baixada", aplicaA: "solo", tiposValidos: TODOS_OS_TIPOS },
  SUC: { camada: "baixada", aplicaA: "solo", tiposValidos: TODOS_OS_TIPOS },
  ALU: { camada: "fora-da-frota", aplicaA: "solo", tiposValidos: TODOS_OS_TIPOS },
  EMP: { camada: "fora-da-frota", aplicaA: "solo", tiposValidos: TODOS_OS_TIPOS },
  VEN: { camada: "fora-da-frota", aplicaA: "solo", tiposValidos: TODOS_OS_TIPOS },
  SIN: { camada: "impedida", aplicaA: "solo", tiposValidos: TODOS_OS_TIPOS },
  MAc: { camada: "impedida", aplicaA: "conjunto", tiposValidos: CAVALO_E_IMPLEMENTO },
  MAt: { camada: "impedida", aplicaA: "conjunto", tiposValidos: CAVALO_E_IMPLEMENTO },
  MAv: { camada: "impedida", aplicaA: "conjunto", tiposValidos: CAVALO_E_IMPLEMENTO },
  MAN: { camada: "impedida", aplicaA: "solo", tiposValidos: TODOS_OS_TIPOS },
  REF: { camada: "impedida", aplicaA: "solo", tiposValidos: TODOS_OS_TIPOS },
  SDo: { camada: "impedida", aplicaA: "ambos", tiposValidos: TODOS_OS_TIPOS },
  DOC: { camada: "impedida", aplicaA: "ambos", tiposValidos: TODOS_OS_TIPOS },
  SMo: { camada: "sem-motorista", aplicaA: "ambos", tiposValidos: CAVALO_E_CAMINHAO },
  FOg: { camada: "sem-motorista", aplicaA: "ambos", tiposValidos: CAVALO_E_CAMINHAO },
  FEr: { camada: "sem-motorista", aplicaA: "ambos", tiposValidos: CAVALO_E_CAMINHAO },
  DOp: { camada: "atividade", aplicaA: "ambos", tiposValidos: CAVALO_E_CAMINHAO },
  ETv: { camada: "atividade", aplicaA: "ambos", tiposValidos: CAVALO_E_CAMINHAO },
  ACe: { camada: "atividade", aplicaA: "conjunto", tiposValidos: CAVALO_E_CAMINHAO },
  CAr: { camada: "atividade", aplicaA: "conjunto", tiposValidos: CAVALO_E_CAMINHAO },
  CAn: { camada: "atividade", aplicaA: "conjunto", tiposValidos: CAVALO_E_CAMINHAO },
  ETc: { camada: "atividade", aplicaA: "conjunto", tiposValidos: CAVALO_E_CAMINHAO },
  ADe: { camada: "atividade", aplicaA: "conjunto", tiposValidos: CAVALO_E_CAMINHAO },
  DEs: { camada: "atividade", aplicaA: "conjunto", tiposValidos: CAVALO_E_CAMINHAO },
  PÁT: { camada: "atividade", aplicaA: "ambos", tiposValidos: TODOS_OS_TIPOS },
};

/** A sigla pode ser registrada num ativo deste tipo? */
export function siglaAceitaOTipo(sigla: Sigla, tipo: TipoDeAtivo): boolean {
  return REGRAS_DAS_SIGLAS[sigla].tiposValidos.includes(tipo);
}
