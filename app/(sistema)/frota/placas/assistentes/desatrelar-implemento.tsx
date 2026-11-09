"use client";

import { type RefObject } from "react";
import { Controller } from "react-hook-form";
import { agoraEmSaoPaulo, formatarDataEHora } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { ConjuntoDaPlaca, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { esquemaDesatrelar } from "@/lib/dominio/esquemas/ficha-da-placa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { desatrelarImplementoAcao } from "../acoes";
import { resolvedorDoEsquema } from "./resolvedor-da-ficha";

// Desatrelar implemento: um, vários ou todos os implementos saem do cavalo e voltam ao pátio.

interface Valores {
  implementos: string[];
  quando: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "desatrelar-implemento",
  titulo: "Desatrelar implemento",
  versaoDoEsquema: 1,
  passos: [
    { id: "implementos", titulo: "O que sai", campos: ["implementos", "quando"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function DesatrelarImplemento({
  placa,
  conjunto,
  aoFechar,
  focoFinal,
}: {
  /** O cavalo. */
  placa: PlacaGravada;
  conjunto: ConjuntoDaPlaca;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const agora = () => agoraEmSaoPaulo(new Date());
  const entrada = (v: Valores) => ({
    placa: placa.placa,
    implementos: v.implementos,
    quando: v.quando,
  });
  const resolver = resolvedorDoEsquema<Valores>(
    { safeParse: (e) => esquemaDesatrelar({ agora: agora() }).safeParse(e) },
    entrada,
    (path) => (path[0] === "implementos" ? ["implementos"] : path),
  );
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ implementos: [], quando: agora() }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Desatrelar implemento"
      mensagemConcluido="Implemento desatrelado."
      aoConcluir={(valores, chaveDeEnvio) =>
        desatrelarImplementoAcao({ chaveDeEnvio, dados: entrada(valores) })
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
            { rotulo: "Conjunto agora", valor: conjunto.nome ?? "Sem nome definido" },
          ],
        },
        {
          titulo: "Desengate",
          linhas: [
            { rotulo: "Sai do conjunto", valor: v.implementos.join(", ") },
            { rotulo: "Quando", valor: v.quando ? formatarDataEHora(v.quando) : "" },
          ],
        },
      ]}
      efeitos={(v) => [
        <>
          <b>{v.implementos.join(", ") || "Os implementos escolhidos"}</b> saem do conjunto do
          cavalo <b>{placa.placa}</b>.
        </>,
        "Cada implemento que sai volta ao pátio (PÁT), se não tiver outra situação.",
        v.implementos.length === conjunto.implementos.length && v.implementos.length > 0
          ? "O cavalo fica sozinho: se a situação dele exige conjunto, mude a situação antes."
          : "O nome do conjunto é recalculado pela nomenclatura.",
      ]}
      renderPasso={(_, form) => (
        <>
          <Controller
            control={form.control}
            name="implementos"
            render={({ field }) => (
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="text-muted-foreground mb-1">Implementos que saem</legend>
                {conjunto.implementos.map((implemento) => (
                  <label key={implemento} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.value.includes(implemento)}
                      onChange={(e) =>
                        field.onChange(
                          e.target.checked
                            ? [...field.value, implemento]
                            : field.value.filter((p: string) => p !== implemento),
                        )
                      }
                    />
                    {implemento}
                  </label>
                ))}
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
