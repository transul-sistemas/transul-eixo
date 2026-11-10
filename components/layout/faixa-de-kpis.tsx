import type { ReactNode } from "react";
import { CartaoDeKpi, type VariacaoDoKpi } from "./cartao-de-kpi";

export interface Kpi {
  readonly id: string;
  readonly rotulo: string;
  /** O valor já formatado: use os componentes de components/formato/ (moeda, km, percentual...). */
  readonly valor: ReactNode;
  /** Uma linha de apoio. */
  readonly apoio?: string;
  /** A variação contra o período anterior (setas e tom; nunca inventa número sem base). */
  readonly variacao?: VariacaoDoKpi;
  /** Falta a fonte: mostra este texto no lugar do valor ("Sem dados ainda: depende de ..."). */
  readonly semDados?: string;
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
        <li key={kpi.id}>
          <CartaoDeKpi
            rotulo={kpi.rotulo}
            valor={kpi.valor}
            apoio={kpi.apoio}
            variacao={kpi.variacao}
            semDados={kpi.semDados}
          />
        </li>
      ))}
    </ul>
  );
}
