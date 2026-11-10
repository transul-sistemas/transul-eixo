"use client";

import { useRouter } from "next/navigation";
import { NOME_DO_COOKIE_DO_TAMANHO } from "@/lib/navegacao/preferencias-da-tabela";

/**
 * O tamanho da página de uma lista que tem paginação própria (a grade do Acompanhamento). Os endereços
 * já vêm prontos do servidor, um por tamanho; a escolha fica lembrada no mesmo cookie do Paginador.
 */
export function SeletorDeTamanho({
  tam,
  enderecos,
}: {
  tam: number;
  enderecos: Record<number, string>;
}) {
  const router = useRouter();
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm">
      Linhas
      <select
        aria-label="Linhas por página"
        value={tam}
        onChange={(evento) => {
          const novo = Number(evento.target.value);
          const seguro = window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `${NOME_DO_COOKIE_DO_TAMANHO}=${novo}; Path=/; Max-Age=31536000; SameSite=Lax${seguro}`;
          router.push(enderecos[novo] ?? enderecos[20]!, { scroll: false });
        }}
        className="border-input bg-card text-foreground focus-visible:ring-ring/50 h-9 rounded-lg border px-2 tabular-nums outline-none focus-visible:ring-3"
      >
        {Object.keys(enderecos).map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    </label>
  );
}
