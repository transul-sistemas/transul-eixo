"use client";

import { type RefObject, useState } from "react";
import { Controller, type Resolver } from "react-hook-form";
import { formatarData } from "@/components/formato/data";
import { formatarInteiro } from "@/components/formato/numero";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { AlvoDoLancamento } from "@/lib/dados/acompanhamento-tipos";
import { esquemaLancarODia, textoDosRecusados } from "@/lib/dominio/esquemas/dia-cr-e-baixa";
import { NOMES_DAS_SIGLAS, type Sigla } from "@/lib/dominio/status";
import { siglasParaLancar } from "@/lib/navegacao/acompanhamento";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { erroDaAcao } from "@/lib/wizard/resultado";
import { errosDoResolvedor } from "../placas/assistentes/erros-do-resolvedor";
import { lancarODiaAcao } from "./acoes-do-dia";

// A2, Lançar o dia (lote), aberto pelo cabeçalho do dia da grade: a mesma situação e a mesma hora para
// vários conjuntos, tudo ou nada (nucleo.lancar_o_dia_em_lote). Se um for recusado, nada grava: a tela
// marca os recusados com o motivo e oferece "Remover os recusados e lançar os outros".

interface Valores {
  sigla: string;
  hora: string;
  ativos: string[];
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "lancar-o-dia",
  titulo: "Lançar o dia",
  versaoDoEsquema: 1,
  passos: [
    { id: "situacao", titulo: "Situação e hora", campos: ["sigla", "hora"] },
    { id: "conjuntos", titulo: "Conjuntos", campos: ["ativos"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function LancarODia({
  dia,
  linhas,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  dia: string;
  linhas: AlvoDoLancamento[];
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const [recusados, setRecusados] = useState<Record<string, string>>({});
  const primeira = linhas[0];
  const siglas = primeira ? siglasParaLancar(primeira.tipo, primeira.emConjunto) : [];
  const placaDe = (id: string) => linhas.find((l) => l.ativoId === id)?.placa;
  const entrada = (v: Valores) => ({ ativos: v.ativos, sigla: v.sigla, dia, hora: v.hora });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaLancarODia.safeParse(entrada(valores));
    return r.success
      ? { values: valores, errors: {} }
      : {
          values: {},
          errors: errosDoResolvedor<Valores>(
            r.error.issues.map((i) => ({ path: [i.path[0] ?? "ativos"], message: i.message })),
          ),
        };
  };
  const nome = (s: string) => NOMES_DAS_SIGLAS[s as Sigla] ?? s;
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{ sigla: "", hora: "08:00", ativos: linhas.map((l) => l.ativoId) }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={dia}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Lançar o dia"
      mensagemConcluido="Dia lançado."
      aoGravar={aoGravar}
      aoConcluir={async (valores, chaveDeEnvio) => {
        const r = await lancarODiaAcao({ chaveDeEnvio, dados: entrada(valores) });
        if (!r.ok || r.linha.recusados.length === 0) return r;
        const mapa = Object.fromEntries(r.linha.recusados.map((x) => [x.ativo_id, x.motivo]));
        setRecusados(mapa);
        return erroDaAcao("entrada_invalida", {
          mensagem: `Nada foi lançado: ${formatarInteiro(r.linha.recusados.length)} de ${formatarInteiro(r.linha.total)} recusados. Remova-os da lista e lance os outros.`,
          campos: { ativos: textoDosRecusados(r.linha.recusados, placaDe) },
        });
      }}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: `Dia ${formatarData(dia)}`,
          linhas: [
            { rotulo: "Situação", valor: v.sigla ? `${v.sigla} · ${nome(v.sigla)}` : "—" },
            { rotulo: "Hora", valor: v.hora },
            { rotulo: "Conjuntos", valor: formatarInteiro(v.ativos.length) },
          ],
        },
      ]}
      efeitos={(v) => [
        <>
          {formatarInteiro(v.ativos.length)} conjuntos ficam em <b>{v.sigla || "—"}</b> às {v.hora}{" "}
          de {formatarData(dia)}.
        </>,
        "Tudo ou nada: se um for recusado, nenhum é lançado e a tela diz qual e por quê.",
        "Repetir o envio não lança duas vezes (a mesma chave).",
      ]}
      renderPasso={(passo, form) => {
        if (passo.id === "situacao") {
          return (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm">Situação de todos em {formatarData(dia)}</legend>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {siglas.map((s) => (
                    <label
                      key={s}
                      className="hover:bg-muted flex min-h-9 items-center gap-2 rounded-md px-2 text-sm"
                    >
                      <input
                        type="radio"
                        value={s}
                        className="size-4"
                        {...form.register("sigla")}
                      />
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
                  <input
                    {...p}
                    {...form.register("hora")}
                    type="time"
                    className={CLASSE_DO_CAMPO}
                  />
                )}
              </Campo>
            </>
          );
        }
        return (
          <Controller
            control={form.control}
            name="ativos"
            render={({ field }) => (
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="text-muted-foreground mb-1">
                  {formatarInteiro(field.value.length)} de {formatarInteiro(linhas.length)}{" "}
                  conjuntos marcados
                </legend>
                {Object.keys(recusados).length > 0 ? (
                  <button
                    type="button"
                    className="text-acao w-fit text-sm underline underline-offset-4"
                    onClick={() => {
                      field.onChange(field.value.filter((a: string) => !(a in recusados)));
                      setRecusados({});
                    }}
                  >
                    Remover os recusados da lista
                  </button>
                ) : null}
                <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                  {linhas.map((l) => (
                    <label
                      key={l.ativoId}
                      data-recusado={l.ativoId in recusados ? "" : undefined}
                      className="data-[recusado]:bg-status-impedida-suave flex items-center gap-2 rounded px-1"
                    >
                      <input
                        type="checkbox"
                        checked={field.value.includes(l.ativoId)}
                        onChange={(e) =>
                          field.onChange(
                            e.target.checked
                              ? [...field.value, l.ativoId]
                              : field.value.filter((a: string) => a !== l.ativoId),
                          )
                        }
                      />
                      <span className="font-medium">{l.placa}</span>
                      {l.ativoId in recusados ? (
                        <span className="text-xs">recusado: {recusados[l.ativoId]}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
                <p role="alert" className="text-destructive min-h-4 text-xs">
                  {form.formState.errors.ativos?.message}
                </p>
              </fieldset>
            )}
          />
        );
      }}
    />
  );
}
