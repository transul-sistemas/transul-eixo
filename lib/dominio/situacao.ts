import { TIPOS_DE_ATIVO, type TipoDeAtivo } from "@/lib/dados/placas-tipos";
import {
  CAMADAS_DE_STATUS,
  type CamadaDeStatus,
  REGRAS_DAS_SIGLAS,
  type Sigla,
  SIGLAS,
} from "@/lib/dominio/status";

// Espelho em TypeScript da situação calculada no banco (fatia 3.5): `nucleo.sigla_valida` e
// `nucleo.situacao_em`. A assinatura da validade é conferida contra o banco pela mesma constante no
// Vitest e no pgTAP (40-eventos-e-situacao.test.sql).

/** A sigla vale para este tipo, dentro ou fora de conjunto? O caminhão depende só dos tipos. */
export function siglaValidaNoContexto(
  sigla: Sigla,
  tipo: TipoDeAtivo,
  emConjunto: boolean,
): boolean {
  const regra = REGRAS_DAS_SIGLAS[sigla];
  if (!regra.tiposValidos.includes(tipo)) return false;
  if (tipo === "caminhao" || regra.aplicaA === "ambos") return true;
  return (regra.aplicaA === "conjunto") === emConjunto;
}

/** As combinações válidas "sigla|tipo|contexto", em ordem de código, separadas por vírgula. */
export function assinaturaDaValidade(): string {
  const combinacoes: string[] = [];
  for (const sigla of SIGLAS) {
    for (const tipo of TIPOS_DE_ATIVO) {
      for (const contexto of ["solo", "conjunto"] as const) {
        if (siglaValidaNoContexto(sigla, tipo, contexto === "conjunto")) {
          combinacoes.push(`${sigla}|${tipo}|${contexto}`);
        }
      }
    }
  }
  return combinacoes.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join(",");
}

/** O md5 de `assinaturaDaValidade()`: a mesma constante que o pgTAP confere no banco. */
export const ASSINATURA_DA_VALIDADE = "6f838f3c16c75615ab050c9493d0efc9";

/** O estado vigente de cada camada de um ativo (a sigla, ou nada). */
export type EstadosPorCamada = Partial<Record<CamadaDeStatus, Sigla>>;

export interface EntradaDaSituacao {
  /** Os estados do próprio ativo. */
  proprios: EstadosPorCamada;
  /** Os estados do cavalo, quando o ativo é um implemento engatado. */
  cavalo?: EstadosPorCamada;
  /** Os outros membros do conjunto (o cavalo primeiro, depois os implementos por posição). */
  outrosMembros?: readonly EstadosPorCamada[];
}

/**
 * A situação: a sigla da camada de maior prioridade com estado. O implemento engatado herda só a
 * atividade do cavalo; qualquer membro impedido deixa o conjunto impedido. Sem estado, "pendente".
 */
export function situacaoDoAtivo({
  proprios,
  cavalo,
  outrosMembros = [],
}: EntradaDaSituacao): Sigla | "pendente" {
  for (const camada of CAMADAS_DE_STATUS) {
    let sigla = camada === "atividade" && cavalo ? cavalo.atividade : proprios[camada];
    if (!sigla && camada === "impedida") {
      sigla = outrosMembros.find((m) => m.impedida)?.impedida;
    }
    if (sigla) return sigla;
  }
  return "pendente";
}
