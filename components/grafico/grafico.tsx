"use client";

import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { formatarMoeda, formatarMoedaAbreviada } from "@/components/formato/moeda-valor";
import { formatarInteiro, formatarPercentual } from "@/components/formato/numero";
import { type Modulo, type Status, variavelDoModulo, variavelDoStatus } from "@/lib/visual/tons";

// O gráfico do Eixo (Apache ECharts): a cor sai dos tokens (status, módulo ou o azul de ação, lidos
// das variáveis CSS, e acompanha o tema claro ou escuro) e o número sai de components/formato. Nada de
// cor nem formato escrito à mão nas telas: elas passam só a série, o token e o formato.

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export type CorDoGrafico = { status: Status } | { modulo: Modulo } | "acao";
/** `moeda`: os valores vêm em centavos; o eixo abrevia ("R$ 1,3 mi") e o tooltip mostra o valor completo. */
export type FormatoDoGrafico = "inteiro" | "percentual" | "moeda";

export interface SerieDoGrafico {
  readonly nome: string;
  readonly tipo: "barra" | "linha";
  readonly cor: CorDoGrafico;
  readonly valores: readonly (number | null)[];
  /** Séries com a mesma pilha se empilham (só barras). */
  readonly pilha?: string;
  /** 0 = eixo da esquerda (padrão); 1 = eixo da direita. */
  readonly eixo?: 0 | 1;
}

export interface PropsDoGrafico {
  /** Nome acessível do gráfico (o leitor de tela lê este texto). */
  readonly rotulo: string;
  readonly categorias: readonly string[];
  readonly series: readonly SerieDoGrafico[];
  /** O formato de cada eixo de valores: [esquerda, direita]. */
  readonly formatos: readonly [FormatoDoGrafico] | readonly [FormatoDoGrafico, FormatoDoGrafico];
  /** Barras deitadas (categorias no eixo vertical), para listas com nomes longos. */
  readonly deitado?: boolean;
  readonly altura?: number;
}

const FORMATADORES: Record<FormatoDoGrafico, (n: number | null) => string> = {
  inteiro: formatarInteiro,
  percentual: formatarPercentual,
  moeda: formatarMoeda,
};

const FORMATADORES_DO_EIXO: Record<FormatoDoGrafico, (n: number | null) => string> = {
  ...FORMATADORES,
  moeda: formatarMoedaAbreviada,
};

function variavel(nome: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

function corDaSerie(cor: CorDoGrafico): string {
  if (cor === "acao") return variavel("--acao");
  return "status" in cor
    ? variavel(variavelDoStatus(cor.status))
    : variavel(variavelDoModulo(cor.modulo));
}

export function Grafico({
  rotulo,
  categorias,
  series,
  formatos,
  deitado = false,
  altura = 280,
}: PropsDoGrafico) {
  const elemento = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const no = elemento.current;
    if (!no) return;
    const grafico = echarts.init(no, undefined, { renderer: "canvas" });
    const texto = variavel("--muted-foreground");
    const linha = variavel("--border");
    const fundo = variavel("--card");
    const primeiro = texto ? texto : undefined;
    const eixosDeValor = formatos.map((f, i) => ({
      type: "value" as const,
      position: (deitado ? "bottom" : i === 0 ? "left" : "right") as "left",
      max: f === "percentual" ? 100 : undefined,
      axisLabel: {
        color: primeiro,
        hideOverlap: true,
        formatter: (v: number) => FORMATADORES_DO_EIXO[f](v),
      },
      splitNumber: deitado ? 3 : undefined,
      splitLine: { show: i === 0, lineStyle: { color: linha } },
    }));
    const eixoDeCategoria = {
      type: "category" as const,
      data: [...categorias],
      axisLabel: { color: primeiro },
      axisLine: { lineStyle: { color: linha } },
      axisTick: { show: false },
    };
    grafico.setOption({
      animation: false,
      aria: { enabled: true, label: { description: rotulo } },
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, textStyle: { color: primeiro }, itemWidth: 12, itemHeight: 12 },
      tooltip: {
        trigger: "axis",
        backgroundColor: fundo,
        borderColor: linha,
        textStyle: { color: variavel("--foreground") },
        valueFormatter: undefined,
      },
      xAxis: deitado ? eixosDeValor[0] : eixoDeCategoria,
      yAxis: deitado ? { ...eixoDeCategoria, inverse: true } : eixosDeValor,
      series: series.map((s) => {
        const formato = formatos[s.eixo ?? 0] ?? "inteiro";
        return {
          name: s.nome,
          type: s.tipo === "barra" ? "bar" : "line",
          stack: s.pilha,
          yAxisIndex: deitado ? undefined : (s.eixo ?? 0),
          data: [...s.valores],
          itemStyle: { color: corDaSerie(s.cor) },
          lineStyle: s.tipo === "linha" ? { width: 2 } : undefined,
          symbol: "none",
          connectNulls: false,
          barMaxWidth: 28,
          tooltip: {
            valueFormatter: (v: unknown) => FORMATADORES[formato](typeof v === "number" ? v : null),
          },
        };
      }),
    });
    const observador = new ResizeObserver(() => grafico.resize());
    observador.observe(no);
    return () => {
      observador.disconnect();
      grafico.dispose();
    };
  }, [rotulo, categorias, series, formatos, deitado, resolvedTheme]);

  return (
    <div
      ref={elemento}
      role="img"
      aria-label={rotulo}
      style={{ height: altura }}
      className="w-full"
    />
  );
}
