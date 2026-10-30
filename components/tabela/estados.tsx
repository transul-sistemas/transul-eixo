import { IconAlertCircle, IconSearchOff } from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Enquanto a página chega: linhas cinza do tamanho da tabela, para a tela não pular. */
export function EsqueletoDaTabela({ linhas = 10, rotulo }: { linhas?: number; rotulo: string }) {
  return (
    <div
      role="status"
      aria-label={rotulo}
      className="border-border bg-card overflow-hidden rounded-xl border"
    >
      <span className="sr-only">{rotulo}</span>
      <div className="border-border bg-muted/40 h-9 border-b" />
      {Array.from({ length: linhas }, (_, i) => (
        <div
          key={i}
          className="border-border flex h-10 items-center gap-4 border-b px-3 last:border-b-0"
        >
          <span className="bg-muted h-5 w-20 animate-pulse rounded" />
          <span className="bg-muted h-3 w-24 animate-pulse rounded" />
          <span className="bg-muted h-3 w-32 animate-pulse rounded" />
          <span className="bg-muted h-3 w-40 animate-pulse rounded max-md:hidden" />
          <span className="bg-muted ml-auto h-5 w-36 animate-pulse rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Lista sem linhas: diz por quê e, se há filtro, oferece limpar. Convida a agir, não só informa. */
export function ListaVazia({
  titulo,
  descricao,
  hrefLimpar,
}: {
  titulo: string;
  descricao: string;
  /** Com filtros ativos, o endereço da mesma tela sem eles. */
  hrefLimpar?: string;
}) {
  return (
    <div
      data-testid="lista-vazia"
      role="status"
      className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
    >
      <IconSearchOff aria-hidden className="text-muted-foreground size-8" />
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="text-muted-foreground max-w-[56ch] text-sm">{descricao}</p>
      {hrefLimpar ? (
        <Link
          href={hrefLimpar}
          className="border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
        >
          Limpar filtros
        </Link>
      ) : null}
    </div>
  );
}

/** Erro ao carregar: o que houve, como resolver e o botão para tentar de novo. */
export function ErroDeCarregamento({
  titulo,
  descricao,
  codigo,
  aoTentar,
  pendente = false,
}: {
  titulo: string;
  descricao: string;
  /** Código do erro (digest), para quem for dar suporte. */
  codigo?: string;
  aoTentar: () => void;
  pendente?: boolean;
}) {
  return (
    <div
      role="alert"
      className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
    >
      <IconAlertCircle aria-hidden className="text-texto-negativo size-8" />
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="text-muted-foreground max-w-[56ch] text-sm">{descricao}</p>
      <Button variant="outline" onClick={aoTentar} disabled={pendente}>
        Tentar de novo
      </Button>
      {codigo ? (
        <p className="text-muted-foreground text-xs">
          Código do erro: <span className="tabular-nums">{codigo}</span>
        </p>
      ) : null}
    </div>
  );
}
