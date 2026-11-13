"use client";

import Link from "next/link";
import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { formatarMes } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import type { PlacaDaCarteira } from "@/lib/dados/acompanhamento-tipos";
import {
  itensParaGravar,
  ordemDeAtencao,
  progressoDaCarteira,
  type Resposta,
  type RespostaDaPlaca,
  ROTULOS_DAS_RESPOSTAS,
} from "@/lib/dominio/confirmacao-da-carteira";
import { esquemaConfirmarCarteira } from "@/lib/dominio/esquemas/acompanhamento";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../placas/assistentes/erros-do-resolvedor";
import { confirmarCarteiraAcao } from "./acoes";

// Confirmar carteira em 3 passos (quadro 4 de docs/prototipos/soltas-envio-carteira-e-saude): Conferir as
// placas ("Está comigo", "Não é minha", "Corrigir"), Resolver o que não confere (o texto de cada uma) e
// Confirmar. Grava pela mesma nucleo.confirmar_carteira (tudo ou nada no banco).

interface Valores {
  itens: RespostaDaPlaca[];
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "confirmar-carteira",
  titulo: "Confirmar carteira",
  versaoDoEsquema: 2,
  passos: [
    { id: "placas", titulo: "Conferir as placas", campos: ["itens.resposta"] },
    { id: "resolver", titulo: "Resolver o que não confere", campos: ["itens"] },
    { id: "conferir", titulo: "Confirmar", campos: [] },
  ],
};

const RESPOSTAS: readonly Resposta[] = ["comigo", "nao-e-minha", "corrigir"];

function respostaInicial(p: PlacaDaCarteira): Resposta {
  if (p.confere === false) return p.observacao?.startsWith("Corrigir") ? "corrigir" : "nao-e-minha";
  return "comigo";
}

function notaInicial(p: PlacaDaCarteira): string {
  return (p.observacao ?? "").replace(/^(Não é minha|Corrigir): /, "");
}

function BarraDeProgresso({ itens }: { itens: readonly RespostaDaPlaca[] }) {
  const { confirmadas, total } = progressoDaCarteira(itens);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span data-testid="progresso-da-carteira">
        {formatarInteiro(confirmadas)} de {formatarInteiro(total)} confirmadas
      </span>
      <progress
        max={Math.max(total, 1)}
        value={confirmadas}
        aria-label="Placas confirmadas"
        className="accent-acao h-2 w-full"
      />
    </div>
  );
}

