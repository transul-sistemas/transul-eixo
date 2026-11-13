"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { formatarData } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { AlvoDoLancamento } from "@/lib/dados/acompanhamento-tipos";
import type { SituacaoProgramada } from "@/lib/dados/lancar-o-dia-tipos";
import { esquemaCancelarProgramada, esquemaProgramar } from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import { NOMES_DAS_SIGLAS, type Sigla } from "@/lib/dominio/status";
import { siglasParaLancar } from "@/lib/navegacao/acompanhamento";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../placas/assistentes/erros-do-resolvedor";
import {
  cancelarProgramadaAcao,
  confirmarProgramadaAcao,
  programarSituacaoAcao,
} from "./acoes-do-dia";

// A2, Programado: o dia futuro da grade (célula tracejada) abre "Programar situação"; a célula com uma
// situação programada abre "Confirmar ou cancelar". Programado fica fora do realizado, de "X de Y" e do
// resultado até ser confirmado (nucleo.programar_situacao, confirmar_ e cancelar_situacao_programada).

const nome = (s: string) => NOMES_DAS_SIGLAS[s as Sigla] ?? s;

function resolvedor<V extends object>(
  validar: (v: V) => {
    success: boolean;
    error?: { issues: { path: PropertyKey[]; message: string }[] };
  },
): Resolver<V> {
  return async (valores) => {
    const r = validar(valores);
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<V>(
            (r.error?.issues ?? []).map((i) => ({ path: i.path, message: i.message })),
          ),
        };
  };
}

interface ValoresDoProgramar {
  sigla: string;
  hora: string;
}

const PROGRAMAR: DefinicaoDeAssistente = {
  id: "programar-situacao",
  titulo: "Programar situação",
  versaoDoEsquema: 1,
  passos: [
    { id: "situacao", titulo: "Situação e hora", campos: ["sigla", "hora"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function ProgramarSituacao({
  alvo,
  dia,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  alvo: AlvoDoLancamento;
  dia: string;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const siglas = siglasParaLancar(alvo.tipo, alvo.emConjunto);
  const entrada = (v: ValoresDoProgramar) => ({
    ativoId: alvo.ativoId,
    dia,
    sigla: v.sigla,
    hora: v.hora,
  });
  return (
    <Assistente<ValoresDoProgramar>
      definicao={PROGRAMAR}
      resolver={resolvedor((v: ValoresDoProgramar) => esquemaProgramar.safeParse(entrada(v)))}
      valoresIniciais={{ sigla: "", hora: "08:00" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={`${alvo.placa}-${dia}`}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Programar situação"
      mensagemConcluido="Situação programada."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(v, chaveDeEnvio) => programarSituacaoAcao({ chaveDeEnvio, dados: entrada(v) })}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Programado",
          linhas: [
            { rotulo: "Placa", valor: alvo.placa },
            { rotulo: "Dia", valor: formatarData(dia) },
            { rotulo: "Situação", valor: v.sigla ? `${v.sigla} · ${nome(v.sigla)}` : "—" },
            { rotulo: "Hora", valor: v.hora },
          ],
        },
      ]}
      efeitos={() => [
        "Fica Programada e não conta no realizado, no X de Y nem no resultado.",
        "No dia, a tarefa pede para confirmar; só confirmada ela vira evento.",
      ]}
      renderPasso={(_, form) => (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm">
              Situação de {alvo.placa} em {formatarData(dia)}
            </legend>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {siglas.map((s) => (
                <label
                  key={s}
                  className="hover:bg-muted flex min-h-9 items-center gap-2 rounded-md px-2 text-sm"
                >
                  <input type="radio" value={s} className="size-4" {...form.register("sigla")} />
                  <span className="font-semibold">{s}</span>
                  <span className="text-muted-foreground">{nome(s)}</span>
                </label>
              ))}
            </div>
            <p role="alert" className="text-destructive min-h-4 text-xs">
              {form.formState.errors.sigla?.message}
            </p>
          </fieldset>
          <Campo rotulo="Hora" erro={form.formState.errors.hora?.message}>
            {(p) => (
              <input {...p} {...form.register("hora")} type="time" className={CLASSE_DO_CAMPO} />
            )}
          </Campo>
        </>
      )}
    />
  );
}

interface ValoresDaDecisao {
  decisao: "confirmar" | "cancelar" | "";
  motivo: string;
}

const DECIDIR: DefinicaoDeAssistente = {
  id: "decidir-situacao-programada",
  titulo: "Situação programada",
  versaoDoEsquema: 1,
  passos: [
    { id: "decisao", titulo: "Confirmar ou cancelar", campos: ["decisao", "motivo"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function DecidirProgramada({
  programada,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  programada: SituacaoProgramada;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const validar = (v: ValoresDaDecisao) => {
    if (v.decisao === "")
      return {
        success: false,
        error: { issues: [{ path: ["decisao"], message: "Escolha confirmar ou cancelar." }] },
      };
    if (v.decisao === "cancelar")
      return esquemaCancelarProgramada.safeParse({ programadaId: programada.id, motivo: v.motivo });
    return { success: true };
  };
  return (
    <Assistente<ValoresDaDecisao>
      definicao={DECIDIR}
      resolver={resolvedor(validar)}
      valoresIniciais={{ decisao: "", motivo: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={programada.id}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Gravar decisão"
      mensagemConcluido="Decisão gravada."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(v, chaveDeEnvio) =>
        v.decisao === "cancelar"
          ? cancelarProgramadaAcao({
              chaveDeEnvio,
              dados: { programadaId: programada.id, motivo: v.motivo },
            })
          : confirmarProgramadaAcao({
              chaveDeEnvio,
              dados: { programadaId: programada.id, versao: programada.versao },
            })
      }
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Programado",
          linhas: [
            { rotulo: "Placa", valor: programada.placa ?? "" },
            {
              rotulo: "Dia",
              valor: `${formatarData(programada.dia)} às ${programada.hora.slice(0, 5)}`,
            },
            { rotulo: "Situação", valor: `${programada.sigla} · ${nome(programada.sigla)}` },
            {
              rotulo: "Decisão",
              valor:
                v.decisao === "cancelar"
                  ? "Cancelar programada"
                  : v.decisao === "confirmar"
                    ? "Confirmar situação"
                    : "—",
            },
          ],
        },
      ]}
      efeitos={(v) => [
        v.decisao === "cancelar"
          ? "A situação programada é cancelada, com o motivo; nada vai ao realizado."
          : "A situação programada vira evento no dia e na hora e passa a contar no realizado.",
      ]}
      renderPasso={(_, form) => {
        const decisao = form.watch("decisao");
        return (
          <>
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-2">
                {programada.placa}: {programada.sigla} em {formatarData(programada.dia)}
              </legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="confirmar"
                  className="size-4"
                  {...form.register("decisao")}
                />
                Confirmar situação
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="cancelar"
                  className="size-4"
                  {...form.register("decisao")}
                />
                Cancelar programada
              </label>
              <p role="alert" className="text-destructive min-h-4 text-xs">
                {form.formState.errors.decisao?.message}
              </p>
            </fieldset>
            {decisao === "cancelar" ? (
              <Campo rotulo="Motivo" erro={form.formState.errors.motivo?.message}>
                {(p) => <input {...p} {...form.register("motivo")} className={CLASSE_DO_CAMPO} />}
              </Campo>
            ) : null}
          </>
        );
      }}
    />
  );
}
