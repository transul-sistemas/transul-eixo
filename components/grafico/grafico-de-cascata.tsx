"use client";

import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useCallback } from "react";
import { formatarMoeda, formatarMoedaAbreviada } from "@/components/formato/moeda-valor";
import { type PassoDaCascata, tokenDoPasso } from "@/lib/dominio/resultado-da-operacao";
import { useGrafico } from "./usar-grafico";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

/**
 * O gráfico em cascata: receita, custos que descem e margem. Os passos vêm prontos do domínio
 * (`passosDaCascata`); os valores são em centavos e o tooltip mostra o valor completo.
 */
export function GraficoDeCascata({
  rotulo,
  passos,
  altura = 300,
}: {
  rotulo: string;
  passos: readonly PassoDaCascata[];
  altura?: number;
}) {
  const montar = useCallback(
    (t: ReturnType<typeof import("./usar-grafico").lerTema>) => ({
      animation: false,
      aria: { enabled: true, label: { description: rotulo } },
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "none" },
        backgroundColor: t.fundo,
        borderColor: t.linha,
        textStyle: { color: t.letra },
        formatter: (itens: unknown) => {
          const i = (itens as { dataIndex: number }[])[0];
          const p = i ? passos[i.dataIndex] : undefined;
          return p ? `${p.rotulo}: ${formatarMoeda(p.valor)}` : "";
        },
      },
      xAxis: {
        type: "category",
        data: passos.map((p) => p.rotulo),
        axisLabel: { color: t.texto, interval: 0, width: 96, overflow: "break" },
        axisLine: { lineStyle: { color: t.linha } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: t.texto,
          hideOverlap: true,
          formatter: (v: number) => formatarMoedaAbreviada(v),
        },
        splitLine: { lineStyle: { color: t.linha } },
      },
      series: [
        {
          type: "bar",
          stack: "cascata",
          silent: true,
          itemStyle: { color: "transparent" },
          data: passos.map((p) => p.base),
        },
        {
          type: "bar",
          stack: "cascata",
          barMaxWidth: 56,
          data: passos.map((p) => ({
            value: p.altura,
            itemStyle: {
              color: ((token) =>
                token === "negativo" ? t.negativo : token === "acao" ? t.acao : t.modulo(token))(
                tokenDoPasso(p.tipo),
              ),
            },
          })),
        },
      ],
    }),
    [rotulo, passos],
  );
  const elemento = useGrafico(montar);
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