export function ConfirmarCarteira({
  mes,
  placas,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  mes: string;
  placas: PlacaDaCarteira[];
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaConfirmarCarteira.safeParse({ mes, itens: itensParaGravar(valores.itens) });
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<Valores>(
            r.error.issues.map((i) => ({
              // O texto que falta mora na nota da resposta.
              path: i.path.map((p) => (p === "observacao" ? "nota" : p)),
              message: i.message,
            })),
          ),
        };
  };
  const iniciais: RespostaDaPlaca[] = ordemDeAtencao(
    placas.map((p) => ({
      ativoId: p.ativoId,
      placa: p.placa,
      resposta: respostaInicial(p),
      nota: notaInicial(p),
    })),
  );
  const modeloDa = (placa: string) => placas.find((p) => p.placa === placa)?.modelo ?? "";
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ itens: iniciais }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={`${mes}-${placas.map((p) => p.placa).join("-")}`}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Confirmar carteira"
      mensagemConcluido="Carteira confirmada."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(valores, chaveDeEnvio) =>
        confirmarCarteiraAcao({
          chaveDeEnvio,
          dados: { mes, itens: itensParaGravar(valores.itens) },
        })
      }
      aoFechar={aoFechar}
      resumo={(v) => {
        const p = progressoDaCarteira(v.itens);
        return [
          {
            titulo: `Carteira de ${formatarMes(mes)}`,
            linhas: [
              { rotulo: "Placas", valor: formatarInteiro(p.total) },
              { rotulo: "Está comigo", valor: formatarInteiro(p.confirmadas) },
              { rotulo: "A resolver", valor: formatarInteiro(p.aResolver) },
            ],
          },
        ];
      }}
      efeitos={(v) => {
        const p = progressoDaCarteira(v.itens);
        return [
          <>
            {formatarInteiro(p.confirmadas)} placas ficam confirmadas com você em{" "}
            <b>{formatarMes(mes)}</b>: com este CR e esta operação, estavam sob a sua
            responsabilidade.
          </>,
          `${formatarInteiro(p.aResolver)} ficam marcadas como "não confere", com o texto que você escreveu, para o líder da operação tratar.`,
          "Quem já tinha resposta neste mês tem a resposta trocada pela nova.",
        ];
      }}
      renderPasso={(passo, form) => {
        const itens = form.watch("itens");
        if (passo.id === "placas") {
          return (
            <>
              <p className="text-muted-foreground text-sm">
                Confirmar diz que a placa, com este CR e esta operação, esteve com você no mês.
              </p>
              <BarraDeProgresso itens={itens} />
              <ul className="flex flex-col gap-2" aria-label="Placas a confirmar">
                {itens.map((item, i) => (
                  <li
                    key={item.ativoId}
                    data-resposta={item.resposta}
                    className="border-border data-[resposta=corrigir]:bg-status-atencao-suave data-[resposta=nao-e-minha]:bg-status-atencao-suave flex flex-col gap-2 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{item.placa}</span>
                      <span className="text-muted-foreground text-sm">{modeloDa(item.placa)}</span>
                    </div>
                    <div
                      role="radiogroup"
                      aria-label={`Resposta para ${item.placa}`}
                      className="flex flex-wrap gap-x-4 text-sm"
                    >
                      {RESPOSTAS.map((resposta) => (
                        <label key={resposta} className="flex min-h-9 items-center gap-2">
                          <input
                            type="radio"
                            className="size-4"
                            checked={item.resposta === resposta}
                            onChange={() =>
                              form.setValue(`itens.${i}.resposta`, resposta, {
                                shouldDirty: true,
                              })
                            }
                          />
                          {ROTULOS_DAS_RESPOSTAS[resposta]}
                        </label>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          );
        }
        const aResolver = itens
          .map((item, i) => ({ item, i }))
          .filter(({ item }) => item.resposta !== "comigo");
        if (aResolver.length === 0) {
          return (
            <p className="text-sm">
              Todas as placas estão com você. Nada a resolver: continue para confirmar.
            </p>
          );
        }
        return (
          <ul className="flex flex-col gap-3" aria-label="Placas a resolver">
            {aResolver.map(({ item, i }) => {
              const erro = form.formState.errors.itens?.[i]?.nota?.message;
              return (
                <li
                  key={item.ativoId}
                  className="border-border flex flex-col gap-2 rounded-lg border p-3"
                >
                  <label className="flex flex-col gap-1 text-sm">
                    <span>
                      {item.resposta === "corrigir"
                        ? `O que corrigir em ${item.placa}`
                        : `Por que ${item.placa} não é sua`}
                    </span>
                    <textarea
                      rows={2}
                      className="border-input bg-card rounded-lg border px-3 py-2"
                      aria-invalid={erro ? true : undefined}
                      {...form.register(`itens.${i}.nota`)}
                    />
                    <span role="alert" className="text-destructive min-h-4 text-xs">
                      {erro}
                    </span>
                  </label>
                  {item.resposta === "corrigir" ? (
                    <Link
                      href={`/frota/placas/${item.placa}?assistente=corrigir-placa`}
                      className="text-acao w-fit text-sm underline underline-offset-4"
                    >
                      Corrigir placa {item.placa}
                    </Link>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Vira pedido de correção para o líder da operação.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        );
      }}
    />
  );
}
