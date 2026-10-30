import { placaNormalizadaValida } from "@/lib/dominio/placa";

// Voltar da ficha devolve a lista no mesmo ponto: a URL (página, ordem, filtros), a rolagem da
// tabela e a linha. O ponto é guardado ao sair da lista para a ficha e fica guardado (sem prazo)
// enquanto a sessão da aba durar. Quem decide se ele é usado é a **volta armada**: só o Voltar e o
// Avançar do navegador e os links de voltar da ficha (Voltar à lista e a trilha) armam a volta;
// visita nova à lista (menu, link direto, recarregar) nunca é armada e começa no topo. O ponto só
// vale para a mesma URL; qualquer dúvida é "não restaurar".

export const CHAVE_DO_RETORNO = "eixo-retorno-da-lista";
export const CHAVE_DA_VOLTA_ARMADA = "eixo-retorno-armado";
/** A volta chega em instantes depois de armada; passado isso, ela já não conta. */
export const JANELA_DO_ARMADO_MS = 1_500;

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

/** O ponto guardado, se é para esta URL. Não é gasto: Voltar, Avançar e Voltar de novo restauram sempre. */
export function lerRetorno(
  armazenamento: Pick<Storage, "getItem">,
  urlAtual: string,
): Retorno | null {
  const retorno = espiarRetorno(armazenamento);
  return retorno !== null && retorno.url === urlAtual ? retorno : null;
}

/** O ponto guardado, qualquer que seja a URL (o Voltar à lista da ficha só precisa saber para onde ir). */
export function espiarRetorno(armazenamento: Pick<Storage, "getItem">): Retorno | null {
  let bruto: string | null;
  try {
    bruto = armazenamento.getItem(CHAVE_DO_RETORNO);
  } catch {
    return null;
  }
  return bruto === null ? null : lerFormato(bruto);
}

/** Arma a volta: a próxima lista que abrir agora é uma volta e pode restaurar o ponto. */
export function armarRetorno(armazenamento: Pick<Storage, "setItem">, agora: number): void {
  try {
    armazenamento.setItem(CHAVE_DA_VOLTA_ARMADA, String(agora));
  } catch {
    // Sem armazenamento: nada é armado e a lista abre no topo.
  }
}

/** Desarma a volta: quem agiu sobre ela (o restaurador) apaga a marca, para um recarregar logo depois não restaurar. */
export function desarmarRetorno(armazenamento: Pick<Storage, "removeItem">): void {
  try {
    armazenamento.removeItem(CHAVE_DA_VOLTA_ARMADA);
  } catch {
    // Sem como apagar: a janela curta ainda protege.
  }
}

/**
 * A volta foi armada há pouco? Não gasta a marca: o Next reativa os efeitos da lista escondida mais
 * de uma vez ao mostrá-la de novo, e todas as rodadas de uma mesma volta têm de enxergar a mesma
 * resposta. A janela curta é o que impede uma visita nova de herdar uma volta antiga.
 */
export function voltaArmada(armazenamento: Pick<Storage, "getItem">, agora: number): boolean {
  let bruto: string | null;
  try {
    bruto = armazenamento.getItem(CHAVE_DA_VOLTA_ARMADA);
  } catch {
    return false;
  }
  if (bruto === null || !/^\d+$/.test(bruto)) return false;
  const armadoEm = Number(bruto);
  return armadoEm <= agora && agora - armadoEm <= JANELA_DO_ARMADO_MS;
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
