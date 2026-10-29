import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { AssinaturaTranSul } from "./assinatura-transul";

function PlacaDoEixo() {
  // A placa é clara nos dois temas; o símbolo dentro dela usa a cor do texto da placa.
  const estilo = { "--cor-da-marca": "var(--placa-texto)" } as CSSProperties;
  return (
    <span
      aria-hidden
      style={estilo}
      className="flex h-12 w-16 shrink-0 flex-col overflow-hidden rounded-[5px] border border-[var(--placa-texto)]/25 bg-[var(--placa-fundo)] text-[var(--placa-texto)]"
    >
      <span className="h-2.5 w-full bg-[var(--modulo-frota)]" />
      <span className="flex flex-1 flex-col items-center justify-center gap-0.5">
        <AssinaturaTranSul apenasSimbolo className="h-4" />
        <span className="font-placa text-xs leading-none font-bold tracking-[0.2em]">EIXO</span>
      </span>
    </span>
  );
}

/**
 * Logotipo do Eixo: placa com o símbolo da TranSul e "EIXO" embaixo, "TranSul Eixo" ao lado e a
 * assinatura "para TranSul". `recolhido` mostra só a placa.
 */
export function Logotipo({
  recolhido = false,
  comAssinatura = true,
  className,
}: {
  recolhido?: boolean;
  comAssinatura?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-3", className)}
      role={recolhido ? "img" : undefined}
      aria-label={recolhido ? "TranSul Eixo" : undefined}
    >
      <PlacaDoEixo />
      {recolhido ? null : (
        <span className="flex flex-col gap-1 leading-none">
          <span className="text-xl font-semibold tracking-tight">TranSul Eixo</span>
          {comAssinatura ? (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              para
              <AssinaturaTranSul className="h-3" />
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}
