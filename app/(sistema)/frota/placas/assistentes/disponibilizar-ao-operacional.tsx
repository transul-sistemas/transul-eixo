"use client";

import { type RefObject } from "react";
import { agoraEmSaoPaulo, formatarDataEHora } from "@/components/formato/data";
import { Controller, type Resolver } from "react-hook-form";
import { Assistente } from "@/components/wizard/assistente";
import { CampoComMais } from "@/components/wizard/campos";
import type { DadosDosAssistentes } from "@/lib/dados/escrita-tipos";
import type { Catalogos, ItemCriado, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { esquemaDisponibilizacao } from "@/lib/dominio/esquemas/placa";
import { NOMES_DAS_SIGLAS } from "@/lib/dominio/status";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { disponibilizarPlacaAcao } from "../acoes";
import { errosDoResolvedor } from "./erros-do-resolvedor";
import { ACAO_DO_MAIS, renderizarMini } from "./mini-cadastro-de-catalogo";

// Disponibilizar ao Operacional: a placa do gestor de frota vai ao Operacional da filial escolhida
// (de PÁT ou ETv para DOp). Dois passos: a filial e a conferência.

interface Valores {
  filialId: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "disponibilizar",
  titulo: "Disponibilizar ao Operacional",
  versaoDoEsquema: 1,
  passos: [
    { id: "filial", titulo: "Filial", campos: ["filialId"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function DisponibilizarAoOperacional({
  placa,
  catalogos,
  aoItemCriado,
  aoFechar,
  focoFinal,
}: {
  placa: NonNullable<DadosDosAssistentes["placaAlvo"]>;
  catalogos: Catalogos;
  aoItemCriado: (item: ItemCriado) => void;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaDisponibilizacao.safeParse({
      placa: placa.placa,
      filialId: valores.filialId,
      versaoDaPlaca: placa.versao,
    });
    const problemas = r.success
      ? []
      : r.error.issues
          .filter((i) => i.path[0] === "filialId")
          .map((i) => ({ path: i.path, message: i.message }));
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  const filial = (id: string) => catalogos.filiais.find((f) => f.id === id)?.nome ?? "";
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ filialId: placa.filialId ?? "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Disponibilizar ao Operacional"
      mensagemConcluido="Placa disponibilizada ao Operacional."
      aoConcluir={(valores, chaveDeEnvio) =>
        disponibilizarPlacaAcao({
          chaveDeEnvio,
          dados: { placa: placa.placa, filialId: valores.filialId, versaoDaPlaca: placa.versao },
        })
      }
      descreverAtual={(atual) => {
        const agora = atual as PlacaGravada;
        return (
          <p>
            Agora a placa {agora.placa} está em {agora.sigla} · {NOMES_DAS_SIGLAS[agora.sigla]}.
          </p>
        );
      }}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Placa",
          linhas: [
            { rotulo: "Placa", valor: placa.placa },
            {
              rotulo: "Situação agora",
              valor: `${placa.sigla} · ${NOMES_DAS_SIGLAS[placa.sigla]}`,
            },
            { rotulo: "Vai para", valor: `DOp · ${NOMES_DAS_SIGLAS.DOp}` },
          ],
        },
        { titulo: "Filial", linhas: [{ rotulo: "Filial", valor: filial(v.filialId) }] },
      ]}
      efeitos={(v) => [
        <>
          A placa sai de{" "}
          <b>
            {placa.sigla} · {NOMES_DAS_SIGLAS[placa.sigla]}
          </b>{" "}
          e passa para <b>DOp · {NOMES_DAS_SIGLAS.DOp}</b>, na filial{" "}
          <b>{filial(v.filialId) || "a escolher"}</b>.
        </>,
        "O Operacional da filial passa a ver a placa para alocar a um carregamento.",
        <>
          Um evento é registrado na linha do tempo da placa, em{" "}
          <b>{formatarDataEHora(agoraEmSaoPaulo(new Date()))}</b>.
        </>,
        "O conjunto da placa não é alterado por esta ação.",
      ]}
      renderPasso={(_, form) => (
        <Controller
          control={form.control}
          name="filialId"
          render={({ field }) => (
            <CampoComMais
              rotulo="Filial"
              rotuloDoMais={ACAO_DO_MAIS("filial")}
              opcoes={catalogos.filiais}
              valor={field.value}
              aoMudar={field.onChange}
              erro={form.formState.errors.filialId?.message}
              semOpcao="Nenhuma filial ainda. Use o + para cadastrar a primeira."
              renderMini={(m) => renderizarMini(m, "filial", undefined, aoItemCriado)}
            />
          )}
        />
      )}
    />
  );
}
