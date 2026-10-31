import { placaNormalizadaValida } from "@/lib/dominio/placa";

// Voltar da ficha devolve a lista no mesmo ponto: a URL (página, ordem, filtros), a rolagem da
// tabela e a linha. O ponto é guardado ao sair da lista para a ficha e fica guardado (sem prazo)
// enquanto a sessão da aba durar. Quem decide se ele é usado é a **volta armada**: só o Voltar e o
// Avançar do navegador e os links de voltar da ficha (Voltar à lista e a trilha) armam a volta;
// visita nova à lista (menu, link direto, recarregar) nunca é armada e começa no topo. O ponto só
// vale para a mesma URL; qualquer dúvida é "não restaurar".

export const CHAVE_DO_RETORNO = "eixo-retorno-da-lista";

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

/**
 * A marca de volta: "a próxima lista que abrir, nesta URL, é uma volta". Vive só na memória da
 * página (nada em armazenamento: um recarregar a apaga sozinho) e só nasce de um sinal real: o
 * `popstate` ou a travessia da Navigation API (Voltar e Avançar) e o clique nos links de voltar.
 * Não tem prazo nem relógio. Vale para a URL de destino e dura até a próxima navegação para outro
 * lugar (`aoNavegar`) ou até a página ser deixada (`limpar`, no `pagehide`). As rodadas de efeito
 * que o Next repete na lista escondida enxergam a mesma resposta (`vale`), mas só a primeira
 * restaura (`tomarParaRestaurar`), para uma rodada tardia não puxar a rolagem de volta.
 */
export interface MarcaDeVolta {
  armar(destino: string): void;
  /** Esta URL é o destino de uma volta armada? Não gasta a marca. */
  vale(url: string): boolean;
  /** Verdadeiro uma única vez por volta, para quem vai restaurar. */
  tomarParaRestaurar(url: string): boolean;
  /** Uma navegação começou: para outro lugar, a marca acaba; para o próprio destino, continua. */
  aoNavegar(destino: string): void;
  limpar(): void;
}

export function criarMarcaDeVolta(): MarcaDeVolta {
  let destino: string | null = null;
  let restaurada = false;
  return {
    armar(novo) {
      destino = novo;
      restaurada = false;
    },
    vale: (url) => destino !== null && destino === url,
    tomarParaRestaurar(url) {
      if (destino === null || destino !== url || restaurada) return false;
      restaurada = true;
      return true;
    },
    aoNavegar(para) {
      if (destino !== null && destino !== para) {
        destino = null;
        restaurada = false;
      }
    },
    limpar() {
      destino = null;
      restaurada = false;
    },
  };
}

/**
 * O que a carga completa da página diz (`performance.getEntriesByType("navigation")[0].type`):
 * recarregar (F5) nunca é uma volta; Voltar ou Avançar que recarrega a página inteira é.
 */
export function sinalDaCargaCompleta(tipo: string | undefined): "volta" | "nenhum" {
  return tipo === "back_forward" ? "volta" : "nenhum";
}

/** Caminho e consulta de um endereço da mesma origem, sem origem nem âncora; `null` para outra origem. */
export function destinoDaNavegacao(endereco: string, origem: string): string | null {
  try {
    const url = new URL(endereco, origem);
    return url.origin === new URL(origem).origin ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
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
