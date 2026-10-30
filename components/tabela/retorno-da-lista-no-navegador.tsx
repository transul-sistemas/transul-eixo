"use client";

import { useEffect } from "react";
import { destinoDoRetorno, guardarRetorno, lerRetorno } from "@/lib/navegacao/retorno-da-lista";

const CAIXA_DA_TABELA = '[role="region"][aria-label*="rolável"]';

function armazenamentoDaSessao(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null; // modo privado ou bloqueado: a lista só abre sem restaurar
  }
}

/** Guarda o ponto da lista (URL, rolagem da tabela e a placa) ao sair dela para a ficha. */
export function guardarRetornoDaLista(placa: string) {
  const armazenamento = armazenamentoDaSessao();
  if (!armazenamento) return;
  const caixa = document.querySelector<HTMLElement>(CAIXA_DA_TABELA);
  guardarRetorno(armazenamento, {
    url: `${window.location.pathname}${window.location.search}`,
    placa,
    rolagemTopo: caixa?.scrollTop ?? 0,
    rolagemEsquerda: caixa?.scrollLeft ?? 0,
    guardadoEm: Date.now(),
  });
}

/**
 * Ao abrir a lista, se há um ponto de retorno guardado para esta mesma URL (e ainda vale), devolve a
 * rolagem da tabela e o foco: ao link da placa de onde a pessoa saiu, ou à caixa da tabela se ela não
 * está mais na página. Lê uma vez só. Não desenha nada.
 */
export function RestauradorDaLista({ placasDaPagina }: { placasDaPagina: readonly string[] }) {
  const chave = placasDaPagina.join(",");
  useEffect(() => {
    const armazenamento = armazenamentoDaSessao();
    if (!armazenamento) return;
    const retorno = lerRetorno(
      armazenamento,
      `${window.location.pathname}${window.location.search}`,
      Date.now(),
    );
    if (!retorno) return;
    const destino = destinoDoRetorno(retorno, chave === "" ? [] : chave.split(","));
    const caixa = document.querySelector<HTMLElement>(CAIXA_DA_TABELA);
    if (caixa) {
      caixa.scrollTop = retorno.rolagemTopo;
      caixa.scrollLeft = retorno.rolagemEsquerda;
    }
    const alvo =
      destino.tipo === "linha"
        ? document.querySelector<HTMLElement>(`[data-ficha-placa="${destino.placa}"]`)
        : caixa;
    // Sem rolar: a posição já foi devolvida acima e o foco na coluna fixa não pede rolar.
    alvo?.focus({ preventScroll: true });
  }, [chave]);
  return null;
}
