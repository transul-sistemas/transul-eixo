"use client";

import { useEffect, useLayoutEffect } from "react";
import {
  armarRetorno,
  voltaArmada,
  desarmarRetorno,
  destinoDoRetorno,
  guardarRetorno,
  lerRetorno,
} from "@/lib/navegacao/retorno-da-lista";

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

/** Arma a volta: a próxima lista que abrir agora é uma volta (Voltar do navegador ou link de voltar). */
export function armarVoltaDaLista() {
  const armazenamento = armazenamentoDaSessao();
  if (armazenamento) armarRetorno(armazenamento, Date.now());
}

/**
 * Escuta o Voltar e o Avançar do navegador e arma a volta: o `popstate` (sempre) e, onde o navegador
 * tem a Navigation API, o `navigate` do tipo travessia (que chega antes). Só isso: visita nova à
 * lista (menu, link direto, recarregar) não é travessia e por isso começa no topo.
 */
export function ArmadorDaVolta() {
  useEffect(() => {
    // Em fase de captura: dispara antes do `popstate` do próprio Next.
    window.addEventListener("popstate", armarVoltaDaLista, true);
    type Navegacao = {
      addEventListener(
        tipo: "navigate",
        ouvinte: (evento: { navigationType: string }) => void,
      ): void;
      removeEventListener(
        tipo: "navigate",
        ouvinte: (evento: { navigationType: string }) => void,
      ): void;
    };
    const navegacao = (window as unknown as { navigation?: Navegacao }).navigation;
    const aoNavegar = (evento: { navigationType: string }) => {
      if (evento.navigationType === "traverse") armarVoltaDaLista();
    };
    navegacao?.addEventListener("navigate", aoNavegar);
    return () => {
      window.removeEventListener("popstate", armarVoltaDaLista, true);
      navegacao?.removeEventListener("navigate", aoNavegar);
    };
  }, []);
  return null;
}

/** Quanto o restaurador espera antes de decidir: o sinal de volta pode chegar logo depois de a lista reaparecer. */
const ESPERA_DO_RESTAURADOR_MS = 60;

/**
 * Ao abrir a lista, se a abertura é uma volta armada e há um ponto guardado para esta mesma URL,
 * devolve a rolagem da tabela e o foco: ao link da placa de onde a pessoa saiu, ou à caixa da
 * tabela se ela não está mais na página. Visita nova não restaura nada. Não desenha nada.
 */
export function RestauradorDaLista({ placasDaPagina }: { placasDaPagina: readonly string[] }) {
  const chave = placasDaPagina.join(",");

  // Visita nova (menu, link direto): a tabela começa no topo. O Next mantém a lista escondida com a
  // rolagem de antes e a mostra de novo ao voltar a ela por um link; a rolagem antiga cai antes de
  // pintar. Se a abertura é uma volta, o efeito abaixo devolve o ponto guardado logo em seguida.
  useLayoutEffect(() => {
    const armazenamento = armazenamentoDaSessao();
    if (armazenamento && voltaArmada(armazenamento, Date.now())) return;
    const caixa = document.querySelector<HTMLElement>(CAIXA_DA_TABELA);
    if (caixa) {
      caixa.scrollTop = 0;
      caixa.scrollLeft = 0;
    }
  }, [chave]);

  useEffect(() => {
    const espera = setTimeout(restaurar, ESPERA_DO_RESTAURADOR_MS);
    return () => clearTimeout(espera);

    function restaurar() {
      const armazenamento = armazenamentoDaSessao();
      if (!armazenamento || !voltaArmada(armazenamento, Date.now())) return;
      // Age uma vez por volta: desarma, para outra rodada do efeito ou um recarregar não repetirem.
      desarmarRetorno(armazenamento);
      const retorno = lerRetorno(
        armazenamento,
        `${window.location.pathname}${window.location.search}`,
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
    }
  }, [chave]);
  return null;
}
