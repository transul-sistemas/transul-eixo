"use client";

import { type RefObject, useRef, useState } from "react";
import type { Resolver } from "react-hook-form";
import { formatarData } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { AlvoDoLancamento } from "@/lib/dados/acompanhamento-tipos";
import { esquemaLancarSituacao } from "@/lib/dominio/esquemas/acompanhamento";
import { NOMES_DAS_SIGLAS, type Sigla } from "@/lib/dominio/status";
import { siglasParaLancar } from "@/lib/navegacao/acompanhamento";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../placas/assistentes/erros-do-resolvedor";
import { lancarSituacaoAcao } from "./acoes";
import { lancarNaHoraAcao } from "./acoes-do-dia";
import { CorrigirUltimoEvento } from "./corrigir-ultimo-evento";

// Lançar situação (popup central, aberto pela célula da grade): escolher a situação do dia entre
// as que valem para a placa (tipo e conjunto), conferir e gravar. O banco fecha as camadas de
// prioridade maior que estejam abertas, para o que se lança ser o que se vê.

interface Valores {
  sigla: string;
  /** Vazia: a situação vale para o dia. Com hora: lança naquele instante (nucleo.lancar_situacao_na_hora). */
  hora: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "lancar-situacao",
  titulo: "Lançar situação",
  versaoDoEsquema: 2,
  passos: [
    { id: "situacao", titulo: "Situação", campos: ["sigla", "hora"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function LancarSituacao({
  alvo: linha,
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
  const [corrigindo, setCorrigindo] = useState(false);
  const botaoDeCorrigir = useRef<HTMLButtonElement>(null);
  const siglas = siglasParaLancar(linha.tipo, linha.emConjunto);
  const atual = linha.dias.find((d) => d.dia === dia)?.sigla ?? null;
  const entrada = (v: Valores) => ({
    ativoId: linha.ativoId,
    placa: linha.placa,
    sigla: v.sigla,
    dia,
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaLancarSituacao.safeParse(entrada(valores));
    if (valores.hora !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(valores.hora)) {
      return {
        values: {},
        errors: errosDoResolvedor<Valores>([
          { path: ["hora"], message: "Informe a hora (hh:mm)." },
        ]),
      };
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
  const nome = (s: string) => NOMES_DAS_SIGLAS[s as Sigla] ?? s;
  return (
    <>
      <Assistente<Valores>
        definicao={DEFINICAO}
        resolver={resolver}
        valoresIniciais={{ sigla: "", hora: "" }}
        validarRascunho={() => null}
        usuario={usuario}
        registro={`${linha.placa}-${dia}`}
        rascunho={false}
        focoFinal={focoFinal}
        rotuloConcluir="Lançar situação"
        mensagemConcluido="Situação lançada."
        fecharAoGravar
        aoGravar={aoGravar}
        aoConcluir={(valores, chaveDeEnvio) =>
          valores.hora === ""
            ? lancarSituacaoAcao({ chaveDeEnvio, dados: entrada(valores) })
            : lancarNaHoraAcao({
                chaveDeEnvio,
                dados: { ativoId: linha.ativoId, sigla: valores.sigla, dia, hora: valores.hora },
              })
        }
        aoFechar={aoFechar}
        resumo={(v) => [
          {
            titulo: "Situação do dia",
            linhas: [
              { rotulo: "Placa", valor: linha.placa },
              { rotulo: "Dia", valor: formatarData(dia) },
              { rotulo: "Antes", valor: atual ? `${atual} · ${nome(atual)}` : "Sem situação" },
              { rotulo: "Lançar", valor: v.sigla ? `${v.sigla} · ${nome(v.sigla)}` : "—" },
            ],
          },
        ]}
        efeitos={(v) => [
          <>
            A placa {linha.placa} fica em <b>{v.sigla || "—"}</b> no fim de {formatarData(dia)}.
          </>,
          "Uma manutenção, folga ou afastamento aberto antes deste lançamento se encerra no mesmo instante.",
          "Lançamento de dia passado só vale se não houver outro lançamento depois dele.",
        ]}
        renderPasso={(_, form) => {
          const erro = form.formState.errors.sigla?.message;
          return (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm">
                Situação de {linha.placa} em {formatarData(dia)}
              </legend>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {siglas.map((s) => (
                  <label
                    key={s}
                    className="hover:bg-muted flex min-h-9 items-center gap-2 rounded-md px-2 text-sm max-sm:min-h-11"
                  >
                    <input type="radio" value={s} className="size-4" {...form.register("sigla")} />
                    <span className="font-semibold">{s}</span>
                    <span className="text-muted-foreground">{nome(s)}</span>
                  </label>
                ))}
              </div>
              <p role="alert" className="text-destructive min-h-4 text-xs">
                {erro}
              </p>
              <Campo
                rotulo="Hora (opcional)"
                erro={form.formState.errors.hora?.message}
                ajuda="Vazia, vale para o dia. Com a hora, o movimento entra naquele instante."
              >
                {(p) => (
                  <input
                    {...p}
                    {...form.register("hora")}
                    type="time"
                    className={CLASSE_DO_CAMPO}
                  />
                )}
              </Campo>
              <button
                ref={botaoDeCorrigir}
                type="button"
                aria-haspopup="dialog"
                onClick={() => setCorrigindo(true)}
                className="text-acao w-fit text-sm underline underline-offset-4"
              >
                Corrigir o último evento
              </button>
            </fieldset>
          );
        }}
      />
      {corrigindo ? (
        <CorrigirUltimoEvento
          ativoId={linha.ativoId}
          placa={linha.placa}
          siglas={siglas}
          focoFinal={botaoDeCorrigir}
          aoGravar={aoGravar}
          aoFechar={() => setCorrigindo(false)}
        />
      ) : null}
    </>
  );
}
