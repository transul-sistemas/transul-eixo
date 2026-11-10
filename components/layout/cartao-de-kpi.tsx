import { IconMinus, IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { formatarPercentual } from "@/components/formato/numero";
import { cn } from "@/lib/utils";

/** A variação do indicador contra o período anterior. */
export interface VariacaoDoKpi {
  /** Pontos percentuais sobre o período anterior; nulo quando não há base de comparação. */
  readonly pontos: number | null;
  /** Qual sentido é bom: o custo bom é o que cai. Padrão: subir. */
  readonly bomQuando?: "subir" | "cair";
  /** Com o que se compara ("o mês anterior"). */
  readonly contra?: string;
}

interface Props {
  readonly rotulo: string;
  /** O valor já formatado: use os componentes de components/formato/. */
  readonly valor: ReactNode;
  readonly apoio?: string;
  readonly variacao?: VariacaoDoKpi;
  /** Texto no lugar do valor quando falta a fonte ("Sem dados ainda: depende de ..."). */
  readonly semDados?: string;
}

function Variacao({ variacao }: { variacao: VariacaoDoKpi }) {
  const contra = variacao.contra ?? "o período anterior";
  if (variacao.pontos === null) {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-sm">
        <IconMinus aria-hidden className="size-4" />
        Sem base para comparar com {contra}
      </span>
    );
  }
  const subiu = variacao.pontos > 0;
  const igual = variacao.pontos === 0;
  const ruim = !igual && subiu === ((variacao.bomQuando ?? "subir") === "cair");
  const Icone = igual ? IconMinus : subiu ? IconTrendingUp : IconTrendingDown;
  return (
    <span
      data-variacao={igual ? "igual" : subiu ? "subiu" : "caiu"}
      className={cn(
        "flex items-center gap-1 text-sm tabular-nums",
        ruim ? "text-texto-negativo" : "text-muted-foreground",
      )}
    >
      <Icone aria-hidden className="size-4" />
      <span>
        {subiu ? "Subiu" : igual ? "Igual a" : "Caiu"}{" "}
        {igual ? "" : formatarPercentual(Math.abs(variacao.pontos))} {igual ? "" : "sobre "}
        {contra}
      </span>
    </span>
  );
}

/** O cartão de um indicador: rótulo, valor grande, variação contra o período anterior e apoio. */
export function CartaoDeKpi({ rotulo, valor, apoio, variacao, semDados }: Props) {
  return (
    <div className="border-border bg-card flex h-full flex-col gap-1 rounded-xl border px-4 py-3">
      <span className="text-muted-foreground text-sm">{rotulo}</span>
      {semDados ? (
        <span className="text-muted-foreground text-sm" data-sem-dados>
          {semDados}
        </span>
      ) : (
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{valor}</span>
      )}
      {!semDados && variacao ? <Variacao variacao={variacao} /> : null}
      {apoio ? <span className="text-muted-foreground text-sm">{apoio}</span> : null}
    </div>
  );
}
