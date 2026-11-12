import { tonsDeVerdeDaLegenda } from "@/lib/dominio/legenda";
import { cn } from "@/lib/utils";
import { estiloDoTom } from "./tom";

/** Os cinco tons de verde de "em atividade", do mais escuro (mais perto de gerar receita) ao mais claro. */
export function TonsDeVerde({ className }: { className?: string }) {
  return (
    <div
      data-tons-de-verde=""
      className={cn(
        "border-border bg-card flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm",
        className,
      )}
    >
      <strong className="font-semibold">Tons de verde</strong>
      <span className="text-muted-foreground">quanto mais escuro, mais perto de gerar receita:</span>
      <ul className="flex flex-wrap items-center gap-2">
        {tonsDeVerdeDaLegenda().map((v) => (
          <li
            key={v.tom}
            data-tom-de-verde={v.tom}
            style={estiloDoTom(v.tom)}
            className="rounded-lg px-2.5 py-0.5 text-[13px] font-bold"
          >
            {v.siglas.join(" ")} <span className="font-medium">{v.rotulo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
