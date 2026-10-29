"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MouseEvent } from "react";
import { formatarInteiro } from "@/components/formato/numero";
import { mudarConsulta, type PadraoDaTabela } from "@/lib/navegacao/tabela";
import { TAMANHOS_DE_PAGINA } from "@/lib/navegacao/preferencias-da-tabela";
import { cn } from "@/lib/utils";
import { useLista } from "./pendencia-da-lista";

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
 * O resumo ("Mostrando 26–50 de 218 placas", com o total já respeitando os filtros), o tamanho da
 * página (lembrado em cookie) e a troca de página. A página vai para a URL, então voltar e recarregar
 * devolvem à mesma página. Enquanto uma navegação está a caminho, os controles não aceitam clique.
 */
export function Paginador({ pagina, paginas, total, tam, itens, padrao, campos }: Props) {
  const rota = usePathname();
  const parametros = useSearchParams();
  const router = useRouter();
  const lista = useLista();
  const ocupado = lista?.pendente ?? false;

  const primeiro = total === 0 ? 0 : (pagina - 1) * tam + 1;
  const ultimo = Math.min(pagina * tam, total);

  function enderecoDe(novos: URLSearchParams): string {
    const texto = novos.toString();
    return texto ? `${rota}?${texto}` : rota;
  }

  function href(destino: number): string {
    return enderecoDe(
      mudarConsulta(
        new URLSearchParams(parametros.toString()),
        { pagina: destino },
        padrao,
        campos,
      ),
    );
  }

  function navegar(url: string) {
    const ir = () => router.push(url, { scroll: false });
    if (lista) lista.iniciar(ir);
    else ir();
  }

  function aoClicar(evento: MouseEvent<HTMLAnchorElement>, destino: string, habilitado: boolean) {
    // Desligado ou carregando: o clique não faz nada. Ctrl/Cmd/meio abrem em outra aba, como link.
    if (!habilitado || ocupado) {
      evento.preventDefault();
      return;
    }
    if (
      evento.metaKey ||
      evento.ctrlKey ||
      evento.shiftKey ||
      evento.altKey ||
      evento.button !== 0
    ) {
      return;
    }
    evento.preventDefault();
    navegar(destino);
  }

  function aoMudarTamanho(novo: number) {
    if (!lista || novo === tam) return;
    lista.atualizarPreferencias({ tam: novo as (typeof TAMANHOS_DE_PAGINA)[number] });
    // Mudar o tamanho volta à página 1; o novo tamanho passa a ser o padrão, então sai da URL.
    const novos = mudarConsulta(
      new URLSearchParams(parametros.toString()),
      { tam: novo },
      padrao,
      campos,
    );
    novos.delete("tam");
    navegar(enderecoDe(novos));
  }

  const opcoes = (TAMANHOS_DE_PAGINA as readonly number[]).includes(tam)
    ? [...TAMANHOS_DE_PAGINA]
    : [...TAMANHOS_DE_PAGINA, tam].sort((a, b) => a - b);

  const botao =
    "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 grid size-9 place-items-center rounded-lg border outline-none focus-visible:ring-3";
  const desligado = "pointer-events-none opacity-40";
  const temAnterior = pagina > 1;
  const temProxima = pagina < paginas;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p data-testid="resumo-da-pagina" className="text-muted-foreground tabular-nums">
        Mostrando {formatarInteiro(primeiro)}–{formatarInteiro(ultimo)} de {formatarInteiro(total)}{" "}
        {itens}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-muted-foreground flex items-center gap-2">
          Linhas por página
          <select
            value={tam}
            disabled={ocupado || !lista}
            onChange={(evento) => aoMudarTamanho(Number(evento.target.value))}
            className="border-input bg-card text-foreground focus-visible:ring-ring/50 h-9 rounded-lg border px-2 tabular-nums outline-none focus-visible:ring-3"
          >
            {opcoes.map((opcao) => (
              <option key={opcao} value={opcao}>
                {opcao}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Páginas" className="flex items-center gap-2">
          <Link
            href={href(pagina - 1)}
            scroll={false}
            aria-label="Página anterior"
            aria-disabled={!temAnterior || ocupado}
            tabIndex={!temAnterior ? -1 : undefined}
            onClick={(evento) => aoClicar(evento, href(pagina - 1), temAnterior)}
            className={cn(botao, (!temAnterior || ocupado) && desligado)}
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
            aria-disabled={!temProxima || ocupado}
            tabIndex={!temProxima ? -1 : undefined}
            onClick={(evento) => aoClicar(evento, href(pagina + 1), temProxima)}
            className={cn(botao, (!temProxima || ocupado) && desligado)}
          >
            <IconChevronRight aria-hidden className="size-4" />
          </Link>
        </nav>
      </div>
    </div>
  );
}
