import { placaNormalizadaValida } from "@/lib/dominio/placa";

// Voltar da ficha devolve a lista no mesmo ponto: a URL (página, ordem, filtros), a rolagem da
// tabela e a linha. O registro é guardado ao sair da lista para a ficha e lido uma vez só quando a
// lista volta. Vale por pouco tempo e só para a mesma URL; qualquer dúvida é "não restaurar".

export const CHAVE_DO_RETORNO = "eixo-retorno-da-lista";
export const VALIDADE_DO_RETORNO_MS = 30 * 60 * 1000;

export interface Retorno {
  /** Caminho e parâmetros da lista (`/frota/placas?pagina=2`). */
  url: string;
  /** A placa da linha de onde a pessoa saiu. */
  placa: string;
  rolagemTopo: number;
  rolagemEsquerda: number;
  /** Quando foi guardado, em milissegundos. */
  guardadoEm: number;
}

type Escrita = Pick<Storage, "setItem">;
type Leitura = Pick<Storage, "getItem" | "removeItem">;

export function guardarRetorno(armazenamento: Escrita, retorno: Retorno): void {
  try {
    armazenamento.setItem(CHAVE_DO_RETORNO, JSON.stringify(retorno));
  } catch {
    // Modo privado ou cota cheia: sem registro, a lista só abre sem restaurar.
  }
}

const numeroNaoNegativo = (valor: unknown): valor is number =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= 0;

function lerFormato(bruto: string): Retorno | null {
  let dado: unknown;
  try {
    dado = JSON.parse(bruto);
  } catch {
    return null;
  }
  if (typeof dado !== "object" || dado === null || Array.isArray(dado)) return null;
  const r = dado as Record<string, unknown>;
  if (typeof r.url !== "string" || !r.url.startsWith("/") || r.url.startsWith("//")) return null;
  if (typeof r.placa !== "string" || !placaNormalizadaValida(r.placa)) return null;
  if (!numeroNaoNegativo(r.rolagemTopo) || !numeroNaoNegativo(r.rolagemEsquerda)) return null;
  if (!numeroNaoNegativo(r.guardadoEm)) return null;
  return {
    url: r.url,
    placa: r.placa,
    rolagemTopo: r.rolagemTopo,
    rolagemEsquerda: r.rolagemEsquerda,
    guardadoEm: r.guardadoEm,
  };
}

function dentroDoPrazo(retorno: Retorno, agora: number): boolean {
  return retorno.guardadoEm <= agora && agora - retorno.guardadoEm <= VALIDADE_DO_RETORNO_MS;
}

/**
 * O registro de retorno, se vale para esta URL agora. É de uma leitura só: o registro é apagado
 * sempre que existe, valendo ou não, para nunca restaurar a coisa errada mais tarde.
 */
export function lerRetorno(
  armazenamento: Leitura,
  urlAtual: string,
  agora: number,
): Retorno | null {
  let bruto: string | null;
  try {
    bruto = armazenamento.getItem(CHAVE_DO_RETORNO);
  } catch {
    return null;
  }
  if (bruto === null) return null;
  try {
    armazenamento.removeItem(CHAVE_DO_RETORNO);
  } catch {
    // Sem como apagar: segue, a validade e a conferência da URL ainda protegem.
  }
  const retorno = lerFormato(bruto);
  if (retorno === null) return null;
  if (retorno.url !== urlAtual) return null;
  if (!dentroDoPrazo(retorno, agora)) return null;
  return retorno;
}

/** O registro de retorno, se ainda vale, sem apagá-lo: o Voltar à lista da ficha só precisa saber para onde ir. */
export function espiarRetorno(
  armazenamento: Pick<Storage, "getItem">,
  agora: number,
): Retorno | null {
  let bruto: string | null;
  try {
    bruto = armazenamento.getItem(CHAVE_DO_RETORNO);
  } catch {
    return null;
  }
  if (bruto === null) return null;
  const retorno = lerFormato(bruto);
  return retorno !== null && dentroDoPrazo(retorno, agora) ? retorno : null;
}

export type DestinoDoRetorno = { tipo: "linha"; placa: string } | { tipo: "tabela" };

/** Para onde o foco volta: a linha de onde a pessoa saiu, ou a caixa da tabela se ela não está mais na página. */
export function destinoDoRetorno(
  retorno: Retorno,
  placasDaPagina: readonly string[],
): DestinoDoRetorno {
  return placasDaPagina.includes(retorno.placa)
    ? { tipo: "linha", placa: retorno.placa }
    : { tipo: "tabela" };
}

const semConsultaNemBarraFinal = (caminho: string) =>
  (caminho.split(/[?#]/)[0] ?? "").replace(/\/+$/, "");

/**
 * Para onde o Voltar à lista da ficha leva: a URL guardada (página, ordem e filtros), só se a página
 * atual é uma ficha daquela lista (`/frota/placas/AAA0A00`) e o registro é daquela mesma lista.
 * Fora disso, `null`: o link segue para a lista como sempre.
 */
export function urlDeVolta(
  caminhoAtual: string,
  rotaDaLista: string,
  retorno: Retorno | null,
): string | null {
  if (retorno === null) return null;
  if (!semConsultaNemBarraFinal(caminhoAtual).startsWith(`${rotaDaLista}/`)) return null;
  return semConsultaNemBarraFinal(retorno.url) === rotaDaLista ? retorno.url : null;
}
