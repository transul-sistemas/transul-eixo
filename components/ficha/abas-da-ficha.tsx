"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";
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
  // A tecla vale para a aba que tem o foco (a que recebeu o evento), não para a `ativa`: a ativa vem
  // da URL e atrasa em relação ao foco quando as setas são apertadas em sequência rápida.
  // Ids únicos por instância: o Next mantém a página anterior escondida no documento depois de uma
  // navegação interna, e dois `aba-resumo` iguais quebram `aria-controls` e o foco por id.
  const base = useId();
  const botoes = useRef(new Map<AbaId, HTMLButtonElement>());
  const idDaAba = (id: AbaId) => `${base}-aba-${id}`;
  const idDoPainel = (id: AbaId) => `${base}-painel-${id}`;

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, atual: AbaId) {
    const proxima = abaPorTecla(atual, evento.key);
    if (proxima === null) return;
    evento.preventDefault();
    aoMudar(proxima);
    botoes.current.get(proxima)?.focus();
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
              id={idDaAba(aba.id)}
              ref={(el) => {
                if (el) botoes.current.set(aba.id, el);
                else botoes.current.delete(aba.id);
              }}
              aria-selected={selecionada}
              aria-controls={idDoPainel(aba.id)}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => aoMudar(aba.id)}
              onKeyDown={(evento) => aoTeclar(evento, aba.id)}
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
          id={idDoPainel(aba.id)}
          aria-labelledby={idDaAba(aba.id)}
          tabIndex={0}
          hidden={aba.id !== ativa}
          className="focus-visible:ring-ring/50 rounded-lg outline-none focus-visible:ring-3"
        >
          {/* A ficha tem o h1; cada painel abre com um h2 só para o leitor de tela. */}
          <h2 className="sr-only">{aba.nome}</h2>
          {conteudos[aba.id]}
        </div>
      ))}
    </div>
  );
}
