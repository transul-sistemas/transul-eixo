"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
  useForm,
  type UseFormReturn,
  useWatch,
} from "react-hook-form";
import { agoraEmSaoPaulo } from "@/components/formato/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { novaChaveDeEnvio } from "@/lib/wizard/chave-de-envio";
import {
  indiceDoPrimeiroPassoComErro,
  type DefinicaoDeAssistente,
  type PassoDoAssistente,
  passoAnterior,
  passoSeguinte,
} from "@/lib/wizard/passos";
import {
  apagarRascunho,
  type ArmazemDeRascunho,
  chaveDoRascunho,
  guardarRascunho,
  lerRascunho,
} from "@/lib/wizard/rascunho";
import { erroDaAcao, type ErroDaAcao, type ResultadoDaAcao } from "@/lib/wizard/resultado";
import { PassosDoAssistente } from "./passos-do-assistente";
import { ResumoAoVivo, type SecaoDoResumo } from "./resumo-ao-vivo";

// O motor de interface dos assistentes (wizard): um modal de tela quase cheia (ou um painel lateral
// para o mini-wizard) com stepper, barra de progresso, resumo ao vivo, rascunho salvo, "fechar é
// fechar" e envio que não duplica. Não conhece nenhum assistente em particular: quem usa passa a
// definição, o resolvedor do Zod, o desenho dos campos de cada passo, o resumo e a gravação.

export interface PropsDoAssistente<V extends FieldValues> {
  definicao: DefinicaoDeAssistente;
  /** O mesmo esquema Zod que o servidor usa, no resolvedor do React Hook Form. */
  resolver: Resolver<V>;
  valoresIniciais: V;
  /** Valida o que veio do rascunho (nada guardado vale sem passar por aqui). */
  validarRascunho: (valores: unknown) => Partial<V> | null;
  /** De quem é o rascunho (provisório até haver login). */
  usuario: string;
  /** O registro que se edita, quando há (o rascunho é por registro); sem ele, é um cadastro novo. */
  registro?: string;
  /** Campos que nunca vão para o rascunho. */
  camposSensiveis?: readonly string[];
  /** Desenha os campos de um passo (o de conferir, sem campos, o motor desenha sozinho). */
  renderPasso: (passo: PassoDoAssistente, form: UseFormReturn<V>) => ReactNode;
  resumo: (valores: V) => SecaoDoResumo[];
  /**
   * O que vai acontecer ao gravar, em texto simples. Com ele o passo Conferir ganha duas colunas
   * ("Dados" e "O que vai acontecer"); sem ele, o resumo ocupa o passo sozinho.
   */
  efeitos?: (valores: V) => readonly ReactNode[];
  /** Verbo e objeto, o mesmo nome do começo ao fim: "Cadastrar item" e depois "Item cadastrado". */
  rotuloConcluir: string;
  mensagemConcluido: string;
  /** Grava. Recebe a chave de envio: o clique duplo e "Tentar de novo" mandam a mesma. */
  aoConcluir: (valores: V, chaveDeEnvio: string) => Promise<ResultadoDaAcao<unknown, unknown>>;
  /** O que mostrar do registro atual quando o servidor avisa que ele mudou. */
  descreverAtual?: (atual: unknown) => ReactNode;
  /** O que acrescentar à mensagem de um erro (por exemplo, o link para a ficha da placa que já existe). */
  descreverErro?: (erro: ErroDaAcao) => ReactNode;
  /** Chamado quando o assistente deve fechar de verdade (quem chamou tira o estado da URL). */
  aoFechar: () => void;
  /** Chamado com a linha gravada, antes de mostrar "concluído". */
  aoGravar?: (linha: unknown) => void;
  /** `lateral` é o mini-wizard: painel à direita (folha de baixo no celular), sem resumo ao lado. */
  variante?: "modal" | "lateral";
  /** Leva o foco de volta a quem abriu (padrão: o elemento que tinha o foco). */
  focoFinal?: React.RefObject<HTMLElement | null>;
  /** Guarda e retoma rascunho (padrão: sim). O mini-wizard não guarda: ele nunca vira rascunho do assistente de baixo. */
  rascunho?: boolean;
  /** Fecha sozinho depois de gravar, em vez de mostrar "concluído" (o mini-wizard devolve o campo preenchido). */
  fecharAoGravar?: boolean;
}

