"use client";

import { PieChart } from "echarts/charts";
import { LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useCallback } from "react";
import { formatarMoeda } from "@/components/formato/moeda-valor";
import { formatarInteiro } from "@/components/formato/numero";
import type { Modulo, Status } from "@/lib/visual/tons";
import { variavelDoStatus } from "@/lib/visual/tons";
import { comTransparencia, type TemaDoGrafico, useGrafico } from "./usar-grafico";

echarts.use([PieChart, LegendComponent, TooltipComponent, CanvasRenderer]);

export interface FatiaDaRosca {
  readonly nome: string;
  readonly valor: number;
  /** Cor de status da fatia (a situação da placa); sem ela, a cor do módulo em tons. */
  readonly status?: Status;
}

/**
 * A rosca: parte de um todo (a situação das placas, o custo por natureza). `formato`: `moeda` (os
 * valores vêm em centavos) ou `inteiro`. Sem cor de status, as fatias usam o tom do módulo em
 * transparências decrescentes.
 */
export function GraficoDeRosca({
  rotulo,
  fatias,
  formato,
  modulo = "operacoes",
  altura = 260,
}: {
  rotulo: string;
  fatias: readonly FatiaDaRosca[];
  formato: "moeda" | "inteiro";
  modulo?: Modulo;
  altura?: number;
}) {
  const montar = useCallback(
    (t: TemaDoGrafico) => {
      const formatar = formato === "moeda" ? formatarMoeda : formatarInteiro;
      const base = t.modulo(modulo);
      return {
        animation: false,
        aria: { enabled: true, label: { description: rotulo } },
        tooltip: {
          trigger: "item",
          backgroundColor: t.fundo,
          borderColor: t.linha,
          textStyle: { color: t.letra },
          valueFormatter: (v: unknown) => formatar(typeof v === "number" ? v : null),
        },
        legend: {
          bottom: 0,
          left: "center",
          textStyle: { color: t.texto },
          itemWidth: 12,
          itemHeight: 12,
        },
        series: [
          {
            type: "pie",
            radius: ["48%", "72%"],
            center: ["50%", "44%"],
            label: { show: false },
            itemStyle: { borderColor: t.fundo, borderWidth: 2 },
            data: fatias.map((f, i) => ({
              name: f.nome,
              value: f.valor,
              itemStyle: {
                color: f.status
                  ? getComputedStyle(document.documentElement)
                      .getPropertyValue(variavelDoStatus(f.status))
                      .trim()
                  : comTransparencia(base, Math.max(1 - i * 0.14, 0.25)),
              },
            })),
          },
        ],
      };
    },
    [rotulo, fatias, formato, modulo],
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
