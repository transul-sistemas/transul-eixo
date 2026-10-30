"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { type AbaId, abaPorTecla } from "@/lib/navegacao/ficha";
import { cn } from "@/lib/utils";

/**
 * As abas da ficha no padrão ARIA (lista de abas com tabulação em roving): só a aba ativa entra no
 * Tab; as setas andam (e dão a volta), Home e End vão às pontas, e a aba ganha o foco ao andar.
 * Todos os painéis existem e só o ativo aparece, então trocar de aba é instantâneo. Controlada: quem
 * usa diz qual é a ativa e o que fazer ao mudar (`AbasDaFichaNaUrl` põe isso na URL).
 */
export function AbasDaFicha({
  abas,
  ativa,
  aoMudar,
  conteudos,
}: {
  abas: readonly { id: AbaId; nome: string }[];
  ativa: AbaId;
  aoMudar: (aba: AbaId) => void;
  conteudos: Record<AbaId, ReactNode>;
}) {
  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>) {
    const proxima = abaPorTecla(ativa, evento.key);
    if (proxima === null) return;
    evento.preventDefault();
    aoMudar(proxima);
    document.getElementById(`aba-${proxima}`)?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Seções da ficha"
        className="border-border flex gap-1 overflow-x-auto border-b"
      >
        {abas.map((aba) => {
          const selecionada = aba.id === ativa;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`aba-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`painel-${aba.id}`}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => aoMudar(aba.id)}
              onKeyDown={aoTeclar}
              className={cn(
                "focus-visible:ring-ring/50 -mb-px inline-flex min-h-10 shrink-0 cursor-pointer items-center border-b-2 px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-3",
                selecionada
                  ? "text-foreground border-[var(--acao)] font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {aba.nome}
            </button>
          );
        })}
      </div>
      {abas.map((aba) => (
        <div
          key={aba.id}
          role="tabpanel"
          id={`painel-${aba.id}`}
          aria-labelledby={`aba-${aba.id}`}
          tabIndex={0}
          hidden={aba.id !== ativa}
          className="focus-visible:ring-ring/50 rounded-lg outline-none focus-visible:ring-3"
        >
          {conteudos[aba.id]}
        </div>
      ))}
    </div>
  );
}
