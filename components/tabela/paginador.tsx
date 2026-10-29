"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { formatarInteiro } from "@/components/formato/numero";
import { cn } from "@/lib/utils";
import { mudarConsulta, type PadraoDaTabela } from "@/lib/navegacao/tabela";

interface Props {
  pagina: number;
  paginas: number;
  total: number;
  tam: number;
  /** Nome no plural do que a lista mostra ("placas"). */
  itens: string;
  /** Os padrões e os campos de ordem da tabela, para o link da página não mexer no resto da URL. */
  padrao: PadraoDaTabela;
  campos: readonly string[];
}

/**
 * O resumo ("Mostrando 26–50 de 218 placas", com o total já respeitando os filtros) e a troca de
 * página. A página vai para a URL, então voltar e recarregar devolvem à mesma página.
 */
export function Paginador({ pagina, paginas, total, tam, itens, padrao, campos }: Props) {
  const rota = usePathname();
  const parametros = useSearchParams();

  const primeiro = total === 0 ? 0 : (pagina - 1) * tam + 1;
  const ultimo = Math.min(pagina * tam, total);

  function href(destino: number): string {
    const novos = mudarConsulta(
      new URLSearchParams(parametros.toString()),
      { pagina: destino },
      padrao,
      campos,
    ).toString();
    return novos ? `${rota}?${novos}` : rota;
  }

  const botao =
    "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 grid size-9 place-items-center rounded-lg border outline-none focus-visible:ring-3";
  const desligado = "pointer-events-none opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p data-testid="resumo-da-pagina" className="text-muted-foreground tabular-nums">
        Mostrando {formatarInteiro(primeiro)}–{formatarInteiro(ultimo)} de {formatarInteiro(total)}{" "}
        {itens}
      </p>
      <nav aria-label="Páginas" className="flex items-center gap-2">
        <Link
          href={href(pagina - 1)}
          scroll={false}
          aria-label="Página anterior"
          aria-disabled={pagina <= 1}
          tabIndex={pagina <= 1 ? -1 : undefined}
          className={cn(botao, pagina <= 1 && desligado)}
        >
          <IconChevronLeft aria-hidden className="size-4" />
        </Link>
        <span className="text-muted-foreground min-w-24 text-center tabular-nums">
          Página {formatarInteiro(pagina)} de {formatarInteiro(paginas)}
        </span>
        <Link
          href={href(pagina + 1)}
          scroll={false}
          aria-label="Próxima página"
          aria-disabled={pagina >= paginas}
          tabIndex={pagina >= paginas ? -1 : undefined}
          className={cn(botao, pagina >= paginas && desligado)}
        >
          <IconChevronRight aria-hidden className="size-4" />
        </Link>
      </nav>
    </div>
  );
}
