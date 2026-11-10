import Link from "next/link";
import { formatarInteiro } from "@/components/formato/numero";
import { SeletorDeTamanho } from "@/components/tabela/seletor-de-tamanho";
import { TAMANHOS_DE_PAGINA } from "@/lib/navegacao/preferencias-da-tabela";
import { cn } from "@/lib/utils";

// Os chips de filtro (com a contagem pronta do banco) e a paginação do Pátio e das Ordens: tudo por
// link, com o estado na URL.

const classeDoLink =
  "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

export function FiltrosDaLista<F extends string>({
  rotulo,
  filtros,
  nomes,
  contagens,
  atual,
  endereco,
}: {
  rotulo: string;
  filtros: readonly F[];
  nomes: Record<F, string>;
  contagens: Record<F, number>;
  atual: F;
  endereco: (filtro: F) => string;
}) {
  return (
    <nav aria-label={rotulo} className="flex flex-wrap gap-2">
      {filtros.map((f) => (
        <Link
          key={f}
          href={endereco(f)}
          aria-current={atual === f ? "page" : undefined}
          className={cn(
            classeDoLink,
            atual === f && "bg-primary text-primary-foreground hover:bg-primary",
          )}
        >
          {nomes[f]}
          <span className="tabular-nums">{formatarInteiro(contagens[f] ?? 0)}</span>
        </Link>
      ))}
    </nav>
  );
}

export function PaginasDaLista({
  rotulo,
  total,
  unidade,
  pagina,
  paginas,
  endereco,
  testId,
  tam,
  enderecoDoTamanho,
}: {
  rotulo: string;
  total: number;
  unidade: string;
  pagina: number;
  paginas: number;
  endereco: (pagina: number) => string;
  testId: string;
  /** Linhas por página (20, 50 ou 100), lembrado por pessoa no cookie único. */
  tam: number;
  /** O endereço da mesma visão com outro tamanho, na página 1. */
  enderecoDoTamanho: (tam: number) => string;
}) {
  return (
    <nav aria-label={rotulo} className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground" data-testid={testId}>
        {formatarInteiro(total)} {unidade} · página {formatarInteiro(pagina)} de{" "}
        {formatarInteiro(paginas)}
      </span>
      <SeletorDeTamanho
        tam={tam}
        enderecos={Object.fromEntries(TAMANHOS_DE_PAGINA.map((t) => [t, enderecoDoTamanho(t)]))}
      />
      {pagina > 1 ? (
        <Link className={classeDoLink} href={endereco(pagina - 1)}>
          Página anterior
        </Link>
      ) : null}
      {pagina < paginas ? (
        <Link className={classeDoLink} href={endereco(pagina + 1)}>
          Próxima página
        </Link>
      ) : null}
    </nav>
  );
}

/** Os parâmetros da busca, do jeito que o Next entrega, como URLSearchParams (o primeiro valor). */
export function paraParametros(
  bruto: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(bruto)) {
    const primeiro = Array.isArray(valor) ? valor[0] : valor;
    if (primeiro !== undefined) parametros.set(chave, primeiro);
  }
  return parametros;
}

export type ParametrosDaBusca = Promise<Record<string, string | string[] | undefined>>;
