"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import type { OperacaoParaEscolher } from "@/lib/dados/pessoas-tipos";
import { enderecoDaEscala } from "@/lib/navegacao/pessoas";

/** A operação da escala: a escolha vai para a URL e mantém o mês. */
export function EscolherOperacao({
  operacoes,
  atual,
  mes,
}: {
  operacoes: readonly OperacaoParaEscolher[];
  atual: string | null;
  mes: string;
}) {
  const id = useId();
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-muted-foreground">
        Operação
      </label>
      <select
        id={id}
        value={atual ?? ""}
        disabled={pendente}
        onChange={(evento) =>
          iniciar(() =>
            router.push(enderecoDaEscala(evento.target.value || null, mes), { scroll: false }),
          )
        }
        className="border-input bg-card focus-visible:ring-ring/50 h-9 max-w-64 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3"
      >
        {operacoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </span>
  );
}
