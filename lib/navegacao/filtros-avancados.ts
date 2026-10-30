import {
  ehBaixada,
  grupoDaSigla,
  NOMES_DAS_SIGLAS,
  NOMES_DOS_CHIPS,
  SIGLAS,
  type Sigla,
} from "@/lib/dominio/status";
import { STATUS, type Status } from "@/lib/visual/tons";

// O filtro avançado da lista de placas: as 26 siglas exatas, agrupadas pelo chip de origem (o chip
// é só o agrupamento), e o "inclui baixadas" (VND e SUC). Regras puras; a tela só desenha.

export interface SiglaDoFiltro {
  sigla: Sigla;
  nome: string;
  baixada: boolean;
}

export interface GrupoDeSiglas {
  id: Status;
  nome: string;
  siglas: SiglaDoFiltro[];
}

/** Os cinco chips, na ordem da barra, cada um com as suas siglas na ordem da régua. */
export function gruposDeSiglas(): GrupoDeSiglas[] {
  return STATUS.map((id) => ({
    id,
    nome: NOMES_DOS_CHIPS[id],
    siglas: SIGLAS.filter((sigla) => grupoDaSigla(sigla) === id).map((sigla) => ({
      sigla,
      nome: NOMES_DAS_SIGLAS[sigla],
      baixada: ehBaixada(sigla),
    })),
  }));
}

/** "PÁT Pátio": a sigla exata e o nome por extenso. */
export function rotuloDaSigla(sigla: Sigla): string {
  return `${sigla} ${NOMES_DAS_SIGLAS[sigla]}`;
}

/** O tooltip de um chip de situação: as siglas que ele agrupa, com o nome por extenso. */
export function dicaDoChipDeSituacao(id: Status): string {
  const grupo = gruposDeSiglas().find((g) => g.id === id) as GrupoDeSiglas;
  const lista = grupo.siglas.map((s) => rotuloDaSigla(s.sigla)).join(", ");
  const aviso = grupo.siglas.some((s) => s.baixada)
    ? ' VND e SUC só entram com "Inclui baixadas" (em Mais filtros).'
    : "";
  return `${grupo.nome}: ${lista}.${aviso}`;
}

export function alternarSigla(siglas: readonly Sigla[], sigla: Sigla): Sigla[] {
  return siglas.includes(sigla) ? siglas.filter((s) => s !== sigla) : [...siglas, sigla];
}

/** O número que aparece no botão "Mais filtros": siglas marcadas mais o "inclui baixadas". */
export function contarFiltrosAvancados(filtros: {
  siglas: readonly Sigla[];
  baixadas: boolean;
}): number {
  return filtros.siglas.length + (filtros.baixadas ? 1 : 0);
}
