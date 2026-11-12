"use client";

import { useEffect, useId, useReducer, useRef } from "react";
import {
  NOMES_DAS_SIGLAS,
  type Sigla,
  SIGNIFICADOS_DAS_SIGLAS,
  tomDaSigla,
} from "@/lib/dominio/status";
import { cn } from "@/lib/utils";
import { balaoAberto, BALAO_FECHADO, reduzirBalao } from "./balao";
import { estiloDoTom } from "./tom";

/**
 * A sigla escrita, no tom da régua. O nome da sigla aparece num balão ao passar o mouse, ao focar com o
 * teclado e ao tocar (o segundo toque, ou Esc, ou tocar fora, fecha); o `aria-label` leva sigla e nome
 * para o leitor de tela. A cor só reforça: o texto da sigla está sempre ali.
 */
export function SiglaDoStatus({
  sigla,
  className,
  comSignificado = true,
}: {
  sigla: Sigla;
  className?: string;
  /** O balão leva também o significado, além do nome. */
  comSignificado?: boolean;
}) {
  const [estado, despachar] = useReducer(reduzirBalao, BALAO_FECHADO);
  const id = useId();
  const raiz = useRef<HTMLSpanElement>(null);
  const aberto = balaoAberto(estado);
  const nome = NOMES_DAS_SIGLAS[sigla];

  // Tocar fora fecha o balão que o toque deixou aberto.
  useEffect(() => {
    if (!estado.fixado) return;
    const fora = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) despachar("tocou-fora");
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [estado.fixado]);

  return (
    <span ref={raiz} className="relative inline-flex" data-sigla-do-status={sigla}>
      <button
        type="button"
        aria-label={`${sigla}: ${nome}`}
        aria-describedby={aberto ? id : undefined}
        aria-expanded={aberto}
        style={estiloDoTom(tomDaSigla(sigla))}
        className={cn(
          "focus-visible:ring-ring/60 inline-flex min-w-11 items-center justify-center rounded-lg px-2 py-0.5 text-[13px] font-bold outline-none focus-visible:ring-2",
          className,
        )}
        // O mouse só conta como passar o mouse; o toque tem o caminho próprio do clique.
        onPointerEnter={(e) => e.pointerType === "mouse" && despachar("entrou-mouse")}
        onPointerLeave={(e) => e.pointerType === "mouse" && despachar("saiu-mouse")}
        onFocus={() => despachar("focou")}
        onBlur={() => despachar("desfocou")}
        onClick={() => despachar("tocou")}
        onKeyDown={(e) => e.key === "Escape" && despachar("esc")}
      >
        {sigla}
      </button>
      {aberto ? (
        <span
          id={id}
          role="tooltip"
          data-balao-da-sigla=""
          className="bg-popover text-popover-foreground border-border absolute top-full left-0 z-30 mt-1.5 w-max max-w-64 rounded-lg border px-3 py-2 text-left text-sm shadow-md"
        >
          <span className="block font-semibold">{nome}</span>
          {comSignificado ? (
            <span className="text-muted-foreground block text-xs">
              {SIGNIFICADOS_DAS_SIGLAS[sigla]}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
