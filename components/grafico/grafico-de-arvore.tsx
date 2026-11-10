"use client";

import { TreeChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useCallback } from "react";
import { type TemaDoGrafico, useGrafico } from "./usar-grafico";

echarts.use([TreeChart, TooltipComponent, CanvasRenderer]);

export interface NoDaArvore {
  readonly nome: string;
  readonly filhos?: readonly NoDaArvore[];
  /** Nó de resumo ("+ 12 placas"): aparece mais apagado. */
  readonly resumo?: boolean;
}

function paraEcharts(no: NoDaArvore, nivel: number, t: TemaDoGrafico): unknown {
  return {
    name: no.nome,
    collapsed: false,
    label: no.resumo ? { color: t.texto } : undefined,
    children: no.filhos?.map((f) => paraEcharts(f, nivel + 1, t)),
  };
}

/** A árvore (ECharts tree), da esquerda para a direita; as cores saem dos tokens. */
export function GraficoDeArvore({
  rotulo,
  raiz,
  altura = 520,
}: {
  rotulo: string;
  raiz: NoDaArvore;
  altura?: number;
}) {
  const montar = useCallback(
    (t: TemaDoGrafico) => ({
      animation: false,
      aria: { enabled: true, label: { description: rotulo } },
      tooltip: {
        trigger: "item",
        backgroundColor: t.fundo,
        borderColor: t.linha,
        textStyle: { color: t.letra },
      },
      series: [
        {
          type: "tree",
          data: [paraEcharts(raiz, 0, t)],
          top: 8,
          bottom: 8,
          left: 150,
          right: 170,
          orient: "LR",
          symbolSize: 9,
          initialTreeDepth: -1,
          expandAndCollapse: true,
          roam: false,
          lineStyle: { color: t.linha, width: 1.5, curveness: 0.5 },
          itemStyle: { color: t.modulo("operacoes"), borderColor: t.modulo("operacoes") },
          label: {
            position: "left",
            verticalAlign: "middle",
            align: "right",
            color: t.letra,
            fontSize: 12,
          },
          leaves: { label: { position: "right", verticalAlign: "middle", align: "left" } },
          emphasis: { focus: "descendant" },
        },
      ],
    }),
    [rotulo, raiz],
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
