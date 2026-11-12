import { IconHelpCircle } from "@tabler/icons-react";
import Link from "next/link";
import { tonsDeVerdeDaLegenda } from "@/lib/dominio/legenda";
import { grupoDaSigla, NOMES_DOS_CHIPS, SIGLAS, tomDaSigla } from "@/lib/dominio/status";
import { cn } from "@/lib/utils";
import { estiloDoTom } from "./tom";

export const ROTA_DA_LEGENDA = "/frota/acompanhamento/legenda";

/** O botão "Legenda": abre a tela "Legenda e siglas". */
export function BotaoDaLegenda({ className }: { className?: string }) {
  return (
    <Link
      href={ROTA_DA_LEGENDA}
      className={cn(
        "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3",
        className,
      )}
    >
      <IconHelpCircle aria-hidden className="size-4" />
      Legenda
    </Link>
  );
}

/**
 * A faixa rápida de legenda, sob a grade: os cinco verdes e um tom de cada outro grupo, todos com a
 * sigla ou o nome escrito. Quebra em linhas (nunca rola de lado) e leva à legenda completa.
 */
export function FaixaDeLegenda() {
  // Siglas e nome do grupo saem da régua: nada digitado à mão.
  const outros = (["atencao-1", "impedida-1", "patio-1", "fora-1"] as const).map((tom) => {
    const siglas = SIGLAS.filter((s) => tomDaSigla(s) === tom);
    const primeira = siglas[0];
    return {
      tom,
      siglas: siglas.join(" "),
      chip: primeira ? NOMES_DOS_CHIPS[grupoDaSigla(primeira)] : "",
    };
  });
  return (
    <div
      data-faixa-de-legenda=""
      aria-label="Legenda rápida das cores"
      role="group"
      className="border-border bg-card flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-2.5 text-xs"
    >
      <strong className="text-sm font-semibold">Legenda</strong>
      <ul className="flex flex-wrap items-center gap-1.5" aria-label="Em atividade, do mais escuro ao mais claro">
        {tonsDeVerdeDaLegenda().map((v) => (
          <li
            key={v.tom}
            data-tom-de-verde={v.tom}
            style={estiloDoTom(v.tom)}
            className="rounded-md px-2 py-0.5 font-bold"
          >
            {v.siglas.join(" ")}
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap items-center gap-1.5">
        {outros.map((o) => (
          <li
            key={o.tom}
            data-tom-de-grupo={o.tom}
            style={estiloDoTom(o.tom)}
            className="rounded-md px-2 py-0.5 font-bold"
          >
            {o.siglas} <span className="font-medium">· {o.chip}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ROTA_DA_LEGENDA}
        className="text-primary ml-auto font-medium underline-offset-2 hover:underline focus-visible:underline"
      >
        Ver a legenda completa
      </Link>
    </div>
  );
}
