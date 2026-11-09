"use client";

import { type RefObject } from "react";
import { agoraEmSaoPaulo, formatarDataEHora } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO, GradeDeCampos } from "@/components/wizard/campos";
import type { ConjuntoDaPlaca, PlacaAEscolher, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { esquemaEngatar } from "@/lib/dominio/esquemas/ficha-da-placa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { engatarImplementoAcao } from "../acoes";
import { resolvedorDoEsquema } from "./resolvedor-da-ficha";

// Engatar implemento: o cavalo recebe um implemento solto, numa posição e num instante. O nome do
// conjunto muda sozinho (a nomenclatura calcula pela carroceria e pela configuração).

interface Valores {
  implemento: string;
  /** Texto do campo numérico; o número sai na entrada. */
  posicao: string;
  quando: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "engatar-implemento",
  titulo: "Engatar implemento",
  versaoDoEsquema: 1,
  passos: [
    { id: "implemento", titulo: "Implemento", campos: ["implemento", "posicao", "quando"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function EngatarImplemento({
  placa,
  conjunto,
  livres,
  aoFechar,
  focoFinal,
}: {
  /** O cavalo. */
  placa: PlacaGravada;
  conjunto: ConjuntoDaPlaca | null;
  livres: PlacaAEscolher[];
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const proxima = (conjunto?.implementos.length ?? 0) + 1;
  const agora = () => agoraEmSaoPaulo(new Date());
  const entrada = (v: Valores) => ({
    placa: placa.placa,
    implemento: v.implemento,
    posicao: v.posicao.trim() === "" ? undefined : Number(v.posicao),
    quando: v.quando,
  });
  const resolver = resolvedorDoEsquema<Valores>(
    { safeParse: (e) => esquemaEngatar({ agora: agora() }).safeParse(e) },
    entrada,
  );
  const nomeDoImplemento = (placaDoImplemento: string) =>
    livres.find((l) => l.placa === placaDoImplemento)?.nome ?? placaDoImplemento;
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ implemento: "", posicao: String(proxima), quando: agora() }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Engatar implemento"
      mensagemConcluido="Implemento engatado."
      aoConcluir={(valores, chaveDeEnvio) =>
        engatarImplementoAcao({ chaveDeEnvio, dados: entrada(valores) })
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
            { rotulo: "Implemento", valor: v.implemento ? nomeDoImplemento(v.implemento) : "" },
            { rotulo: "Posição", valor: v.posicao },
            { rotulo: "Quando", valor: v.quando ? formatarDataEHora(v.quando) : "" },
          ],
        },
      ]}
      efeitos={(v) => [
        <>
          <b>{v.implemento || "O implemento"}</b> passa a fazer parte do conjunto do cavalo{" "}
          <b>{placa.placa}</b>, na posição {v.posicao || "a escolher"}.
        </>,
        "O implemento herda a operação e a atividade do cavalo.",
        "O nome do conjunto é calculado pela nomenclatura (carroceria e configuração) e aparece na ficha.",
      ]}
      renderPasso={(_, form) => (
        <>
          <Campo
            rotulo="Implemento"
            erro={form.formState.errors.implemento?.message}
            ajuda={livres.length === 0 ? "Nenhum implemento solto no momento." : undefined}
          >
            {(p) => (
              <select {...p} {...form.register("implemento")} className={CLASSE_DO_CAMPO}>
                <option value="">Escolha…</option>
                {livres.map((l) => (
                  <option key={l.placa} value={l.placa}>
                    {l.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <GradeDeCampos>
            <Campo
              rotulo="Posição"
              erro={form.formState.errors.posicao?.message}
              ajuda="1 é o implemento mais perto do cavalo."
            >
              {(p) => (
                <input
                  {...p}
                  {...form.register("posicao")}
                  inputMode="numeric"
                  className={CLASSE_DO_CAMPO}
                />
              )}
            </Campo>
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
          </GradeDeCampos>
        </>
      )}
    />
  );
}
