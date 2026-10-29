import type { CSSProperties, ReactNode } from "react";
import { type Modulo, type Status, variavelDoModulo, variavelDoStatus } from "@/lib/visual/tons";
import { cn } from "@/lib/utils";

type Tom = { modulo: Modulo; status?: never } | { status: Status; modulo?: never };

/**
 * Etiqueta suave: fundo na versão suave, bolinha na forte e texto na cor do texto, para o
 * contraste não depender de cada cor. É de módulo ou de status, nunca dos dois.
 */
export function Etiqueta({
  children,
  className,
  ...tom
}: Tom & { children: ReactNode; className?: string }) {
  const [nome, forte] =
    tom.modulo !== undefined
      ? [`modulo:${tom.modulo}`, variavelDoModulo(tom.modulo)]
      : [`status:${tom.status}`, variavelDoStatus(tom.status)];
  const estilo = {
    "--tom-forte": `var(${forte})`,
    "--tom-suave": `var(${forte}-suave)`,
  } as CSSProperties;
  return (
    <span
      data-tom={nome}
      style={estilo}
      className={cn(
        "text-texto inline-flex items-center gap-1.5 rounded-full bg-[var(--tom-suave)] px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-[var(--tom-forte)]" />
      {children}
    </span>
  );
}
