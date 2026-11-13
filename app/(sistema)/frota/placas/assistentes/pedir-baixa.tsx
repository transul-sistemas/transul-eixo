"use client";

import { type RefObject, useState } from "react";
import type { Resolver } from "react-hook-form";
import { formatarData, hojeEmSaoPaulo } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import { CarregarParaAbrir } from "@/components/wizard/carregar-para-abrir";
import type { ImpactoDaBaixa } from "@/lib/dados/baixa-tipos";
import type { VinculosDaPlaca } from "@/lib/dados/vinculos-da-placa-tipos";
import {
  esquemaPedirBaixa,
  MOTIVOS_DA_BAIXA,
  NOMES_DOS_MOTIVOS_DA_BAIXA,
} from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { impactoDaBaixaAcao, pedirBaixaAcao, vinculosDaPlacaAcao } from "../acoes-de-vinculo";
import { errosDoResolvedor } from "./erros-do-resolvedor";

// Pedir baixa (S4, quadro soltas-envio-carteira-e-saude/5): o gestor pede; a Diretoria aprova (quatro
// olhos: quem pede não aprova), com prazo de 5 dias. Enquanto não aprova, a placa segue ativa e marcada
// "baixa pedida". Comprador e valor ficam no documento, nunca no sistema. Passos: Motivo, Documento,
// Conferir (com o impacto: CRs que encerram, operação que deixa de contar a placa).

interface Valores {
  motivo: (typeof MOTIVOS_DA_BAIXA)[number] | "";
  dia: string;
  justificativa: string;
  documento: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "pedir-baixa",
  titulo: "Pedir baixa",
  versaoDoEsquema: 1,
  passos: [
    { id: "motivo", titulo: "Motivo", campos: ["motivo", "dia", "justificativa"] },
    { id: "documento", titulo: "Documento", campos: ["documento"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

function PedirBaixaDaPlaca({
  dados,
  aoFechar,
  focoFinal,
}: {
  dados: VinculosDaPlaca;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const [impacto, setImpacto] = useState<ImpactoDaBaixa | null>(null);
  const entrada = (v: Valores) => ({
    ativoId: dados.ativoId,
    motivo: v.motivo,
    dia: v.dia,
    justificativa: v.justificativa,
    documento: v.documento.trim() === "" ? null : v.documento.trim(),
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaPedirBaixa.safeParse(entrada(valores));
    if (r.success && valores.dia) {
      // O impacto vem do banco, com a data escolhida: entra no Conferir.
      void impactoDaBaixaAcao({ ativoId: dados.ativoId, dia: valores.dia }).then((i) =>
        setImpacto(i.ok ? i.linha : null),
      );
    }
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<Valores>(
            r.error.issues.map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{
        motivo: "",
        dia: hojeEmSaoPaulo(new Date()),
        justificativa: "",
        documento: "",
      }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={dados.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Pedir baixa"
      mensagemConcluido="Baixa pedida. A Diretoria decide em até 5 dias; até lá a placa segue ativa."
      aoConcluir={(v, chaveDeEnvio) => pedirBaixaAcao({ chaveDeEnvio, dados: entrada(v) })}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: `Baixa de ${dados.placa}`,
          linhas: [
            { rotulo: "Motivo", valor: v.motivo ? NOMES_DOS_MOTIVOS_DA_BAIXA[v.motivo] : "" },
            { rotulo: "Data", valor: v.dia ? formatarData(v.dia) : "" },
            { rotulo: "Documento", valor: v.documento || "Sem anexo" },
          ],
        },
      ]}
      efeitos={() => [
        "A Diretoria recebe o pedido para aprovar ou recusar; quem pede não aprova.",
        'Até a aprovação, a placa fica ativa e marcada "baixa pedida".',
        impacto === null
          ? "Ao aprovar, a situação vai a VND ou SUC na data e os vínculos de CR encerram nela."
          : impacto.crs_que_encerram.length > 0
            ? `Ao aprovar, encerram os CRs ${impacto.crs_que_encerram.map((c) => c.codigo).join(", ")}${impacto.operacao ? ` e a operação ${impacto.operacao} deixa de contar a placa` : ""}.`
            : "Ao aprovar, a situação vai a VND ou SUC na data; a placa não tem CR vigente para encerrar.",
        ...(impacto?.transferencia_aberta
          ? ["Há uma transferência em andamento: resolva antes, ou o banco recusa o pedido."]
          : []),
        ...(impacto?.em_conjunto ? ["A placa está num conjunto: desatrele antes da baixa."] : []),
      ]}
      renderPasso={(passo, form) =>
        passo.id === "motivo" ? (
          <>
            <Campo rotulo="Motivo da baixa" erro={form.formState.errors.motivo?.message}>
              {(p) => (
                <select {...p} {...form.register("motivo")} className={CLASSE_DO_CAMPO}>
                  <option value="">Escolha…</option>
                  {MOTIVOS_DA_BAIXA.map((m) => (
                    <option key={m} value={m}>
                      {NOMES_DOS_MOTIVOS_DA_BAIXA[m]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Data da baixa" erro={form.formState.errors.dia?.message}>
              {(p) => (
                <input {...p} {...form.register("dia")} type="date" className={CLASSE_DO_CAMPO} />
              )}
            </Campo>
            <Campo rotulo="Justificativa" erro={form.formState.errors.justificativa?.message}>
              {(p) => (
                <input {...p} {...form.register("justificativa")} className={CLASSE_DO_CAMPO} />
              )}
            </Campo>
          </>
        ) : (
          <Campo
            rotulo="Documento (opcional)"
            erro={form.formState.errors.documento?.message}
            ajuda="Referência do documento (nota, laudo ou contrato). Comprador e valor ficam nele, não no sistema."
          >
            {(p) => <input {...p} {...form.register("documento")} className={CLASSE_DO_CAMPO} />}
          </Campo>
        )
      }
    />
  );
}

export function PedirBaixa({
  placa,
  aoFechar,
  focoFinal,
}: {
  placa: string;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  return (
    <CarregarParaAbrir
      titulo="Pedir baixa"
      ler={() => vinculosDaPlacaAcao(placa)}
      vazio={(d) => (d === null ? `Não achamos a placa ${placa}. Confira a placa.` : null)}
      aoFechar={aoFechar}
    >
      {(d) =>
        d === null ? null : (
          <PedirBaixaDaPlaca dados={d} aoFechar={aoFechar} {...(focoFinal ? { focoFinal } : {})} />
        )
      }
    </CarregarParaAbrir>
  );
}
