"use client";

import { Drawer } from "@base-ui/react/drawer";
import { IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Placa } from "@/components/placa";
import type { DadosDoPainel } from "@/lib/dados/placas-tipos";
import { anuncioDaTroca, vizinhas } from "@/lib/navegacao/espiar";
import { NavegacaoDoPainel } from "./navegacao-do-painel";
import { useLista } from "./pendencia-da-lista";
import { guardarRetornoDaLista } from "./retorno-da-lista-no-navegador";
import {
  BotaoDaFicha,
  ErroDoResumo,
  PlacaNaoEncontrada,
  ResumoCarregando,
  ResumoDaPlaca,
} from "./resumo-da-placa";
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

/**
 * Traz a linha para a área visível da tabela, só na vertical e sem tapar a linha com o cabeçalho
 * fixo. A rolagem lateral não é mexida (a coluna Placa é fixa e o foco nela não pede rolar).
 */
function trazerLinhaParaAVista(botao: HTMLElement) {
  const caixa = botao.closest<HTMLElement>('[role="region"]');
  const linha = botao.closest("tr");
  if (!caixa || !linha) return;
  const cabecalho = caixa.querySelector("thead")?.getBoundingClientRect().height ?? 0;
  const c = caixa.getBoundingClientRect();
  const l = linha.getBoundingClientRect();
  if (l.top < c.top + cabecalho) caixa.scrollTop -= c.top + cabecalho - l.top;
  else if (l.bottom > c.bottom) caixa.scrollTop += l.bottom - c.bottom;
  // A página também rola (o topo é fixo): se a linha ficou fora da janela, leva-a para dentro.
  const topoFixo = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  const a = linha.getBoundingClientRect();
  if (a.bottom > window.innerHeight) window.scrollBy(0, a.bottom - window.innerHeight);
  else if (a.top < topoFixo) window.scrollBy(0, a.top - topoFixo);
}

/** Devolve o foco: ao botão Espiar da última placa vista (trazendo a linha à vista); senão, à caixa da tabela, ao campo de busca ou ao conteúdo. */
function devolverFoco(placa: string | null) {
  const botao = placa
    ? document.querySelector<HTMLElement>(`[data-espiar-placa="${placa}"]`)
    : null;
  if (botao) {
    // Sem rolar: o foco voltando ao botão da coluna fixa levaria a tabela de volta à esquerda.
    botao.focus({ preventScroll: true });
    trazerLinhaParaAVista(botao);
    return;
  }
  // Sem linha nem caixa (lista vazia): o campo de busca, onde a pessoa corrige a consulta; por fim
  // o conteúdo da página. O foco nunca fica no body.
  const destino =
    document.querySelector<HTMLElement>('[role="region"][aria-label*="rolável"]') ??
    document.querySelector<HTMLElement>('[role="search"] input') ??
    document.querySelector<HTMLElement>("#conteudo");
  destino?.focus({ preventScroll: true });
}

/**
 * O painel de espiar: um Drawer modal do base-ui por cima da lista (foco preso, lista inerte,
 * rolagem da página travada). A placa vem da URL (`?espiar=`), com abertura otimista. Esc, o botão,
 * o clique no fundo e o gesto de arrastar fecham, e o foco volta à linha de origem.
 */
