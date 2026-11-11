"use client";

import { Dialog } from "@base-ui/react/dialog";
import { IconSearch } from "@tabler/icons-react";
import {
  type KeyboardEvent,
  type Ref,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import { acharTela } from "@/lib/navegacao/catalogo";
import { ehAtalho } from "@/lib/navegacao/atalhos";
import {
  achatar,
  type ContextoDaBusca,
  gravarRecentes,
  type GrupoDaBusca,
  type ItemDaBusca,
  lerRecentes,
  montarGrupos,
  mover,
  registrarRecente,
} from "@/lib/navegacao/busca-rapida";
import { anexarContexto } from "@/lib/navegacao/contexto";
import { lerEstado } from "@/lib/navegacao/estado-da-barra";
import type { Perfil } from "@/lib/navegacao/perfis";
import { cn } from "@/lib/utils";
import { variaveisDeCor } from "@/lib/visual/tons";
import { IconeDoCatalogo } from "./icones";

const AVISO_DA_ACAO_RESERVADA = "Esta ação chega com os assistentes (entrega 2D).";

function armazenamentoDoNavegador(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface PropsDoConteudo {
  termo: string;
  grupos: readonly GrupoDaBusca[];
  /** Posição da opção ativa na lista de todos os itens. */
  ativo: number;
  /** Id da lista; as opções são `<id>-opcao-<n>`. */
  idDaLista: string;
  /** Mensagem de estado, como a da ação que ainda não executa. */
  aviso?: string;
  aoMudarTermo: (texto: string) => void;
  aoTeclar: (evento: KeyboardEvent<HTMLInputElement>) => void;
  aoEscolher: (item: ItemDaBusca) => void;
  aoPassar: (indice: number) => void;
  refDoCampo?: Ref<HTMLInputElement>;
}

function Tecla({ children }: { children: string }) {
  return (
    <kbd className="border-border bg-background rounded border px-1.5 font-sans text-xs">
      {children}
    </kbd>
  );
}

/** A janela por dentro: campo de busca, lista com grupos e as teclas. Sem estado próprio. */
export function ConteudoDaBusca({
  termo,
  grupos,
  ativo,
  idDaLista,
  aviso,
  aoMudarTermo,
  aoTeclar,
  aoEscolher,
  aoPassar,
  refDoCampo,
}: PropsDoConteudo) {
  const itens = achatar(grupos);
  const temOpcoes = itens.length > 0;
  // Posição, na lista de todos os itens, do primeiro item de cada grupo.
  const inicios = grupos.map((_, g) =>
    grupos.slice(0, g).reduce((soma, anterior) => soma + anterior.itens.length, 0),
  );

  return (
    <div className="flex flex-col">
      <div className="border-border relative border-b">
        <IconSearch
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-3.5 left-4 size-5"
        />
        <input
          ref={refDoCampo}
          type="text"
          role="combobox"
          aria-label="Buscar tela, modo ou ação"
          aria-expanded={temOpcoes}
          aria-controls={idDaLista}
          aria-autocomplete="list"
          aria-activedescendant={
            temOpcoes && ativo >= 0 ? `${idDaLista}-opcao-${ativo}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
          placeholder="Buscar tela, modo ou ação"
          value={termo}
          onChange={(evento) => aoMudarTermo(evento.target.value)}
          onKeyDown={aoTeclar}
          className="h-12 w-full bg-transparent pr-4 pl-12 outline-none"
        />
      </div>

      <div
        role="listbox"
        id={idDaLista}
        aria-label="Resultados"
        className="max-h-[22rem] overflow-y-auto p-2"
      >
        {grupos.map((grupo, g) => (
          <div key={grupo.id} role="group" aria-label={grupo.titulo}>
            <p aria-hidden className="text-muted-foreground px-3 pt-2 pb-1 text-xs">
              {grupo.titulo}
            </p>
            {grupo.itens.map((item, i) => {
              const posicao = (inicios[g] ?? 0) + i;
              const { forte } = variaveisDeCor(item.cor);
              return (
                <div
                  key={item.id}
                  role="option"
                  id={`${idDaLista}-opcao-${posicao}`}
                  aria-selected={posicao === ativo}
                  aria-disabled={item.disponivel ? undefined : true}
                  onMouseMove={() => aoPassar(posicao)}
                  onClick={() => aoEscolher(item)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                    posicao === ativo && "bg-muted",
                    !item.disponivel && "cursor-default",
                  )}
                >
                  <IconeDoCatalogo nome={item.icone} className="size-4 shrink-0" />
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: `var(${forte})` }}
                  />
                  <span className="min-w-0 flex-1">{item.rotulo}</span>
                  {item.emBreve ? (
                    <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                      Em breve
                    </span>
                  ) : null}
                  {item.estrutura ? (
                    <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                      Estrutura
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}

        {!temOpcoes ? (
          <p role="status" className="text-muted-foreground px-3 py-8 text-center text-sm">
            {termo.trim() === ""
              ? "Digite o nome de uma tela, de um modo ou de uma ação."
              : "Nenhuma tela encontrada. Tente outro nome."}
          </p>
        ) : null}
      </div>

      {aviso ? (
        <p role="status" className="border-border border-t px-4 py-2 text-sm">
          {aviso}
        </p>
      ) : null}

      <div className="border-border text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs">
        <span className="flex items-center gap-1">
          <Tecla>↑</Tecla>
          <Tecla>↓</Tecla>
          escolher
        </span>
        <span className="flex items-center gap-1">
          <Tecla>Enter</Tecla>
          abrir
        </span>
        <span className="flex items-center gap-1">
          <Tecla>Esc</Tecla>
          fechar
        </span>
      </div>
    </div>
  );
}

export interface PropsDaBusca {
  perfil: Perfil;
  /** De quem são os fixados e os recentes. */
  usuario: string;
  /** Rota da página: toda tela visitada vira um item de Recentes. */
  rota: string;
  /** Parâmetros da URL: o contexto global acompanha a escolha. */
  parametros?: URLSearchParams;
  /** Chamado com a URL da tela escolhida. */
  aoNavegar?: (url: string) => void;
}

/**
 * Busca rápida: o botão do topo e a janela do Ctrl+K. Lê só o catálogo (telas, modos e ações
 * reservadas). As ações, como "Receber placa", aparecem em Ações como "Em breve" e só passam a
 * executar com os assistentes (entrega 2D).
 */
export function BuscaRapida({
  perfil,
  usuario,
  rota,
  parametros = new URLSearchParams(),
  aoNavegar,
}: PropsDaBusca) {
  const idDaLista = useId();
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [aviso, setAviso] = useState<string | undefined>(undefined);
  const [contexto, setContexto] = useState<ContextoDaBusca>({ fixados: [], recentes: [] });
  const campo = useRef<HTMLInputElement>(null);
  const lembrado = useRef<HTMLElement | null>(null);

  const grupos = montarGrupos(termo, perfil, contexto);
  const itens = achatar(grupos);
  const ativoEfetivo = itens.length === 0 ? -1 : Math.min(Math.max(ativo, 0), itens.length - 1);

  function abrir() {
    const foco = document.activeElement;
    lembrado.current = foco instanceof HTMLElement ? foco : null;
    const armazenamento = armazenamentoDoNavegador();
    setContexto({
      fixados: armazenamento ? lerEstado(usuario, armazenamento).fixados : [],
      recentes: armazenamento ? lerRecentes(usuario, armazenamento) : [],
      atual: acharTela(rota)?.tela.id,
    });
    setTermo("");
    setAtivo(0);
    setAviso(undefined);
    setAberta(true);
  }

  // Ctrl+K abre e fecha, até com o foco num campo de texto (é o atalho de busca do sistema).
  const aoAtalho = useEffectEvent((evento: globalThis.KeyboardEvent) => {
    if (!ehAtalho(evento, "k")) return;
    evento.preventDefault();
    if (aberta) setAberta(false);
    else abrir();
  });
  useEffect(() => {
    const ouvinte = (evento: globalThis.KeyboardEvent) => aoAtalho(evento);
    document.addEventListener("keydown", ouvinte);
    return () => document.removeEventListener("keydown", ouvinte);
  }, []);

  // Cada tela visitada entra nos Recentes.
  useEffect(() => {
    const achada = acharTela(rota);
    const armazenamento = armazenamentoDoNavegador();
    if (!achada || !armazenamento) return;
    gravarRecentes(
      usuario,
      registrarRecente(lerRecentes(usuario, armazenamento), achada.tela.id),
      armazenamento,
    );
  }, [rota, usuario]);

  // A opção ativa acompanha o teclado dentro da lista que rola.
  useEffect(() => {
    if (!aberta || ativoEfetivo < 0) return;
    document
      .getElementById(`${idDaLista}-opcao-${ativoEfetivo}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [aberta, ativoEfetivo, idDaLista]);

  function escolher(item: ItemDaBusca) {
    if (!item.disponivel || !item.rota) {
      setAviso(AVISO_DA_ACAO_RESERVADA);
      return;
    }
    setAberta(false);
    aoNavegar?.(anexarContexto(item.rota, parametros));
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.nativeEvent.isComposing) return;
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      setAtivo(mover(ativoEfetivo, itens.length, evento.key === "ArrowDown" ? 1 : -1));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      const item = itens[ativoEfetivo];
      if (item) escolher(item);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-keyshortcuts="Control+K"
        className="border-input bg-card text-muted-foreground hover:bg-muted focus-visible:ring-ring/50 flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
      >
        <IconSearch aria-hidden className="size-4" />
        <span className="max-sm:sr-only">Buscar</span>
        <kbd className="border-border rounded border px-1.5 font-sans text-xs">Ctrl+K</kbd>
      </button>

      <Dialog.Root open={aberta} onOpenChange={setAberta}>
        <Dialog.Portal>
          <Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-40" />
          <Dialog.Popup
            initialFocus={campo}
            finalFocus={lembrado}
            className="border-border bg-popover text-popover-foreground fixed top-[12vh] left-1/2 z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border shadow-lg outline-none"
          >
            <Dialog.Title className="sr-only">Busca rápida</Dialog.Title>
            <ConteudoDaBusca
              termo={termo}
              grupos={grupos}
              ativo={ativoEfetivo}
              idDaLista={idDaLista}
              aviso={aviso}
              aoMudarTermo={(texto) => {
                setTermo(texto);
                setAtivo(0);
                setAviso(undefined);
              }}
              aoTeclar={aoTeclar}
              aoEscolher={escolher}
              aoPassar={setAtivo}
              refDoCampo={campo}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
