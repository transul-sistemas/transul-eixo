"use client";

import { DENSIDADES, type Densidade } from "@/lib/navegacao/preferencias-da-tabela";
import { cn } from "@/lib/utils";
import { useLista } from "./pendencia-da-lista";

const NOMES: Record<Densidade, string> = { compacta: "Compacta", confortavel: "Confortável" };

/** Compacta ou confortável, lembrada por pessoa (cookie). Muda na hora, sem recarregar a lista. */
export function DensidadeDaTabela() {
  const lista = useLista();
  if (!lista) return null;
  const atual = lista.preferencias.densidade;
  return (
    <div
      role="group"
      aria-label="Densidade"
      className="border-input bg-card inline-flex rounded-lg border p-0.5 text-sm"
    >
      {DENSIDADES.map((densidade) => (
        <button
          key={densidade}
          type="button"
          aria-pressed={atual === densidade}
          onClick={() => lista.atualizarPreferencias({ densidade })}
          className={cn(
            "focus-visible:ring-ring/50 rounded-md px-3 py-1 outline-none focus-visible:ring-3",
            atual === densidade ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {NOMES[densidade]}
        </button>
      ))}
    </div>
  );
}
