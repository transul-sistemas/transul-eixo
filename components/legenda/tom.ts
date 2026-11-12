import type { CSSProperties } from "react";
import { type TomDeStatus, variavelDoTom } from "@/lib/dominio/status";

/** Fundo e texto do tom, só por tokens (nunca uma cor escrita à mão). O verde mais claro leva contorno. */
export function estiloDoTom(tom: TomDeStatus): CSSProperties {
  const variavel = variavelDoTom(tom);
  return {
    backgroundColor: `var(${variavel})`,
    color: `var(${variavel}-texto)`,
    ...(tom === "atividade-5" ? { boxShadow: "inset 0 0 0 1.5px var(--status-em-atividade)" } : {}),
  };
}
