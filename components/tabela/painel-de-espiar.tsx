"use client";

import { Drawer } from "@base-ui/react/drawer";
import { IconX } from "@tabler/icons-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { useLista } from "./pendencia-da-lista";
import { useHidratacaoPronta } from "./sinal-de-hidratacao";

// Abaixo de 640 px o painel é a folha de baixo (arrasta-se para baixo para fechar); a partir daí é
// o painel lateral de 420 px, à direita (arrasta-se para a direita).
const CONSULTA_DE_CELULAR = "(max-width: 639px)";

function assinar(ouvinte: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA_DE_CELULAR);
  consulta.addEventListener("change", ouvinte);
  return () => consulta.removeEventListener("change", ouvinte);
}

function useCelular(): boolean {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA_DE_CELULAR).matches,
    () => false,
  );
}

/** Para onde o foco volta ao fechar: o botão Espiar da placa; senão, a caixa rolável da tabela. */
function destinoDoFoco(placa: string | null): HTMLElement | null {
  const botao = placa
    ? document.querySelector<HTMLElement>(`[data-espiar-placa="${placa}"]`)
    : null;
  return botao ?? document.querySelector<HTMLElement>('[role="region"][aria-label*="rolável"]');
}

/**
 * O painel de espiar: um Drawer modal do base-ui por cima da lista (foco preso, lista inerte,
 * rolagem da página travada). A placa vem da URL (`?espiar=`), com abertura otimista. Esc, o botão,
 * o clique no fundo e o gesto de arrastar fecham, e o foco volta à linha de origem.
 */
export function PainelDeEspiar() {
  const lista = useLista();
  const celular = useCelular();
  const titulo = useRef<HTMLHeadingElement>(null);

  // Aberto desde a primeira renderização (link direto), o base-ui marcaria `aria-hidden` nos irmãos
  // antes de os trechos em Suspense (topo, barra de consulta, lista) hidratarem, e o React acusaria
  // diferença no HTML. O painel de link direto espera cada região avisar que hidratou. Abrir por
  // clique (outra placa que não a do link) é imediato e não espera.
  const pronta = useHidratacaoPronta();
  const [liberado, setLiberado] = useState(false);
  if (pronta && !liberado) setLiberado(true);
  const [placaDoLink] = useState(lista?.placaEspiada ?? null);

  // Durante a animação de saída a placa já é nula; guarda a última para o painel não se esvaziar.
  const placa = lista?.placaEspiada ?? null;
  const [mostrada, setMostrada] = useState<string | null>(placa);
  if (placa !== null && placa !== mostrada) setMostrada(placa);
  if (!lista) return null;
  const placaDoPainel = placa ?? mostrada;

  return (
    <Drawer.Root
      open={placa !== null && (liberado || placa !== placaDoLink)}
      onOpenChange={(aberto) => {
        if (!aberto) lista.fecharPainel();
      }}
      swipeDirection={celular ? "down" : "right"}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="bg-foreground/40 fixed inset-0 z-40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-stretch justify-end max-sm:items-end max-sm:justify-center">
          <Drawer.Popup
            aria-label={`Resumo da placa ${placaDoPainel ?? ""}`}
            initialFocus={titulo}
            finalFocus={() => {
              // Sem rolar: o foco voltando ao botão da coluna fixa levaria a tabela de volta à esquerda.
              destinoDoFoco(placaDoPainel)?.focus({ preventScroll: true });
              return false;
            }}
            className="border-border bg-popover text-popover-foreground flex h-full w-[420px] max-w-full [transform:translateX(var(--drawer-swipe-movement-x,0px))] flex-col border-l shadow-xl transition-transform duration-200 outline-none data-ending-style:translate-x-full data-starting-style:translate-x-full motion-reduce:transition-none max-sm:h-auto max-sm:max-h-[85dvh] max-sm:w-full max-sm:[transform:translateY(var(--drawer-swipe-movement-y,0px))] max-sm:rounded-t-2xl max-sm:border-t max-sm:border-l-0 max-sm:data-ending-style:translate-x-0 max-sm:data-ending-style:translate-y-full max-sm:data-starting-style:translate-x-0 max-sm:data-starting-style:translate-y-full"
          >
            <div
              aria-hidden
              className="bg-border mx-auto mt-2 h-1 w-10 shrink-0 rounded-full sm:hidden"
            />
            <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
              <h2
                ref={titulo}
                tabIndex={-1}
                className="text-lg font-semibold tracking-tight outline-none"
              >
                {placaDoPainel}
              </h2>
              <Drawer.Close
                aria-label="Fechar painel"
                className="hover:bg-muted focus-visible:ring-ring/50 grid size-10 shrink-0 place-items-center rounded-lg outline-none focus-visible:ring-3"
              >
                <IconX aria-hidden className="size-5" />
              </Drawer.Close>
            </div>
            <div
              data-painel-corpo
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
            >
              <p role="status" className="text-muted-foreground text-sm">
                Carregando o resumo…
              </p>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
