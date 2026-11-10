"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { errosDoResolvedor } from "@/app/(sistema)/frota/placas/assistentes/erros-do-resolvedor";
import { formatarMes } from "@/components/formato/data";
import { formatarMoeda } from "@/components/formato/moeda-valor";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import {
  type LinhaDaConciliacao,
  NOMES_DAS_SITUACOES_DA_CONCILIACAO,
} from "@/lib/dados/parceiros-tipos";
import { esquemaJustificarDiferenca } from "@/lib/dominio/esquemas/parceiros";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { justificarDiferencaAcao } from "../acoes";

// Justificar diferença: o Eixo explica a diferença (ou a falta de lançamento) de um CR de acionista no
// mês. O fato importado do Sankhya não muda; a linha passa a "Justificada".

interface Valores {
  motivo: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "conciliacao-justificar",
  titulo: "Justificar diferença",
  versaoDoEsquema: 1,
  passos: [
    { id: "motivo", titulo: "Motivo", campos: ["motivo"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function JustificarDiferenca({
  linha,
  mes,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  linha: LinhaDaConciliacao;
  mes: string;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const entrada = (v: Valores) => ({ crId: linha.crId, mes, motivo: v.motivo ?? "" });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaJustificarDiferenca.safeParse(entrada(valores));
    const problemas = r.success ? [] : r.error.issues.filter((i) => i.path[0] === "motivo");
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ motivo: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={`${linha.crId}-${mes}`}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Justificar diferença"
      mensagemConcluido="Diferença justificada."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(valores, chaveDeEnvio) =>
        justificarDiferencaAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Linha da conciliação",
          linhas: [
            { rotulo: "Mês", valor: formatarMes(mes) },
            { rotulo: "CR", valor: linha.crCodigo },
            { rotulo: "Situação", valor: NOMES_DAS_SITUACOES_DA_CONCILIACAO[linha.situacao] },
            { rotulo: "Placas esperadas", valor: linha.placas.join(", ") || "nenhuma" },
            { rotulo: "Despesa lançada", valor: formatarMoeda(linha.despesaCentavos) },
            { rotulo: "Motivo", valor: v.motivo?.trim() || undefined },
          ],
        },
      ]}
      efeitos={() => [
        "A linha passa a Justificada neste mês, com o seu motivo.",
        "O lançamento do Sankhya continua igual: o Eixo só registra a explicação.",
      ]}
      renderPasso={(_, form) => (
        <Campo
          rotulo="Motivo da diferença"
          erro={form.formState.errors.motivo?.message}
          ajuda="Explique o que aconteceu, com 10 a 500 caracteres."
        >
          {(p) => (
            <textarea
              {...p}
              {...form.register("motivo")}
              rows={4}
              maxLength={500}
              className={`${CLASSE_DO_CAMPO} h-auto py-2`}
            />
          )}
        </Campo>
      )}
    />
  );
}
