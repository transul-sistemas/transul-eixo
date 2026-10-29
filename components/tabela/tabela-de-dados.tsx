"use client";

import { IconArrowDown, IconArrowUp, IconArrowsSort } from "@tabler/icons-react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { type ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";

/** Uma coluna da tabela: o título, o que ela mostra e (se houver) o campo de ordem no servidor. */
export interface ColunaDeTabela<T extends object> {
  id: string;
  titulo: string;
  /** Campo do parâmetro `ordem`; sem ele, o cabeçalho não ordena. */
  campoDeOrdem?: string;
  celula: (linha: T) => ReactNode;
  /** Classes da coluna (alinhamento, largura). */
  classe?: string;
}

export interface Ordem {
  campo: string;
  sentido: "asc" | "desc";
}

interface Props<T extends object> {
  /** Nome da tabela para leitor de tela (`aria-label`). */
  rotulo: string;
  colunas: readonly ColunaDeTabela<T>[];
  linhas: readonly T[];
  idDaLinha: (linha: T) => string;
  ordem: Ordem;
  aoOrdenar: (campo: string) => void;
  /** Uma nova página ou ordem está a caminho: a tabela atual fica um pouco apagada. */
  pendente?: boolean;
  densidade?: "compacta" | "confortavel";
}

// Só o núcleo: a ordem, o filtro e a página são do servidor (manual); o TanStack entra para
// montar colunas, cabeçalhos e linhas, e para a visibilidade e a ordem das colunas (Tarefa 9).
const funcoes = tableFeatures({});

export function TabelaDeDados<T extends object>({
  rotulo,
  colunas,
  linhas,
  idDaLinha,
  ordem,
  aoOrdenar,
  pendente = false,
  densidade = "compacta",
}: Props<T>) {
  const definicoes = useMemo(() => {
    const ajudante = createColumnHelper<typeof funcoes, T>();
    return ajudante.columns(
      colunas.map((coluna) =>
        ajudante.display({
          id: coluna.id,
          header: coluna.titulo,
          cell: ({ row }) => coluna.celula(row.original),
        }),
      ),
    );
  }, [colunas]);

  const tabela = useTable({
    features: funcoes,
    columns: definicoes,
    data: linhas as T[],
    getRowId: idDaLinha,
  });
  const porId = new Map(colunas.map((coluna) => [coluna.id, coluna]));

  return (
    // `relative`: o texto só para leitor de tela (sr-only) é posicionado em absoluto e, sem isso,
    // escaparia do contêiner e alargaria a página.
    <div className="border-border bg-card relative overflow-x-auto rounded-xl border">
      <table
        aria-label={rotulo}
        aria-busy={pendente}
        className={cn(
          "w-full border-collapse text-sm transition-opacity",
          pendente && "opacity-60",
        )}
      >
        <thead>
          {tabela.getHeaderGroups().map((grupo) => (
            <tr key={grupo.id} className="border-border border-b">
              {grupo.headers.map((cabecalho) => {
                const coluna = porId.get(cabecalho.column.id);
                const campo = coluna?.campoDeOrdem;
                const ativa = campo !== undefined && ordem.campo === campo;
                return (
                  <th
                    key={cabecalho.id}
                    scope="col"
                    aria-sort={
                      campo === undefined
                        ? undefined
                        : ativa
                          ? ordem.sentido === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                    }
                    className={cn(
                      "text-muted-foreground bg-card px-3 py-2 text-left text-xs font-medium whitespace-nowrap",
                      coluna?.classe,
                    )}
                  >
                    {campo === undefined ? (
                      coluna?.titulo
                    ) : (
                      <button
                        type="button"
                        onClick={() => aoOrdenar(campo)}
                        className="hover:text-foreground focus-visible:ring-ring/50 -mx-1 inline-flex items-center gap-1 rounded px-1 outline-none focus-visible:ring-3"
                      >
                        {coluna?.titulo}
                        {ativa ? (
                          ordem.sentido === "asc" ? (
                            <IconArrowUp aria-hidden className="size-3.5" />
                          ) : (
                            <IconArrowDown aria-hidden className="size-3.5" />
                          )
                        ) : (
                          <IconArrowsSort aria-hidden className="size-3.5 opacity-40" />
                        )}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {tabela.getRowModel().rows.map((linha) => (
            <tr key={linha.id} className="border-border hover:bg-muted/50 border-b last:border-b-0">
              {linha.getAllCells().map((celula) => (
                <td
                  key={celula.id}
                  className={cn(
                    "px-3 align-middle whitespace-nowrap",
                    densidade === "compacta" ? "py-1" : "py-2.5",
                    porId.get(celula.column.id)?.classe,
                  )}
                >
                  <tabela.FlexRender cell={celula} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
