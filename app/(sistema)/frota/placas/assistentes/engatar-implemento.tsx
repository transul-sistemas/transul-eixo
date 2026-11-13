"use client";

import { type RefObject } from "react";
import { Controller } from "react-hook-form";
import { agoraEmSaoPaulo, formatarDataEHora } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { ConjuntoDaPlaca, PlacaAEscolher, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { esquemaEngatarVarios } from "@/lib/dominio/esquemas/ficha-da-placa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { engatarImplementosAcao } from "../acoes";
import { resolvedorDoEsquema } from "./resolvedor-da-ficha";

// Engatar implementos: o cavalo recebe um ou vários implementos soltos, na ordem escolhida, a partir
// da primeira posição livre. Aberto pela ficha do cavalo ou pela aba Soltas da grade (o implemento da
// linha já vem marcado). O nome do conjunto muda sozinho (a nomenclatura calcula pela estrutura).

interface Valores {
  implementos: string[];
  quando: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "engatar-implemento",
  titulo: "Engatar implementos",
  versaoDoEsquema: 2,
  passos: [
    { id: "implementos", titulo: "Implementos", campos: ["implementos", "quando"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function EngatarImplemento({
  placa,
  conjunto,
  livres,
  marcado,
  aoFechar,
  focoFinal,
}: {
  /** O cavalo. */
  placa: PlacaGravada;
  conjunto: ConjuntoDaPlaca | null;
  livres: PlacaAEscolher[];
  /** O implemento que já vem marcado (a linha da aba Soltas). */
  marcado?: string | null;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const primeira = (conjunto?.implementos.length ?? 0) + 1;
  const agora = () => agoraEmSaoPaulo(new Date());
  const entrada = (v: Valores) => ({
    placa: placa.placa,
    implementos: v.implementos,
    primeiraPosicao: primeira,
    quando: v.quando,
  });
  const resolver = resolvedorDoEsquema<Valores>(
    { safeParse: (e) => esquemaEngatarVarios({ agora: agora() }).safeParse(e) },
    entrada,
    (path) => (path[0] === "implementos" || path[0] === "primeiraPosicao" ? ["implementos"] : path),
  );
  const nome = (p: string) => livres.find((l) => l.placa === p)?.nome ?? p;
  const iniciais = marcado && livres.some((l) => l.placa === marcado) ? [marcado] : [];
  const lista = (v: Valores) =>
    v.implementos.map((p, i) => `${formatarInteiro(primeira + i)}. ${nome(p)}`).join("; ");
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ implementos: iniciais, quando: agora() }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Engatar implementos"
      mensagemConcluido="Implementos engatados."
      aoConcluir={(valores, chaveDeEnvio) =>
        engatarImplementosAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={(atual) => (
        <p>
          A placa {(atual as PlacaGravada).placa} mudou desde que você a abriu. Feche e abra de
          novo.
        </p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Conjunto",
          linhas: [
            { rotulo: "Cavalo", valor: placa.placa },
            {
              rotulo: "Conjunto agora",
              valor: conjunto ? (conjunto.nome ?? "Sem nome definido") : "Sem implementos",
            },
          ],
        },
        {
          titulo: "Engate",
          linhas: [
            { rotulo: "Implementos (posição)", valor: lista(v) },
            { rotulo: "Quando", valor: v.quando ? formatarDataEHora(v.quando) : "" },
          ],
        },
      ]}
      efeitos={(v) => [
        <>
          <b>{v.implementos.join(", ") || "Os implementos escolhidos"}</b> passam a fazer parte do
          conjunto do cavalo <b>{placa.placa}</b>, na ordem marcada, a partir da posição{" "}
          {formatarInteiro(primeira)}.
        </>,
        "Cada implemento herda a operação e a atividade do cavalo e mantém o próprio CR.",
        "O nome do conjunto é calculado pela estrutura (unidades, dolly e eixos), nunca gravado na placa.",
        "Se um implemento for recusado (conjunto misto, implemento impedido), os seguintes não entram e a mensagem diz quantos entraram.",
      ]}
      renderPasso={(_, form) => (
        <>
          <Controller
            control={form.control}
            name="implementos"
            render={({ field }) => (
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="text-muted-foreground mb-1">
                  Implementos que entram (na ordem em que você marcar)
                </legend>
                {livres.length === 0 ? (
                  <p className="text-muted-foreground">
                    Nenhum implemento solto no momento. Desatrele um implemento de outro conjunto
                    para ele aparecer aqui.
                  </p>
                ) : (
                  <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                    {livres.map((l) => {
                      const ordem = field.value.indexOf(l.placa);
                      return (
                        <label key={l.placa} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={ordem >= 0}
                            onChange={(e) =>
                              field.onChange(
                                e.target.checked
                                  ? [...field.value, l.placa]
                                  : field.value.filter((p: string) => p !== l.placa),
                              )
                            }
                          />
                          <span>{l.nome}</span>
                          {ordem >= 0 ? (
                            <span className="text-muted-foreground text-xs">
                              posição {formatarInteiro(primeira + ordem)}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                )}
                <p role="alert" className="text-destructive min-h-4 text-xs">
                  {form.formState.errors.implementos?.message}
                </p>
              </fieldset>
            )}
          />
          <Campo rotulo="Data e hora" erro={form.formState.errors.quando?.message}>
            {(p) => (
              <input
                {...p}
                {...form.register("quando")}
                type="datetime-local"
                className={CLASSE_DO_CAMPO}
              />
            )}
          </Campo>
        </>
      )}
    />
  );
}
