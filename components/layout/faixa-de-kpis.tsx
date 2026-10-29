import type { ReactNode } from "react";

export interface Kpi {
  readonly id: string;
  readonly rotulo: string;
  /** O valor já formatado: use os componentes de components/formato/ (moeda, km, percentual...). */
  readonly valor: ReactNode;
  /** Uma linha de apoio, como a variação sobre o período anterior. */
  readonly apoio?: string;
}

/** A faixa de indicadores de uma tela de leitura. Sem indicadores, não desenha nada. */
export function FaixaDeKpis({ kpis }: { kpis: readonly Kpi[] }) {
  if (kpis.length === 0) return null;
  return (
    <ul
      aria-label="Indicadores"
      className="grid [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))] gap-3"
    >
      {kpis.map((kpi) => (
        <li
          key={kpi.id}
          className="border-border bg-card flex flex-col gap-1 rounded-xl border px-4 py-3"
        >
          <span className="text-muted-foreground text-sm">{kpi.rotulo}</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{kpi.valor}</span>
          {kpi.apoio ? <span className="text-muted-foreground text-sm">{kpi.apoio}</span> : null}
        </li>
      ))}
    </ul>
  );
}
