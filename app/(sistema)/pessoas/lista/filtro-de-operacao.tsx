"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";
import type { OperacaoParaEscolher } from "@/lib/dados/pessoas-tipos";
import { enderecoDaOperacao } from "@/lib/navegacao/pessoas";

// O filtro por operação da lista de Pessoas, na linha da busca: a escolha vai para a URL
// (`operacao=<id>`) e volta à página 1.

export function FiltroDeOperacao({ operacoes }: { operacoes: readonly OperacaoParaEscolher[] }) {
  const id = useId();
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const atual = parametros.get("operacao") ?? "";
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-muted-foreground">
        Operação
      </label>
      <select
        id={id}
        value={atual}
        disabled={pendente}
        onChange={(evento) =>
          iniciar(() =>
            router.push(
              enderecoDaOperacao(
                rota,
                new URLSearchParams(parametros.toString()),
                evento.target.value || null,
              ),
              { scroll: false },
            ),
          )
        }
        className="border-input bg-card focus-visible:ring-ring/50 h-9 max-w-56 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3"
      >
        <option value="">Todas</option>
        {operacoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
    </span>
  );
}
