"use client";

import { useEffect, useLayoutEffect } from "react";
import {
  criarMarcaDeVolta,
  destinoDaNavegacao,
  destinoDoRetorno,
  guardarRetorno,
  lerRetorno,
  sinalDaCargaCompleta,
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

/** A marca de volta desta página: só na memória (um recarregar a apaga) e só por sinal real. */
const marca = criarMarcaDeVolta();
const quandoArmar = new Set<() => void>();

const urlAtual = () => `${window.location.pathname}${window.location.search}`;

/** Arma a volta para `destino` (padrão: a URL atual) e avisa quem espera o sinal para restaurar. */
export function armarVoltaDaLista(destino: string = urlAtual()) {
  marca.armar(destino);
  for (const aviso of [...quandoArmar]) aviso();
}

/**
 * Escuta os sinais de volta e o fim das voltas: o `popstate` (Voltar e Avançar) e, onde há a
 * Navigation API, a travessia (`navigate` do tipo `traverse`, que chega antes) armam a volta; qualquer
 * outra navegação para outro endereço, e o clique num link para outro endereço, apagam a marca;
 * sair da página (`pagehide`) também. Nada aqui usa tempo.
 */
export function ArmadorDaVolta() {
  useEffect(() => {
    const aoVoltar = () => armarVoltaDaLista();
    const aoSair = () => marca.limpar();
    const aoClicar = (evento: MouseEvent) => {
      const link = (evento.target as Element | null)?.closest?.("a[href]");
      const destino = link
        ? destinoDaNavegacao((link as HTMLAnchorElement).href, window.location.origin)
        : null;
      if (destino !== null) marca.aoNavegar(destino);
    };
    // Em fase de captura: antes do `popstate` do próprio Next e do onClick dos links de voltar
    // (que arma depois de este clique ter apagado a marca antiga).
    window.addEventListener("popstate", aoVoltar, true);
    window.addEventListener("pagehide", aoSair);
    document.addEventListener("click", aoClicar, true);
    type EventoDeNavegacao = { navigationType: string; destination?: { url: string } };
    type Navegacao = {
      addEventListener(tipo: "navigate", ouvinte: (evento: EventoDeNavegacao) => void): void;
      removeEventListener(tipo: "navigate", ouvinte: (evento: EventoDeNavegacao) => void): void;
    };
    const navegacao = (window as unknown as { navigation?: Navegacao }).navigation;
    const aoNavegar = (evento: EventoDeNavegacao) => {
      const destino = evento.destination
        ? destinoDaNavegacao(evento.destination.url, window.location.origin)
        : null;
      if (destino === null) return;
      if (evento.navigationType === "traverse") armarVoltaDaLista(destino);
      else marca.aoNavegar(destino);
    };
    navegacao?.addEventListener("navigate", aoNavegar);
    return () => {
      window.removeEventListener("popstate", aoVoltar, true);
      window.removeEventListener("pagehide", aoSair);
      document.removeEventListener("click", aoClicar, true);
      navegacao?.removeEventListener("navigate", aoNavegar);
    };
  }, []);
  return null;
}

/**
 * Carga completa da página: só uma vez por documento. Recarregar (F5) nunca é uma volta; Voltar ou
 * Avançar que recarrega a página inteira é (a Navigation API não alcança o documento novo).
 */
let cargaCompletaJaLida = false;
function lerACargaCompleta() {
  if (cargaCompletaJaLida) return;
  cargaCompletaJaLida = true;
  const tipo = (
    performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
  )?.type;
  if (sinalDaCargaCompleta(tipo) === "volta") marca.armar(urlAtual());
}

/**
 * Ao abrir a lista, se a abertura é uma volta (marca armada para esta URL) e há um ponto guardado
 * para esta mesma URL, devolve a rolagem da tabela e o foco: ao link da placa de onde a pessoa
 * saiu, ou à caixa da tabela se ela não está mais na página. Visita nova e recarregar não restauram
 * nada. Não desenha nada. Se a lista aparece antes do sinal de volta, espera o sinal (não o tempo).
 */
export function RestauradorDaLista({ placasDaPagina }: { placasDaPagina: readonly string[] }) {
  const chave = placasDaPagina.join(",");

  // Visita nova (menu, link direto): a tabela começa no topo. O Next mantém a lista escondida com a
  // rolagem de antes e a mostra de novo ao voltar a ela por um link; a rolagem antiga cai antes de
  // pintar. Se a abertura é uma volta, o efeito abaixo devolve o ponto guardado logo em seguida.
  useLayoutEffect(() => {
    lerACargaCompleta();
    if (marca.vale(urlAtual())) return;
    const caixa = document.querySelector<HTMLElement>(CAIXA_DA_TABELA);
    if (caixa) {
      caixa.scrollTop = 0;
      caixa.scrollLeft = 0;
    }
  }, [chave]);

  useEffect(() => {
    let quadro = 0;
    // Pode haver o sinal depois de a lista aparecer: então se restaura quando ele chegar.
    const aoArmar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(restaurar);
    };
    quandoArmar.add(aoArmar);
    restaurar();
    return () => {
      quandoArmar.delete(aoArmar);
      cancelAnimationFrame(quadro);
    };

    function restaurar() {
      const url = urlAtual();
      if (!marca.tomarParaRestaurar(url)) return;
      const armazenamento = armazenamentoDaSessao();
      const retorno = armazenamento ? lerRetorno(armazenamento, url) : null;
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
