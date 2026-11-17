"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import type { PlacaDoPatio } from "@/lib/dados/operacional-tipos";
import {
  ACOES_DO_PATIO,
  type AcaoDeAvancar,
  esquemaAvancarNoPatio,
} from "@/lib/dominio/esquemas/operacional";
import { NOMES_DAS_SIGLAS, type Sigla } from "@/lib/dominio/status";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../../frota/placas/assistentes/erros-do-resolvedor";
import { avancarNoPatioAcao } from "../acoes";

// Avançar a placa no pátio (popup central, aberto pela linha): aceitar (DOp → ACe), concluir o
// carregamento (CAr → CAn), liberar a viagem (CAn → ETc, a placa volta ao gestor) ou devolver ao
// gestor (DOp ou ACe → PÁT, com o motivo). O banco confere a filial da custódia e a situação.

interface Valores {
  motivo: string;
}

const EFEITOS: Record<AcaoDeAvancar, string[]> = {
  aceitar: ["A placa fica aguardando carregamento e pode receber a ordem de carregamento."],
  concluir: ["A ordem de carregamento da placa fica carregada, aguardando a nota."],
  liberar: [
    "A ordem de carregamento fica em viagem.",
    "A placa sai do pátio e volta à custódia do gestor de frota.",
  ],
  devolver: [
    "A placa sai do pátio e da fila e volta à custódia do gestor de frota.",
    "O motivo fica registrado na linha do tempo da placa.",
  ],
};

export function AvancarPlaca({
  placa,
  acao,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  placa: PlacaDoPatio;
  acao: AcaoDeAvancar;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const info = ACOES_DO_PATIO[acao];
  const definicao: DefinicaoDeAssistente = {
    id: `patio-${acao}`,
    titulo: info.botao,
    versaoDoEsquema: 1,
    passos:
      acao === "devolver"
        ? [
            { id: "motivo", titulo: "Motivo", campos: ["motivo"] },
            { id: "conferir", titulo: "Conferir", campos: [] },
          ]
        : [
            { id: "placa", titulo: "Placa", campos: [] },
            { id: "conferir", titulo: "Conferir", campos: [] },
          ],
  };
  const entrada = (v: Valores) => ({
    ativoId: placa.ativoId,
    placa: placa.placa,
    acao,
    motivo: v.motivo,
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaAvancarNoPatio.safeParse(entrada(valores));
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<Valores>(
            r.error.issues.map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };
  const nome = (s: string) => NOMES_DAS_SIGLAS[s as Sigla] ?? s;
  return (
    <Assistente<Valores>
      definicao={definicao}
      resolver={resolver}
      valoresIniciais={{ motivo: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={`${placa.placa}-${acao}`}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir={info.botao}
      mensagemConcluido={info.feito}
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(valores, chaveDeEnvio) =>
        avancarNoPatioAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: info.botao,
          linhas: [
            { rotulo: "Placa", valor: placa.placa },
            { rotulo: "Filial", valor: placa.filial },
            { rotulo: "Agora", valor: `${placa.sigla} · ${nome(placa.sigla)}` },
            { rotulo: "Depois", valor: `${info.para} · ${nome(info.para)}` },
            ...(acao === "devolver" ? [{ rotulo: "Motivo", valor: v.motivo.trim() || "—" }] : []),
          ],
        },
      ]}
      efeitos={() => EFEITOS[acao]}
      renderPasso={(_, form) => {
        if (acao !== "devolver") {
          return (
            <p className="text-sm">
              A placa <b>{placa.placa}</b> passa de {placa.sigla} ({nome(placa.sigla)}) para{" "}
              <b>
                {info.para} ({nome(info.para)})
              </b>
              .
            </p>
          );
        }
        const erro = form.formState.errors.motivo?.message;
        return (
          <label className="flex flex-col gap-1 text-sm">
            <span>Por que a placa {placa.placa} volta ao gestor</span>
            <textarea
              rows={3}
              className="border-input bg-card rounded-lg border px-3 py-2"
              aria-invalid={erro ? true : undefined}
              {...form.register("motivo")}
            />
            <span role="alert" className="text-destructive min-h-4 text-xs">
              {erro}
            </span>
          </label>
        );
      }}
    />
  );
}
