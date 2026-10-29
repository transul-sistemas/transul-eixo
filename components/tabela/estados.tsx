/** Enquanto a página chega: linhas cinza do tamanho da tabela, para a tela não pular. */
export function EsqueletoDaTabela({ linhas = 10, rotulo }: { linhas?: number; rotulo: string }) {
  return (
    <div
      role="status"
      aria-label={rotulo}
      className="border-border bg-card overflow-hidden rounded-xl border"
    >
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