export function PainelDeEspiar({
  dados,
  placasDaPagina,
}: {
  dados: DadosDoPainel | null;
  /** As placas da página atual da lista, na ordem das linhas (anterior e próxima andam por elas). */
  placasDaPagina: readonly string[];
}) {
  const lista = useLista();
  const router = useRouter();
  const [tentando, tentarDeNovo] = useTransition();
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
  const [anuncio, setAnuncio] = useState("");
  // O painel pode fechar por fora (Voltar do navegador): o aviso da troca não vaza para a próxima abertura.
  if (placa === null && anuncio !== "") setAnuncio("");
  const [ultimos, setUltimos] = useState(dados);
  if (dados !== null && dados !== ultimos) setUltimos(dados);
  const popup = useRef<HTMLDivElement>(null);
  // Trocou de placa por um botão do resumo (o conjunto): o botão sumiu com o corpo e o foco cairia
  // no body. Leva o foco ao título. Anterior e próxima ficam fora do corpo e mantêm o foco.
  const placaAberta = placa !== null;
  useEffect(() => {
    const el = popup.current;
    if (!el || !placaAberta) return;
    if (!el.contains(document.activeElement)) titulo.current?.focus({ preventScroll: true });
  }, [placa, placaAberta]);
  if (!lista) return null;
  const placaDoPainel = placa ?? mostrada;

  // Troca dentro do painel (anterior, próxima, conjunto): replace, e o leitor de tela é avisado.
  const trocar = (nova: string) => {
    setAnuncio(anuncioDaTroca(nova, vizinhas(placasDaPagina, nova)));
    lista.trocarPlaca(nova);
  };

  // Os dados são da placa da URL, que chega depois do clique: enquanto a placa do painel e a dos
  // dados não coincidem, o painel mostra o esqueleto. Na saída guarda os últimos dados.
  // Dados velhos só valem durante a saída (placa nula): reabrir uma placa que deu erro não mostra o erro antigo.
  const doBase = dados ?? (placa === null ? ultimos : null);
  const doPainel = doBase?.placa === placaDoPainel ? doBase : null;

  return (
    <Drawer.Root
      open={placa !== null && (liberado || placa !== placaDoLink)}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setAnuncio("");
          lista.fecharPainel();
        }
      }}
      swipeDirection={celular ? "down" : "right"}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="bg-foreground/40 fixed inset-0 z-40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-stretch justify-end max-sm:items-end max-sm:justify-center">
          <Drawer.Popup
            ref={popup}
            aria-label={`Resumo da placa ${placaDoPainel ?? ""}`}
            initialFocus={titulo}
            finalFocus={() => {
              devolverFoco(placaDoPainel);
              return false;
            }}
            className="border-border bg-popover text-popover-foreground flex h-full w-[420px] max-w-full [transform:translateX(var(--drawer-swipe-movement-x,0px))] flex-col border-l shadow-xl transition-transform duration-200 outline-none data-ending-style:translate-x-full data-starting-style:translate-x-full motion-reduce:transition-none max-sm:h-[85dvh] max-sm:w-full max-sm:[transform:translateY(var(--drawer-swipe-movement-y,0px))] max-sm:rounded-t-2xl max-sm:border-t max-sm:border-l-0 max-sm:data-ending-style:translate-x-0 max-sm:data-ending-style:translate-y-full max-sm:data-starting-style:translate-x-0 max-sm:data-starting-style:translate-y-full"
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
                <span className="sr-only">{placaDoPainel}</span>
                {placaDoPainel ? (
                  <span aria-hidden>
                    <Placa placa={placaDoPainel} tamanho="g" />
                  </span>
                ) : null}
              </h2>
              <Drawer.Close
                aria-label="Fechar painel"
                className="hover:bg-muted focus-visible:ring-ring/50 grid size-10 shrink-0 place-items-center rounded-lg outline-none focus-visible:ring-3"
              >
                <IconX aria-hidden className="size-5" />
              </Drawer.Close>
            </div>
            <NavegacaoDoPainel
              vizinhas={vizinhas(placasDaPagina, placaDoPainel ?? "")}
              anuncio={anuncio}
              aoIr={trocar}
            />
            <div
              key={placaDoPainel}
              data-painel-corpo
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
            >
              {doPainel === null ? (
                <ResumoCarregando />
              ) : doPainel.situacao === "ok" ? (
                <ResumoDaPlaca detalhe={doPainel.detalhe} aoEspiar={trocar} />
              ) : doPainel.situacao === "nao-encontrada" ? (
                <PlacaNaoEncontrada placa={doPainel.placa} />
              ) : (
                <ErroDoResumo
                  pendente={tentando}
                  aoTentar={() => tentarDeNovo(() => router.refresh())}
                />
              )}
            </div>
            {doPainel?.situacao === "ok" ? (
              <BotaoDaFicha
                placa={doPainel.placa}
                aoAbrir={() => guardarRetornoDaLista(doPainel.placa)}
              />
            ) : null}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
