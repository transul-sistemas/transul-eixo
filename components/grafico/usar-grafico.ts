"use client";

import * as echarts from "echarts/core";
import { useTheme } from "next-themes";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { Modulo } from "@/lib/visual/tons";
import { variavelDoModulo } from "@/lib/visual/tons";

// A base dos gráficos do Eixo além de barras e linhas (cascata, rosca, árvore): cria o ECharts, lê
// as cores dos tokens (acompanha o tema claro e escuro), ajusta ao tamanho e descarta ao sair. Nada
// de cor escrita à mão nas telas.

export interface TemaDoGrafico {
  texto: string;
  linha: string;
  fundo: string;
  letra: string;
  acao: string;
  negativo: string;
  modulo: (m: Modulo) => string;
}

function variavel(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

export function lerTema(): TemaDoGrafico {
  return {
    texto: variavel("--muted-foreground"),
    linha: variavel("--border"),
    fundo: variavel("--card"),
    letra: variavel("--foreground"),
    acao: variavel("--acao"),
    negativo: variavel("--texto-negativo"),
    modulo: (m) => variavel(variavelDoModulo(m)),
  };
}

/** A mesma cor com a transparência dada (para as fatias de uma rosca). */
export function comTransparencia(cor: string, alfa: number): string {
  return echarts.color.modifyAlpha(cor, alfa);
}

/**
 * Liga um gráfico a um elemento. `montar` recebe o tema e devolve as opções do ECharts; ele deve
 * vir de `useCallback` (muda só quando os dados mudam).
 */
export function useGrafico(
  montar: (tema: TemaDoGrafico) => echarts.EChartsCoreOption,
): RefObject<HTMLDivElement | null> {
  const elemento = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [visivel, setVisivel] = useState(0);
  useEffect(() => {
    const no = elemento.current;
    if (!no) return;
    // Numa aba escondida o elemento tem tamanho zero: espera aparecer para criar o gráfico.
    if (no.clientWidth === 0) {
      const espera = new ResizeObserver(() => {
        if (no.clientWidth > 0) {
          espera.disconnect();
          setVisivel((v) => v + 1);
        }
      });
      espera.observe(no);
      return () => espera.disconnect();
    }
    const grafico = echarts.init(no, undefined, { renderer: "canvas" });
    grafico.setOption(montar(lerTema()));
    const observador = new ResizeObserver(() => grafico.resize());
    observador.observe(no);
    return () => {
      observador.disconnect();
      grafico.dispose();
    };
  }, [montar, resolvedTheme, visivel]);
  return elemento;
}
