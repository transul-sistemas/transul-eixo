"use client";

import {
  IconChevronDown,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconPin,
  IconPinFilled,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { acharFicha, acharTela, type ModuloDoCatalogo, type Tela } from "@/lib/navegacao/catalogo";
import { buscarTelas } from "@/lib/navegacao/busca";
import { ehAtalho, ehCampoDeTexto } from "@/lib/navegacao/atalhos";
import {
  ESTADO_INICIAL,
  type EstadoDaBarra,
  somarContadores,
} from "@/lib/navegacao/estado-da-barra";
import { gaveta, trocouDeTela } from "@/lib/navegacao/gaveta";
import { criarLoja } from "@/lib/navegacao/loja-da-barra";
import type { Perfil } from "@/lib/navegacao/perfis";
import { modulosVisiveis, podeAbrir } from "@/lib/navegacao/visibilidade";
import { cn } from "@/lib/utils";
import { variaveisDeCor } from "@/lib/visual/tons";
import { Logotipo } from "@/components/marca/logotipo";
import { IconeDoCatalogo } from "./icones";
import { LinkComContexto } from "./link-com-contexto";
import { useTelaGrande } from "./tela-grande";

export interface PropsDaBarra {
  perfil: Perfil;
  /** Quem usa a barra: a memória (grupos abertos, fixados, modo compacto) é de cada pessoa. */
  usuario: string;
  /** Contador por id de tela. O da tela sobe, somado, para o grupo do módulo. */
  contadores?: Readonly<Record<string, number>>;
  /** Nome acessível do menu. */
  rotulo?: string;
  /** Cópia para a página de demonstração: sem memória, sem atalho e sem ocupar a lateral. */
  incorporada?: boolean;
  /** Rota considerada atual (padrão: a da página). */
  rotaAtual?: string;
  estadoInicial?: Partial<Omit<EstadoDaBarra, "versao">>;
  /** Encerra a sessão (Server Action). Sem ela, o botão Sair não aparece (demonstração, testes). */
  aoSair?: () => Promise<void>;
  /** Quem entrou: nome e e-mail no rodapé, acima do Sair. */
  quem?: { nome: string; email: string | null };
}

function armazenamentoDoNavegador(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function estiloDaCor(cor: ModuloDoCatalogo["cor"]): CSSProperties {
  const { forte, suave } = variaveisDeCor(cor);
  return { "--tom-forte": `var(${forte})`, "--tom-suave": `var(${suave})` } as CSSProperties;
}

function Contador({ id, quantidade }: { id: string; quantidade: number }) {
  return (
    <span
      data-contador={id}
      role="img"
      aria-label={`${quantidade} itens`}
      className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs leading-5 font-medium tabular-nums"
    >
      {quantidade > 99 ? "99+" : quantidade}
    </span>
  );
}

interface ItemProps {
  modulo: ModuloDoCatalogo;
  tela: Tela;
  ativa: boolean;
  /** A página atual é a ficha de um item desta tela: a tela é a seção, não a página. */
  secao?: boolean;
  fixada: boolean;
  quantidade: number | undefined;
  aoFixar: () => void;
  aoNavegar?: () => void;
}

function ItemDaTela({
  modulo,
  tela,
  ativa,
  secao = false,
  fixada,
  quantidade,
  aoFixar,
  aoNavegar,
}: ItemProps) {
  const conteudo = (
    <>
      <IconeDoCatalogo nome={tela.icone} className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 leading-tight">{tela.nome}</span>
      {tela.estado === "em-breve" ? (
        <span className="text-muted-foreground text-xs">Em breve</span>
      ) : null}
      {quantidade ? <Contador id={tela.id} quantidade={quantidade} /> : null}
    </>
  );
  const classes = cn(
    "flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pr-9 pl-2 text-sm max-lg:py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
    ativa ? "bg-[var(--tom-suave)] font-medium" : "hover:bg-sidebar-accent",
  );
  return (
    <li style={estiloDaCor(modulo.cor)} className="group/item relative flex items-center">
      {tela.estado === "restrito" ? (
        <span aria-disabled="true" className={cn(classes, "opacity-50")}>
          {conteudo}
        </span>
      ) : (
        <LinkComContexto
          href={tela.rota}
          aria-current={ativa ? (secao ? "true" : "page") : undefined}
          onClick={aoNavegar}
          className={classes}
        >
          {conteudo}
        </LinkComContexto>
      )}
      <button
        type="button"
        aria-label={`Fixar ${tela.nome}`}
        aria-pressed={fixada}
        onClick={aoFixar}
        className={cn(
          "text-muted-foreground hover:bg-sidebar-accent focus-visible:ring-ring absolute right-1 grid size-7 place-items-center rounded-md outline-none focus-visible:opacity-100 focus-visible:ring-2",
          fixada
            ? "opacity-100"
            : "opacity-0 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        {fixada ? (
          <IconPinFilled aria-hidden className="size-4" />
        ) : (
          <IconPin aria-hidden className="size-4" />
        )}
      </button>
    </li>
  );
}

function estadoDePartida(
  parcial: PropsDaBarra["estadoInicial"],
  moduloAtual: string | undefined,
): EstadoDaBarra {
  const grupos = [...(parcial?.gruposAbertos ?? [])];
  if (moduloAtual && !grupos.includes(moduloAtual)) grupos.push(moduloAtual);
  return { ...ESTADO_INICIAL, ...parcial, versao: 1, gruposAbertos: grupos };
}

/**
 * Barra lateral do sistema: grupos recolhíveis por módulo, contadores que sobem ao grupo, busca
 * no menu, telas fixadas, modo compacto com painel flutuante e atalho Ctrl+B. Lê só o catálogo.
 */
export function BarraLateral({
  perfil,
  usuario,
  contadores = {},
  rotulo = "Menu principal",
  incorporada = false,
  rotaAtual,
  estadoInicial,
  aoSair,
  quem,
}: PropsDaBarra) {
  const caminhoDaPagina = usePathname();
  const caminho = (rotaAtual ?? caminhoDaPagina ?? "").split(/[?#]/)[0] ?? "";
  const telaDaPagina = acharTela(caminho);
  const fichaDaPagina = telaDaPagina ? undefined : acharFicha(caminho);
  const moduloAtual = (telaDaPagina ?? fichaDaPagina)?.modulo.id;

  const [loja] = useState(() =>
    criarLoja({
      usuario,
      armazenamento: incorporada ? null : armazenamentoDoNavegador(),
      inicial: estadoDePartida(estadoInicial, moduloAtual),
    }),
  );
  const estado = useSyncExternalStore(loja.assinar, loja.estadoNoCliente, loja.estadoNoServidor);
  const telaGrande = useTelaGrande();
  const gavetaAberta = useSyncExternalStore(gaveta.assinar, gaveta.estaAberta, () => false);
  // Abaixo de 1024 px o menu é uma gaveta; a cópia da demonstração nunca é.
  const emGaveta = !incorporada && gavetaAberta && !telaGrande;
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const eraGaveta = useRef(false);
  const [termo, setTermo] = useState("");
  const [painel, setPainel] = useState<string | null>(null);
  const ignorarFoco = useRef(false);
  // A cópia da demonstração convive com a barra real na mesma página: ids não podem se repetir.
  const prefixoDeId = incorporada ? "grupo-demonstracao" : "grupo";

  // Ao entrar numa tela, o grupo do módulo dela abre.
  useEffect(() => {
    if (moduloAtual) loja.despachar({ tipo: "abrirGrupo", id: moduloAtual });
  }, [loja, moduloAtual]);

  // Ctrl+B recolhe e expande, menos quando a pessoa está digitando.
  useEffect(() => {
    if (incorporada) return;
    function aoTeclar(evento: globalThis.KeyboardEvent) {
      if (!ehAtalho(evento, "b") || ehCampoDeTexto(evento.target)) return;
      evento.preventDefault();
      loja.despachar({ tipo: "alternarCompacta" });
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [incorporada, loja]);

  // A barra chega pelo streaming (a sessão é lida num Suspense): depois de os atalhos estarem ligados,
  // ela se marca como pronta (os efeitos rodam na ordem; os testes de tela esperam por esta marca).
  const raizDaBarra = useRef<HTMLElement>(null);
  useEffect(() => {
    raizDaBarra.current?.setAttribute("data-pronta", "");
  }, []);

  // A gaveta fecha ao mudar de tela e quando a tela cresce. A primeira montagem não é troca de tela:
  // a barra chega por streaming e não pode desfazer o toque em "Abrir menu" feito antes dela (3.9a).
  const caminhoAnterior = useRef(caminho);
  useEffect(() => {
    if (!incorporada && trocouDeTela(caminhoAnterior.current, caminho)) gaveta.fechar();
    caminhoAnterior.current = caminho;
  }, [caminho, incorporada]);
  useEffect(() => {
    if (!incorporada && telaGrande) gaveta.fechar();
  }, [telaGrande, incorporada]);

  // Aberta, a gaveta fecha com Esc e prende o foco nela; ao fechar, o foco volta ao Abrir menu.
  useEffect(() => {
    if (!emGaveta) return;
    function aoTeclar(evento: globalThis.KeyboardEvent) {
      if (evento.key === "Escape") gaveta.fechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [emGaveta]);
  useEffect(() => {
    if (emGaveta) {
      eraGaveta.current = true;
      botaoFechar.current?.focus();
    } else if (eraGaveta.current) {
      eraGaveta.current = false;
      // Se a gaveta fechou porque a tela cresceu, o Abrir menu está oculto e não recebe foco.
      const abrir = document.querySelector<HTMLElement>('[aria-controls="menu-principal"]');
      if (abrir && abrir.getClientRects().length > 0) abrir.focus();
    }
  }, [emGaveta]);

  const modulos = useMemo(() => modulosVisiveis(perfil), [perfil]);
  const somas = useMemo(() => somarContadores(contadores), [contadores]);
  // O modo compacto guardado vale só no computador: na gaveta o menu é sempre inteiro.
  const compacta = estado.compacta && (incorporada || telaGrande);
  const buscando = !compacta && termo.trim() !== "";
  const resultados = useMemo(
    () => (buscando ? buscarTelas(termo, perfil) : []),
    [buscando, termo, perfil],
  );

  const fixadas = estado.fixados.flatMap((id) => {
    for (const modulo of modulos) {
      const tela = modulo.telas.find((t) => t.id === id);
      if (tela) return [{ modulo, tela }];
    }
    return [];
  });

  const fixar = (id: string) => loja.despachar({ tipo: "alternarFixado", id });
  const limpar = () => setTermo("");

  function itemDe(modulo: ModuloDoCatalogo, tela: Tela, aoNavegar?: () => void) {
    return (
      <ItemDaTela
        key={tela.id}
        modulo={modulo}
        tela={tela}
        ativa={tela.rota === (telaDaPagina ?? fichaDaPagina)?.tela.rota}
        secao={fichaDaPagina !== undefined}
        fixada={estado.fixados.includes(tela.id)}
        quantidade={contadores[tela.id]}
        aoFixar={() => fixar(tela.id)}
        aoNavegar={aoNavegar}
      />
    );
  }

  function aoSairDoModulo(evento: FocusEvent<HTMLLIElement>) {
    if (!evento.currentTarget.contains(evento.relatedTarget)) setPainel(null);
  }

  function aoTeclarNoModulo(evento: KeyboardEvent<HTMLLIElement>) {
    if (evento.key !== "Escape" || painel === null) return;
    // Devolver o foco ao módulo dispara o onFocus do item, que reabriria o painel.
    ignorarFoco.current = true;
    setPainel(null);
    (evento.currentTarget.firstElementChild as HTMLElement | null)?.focus();
    ignorarFoco.current = false;
  }

  return (
    <>
      {emGaveta ? (
        <div
          aria-hidden
          onClick={() => gaveta.fechar()}
          className="bg-foreground/40 fixed inset-0 z-30 lg:hidden"
        />
      ) : null}
      <aside
        ref={raizDaBarra}
        id={incorporada ? undefined : "menu-principal"}
        data-barra={incorporada ? "demonstracao" : "principal"}
        data-usuario={incorporada ? undefined : usuario}
        data-gaveta={incorporada ? undefined : emGaveta ? "aberta" : "fechada"}
        data-compacta={compacta ? "true" : "false"}
        onClick={(evento) => {
          // Tocar numa tela em que já se está não muda a rota, então a gaveta fecha aqui.
          if (emGaveta && (evento.target as HTMLElement).closest("a")) gaveta.fechar();
        }}
        role={emGaveta ? "dialog" : undefined}
        aria-modal={emGaveta ? true : undefined}
        aria-label={emGaveta ? "Menu do sistema" : undefined}
        className={cn(
          "border-border bg-sidebar text-sidebar-foreground flex shrink-0 flex-col text-sm",
          incorporada
            ? "h-[34rem] rounded-xl border"
            : "group-has-[[data-modo-foco]]/casca:hidden max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-72 max-lg:max-w-[85vw] max-lg:border-r lg:sticky lg:top-0 lg:h-screen lg:border-r",
          !incorporada && !emGaveta && "max-lg:invisible",
          incorporada ? (compacta ? "w-20" : "w-72") : compacta ? "lg:w-20" : "lg:w-72",
        )}
      >
        <div
          className={cn("flex h-16 shrink-0 items-center", compacta ? "justify-center" : "px-3")}
        >
          <Logotipo recolhido={compacta} comAssinatura={false} />
          {incorporada ? null : (
            <button
              type="button"
              ref={botaoFechar}
              aria-label="Fechar menu"
              onClick={() => gaveta.fechar()}
              className="text-muted-foreground hover:bg-sidebar-accent focus-visible:ring-ring ml-auto grid size-10 place-items-center rounded-lg outline-none focus-visible:ring-2 lg:hidden"
            >
              <IconX aria-hidden className="size-5" />
            </button>
          )}
        </div>

        <nav
          aria-label={rotulo}
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2",
            compacta ? "overflow-visible" : "overflow-y-auto",
          )}
        >
          {!compacta && modulos.length > 0 ? (
            <div className="relative">
              <IconSearch
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4"
              />
              <input
                type="search"
                aria-label="Buscar no menu"
                placeholder="Buscar no menu"
                value={termo}
                onChange={(evento) => setTermo(evento.target.value)}
                className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-lg border pr-8 pl-8 text-sm outline-none focus-visible:ring-3 [&::-webkit-search-cancel-button]:hidden"
              />
              {termo ? (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={limpar}
                  className="text-muted-foreground hover:bg-sidebar-accent absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md"
                >
                  <IconX aria-hidden className="size-4" />
                </button>
              ) : null}
            </div>
          ) : null}

          {modulos.length === 0 ? (
            <p className="text-muted-foreground px-2 py-4">
              Nenhuma tela disponível para o seu perfil.
            </p>
          ) : buscando ? (
            resultados.length === 0 ? (
              <p className="text-muted-foreground px-2 py-4">
                Nenhuma tela encontrada. Tente outro nome.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {resultados.map((r) => (
                  <li key={r.rota} style={estiloDaCor(r.modulo.cor)}>
                    <LinkComContexto
                      href={r.rota}
                      onClick={limpar}
                      className="hover:bg-sidebar-accent focus-visible:ring-ring flex items-center gap-2 rounded-lg px-2 py-1.5 outline-none focus-visible:ring-2"
                    >
                      <IconeDoCatalogo nome={r.tela.icone} className="size-4 shrink-0" />
                      <span className="truncate">{r.rotulo}</span>
                    </LinkComContexto>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              {!compacta && fixadas.length > 0 ? (
                <section aria-label="Fixados" className="flex flex-col gap-0.5">
                  <h2 className="text-muted-foreground px-2 pb-0.5 text-xs">Fixados</h2>
                  <ul className="flex flex-col gap-0.5">
                    {fixadas.map(({ modulo, tela }) => itemDe(modulo, tela))}
                  </ul>
                </section>
              ) : null}

              <ul className="flex flex-col gap-0.5">
                {modulos.map((modulo) => {
                  const soma = somas[modulo.id];
                  const aberto = estado.gruposAbertos.includes(modulo.id);
                  const ativo = modulo.id === moduloAtual;
                  const primeiraAberta = modulo.telas.find((t) => podeAbrir(perfil, t))?.rota;

                  if (compacta) {
                    return (
                      <li
                        key={modulo.id}
                        style={estiloDaCor(modulo.cor)}
                        className="relative flex justify-center"
                        onMouseEnter={() => setPainel(modulo.id)}
                        onMouseLeave={() => setPainel(null)}
                        onFocus={() => !ignorarFoco.current && setPainel(modulo.id)}
                        onBlur={aoSairDoModulo}
                        onKeyDown={aoTeclarNoModulo}
                      >
                        <LinkComContexto
                          href={primeiraAberta ?? modulo.rota}
                          aria-label={soma ? `${modulo.nome}, ${soma} itens` : modulo.nome}
                          aria-current={ativo ? "true" : undefined}
                          className={cn(
                            "hover:bg-sidebar-accent focus-visible:ring-ring relative grid size-11 place-items-center rounded-lg outline-none focus-visible:ring-2",
                            ativo && "bg-[var(--tom-suave)]",
                          )}
                        >
                          <IconeDoCatalogo
                            nome={modulo.icone}
                            className="size-5 text-[var(--tom-forte)]"
                          />
                          {soma ? (
                            <span
                              aria-hidden
                              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--tom-forte)]"
                            />
                          ) : null}
                        </LinkComContexto>
                        {painel === modulo.id ? (
                          <div className="absolute top-0 left-full z-30 pl-2">
                            <div
                              role="group"
                              aria-label={`Telas de ${modulo.nome}`}
                              className="border-border bg-popover text-popover-foreground w-64 rounded-xl border p-2 shadow-md"
                            >
                              <p className="px-2 pb-1 font-medium">{modulo.nome}</p>
                              <ul className="flex flex-col gap-0.5">
                                {modulo.telas.map((tela) =>
                                  itemDe(modulo, tela, () => setPainel(null)),
                                )}
                              </ul>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  }

                  return (
                    <li key={modulo.id} style={estiloDaCor(modulo.cor)}>
                      <button
                        type="button"
                        aria-expanded={aberto}
                        aria-controls={aberto ? `${prefixoDeId}-${modulo.id}` : undefined}
                        onClick={() => loja.despachar({ tipo: "alternarGrupo", id: modulo.id })}
                        className={cn(
                          "hover:bg-sidebar-accent focus-visible:ring-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left outline-none focus-visible:ring-2 max-lg:py-2.5",
                          ativo ? "font-semibold" : "font-medium",
                        )}
                      >
                        <IconeDoCatalogo
                          nome={modulo.icone}
                          className="size-5 shrink-0 text-[var(--tom-forte)]"
                        />
                        <span className="flex-1">{modulo.nome}</span>
                        {soma ? <Contador id={modulo.id} quantidade={soma} /> : null}
                        <IconChevronDown
                          aria-hidden
                          className={cn(
                            "text-muted-foreground size-4 shrink-0",
                            aberto && "rotate-180",
                          )}
                        />
                      </button>
                      {aberto ? (
                        <ul
                          id={`${prefixoDeId}-${modulo.id}`}
                          className="border-border mt-0.5 ml-4 flex flex-col gap-0.5 border-l pl-2"
                        >
                          {modulo.telas.map((tela) => itemDe(modulo, tela))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>

        <div className={cn("border-border shrink-0 border-t p-2", !incorporada && "max-lg:hidden")}>
          <button
            type="button"
            aria-label={compacta ? "Expandir menu" : "Recolher menu"}
            aria-keyshortcuts="Control+B"
            title="Ctrl+B"
            onClick={() => loja.despachar({ tipo: "alternarCompacta" })}
            className={cn(
              "text-muted-foreground hover:bg-sidebar-accent focus-visible:ring-ring flex h-9 w-full items-center gap-2 rounded-lg px-2 outline-none focus-visible:ring-2",
              compacta && "justify-center",
            )}
          >
            {compacta ? (
              <IconLayoutSidebarLeftExpand aria-hidden className="size-5" />
            ) : (
              <IconLayoutSidebarLeftCollapse aria-hidden className="size-5" />
            )}
            {compacta ? null : (
              <>
                <span className="flex-1 text-left">Recolher menu</span>
                <kbd className="border-border rounded border px-1.5 text-xs">Ctrl+B</kbd>
              </>
            )}
          </button>
        </div>
        {/* O Sair mora aqui, não no topo (no 1366 e no celular ele fazia o topo quebrar linha), e
            aparece também na gaveta. */}
        {aoSair ? (
          <div data-rodape-sair="" className="border-border shrink-0 border-t p-2">
            {quem && !compacta ? (
              <div className="min-w-0 px-2 pt-1 pb-2">
                <p className="truncate font-medium">{quem.nome}</p>
                {quem.email ? (
                  <p className="text-muted-foreground truncate text-xs">{quem.email}</p>
                ) : null}
              </div>
            ) : null}
            <form action={aoSair}>
              <button
                type="submit"
                aria-label={compacta ? "Sair" : undefined}
                title={
                  compacta
                    ? quem
                      ? `Sair (${[quem.nome, quem.email].filter(Boolean).join(", ")})`
                      : "Sair"
                    : undefined
                }
                className={cn(
                  "text-muted-foreground hover:bg-sidebar-accent focus-visible:ring-ring flex h-9 w-full items-center gap-2 rounded-lg px-2 outline-none focus-visible:ring-2",
                  compacta && "justify-center",
                )}
              >
                <IconLogout aria-hidden className="size-5" />
                {compacta ? null : <span className="flex-1 text-left">Sair</span>}
              </button>
            </form>
          </div>
        ) : null}
      </aside>
    </>
  );
}
