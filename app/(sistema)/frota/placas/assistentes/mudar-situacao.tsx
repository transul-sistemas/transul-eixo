"use client";

import { type RefObject } from "react";
import { agoraEmSaoPaulo, formatarDataEHora } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { ConjuntoDaPlaca, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { esquemaMudarSituacao, siglasParaMudar } from "@/lib/dominio/esquemas/ficha-da-placa";
import { NOMES_DAS_SIGLAS } from "@/lib/dominio/status";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { mudarSituacaoAcao } from "../acoes";
import { resolvedorDoEsquema } from "./resolvedor-da-ficha";

// Mudar situação: registra um evento de status com data e hora, para a placa solta ou para o
// conjunto. As situações oferecidas são só as que a régua aceita para o tipo e para o contexto.

interface Valores {
  sigla: string;
  /** `aaaa-mm-ddThh:mm` (campo de data e hora do navegador). */
  quando: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "mudar-situacao",
  titulo: "Mudar situação",
  versaoDoEsquema: 1,
  passos: [
    { id: "situacao", titulo: "Situação e hora", campos: ["sigla", "quando"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function MudarSituacao({
  placa,
  conjunto,
  aoFechar,
  focoFinal,
}: {
  placa: PlacaGravada;
  conjunto: ConjuntoDaPlaca | null;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const emConjunto = conjunto !== null;
  const opcoes = siglasParaMudar(placa.tipo, emConjunto);
  const agora = () => agoraEmSaoPaulo(new Date());
  const entrada = (v: Valores) => ({ placa: placa.placa, sigla: v.sigla, quando: v.quando });
  const resolver = resolvedorDoEsquema<Valores>(
    // `agora` é lido a cada validação: a hora digitada não pode passar da hora de agora.
    {
      safeParse: (e) =>
        esquemaMudarSituacao({ tipo: placa.tipo, emConjunto, agora: agora() }).safeParse(e),
    },
    entrada,
  );
  const nome = (sigla: string) =>
    sigla in NOMES_DAS_SIGLAS
      ? `${sigla} · ${NOMES_DAS_SIGLAS[sigla as PlacaGravada["sigla"]]}`
      : "";
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ sigla: "", quando: agora() }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Mudar situação"
      mensagemConcluido="Situação mudada."
      aoConcluir={(valores, chaveDeEnvio) =>
        mudarSituacaoAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={(atual) => {
        const agoraDaPlaca = atual as PlacaGravada;
        return (
          <p>
            Agora a placa {agoraDaPlaca.placa} está em {nome(agoraDaPlaca.sigla)}.
          </p>
        );
      }}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Placa",
          linhas: [
            { rotulo: "Placa", valor: placa.placa },
            { rotulo: "Vale para", valor: emConjunto ? "O conjunto" : "A placa solta" },
            { rotulo: "Situação agora", valor: nome(placa.sigla) },
          ],
        },
        {
          titulo: "Mudança",
          linhas: [
            { rotulo: "Nova situação", valor: nome(v.sigla) },
            { rotulo: "Quando", valor: v.quando ? formatarDataEHora(v.quando) : "" },
          ],
        },
      ]}
      efeitos={(v) => [
        <>
          A placa passa de <b>{nome(placa.sigla)}</b> para <b>{nome(v.sigla) || "a escolher"}</b>.
        </>,
        v.quando
          ? `Um evento fica registrado na linha do tempo, em ${formatarDataEHora(v.quando)}.`
          : "Um evento fica registrado na linha do tempo, com a data e a hora que você informar.",
        emConjunto
          ? `A placa está no conjunto ${conjunto.nome ?? conjunto.cavalo}: só aparecem as situações que valem para um conjunto.`
          : "A placa está solta: só aparecem as situações que valem para uma placa sem conjunto.",
      ]}
      renderPasso={(_, form) => (
        <>
          <Campo rotulo="Nova situação" erro={form.formState.errors.sigla?.message}>
            {(p) => (
              <select {...p} {...form.register("sigla")} className={CLASSE_DO_CAMPO}>
                <option value="">Escolha…</option>
                {opcoes.map((sigla) => (
                  <option key={sigla} value={sigla}>
                    {nome(sigla)}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo
            rotulo="Data e hora"
            erro={form.formState.errors.quando?.message}
            ajuda="Quando a mudança aconteceu, no horário de São Paulo."
          >
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
