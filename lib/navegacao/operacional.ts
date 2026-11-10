import {
  FILTROS_DAS_ORDENS,
  FILTROS_DO_PATIO,
  type FiltroDasOrdens,
  type FiltroDoPatio,
} from "@/lib/dados/operacional-tipos";
import { TAMANHOS_DE_PAGINA } from "./preferencias-da-tabela";

/** O tamanho de página padrão de toda lista: 20 linhas (regra de Alexandre, 10/11/2026). */
export const TAM_PADRAO_DA_LISTA = 20;

// O estado do Pátio e das Ordens de carregamento na URL (?filtro=&pagina=): recarregar ou compartilhar
// o link devolve a mesma visão. Valor desconhecido volta ao padrão.

export interface EstadoDaLista<F extends string> {
  filtro: F;
  pagina: number;
  /** Linhas por página: 20, 50 ou 100 (o da URL, ou o lembrado por pessoa no cookie). */
  tam: number;
}

function pagina(texto: string | null): number {
  const n = Number(texto);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function ler<F extends string>(
  parametros: URLSearchParams,
  filtros: readonly F[],
  tamLembrado: number = TAM_PADRAO_DA_LISTA,
): EstadoDaLista<F> {
  const tamDaUrl = Number(parametros.get("tam"));
  const filtro = parametros.get("filtro");
  return {
    filtro: filtros.includes(filtro as F) ? (filtro as F) : (filtros[0] as F),
    pagina: pagina(parametros.get("pagina")),
    tam: (TAMANHOS_DE_PAGINA as readonly number[]).includes(tamDaUrl) ? tamDaUrl : tamLembrado,
  };
}

function endereco<F extends string>(rota: string, estado: EstadoDaLista<F>, padrao: F): string {
  const p = new URLSearchParams();
  if (estado.filtro !== padrao) p.set("filtro", estado.filtro);
  if (estado.pagina > 1) p.set("pagina", String(estado.pagina));
  if (estado.tam !== TAM_PADRAO_DA_LISTA) p.set("tam", String(estado.tam));
  const busca = p.toString();
  return busca ? `${rota}?${busca}` : rota;
}

export const lerPatioDaUrl = (p: URLSearchParams, tam?: number) =>
  ler<FiltroDoPatio>(p, FILTROS_DO_PATIO, tam);
export const enderecoDoPatio = (e: EstadoDaLista<FiltroDoPatio>) =>
  endereco("/operacional/patio", e, "todas");

export const lerOrdensDaUrl = (p: URLSearchParams, tam?: number) =>
  ler<FiltroDasOrdens>(p, FILTROS_DAS_ORDENS, tam);
export const enderecoDasOrdens = (e: EstadoDaLista<FiltroDasOrdens>) =>
  endereco("/operacional/ordens-de-carregamento", e, "todas");
