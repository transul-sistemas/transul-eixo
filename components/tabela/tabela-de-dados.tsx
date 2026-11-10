"use client";

import { IconArrowDown, IconArrowUp, IconArrowsSort } from "@tabler/icons-react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { type ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { cliqueAbreAPlaca } from "./clique-na-linha";
import { SinalDeHidratacao } from "./sinal-de-hidratacao";

/** Uma coluna da tabela: o título, o que ela mostra e (se houver) o campo de ordem no servidor. */
export interface ColunaDeTabela<T extends object> {
  id: string;
  titulo: string;
  /** Campo do parâmetro `ordem`; sem ele, o cabeçalho não ordena. */
  campoDeOrdem?: string;
  /** `densidade` deixa a célula se ajustar (a Placa usa a mini placa menor na compacta). */
  celula: (
    linha: T,
    contexto: {
      densidade: "compacta" | "confortavel";
      /** Abre o detalhe desta linha (existe só quando a tabela recebe `aoClicarNaLinha`). */
      aoAbrir?: () => void;
    },
  ) => ReactNode;
  /** Classes da coluna (alinhamento, largura). */
  classe?: string;
  /** A célula desta coluna é o cabeçalho da linha (`th scope="row"`): o nome do que a linha descreve. */
  cabecalhoDeLinha?: boolean;
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
  /** Atalho de mouse e de toque: clicar na linha abre o detalhe. O controle de verdade é a célula. */
  aoClicarNaLinha?: (linha: T) => void;
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
  aoClicarNaLinha,
}: Props<T>) {
  const definicoes = useMemo(() => {
    const ajudante = createColumnHelper<typeof funcoes, T>();
    return ajudante.columns(
      colunas.map((coluna) =>
        ajudante.display({
          id: coluna.id,
          header: coluna.titulo,
          cell: ({ row }) =>
            coluna.celula(row.original, {
              densidade,
              aoAbrir: aoClicarNaLinha ? () => aoClicarNaLinha(row.original) : undefined,
            }),
        }),
      ),
    );
  }, [colunas, densidade, aoClicarNaLinha]);

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
    <div
      role="region"
      aria-label={`${rotulo}, área rolável`}
      // Focável para rolar com o teclado. O teto de altura (a janela menos o topo) faz a tabela rolar por dentro, com
      // cabeçalho e primeira coluna fixos, e a página rolar até o paginador; no modo foco, que trava a altura
      // da página, `min-h-0` deixa a caixa encolher e ela ocupa o que sobra. Com poucas linhas acompanha o conteúdo.
      tabIndex={0}
      // O padding de rolagem evita que o foco do teclado pare atrás da coluna Placa e do cabeçalho fixos.
      className="border-border bg-card focus-visible:ring-ring/50 relative max-h-[max(24rem,calc(100dvh-20rem))] min-h-0 scroll-pt-12 scroll-pl-36 overflow-auto rounded-xl border outline-none group-has-[[data-modo-foco]]/casca:max-h-none focus-visible:ring-3"
    >
      <SinalDeHidratacao regiao="lista" />
      <table
        aria-label={rotulo}
        aria-busy={pendente}
        className={cn(
          "w-full border-separate border-spacing-0 text-sm transition-opacity",
          pendente && "opacity-60",
        )}
      >
        <thead>
          {tabela.getHeaderGroups().map((grupo) => (
            <tr key={grupo.id}>
              {grupo.headers.map((cabecalho, posicao) => {
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
                      // Cabeçalho fixo no topo da caixa; a primeira coluna, fixa à esquerda e por cima.
                      "text-muted-foreground bg-card border-border sticky top-0 border-b px-3 py-2 text-left text-xs font-medium whitespace-nowrap",
                      posicao === 0 ? "left-0 z-20 border-r" : "z-10",
                      coluna?.classe,
                    )}
                  >
                    {campo === undefined ? (
                      coluna?.titulo
                    ) : (
                      <button
                        type="button"
                        aria-disabled={pendente ? true : undefined}
                        onClick={() => {
                          if (!pendente) aoOrdenar(campo);
                        }}
                        className="hover:text-foreground focus-visible:ring-ring/50 -mx-1 inline-flex min-h-6 items-center gap-1 rounded px-1 outline-none focus-visible:ring-3 aria-disabled:cursor-wait aria-disabled:opacity-60"
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
            <tr
              key={linha.id}
              onClick={
                aoClicarNaLinha
                  ? (evento) => {
                      const abre = cliqueAbreAPlaca(
                        evento.target instanceof Element ? evento.target : null,
                        evento,
                        window.getSelection()?.toString() ?? "",
                      );
                      if (abre) aoClicarNaLinha(linha.original);
                    }
                  : undefined
              }
              className={cn("group/linha hover:bg-muted/50", aoClicarNaLinha && "cursor-pointer")}
            >
              {linha.getAllCells().map((celula, posicao) => {
                const ehCabecalho = porId.get(celula.column.id)?.cabecalhoDeLinha === true;
                const Celula = ehCabecalho ? "th" : "td";
                return (
                  <Celula
                    key={celula.id}
                    {...(ehCabecalho ? { scope: "row" } : {})}
                    className={cn(
                      "border-border border-b px-3 align-middle whitespace-nowrap group-last/linha:border-b-0",
                      ehCabecalho && "text-left font-normal",
                      posicao === 0 &&
                        "bg-card group-hover/linha:bg-muted sticky left-0 z-10 border-r",
                      densidade === "compacta" ? "py-1" : "py-2.5",
                      porId.get(celula.column.id)?.classe,
                    )}
                  >
                    <tabela.FlexRender cell={celula} />
                  </Celula>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
