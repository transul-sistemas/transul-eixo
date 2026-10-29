"use client";

import { Popover } from "@base-ui/react/popover";
import { IconArrowLeft, IconArrowRight, IconColumns3 } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";
import {
  alternarColuna,
  type DefinicaoDeColuna,
  idsVisiveisNaTela,
  moverColuna,
  ordemCompleta,
  SEM_ESCOLHA_DE_COLUNAS,
} from "@/lib/navegacao/colunas-da-tabela";
import { cn } from "@/lib/utils";
import { useLista } from "./pendencia-da-lista";

// Em tela larga (1700 px ou mais) o padrão mostra mais colunas; o seletor precisa saber em que
// largura a pessoa está para marcar o que ela de fato vê.
const CONSULTA_DE_TELA_LARGA = "(min-width: 1700px)";

function assinar(ouvinte: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA_DE_TELA_LARGA);
  consulta.addEventListener("change", ouvinte);
  return () => consulta.removeEventListener("change", ouvinte);
}

function useTelaLarga(): boolean {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA_DE_TELA_LARGA).matches,
    () => false,
  );
}

interface Props {
  definicoes: readonly DefinicaoDeColuna[];
  titulos: Record<string, string>;
}

/**
 * Menu "Colunas": liga e desliga colunas (a Placa é fixa) e muda a ordem por botões de mover, que
 * funcionam com teclado e toque. A escolha vai para o cookie e vale em qualquer largura de tela.
 */
export function SeletorDeColunas({ definicoes, titulos }: Props) {
  const lista = useLista();
  const larga = useTelaLarga();
  if (!lista) return null;

  const escolha = {
    colunas: lista.preferencias.colunas,
    ordemDasColunas: lista.preferencias.ordemDasColunas,
  };
  const visiveis = new Set(idsVisiveisNaTela(definicoes, escolha, larga));
  const ordem = ordemCompleta(definicoes, escolha);
  const porId = new Map(definicoes.map((d) => [d.id, d]));

  function aplicar(nova: typeof escolha) {
    lista?.atualizarPreferencias(nova);
  }

  const botaoDeMover =
    "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 grid size-7 place-items-center rounded-md outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-30";

  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn(
          "border-input bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3",
        )}
      >
        <IconColumns3 aria-hidden className="size-4" />
        Colunas
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" sideOffset={6} className="z-50">
          <Popover.Popup className="border-border bg-popover text-popover-foreground flex max-h-[70vh] w-80 flex-col gap-2 overflow-auto rounded-xl border p-3 shadow-lg outline-none">
            <Popover.Title className="text-sm font-semibold">Colunas</Popover.Title>
            <Popover.Description className="text-muted-foreground text-xs">
              Escolha o que aparece e a ordem. A escolha fica salva para você.
            </Popover.Description>
            <ul className="flex flex-col gap-0.5">
              {ordem.map((id) => {
                const definicao = porId.get(id) as DefinicaoDeColuna;
                const titulo = titulos[id] ?? id;
                const ligada = visiveis.has(id);
                const paraEsquerda = moverColuna(definicoes, escolha, id, -1, larga);
                const paraDireita = moverColuna(definicoes, escolha, id, 1, larga);
                return (
                  <li key={id} className="flex items-center gap-1">
                    <label className="hover:bg-muted flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={ligada}
                        disabled={definicao.fixa}
                        onChange={() => aplicar(alternarColuna(definicoes, escolha, id, larga))}
                        className="size-4"
                      />
                      {titulo}
                    </label>
                    {definicao.fixa || !ligada ? null : (
                      <>
                        <button
                          type="button"
                          aria-label={`Mover ${titulo} para a esquerda`}
                          disabled={paraEsquerda === escolha}
                          onClick={() => aplicar(paraEsquerda)}
                          className={botaoDeMover}
                        >
                          <IconArrowLeft aria-hidden className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Mover ${titulo} para a direita`}
                          disabled={paraDireita === escolha}
                          onClick={() => aplicar(paraDireita)}
                          className={botaoDeMover}
                        >
                          <IconArrowRight aria-hidden className="size-4" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => aplicar(SEM_ESCOLHA_DE_COLUNAS)}
              className="border-input hover:bg-muted focus-visible:ring-ring/50 mt-1 h-9 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
            >
              Restaurar padrão
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
