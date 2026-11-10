import {
  FILTROS_DAS_ORDENS,
  FILTROS_DO_PATIO,
  type FiltroDasOrdens,
  type FiltroDoPatio,
} from "@/lib/dados/operacional-tipos";

// O estado do Pátio e das Ordens de carregamento na URL (?filtro=&pagina=): recarregar ou compartilhar
// o link devolve a mesma visão. Valor desconhecido volta ao padrão.

export interface EstadoDaLista<F extends string> {
  filtro: F;
  pagina: number;
}

function pagina(texto: string | null): number {
  const n = Number(texto);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function ler<F extends string>(
  parametros: URLSearchParams,
  filtros: readonly F[],
): EstadoDaLista<F> {
  const filtro = parametros.get("filtro");
  return {
    filtro: filtros.includes(filtro as F) ? (filtro as F) : (filtros[0] as F),
    pagina: pagina(parametros.get("pagina")),
  };
}

function endereco<F extends string>(rota: string, estado: EstadoDaLista<F>, padrao: F): string {
  const p = new URLSearchParams();
  if (estado.filtro !== padrao) p.set("filtro", estado.filtro);
  if (estado.pagina > 1) p.set("pagina", String(estado.pagina));
  const busca = p.toString();
  return busca ? `${rota}?${busca}` : rota;
}

export const lerPatioDaUrl = (p: URLSearchParams) => ler<FiltroDoPatio>(p, FILTROS_DO_PATIO);
export const enderecoDoPatio = (e: EstadoDaLista<FiltroDoPatio>) =>
  endereco("/operacional/patio", e, "todas");

export const lerOrdensDaUrl = (p: URLSearchParams) => ler<FiltroDasOrdens>(p, FILTROS_DAS_ORDENS);
export const enderecoDasOrdens = (e: EstadoDaLista<FiltroDasOrdens>) =>
  endereco("/operacional/ordens-de-carregamento", e, "todas");
