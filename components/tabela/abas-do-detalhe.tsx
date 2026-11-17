"use client";

import { IconDatabaseOff } from "@tabler/icons-react";
import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { cn } from "@/lib/utils";

// As abas do painel de detalhe (A3 do Acompanhamento, protótipos 4 e 7 de docs/prototipos/acompanhamento):
// só leitura, sem formulário de gravação. A primeira aba abre selecionada; setas esquerda e direita
// trocam de aba (padrão de abas do WAI-ARIA).

export interface AbaDoDetalhe {
  readonly id: string;
  readonly rotulo: string;
  readonly conteudo: ReactNode;
}

export function AbasDoDetalhe({
  rotulo,
  abas,
}: {
  /** O nome da lista de abas, para o leitor de tela. */
  rotulo: string;
  abas: readonly AbaDoDetalhe[];
}) {
  const base = useId();
  const [atual, setAtual] = useState(abas[0]?.id ?? "");
  const idDaAba = (id: string) => `${base}-aba-${id}`;
  const idDoPainel = (id: string) => `${base}-painel-${id}`;
  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== "ArrowRight" && evento.key !== "ArrowLeft") return;
    evento.preventDefault();
    const i = abas.findIndex((a) => a.id === atual);
    const passo = evento.key === "ArrowRight" ? 1 : -1;
    const proxima = abas[(i + passo + abas.length) % abas.length];
    if (!proxima) return;
    setAtual(proxima.id);
    document.getElementById(idDaAba(proxima.id))?.focus();
  }
  const aberta = abas.find((a) => a.id === atual) ?? abas[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="tablist"
        aria-label={rotulo}
        onKeyDown={aoTeclar}
        className="border-border flex shrink-0 gap-1 overflow-x-auto border-b px-2"
      >
        {abas.map((a) => {
          const selecionada = a.id === aberta?.id;
          return (
            <button
              key={a.id}
              id={idDaAba(a.id)}
              type="button"
              role="tab"
              aria-selected={selecionada}
              aria-controls={idDoPainel(a.id)}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => setAtual(a.id)}
              className={cn(
                "focus-visible:ring-ring/50 -mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:ring-2",
                selecionada
                  ? "border-acao text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {a.rotulo}
            </button>
          );
        })}
      </div>
      {aberta ? (
        <div
          role="tabpanel"
          id={idDoPainel(aberta.id)}
          aria-labelledby={idDaAba(aberta.id)}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto p-4 outline-none"
        >
          {aberta.conteudo}
        </div>
      ) : null}
    </div>
  );
}

/** O vazio honesto: "Sem dados ainda: depende <da fonte>". Nunca um número inventado nem R$ 0,00. */
export function SemDadosAinda({ fonte, children }: { fonte: string; children?: ReactNode }) {
  return (
    <div className="border-border text-muted-foreground flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm">
      <p className="flex items-center gap-2">
        <IconDatabaseOff aria-hidden className="size-4 shrink-0" />
        <span>Sem dados ainda: depende {fonte}.</span>
      </p>
      {children}
    </div>
  );
}
