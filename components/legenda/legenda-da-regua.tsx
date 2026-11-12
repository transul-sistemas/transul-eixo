"use client";

import { IconPrinter, IconSearch } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  filtrarLegenda,
  type GrupoMontado,
} from "@/lib/dominio/legenda";
import { SiglaDoStatus } from "./sigla-do-status";
import { TonsDeVerde } from "./tons-de-verde";

/** Os grupos da legenda, em cartões, com a sigla, o nome, o significado e a observação de cada uma. */
export function GruposDaLegenda({ grupos }: { grupos: readonly GrupoMontado[] }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-2">
      {grupos.map((g) => (
        <section
          key={g.id}
          aria-labelledby={`legenda-${g.id}`}
          data-grupo-da-legenda={g.id}
          className="border-border bg-card break-inside-avoid rounded-xl border px-4 py-3.5"
        >
          <h2 id={`legenda-${g.id}`} className="text-muted-foreground mb-1.5 text-sm font-semibold">
            {g.nome}
          </h2>
          <ul>
            {g.entradas.map((e) => (
              <li
                key={e.sigla}
                data-sigla-da-legenda={e.sigla}
                className="border-border flex items-baseline gap-2.5 border-t py-1.5 first:border-t-0"
              >
                <span className="w-14 shrink-0">
                  <SiglaDoStatus sigla={e.sigla} comSignificado={false} />
                </span>
                <span className="min-w-0 text-sm">
                  <span className="block font-semibold">{e.nome}</span>
                  <span className="text-muted-foreground block">{e.significado}</span>
                  {e.aviso ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">{e.aviso}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** A frase de "nada achado", com a saída: limpar a busca. */
export function SemResultadoNaLegenda({
  busca,
  aoLimpar,
}: {
  busca: string;
  aoLimpar: () => void;
}) {
  return (
    <div
      data-testid="legenda-vazia"
      role="status"
      className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
    >
      <p className="max-w-[56ch] text-sm">
        Nenhuma sigla ou palavra encontrada com “{busca}”. Tente o nome da situação, como “folga”.
      </p>
      <Button variant="outline" onClick={aoLimpar}>
        Limpar a busca
      </Button>
    </div>
  );
}

/**
 * A tela "Legenda e siglas": busca por sigla ou palavra (a busca fica na URL, `?busca=`), botão para
 * imprimir ou salvar em PDF, os tons de verde e os grupos da régua. `/` foca a busca; Esc a limpa.
 */
export function LegendaDaRegua({
  legenda,
  buscaInicial = "",
}: {
  legenda: readonly GrupoMontado[];
  buscaInicial?: string;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const campo = useRef<HTMLInputElement>(null);
  const grupos = filtrarLegenda(legenda, busca);
  const total = grupos.reduce((n, g) => n + g.entradas.length, 0);
  const totalGeral = legenda.reduce((n, g) => n + g.entradas.length, 0);

  // A busca vai para a URL sem empilhar histórico: recarregar ou compartilhar devolve a mesma vista.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (busca.trim()) url.searchParams.set("busca", busca);
    else url.searchParams.delete("busca");
    window.history.replaceState(window.history.state, "", url);
  }, [busca]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo?.matches("input, textarea, select, [contenteditable]");
      if (e.key === "/" && !digitando && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <div data-legenda-da-regua="" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Buscar sigla ou palavra</span>
          <span className="relative">
            <IconSearch
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            />
            <input
              ref={campo}
              type="search"
              value={busca}
              placeholder="ex.: ACe, folga"
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && busca) {
                  e.preventDefault();
                  setBusca("");
                }
              }}
              className="border-input bg-card focus-visible:ring-ring/50 h-9 w-60 max-w-full rounded-lg border pr-3 pl-8 outline-none focus-visible:ring-3"
            />
          </span>
        </label>
        <Button variant="outline" onClick={() => window.print()}>
          <IconPrinter aria-hidden className="size-4" />
          Imprimir ou salvar em PDF
        </Button>
        <p role="status" className="text-muted-foreground text-sm">
          {busca.trim() ? `${total} de ${totalGeral} siglas` : `${totalGeral} siglas`}
        </p>
      </div>

      <p className="border-border bg-card text-muted-foreground rounded-xl border px-4 py-2.5 text-sm">
        Esta legenda é gerada da régua de status: uma fonte só, nunca digitada à mão. Toda sigla tem
        nome, grupo e significado, e um teste falha se faltar algum. Também aparece ao passar o mouse
        ou tocar em qualquer sigla da grade.
      </p>

      {busca.trim() ? null : <TonsDeVerde />}

      {grupos.length === 0 ? (
        <SemResultadoNaLegenda busca={busca.trim()} aoLimpar={() => setBusca("")} />
      ) : (
        <GruposDaLegenda grupos={grupos} />
      )}
    </div>
  );
}