type Estado =
  | { tipo: "editando"; aviso?: string }
  | { tipo: "enviando" }
  | { tipo: "erro"; erro: ErroDaAcao }
  | { tipo: "conflito"; erro: ErroDaAcao }
  | { tipo: "concluido" };

function armazemDoNavegador(): ArmazemDeRascunho | null {
  try {
    return window.localStorage;
  } catch {
    return null; // modo privado ou bloqueado: o assistente funciona sem rascunho
  }
}

export function Assistente<V extends FieldValues>({
  definicao,
  resolver,
  valoresIniciais,
  validarRascunho,
  usuario,
  registro,
  camposSensiveis,
  renderPasso,
  resumo,
  efeitos,
  rotuloConcluir,
  mensagemConcluido,
  aoConcluir,
  descreverAtual,
  descreverErro,
  aoFechar,
  aoGravar,
  variante = "modal",
  focoFinal,
  rascunho: comRascunho = true,
  fecharAoGravar = false,
}: PropsDoAssistente<V>) {
  const { passos } = definicao;
  const ultimo = passos.length - 1;
  const lateral = variante === "lateral";
  const chaveDoRasc = chaveDoRascunho(usuario, definicao.id, registro);
  // O rascunho é lido uma vez, ao montar (o assistente só monta no navegador, depois da hidratação).
  const [rascunho] = useState(() =>
    comRascunho
      ? lerRascunho(armazemDoNavegador(), chaveDoRasc, {
          versaoDoEsquema: definicao.versaoDoEsquema,
          validar: validarRascunho,
        })
      : ({ tipo: "nenhum" } as const),
  );
  const passoInicial = rascunho.tipo === "rascunho" ? Math.min(rascunho.passo, ultimo) : 0;
  const form = useForm<V>({
    resolver,
    defaultValues: (rascunho.tipo === "rascunho"
      ? { ...valoresIniciais, ...rascunho.valores }
      : valoresIniciais) as DefaultValues<V>,
    mode: "onTouched",
  });
  const [passo, setPasso] = useState(passoInicial);
  const [maisAlto, setMaisAlto] = useState(passoInicial);
  const [estado, setEstado] = useState<Estado>({ tipo: "editando" });
  const [confirmando, setConfirmando] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [avisoDoRascunho, setAvisoDoRascunho] = useState<string | null>(
    rascunho.tipo === "descartado"
      ? rascunho.motivo === "versao"
        ? "O rascunho antigo foi descartado porque o formulário mudou desde então."
        : "O rascunho guardado estava danificado e foi descartado."
      : null,
  );
  const [retomado, setRetomado] = useState(rascunho.tipo === "rascunho");
  // A hora (HH:MM) do último rascunho guardado nesta abertura; o rodapé mostra "Rascunho salvo às …".
  const [salvoAs, setSalvoAs] = useState<string | null>(null);
  const chaveDeEnvio = useRef(novaChaveDeEnvio());
  const enviando = useRef(false);
  const descartado = useRef(false);
  const corpo = useRef<HTMLDivElement>(null);
  const valores = useWatch({ control: form.control }) as V;
  const sujo = form.formState.isDirty;
  const ultimosValores = useRef({ valores, passo, sujo });
  useEffect(() => {
    ultimosValores.current = { valores, passo, sujo };
  });

  // ---- rascunho: guarda a cada pausa de digitação e ao sair ----
  const guardar = useCallback(() => {
    if (descartado.current || !comRascunho) return;
    const { valores: v, passo: p, sujo: s } = ultimosValores.current;
    if (!s) return;
    const r = guardarRascunho(armazemDoNavegador(), chaveDoRasc, {
      versaoDoEsquema: definicao.versaoDoEsquema,
      passo: p,
      valores: v as Record<string, unknown>,
      camposSensiveis,
    });
    if (r === "indisponivel") {
      setAvisoDoRascunho("Não foi possível salvar o rascunho neste navegador.");
    } else {
      setSalvoAs(agoraEmSaoPaulo(new Date()).slice(11, 16));
    }
  }, [chaveDoRasc, definicao.versaoDoEsquema, camposSensiveis, comRascunho]);

  useEffect(() => {
    if (!sujo || estado.tipo === "concluido") return;
    const espera = setTimeout(guardar, 400);
    return () => clearTimeout(espera);
  }, [valores, passo, sujo, estado.tipo, guardar]);

  // Ao fechar por fora (Voltar do navegador), o que está na tela já fica guardado.
  useEffect(() => {
    return () => {
      if (!enviando.current) guardar();
    };
  }, [guardar]);

  // ---- passos ----
  const descartarRascunho = useCallback(() => {
    descartado.current = true;
    if (comRascunho) apagarRascunho(armazemDoNavegador(), chaveDoRasc);
  }, [chaveDoRasc, comRascunho]);

  const irPara = useCallback((alvo: number) => {
    setPasso(alvo);
    setMaisAlto((m) => Math.max(m, alvo));
  }, []);

  const avancar = useCallback(async () => {
    const campos = (passos[passo]?.campos ?? []) as Path<V>[];
    const ok = campos.length === 0 ? true : await form.trigger(campos, { shouldFocus: true });
    if (ok) irPara(passoSeguinte(passo, passos.length));
  }, [form, irPara, passo, passos]);

  const aoIrPeloStepper = useCallback(
    async (alvo: number) => {
      if (alvo <= passo) return setPasso(alvo);
      const campos = passos.slice(passo, alvo).flatMap((p) => p.campos) as Path<V>[];
      if (campos.length === 0 || (await form.trigger(campos, { shouldFocus: true }))) irPara(alvo);
    },
    [form, irPara, passo, passos],
  );

  // Ao abrir, o foco vai ao primeiro campo (um quadro depois do foco padrão do base-ui, que cairia no
  // botão de fechar). Não se usa a propriedade `initialFocus`: com ela, o assistente de baixo
  // reaplica o foco e rouba o do mini-wizard aberto por cima.
  useEffect(() => {
    const quadro = requestAnimationFrame(() =>
      corpo.current
        ?.querySelector<HTMLElement>("input, select, textarea, [role='combobox']")
        ?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(quadro);
  }, []);

  // O foco acompanha a troca de passo (não na primeira abertura): o primeiro campo do passo novo.
  const primeiraVez = useRef(true);
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    corpo.current
      ?.querySelector<HTMLElement>("input, select, textarea, [role='combobox']")
      ?.focus({ preventScroll: true });
  }, [passo]);

  // ---- envio ----
  const concluir = useCallback(async () => {
    if (enviando.current) return; // clique duplo e Enter repetido: um envio só
    enviando.current = true;
    setEstado({ tipo: "enviando" });
    const ok = await form.trigger();
    if (!ok) {
      enviando.current = false;
      setEstado({ tipo: "editando" });
      const alvo = indiceDoPrimeiroPassoComErro(passos, Object.keys(form.formState.errors));
      if (alvo !== null) setPasso(alvo);
      return;
    }
    let resultado: ResultadoDaAcao<unknown, unknown>;
    try {
      resultado = await aoConcluir(form.getValues(), chaveDeEnvio.current);
    } catch {
      resultado = erroDaAcao("falha");
    }
    enviando.current = false;
    if (resultado.ok) {
      descartarRascunho();
      aoGravar?.(resultado.linha);
      if (fecharAoGravar) return aoFechar();
      setEstado({ tipo: "concluido" });
      return;
    }
    const { erro } = resultado;
    if (erro.codigo === "conflito") return setEstado({ tipo: "conflito", erro });
    if (erro.codigo === "entrada_invalida" && erro.campos) {
      for (const [campo, mensagens] of Object.entries(erro.campos)) {
        form.setError(campo as Path<V>, { type: "servidor", message: mensagens[0] });
      }
      const alvo = indiceDoPrimeiroPassoComErro(passos, Object.keys(erro.campos));
      if (alvo !== null) setPasso(alvo);
      return setEstado({ tipo: "editando", aviso: erro.mensagem });
    }
    setEstado({ tipo: "erro", erro });
  }, [aoConcluir, aoFechar, aoGravar, descartarRascunho, fecharAoGravar, form, passos]);

  // ---- fechar é fechar ----
  const pedirParaFechar = useCallback(() => {
    if (enviando.current) return; // espera o envio terminar: o resultado não se perde
    if (estado.tipo === "concluido" || !form.formState.isDirty) {
      aoFechar(); // sem mudanças desde que abriu: o rascunho que já existia continua guardado
      return;
    }
    setConfirmando(true);
  }, [aoFechar, estado.tipo, form.formState.isDirty]);

  function aoTeclar(evento: KeyboardEvent<HTMLFormElement>) {
    if (evento.key !== "Enter" || evento.shiftKey || evento.nativeEvent.isComposing) return;
    const alvo = evento.target as HTMLElement;
    if (["TEXTAREA", "BUTTON", "SELECT", "A"].includes(alvo.tagName)) return;
    if (alvo.getAttribute("role") === "combobox") return;
    evento.preventDefault();
    if (passo < ultimo) void avancar();
    else void concluir();
  }

  const passoAtual = passos[passo] as PassoDoAssistente;
  const ehConferir = passoAtual.campos.length === 0;
  const secoes = resumo(valores);
  const listaDeEfeitos = efeitos ? efeitos(valores) : null;
  const conferirEmColunas = ehConferir && listaDeEfeitos !== null;
  const ocupado = estado.tipo === "enviando";

  return (
    <Dialog.Root
      open
      onOpenChange={(aberto) => {
        if (!aberto) pedirParaFechar();
      }}
      modal
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-foreground/40 fixed inset-0 z-50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup
          finalFocus={focoFinal}
          data-assistente={definicao.id}
          data-variante={variante}
          // As teclas do mini-wizard (Enter, por exemplo) não sobem para o assistente de baixo,
          // que está acima dele na árvore do React (o portal não separa os eventos).
          onKeyDown={lateral ? (evento) => evento.stopPropagation() : undefined}
          className={cn(
            "bg-background fixed z-50 flex flex-col overflow-hidden shadow-lg outline-none",
            lateral
              ? "inset-y-0 right-0 w-[28rem] max-w-full border-l max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:rounded-t-xl max-sm:border-t"
              : // Abaixo de 1024 px: tela cheia. Daí em diante: painel centralizado de até 1040 px e 90% da altura.
                "inset-2 rounded-xl border sm:inset-4 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:h-[min(90dvh,820px)] lg:w-[min(1040px,calc(100vw-3rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl",
          )}
        >
          <div className="border-border flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Dialog.Title className="text-lg font-semibold">{definicao.titulo}</Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-sm">
                {passoAtual.titulo}. Esc fecha e Enter continua.
              </Dialog.Description>
            </div>
            <button
              type="button"
              aria-label="Fechar assistente"
              aria-disabled={ocupado ? true : undefined}
              onClick={pedirParaFechar}
              className="border-input bg-card hover:bg-muted focus-visible:ring-ring/50 grid size-9 shrink-0 place-items-center rounded-lg border outline-none focus-visible:ring-3 max-sm:size-11"
            >
              <IconX aria-hidden className="size-4" />
            </button>
          </div>

          {estado.tipo === "concluido" ? (
            <div className="flex flex-1 flex-col items-start justify-center gap-4 px-4 py-8 sm:px-6">
              <p role="status" data-testid="assistente-concluido" className="text-lg font-semibold">
                {mensagemConcluido}
              </p>
              <Button autoFocus onClick={() => aoFechar()}>
                Fechar
              </Button>
            </div>
          ) : (
            <>
              <div className="border-border border-b px-4 py-3 sm:px-6">
                <PassosDoAssistente
                  passos={passos}
                  atual={passo}
                  maisAlto={maisAlto}
                  aoIr={(i) => void aoIrPeloStepper(i)}
                />
              </div>

              {retomado || avisoDoRascunho ? (
                <div
                  role="status"
                  className="bg-muted/60 text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-6"
                >
                  <span data-testid="aviso-do-rascunho">
                    {avisoDoRascunho ?? "Você voltou ao rascunho que tinha salvo."}
                  </span>
                  {retomado ? (
                    <button
                      type="button"
                      onClick={() => {
                        descartarRascunho();
                        descartado.current = false;
                        form.reset(valoresIniciais as DefaultValues<V>);
                        setPasso(0);
                        setMaisAlto(0);
                        setRetomado(false);
                      }}
                      className="text-foreground underline underline-offset-4"
                    >
                      Começar de novo
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div
                className={cn(
                  "grid min-h-0 flex-1 overflow-y-auto",
                  !lateral && !ehConferir && "lg:grid-cols-[minmax(0,1fr)_300px]",
                )}
              >
                <form
                  noValidate
                  onSubmit={(e) => e.preventDefault()}
                  onKeyDown={aoTeclar}
                  className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-6"
                >
                  {/* `key` por passo: sem ele o React reaproveita o mesmo campo entre passos e mistura os valores.
                      A coluna de leitura fica centralizada (até 620 px; no Conferir em duas colunas, até 860 px). */}
                  <div
                    key={passoAtual.id}
                    ref={corpo}
                    data-testid="coluna-de-leitura"
                    className={cn(
                      "flex w-full flex-col gap-4",
                      !lateral && "mx-auto",
                      conferirEmColunas ? "max-w-[860px]" : lateral ? "max-w-xl" : "max-w-[620px]",
                    )}
                  >
                    <h3 className="text-base font-semibold">
                      {conferirEmColunas ? "Conferir e gravar" : passoAtual.titulo}
                    </h3>
                    {conferirEmColunas ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <ResumoAoVivo secoes={secoes} modo="conferir" />
                        <section
                          aria-label="O que vai acontecer"
                          className="border-border bg-muted/50 flex flex-col gap-3 rounded-xl border p-4"
                        >
                          <h4 className="text-muted-foreground text-sm font-semibold">
                            O que vai acontecer
                          </h4>
                          <ul className="flex flex-col gap-2.5 text-sm">
                            {listaDeEfeitos.map((efeito, i) => (
                              <li key={i} className="flex gap-2.5">
                                <span
                                  aria-hidden
                                  className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--acao)]"
                                />
                                <span>{efeito}</span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      </div>
                    ) : ehConferir ? (
                      <ResumoAoVivo secoes={secoes} />
                    ) : (
                      renderPasso(passoAtual, form)
                    )}
                  </div>
                </form>
                {!lateral && !ehConferir ? (
                  <div className="hidden lg:block">
                    <ResumoAoVivo secoes={secoes} modo="coluna" />
                  </div>
                ) : null}
              </div>

              {!lateral && !ehConferir ? (
                <div className="border-border border-t px-4 py-2 sm:px-6 lg:hidden">
                  <button
                    type="button"
                    aria-expanded={resumoAberto}
                    aria-controls="resumo-da-gaveta"
                    onClick={() => setResumoAberto((a) => !a)}
                    className="text-sm underline underline-offset-4"
                  >
                    {resumoAberto ? "Esconder resumo" : "Ver resumo"}
                  </button>
                  <div
                    id="resumo-da-gaveta"
                    hidden={!resumoAberto}
                    className="mt-2 max-h-[40dvh] overflow-y-auto"
                  >
                    {resumoAberto ? <ResumoAoVivo secoes={secoes} /> : null}
                  </div>
                </div>
              ) : null}

              <div className="border-border flex flex-col gap-2 border-t px-4 py-3 sm:px-6">
                {estado.tipo === "editando" && estado.aviso ? (
                  <p role="alert" className="text-sm">
                    {estado.aviso}
                  </p>
                ) : null}
                {estado.tipo === "enviando" ? (
                  <p role="status" className="text-muted-foreground text-sm">
                    Enviando…
                  </p>
                ) : null}
                {estado.tipo === "erro" ? (
                  <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
                    <span>{estado.erro.mensagem}</span>
                    {descreverErro?.(estado.erro)}
                    {estado.erro.codigo === "falha" ? (
                      <Button variant="outline" onClick={() => void concluir()}>
                        Tentar de novo
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {estado.tipo === "conflito" ? (
                  <div role="alert" className="flex flex-col gap-2 text-sm">
                    <span>{estado.erro.mensagem}</span>
                    {descreverAtual && estado.erro.atual !== undefined ? (
                      <div className="bg-muted rounded-lg p-3">
                        {descreverAtual(estado.erro.atual)}
                      </div>
                    ) : null}
                    <div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          chaveDeEnvio.current = novaChaveDeEnvio();
                          setEstado({ tipo: "editando" });
                        }}
                      >
                        Revisar com os dados atuais
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  {comRascunho && salvoAs ? (
                    <span
                      data-testid="rascunho-salvo"
                      className="text-muted-foreground mr-auto text-sm max-sm:text-xs max-sm:leading-tight"
                    >
                      Rascunho salvo às {salvoAs}
                    </span>
                  ) : (
                    <span className="mr-auto" />
                  )}
                  <Button
                    variant="outline"
                    className="aria-disabled:cursor-default aria-disabled:opacity-50 max-sm:h-11 max-sm:px-4 lg:h-10 lg:px-4.5"
                    aria-disabled={passo === 0 || ocupado ? true : undefined}
                    onClick={() => {
                      if (passo === 0 || ocupado) return;
                      setPasso(passoAnterior(passo));
                    }}
                  >
                    Voltar
                  </Button>
                  {passo < ultimo ? (
                    <Button
                      className="aria-disabled:cursor-default aria-disabled:opacity-50 max-sm:h-11 max-sm:px-4 lg:h-10 lg:px-5.5"
                      aria-disabled={ocupado ? true : undefined}
                      onClick={() => {
                        if (!ocupado) void avancar();
                      }}
                    >
                      Continuar
                    </Button>
                  ) : (
                    <Button
                      className="aria-disabled:cursor-default aria-disabled:opacity-50 max-sm:h-11 max-sm:px-4 lg:h-10 lg:px-5.5"
                      aria-disabled={ocupado ? true : undefined}
                      onClick={() => void concluir()}
                    >
                      {ocupado ? "Enviando…" : rotuloConcluir}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>

      <AlertDialog.Root open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="bg-foreground/40 fixed inset-0 z-[70]" />
          <AlertDialog.Popup className="bg-background border-border fixed top-1/2 left-1/2 z-[70] flex w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border p-5 shadow-lg outline-none">
            <AlertDialog.Title className="text-base font-semibold">
              Descartar o rascunho de {definicao.titulo}?
            </AlertDialog.Title>
            <AlertDialog.Description className="text-muted-foreground text-sm">
              Você já preencheu campos. Salve o rascunho para continuar depois, ou descarte para
              apagar o que foi digitado.
            </AlertDialog.Description>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  descartarRascunho();
                  setConfirmando(false);
                  aoFechar();
                }}
              >
                Descartar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  guardar();
                  setConfirmando(false);
                  aoFechar();
                }}
              >
                Salvar rascunho e sair
              </Button>
              <Button autoFocus onClick={() => setConfirmando(false)}>
                Continuar editando
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Dialog.Root>
  );
}
