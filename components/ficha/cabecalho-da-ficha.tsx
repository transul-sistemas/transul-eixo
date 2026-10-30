import type { ReactNode } from "react";

/**
 * O cabeçalho da ficha: o encaixe de voltar, a identidade (o único `h1`), a situação, o aviso
 * quando há (placa baixada) e as ações do momento. A raiz decide o que vai em cada encaixe.
 */
export function CabecalhoDaFicha({
  voltar,
  titulo,
  subtitulo,
  situacao,
  aviso,
  acoes,
}: {
  voltar: ReactNode;
  /** O conteúdo do `h1`: a identidade da raiz (a placa, o nome da pessoa). */
  titulo: ReactNode;
  subtitulo?: ReactNode;
  situacao: ReactNode;
  aviso?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div>{voltar}</div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
          {subtitulo ? <p className="text-muted-foreground">{subtitulo}</p> : null}
          <div className="flex flex-wrap items-center gap-2">{situacao}</div>
        </div>
        {acoes ? (
          <div role="group" aria-label="Ações" className="flex flex-wrap items-center gap-2">
            {acoes}
          </div>
        ) : null}
      </div>
      {aviso ? (
        <p
          data-aviso=""
          className="border-border bg-muted text-foreground rounded-lg border px-3 py-2 text-sm"
        >
          {aviso}
        </p>
      ) : null}
    </header>
  );
}
