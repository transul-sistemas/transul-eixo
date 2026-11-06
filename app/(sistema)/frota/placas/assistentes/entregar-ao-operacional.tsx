"use client";

import { type RefObject } from "react";
import { agoraEmSaoPaulo, formatarDataEHora } from "@/components/formato/data";
import { Controller, type Resolver } from "react-hook-form";
import { Assistente } from "@/components/wizard/assistente";
import type { DadosDosAssistentes } from "@/lib/dados/escrita-tipos";
import type { Catalogos, ItemCriado, PlacaGravada } from "@/lib/dados/escrita-tipos";
import { esquemaEntregaAoOperacional } from "@/lib/dominio/esquemas/placa";
import { NOMES_DAS_SIGLAS } from "@/lib/dominio/status";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { entregarAoOperacionalAcao } from "../acoes";
import { errosDoResolvedor } from "./erros-do-resolvedor";
import { CampoDoCatalogo } from "./mini-cadastro-de-catalogo";

// Entregar ao Operacional: a placa do gestor de frota vai à custódia do Operacional da filial
// escolhida (de PÁT ou ETv para DOp). Dois passos: a filial e a conferência.

interface Valores {
  filialId: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "entregar-ao-operacional",
  titulo: "Entregar ao Operacional",
  versaoDoEsquema: 1,
  passos: [
    { id: "filial", titulo: "Filial", campos: ["filialId"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function EntregarAoOperacional({
  placa,
  catalogos,
  criaveis,
  aoItemCriado,
  aoFechar,
  focoFinal,
}: {
  placa: NonNullable<DadosDosAssistentes["placaAlvo"]>;
  catalogos: Catalogos;
  criaveis: DadosDosAssistentes["criaveis"];
  aoItemCriado: (item: ItemCriado) => void;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaEntregaAoOperacional.safeParse({
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
      rotuloConcluir="Entregar ao Operacional"
      mensagemConcluido="Placa entregue ao Operacional."
      aoConcluir={(valores, chaveDeEnvio) =>
        entregarAoOperacionalAcao({
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
            <CampoDoCatalogo
              rotulo="Filial"
              tipo="filial"
              criaveis={criaveis}
              opcoes={catalogos.filiais}
              valor={field.value}
              aoMudar={field.onChange}
              erro={form.formState.errors.filialId?.message}
              semOpcao="Nenhuma filial ainda."
              aoItemCriado={aoItemCriado}
            />
          )}
        />
      )}
    />
  );
}
