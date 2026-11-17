"use client";

import { Drawer } from "@base-ui/react/drawer";
import { Tooltip } from "@base-ui/react/tooltip";
import { IconEye, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { type ReactNode, useRef, useState } from "react";
import { type AbaDoDetalhe, AbasDoDetalhe } from "./abas-do-detalhe";

/** Uma linha do painel de detalhe: o rótulo e o valor (use os componentes de components/formato/). */
export interface DetalheDoItem {
  readonly rotulo: string;
  readonly valor: ReactNode;
}

interface Props {
  /** O nome do item da linha ("Operação Porto", "AAA0A00"): vai no aria-label e no tooltip. */
  readonly item: string;
  readonly detalhes: readonly DetalheDoItem[];
  /** Para onde "Abrir a ficha" leva; sem ele, o painel só mostra os detalhes. */
  readonly hrefDaFicha?: string;
  /** O que o painel mostra acima dos detalhes (um título mais longo, uma mini placa). */
  readonly titulo?: ReactNode;
  /**
   * Abas a mais (A3 do Acompanhamento: Financeiro, Motorista, Combustível, Rota do mês). Com elas, os
   * detalhes viram a primeira aba, "Visão geral". O painel continua só de leitura.
   */
  readonly abas?: readonly AbaDoDetalhe[];
}

/**
 * O olho: o ÚLTIMO botão de toda linha de tabela de dados (padrão de telas). Tooltip e aria-label
 * "Ver detalhes de <item>"; abre o painel lateral com os detalhes da linha. Esc ou o X fecham e o
 * foco volta ao olho.
 */
export function BotaoDoOlho({ item, detalhes, hrefDaFicha, titulo, abas }: Props) {
  const [aberto, setAberto] = useState(false);
  const nome = `Ver detalhes de ${item}`;
  const cabecalho = useRef<HTMLHeadingElement>(null);
  return (
    <>
      <Tooltip.Provider delay={300}>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                aria-label={nome}
                aria-haspopup="dialog"
                data-olho={item}
                onClick={() => setAberto(true)}
                className="focus-visible:ring-ring/50 text-muted-foreground hover:bg-muted hover:text-foreground inline-grid size-7 cursor-pointer place-items-center rounded outline-none focus-visible:ring-3"
              />
            }
          >
            <IconEye aria-hidden className="size-4" />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={6}>
              <Tooltip.Popup className="bg-popover text-popover-foreground border-border z-[60] rounded-md border px-2 py-1 text-sm shadow-md">
                {nome}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <Drawer.Root open={aberto} onOpenChange={setAberto} swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop className="bg-foreground/40 fixed inset-0 z-40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-stretch justify-end max-sm:items-end max-sm:justify-center">
            <Drawer.Popup
              aria-label={`Detalhes de ${item}`}
              initialFocus={cabecalho}
              className="border-border bg-popover text-popover-foreground flex h-full w-[420px] max-w-full flex-col border-l shadow-xl transition-transform duration-200 outline-none data-ending-style:translate-x-full data-starting-style:translate-x-full motion-reduce:transition-none max-sm:h-[85dvh] max-sm:w-full max-sm:rounded-t-2xl max-sm:border-t max-sm:border-l-0 max-sm:data-ending-style:translate-x-0 max-sm:data-ending-style:translate-y-full max-sm:data-starting-style:translate-x-0 max-sm:data-starting-style:translate-y-full"
            >
              <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
                <h2
                  ref={cabecalho}
                  tabIndex={-1}
                  className="text-lg font-semibold tracking-tight outline-none"
                >
                  {titulo ?? item}
                </h2>
                <Drawer.Close
                  aria-label="Fechar painel"
                  className="hover:bg-muted focus-visible:ring-ring/50 grid size-10 shrink-0 place-items-center rounded-lg outline-none focus-visible:ring-3"
                >
                  <IconX aria-hidden className="size-5" />
                </Drawer.Close>
              </div>
              {abas && abas.length > 0 ? (
                <AbasDoDetalhe
                  rotulo={`Detalhe de ${item}`}
                  abas={[
                    {
                      id: "visao-geral",
                      rotulo: "Visão geral",
                      conteudo: <ListaDeDetalhes detalhes={detalhes} />,
                    },
                    ...abas,
                  ]}
                />
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <ListaDeDetalhes detalhes={detalhes} />
                </div>
              )}
              {hrefDaFicha ? (
                <div className="border-border shrink-0 border-t p-4">
                  <Link
                    href={hrefDaFicha}
                    className="bg-primary text-primary-foreground focus-visible:ring-ring/50 inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium outline-none focus-visible:ring-3"
                  >
                    Abrir a ficha
                  </Link>
                </div>
              ) : null}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

function ListaDeDetalhes({ detalhes }: { detalhes: readonly DetalheDoItem[] }) {
  return (
    <dl className="flex flex-col gap-3">
      {detalhes.map((d) => (
        <div key={d.rotulo} className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground text-sm">{d.rotulo}</dt>
          <dd className="text-right tabular-nums">{d.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
