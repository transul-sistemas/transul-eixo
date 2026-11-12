"use client";

import { useRouter } from "next/navigation";
import { NOME_DO_COOKIE_DO_TAMANHO } from "@/lib/navegacao/preferencias-da-tabela";

/**
 * O tamanho da página de uma lista que tem paginação própria. Os endereços já vêm prontos do servidor, um
 * por opção ("auto" mostra "Auto"); a escolha fica lembrada no cookie da lista (o padrão é o cookie único
 * do Paginador). `valor` é o tamanho em uso: um número ou "auto".
 */
export function SeletorDeTamanho({
  tam,
  enderecos,
  cookie = NOME_DO_COOKIE_DO_TAMANHO,
}: {
  tam: number | "auto";
  enderecos: Record<string, string>;
  /** O nome do cookie em que a escolha fica lembrada. */
  cookie?: string;
}) {
  const router = useRouter();
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-sm">
      Linhas
      <select
        aria-label="Linhas por página"
        value={String(tam)}
        onChange={(evento) => {
          const novo = evento.target.value;
          const seguro = window.location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `${cookie}=${novo}; Path=/; Max-Age=31536000; SameSite=Lax${seguro}`;
          const destino = enderecos[novo] ?? Object.values(enderecos)[0];
          if (destino) router.push(destino, { scroll: false });
        }}
        className="border-input bg-card text-foreground focus-visible:ring-ring/50 h-9 rounded-lg border px-2 tabular-nums outline-none focus-visible:ring-3"
      >
        {Object.keys(enderecos).map((opcao) => (
          <option key={opcao} value={opcao}>
            {opcao === "auto" ? "Auto" : opcao}
          </option>
        ))}
      </select>
    </label>
  );
}
