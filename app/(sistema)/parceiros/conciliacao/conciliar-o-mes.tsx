"use client";

import { IconChecks } from "@tabler/icons-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import type { Resolver } from "react-hook-form";
import { errosDoResolvedor } from "@/app/(sistema)/frota/placas/assistentes/erros-do-resolvedor";
import { formatarMes } from "@/components/formato/data";
import { formatarMoeda } from "@/components/formato/moeda-valor";
import { formatarInteiro } from "@/components/formato/numero";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Button } from "@/components/ui/button";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import {
  type LinhaDaConciliacao,
  NOMES_DAS_SITUACOES_DA_CONCILIACAO,
} from "@/lib/dados/parceiros-tipos";
import type { ResumoDoAcionista } from "@/lib/dominio/conciliar-o-mes";
import { esquemaConciliarOMes } from "@/lib/dominio/esquemas/parceiros";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { conciliarOMesAcao } from "../acoes";

// Conciliar o mês (Alexandre, 17/11/2026): passo 1 justifica em lote as diferenças sem justificativa do
// acionista; passo 2, com zero pendências, marca o mês como conferido e trava. O assistente abre pela
// URL (?assistente=conciliar-o-mes), então também pelo Ctrl+K; fechar tira o parâmetro e volta à lista.

export const ID_DO_ASSISTENTE = "conciliar-o-mes";

interface Valores {
  justificativas: { crId: string; motivo: string }[];
  ciente: boolean;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "conciliacao-conciliar-o-mes",
  titulo: "Conciliar o mês",
  versaoDoEsquema: 1,
  passos: [
    { id: "justificar", titulo: "Justificar", campos: ["justificativas"] },
    { id: "travar", titulo: "Travar o mês", campos: ["ciente"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

interface Props {
  agrupadorId: string;
  parceiro: string;
  mes: string;
  pendentes: LinhaDaConciliacao[];
  resumo: ResumoDoAcionista;
}

function AssistenteConciliarOMes({
  agrupadorId,
  parceiro,
  mes,
  pendentes,
  resumo,
  aoFechar,
  focoFinal,
}: Props & { aoFechar: () => void; focoFinal: React.RefObject<HTMLElement | null> }) {
  const usuario = useUsuarioDaSessao();
  const router = useRouter();
  const entrada = (v: Valores) => ({
    agrupadorId,
    mes,
    justificativas: (v.justificativas ?? []).map((j) => ({ crId: j.crId, motivo: j.motivo ?? "" })),
    ciente: v.ciente === true,
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaConciliarOMes.safeParse(entrada(valores));
    const problemas = r.success
      ? []
      : r.error.issues.filter((i) => i.path[0] === "justificativas" || i.path[0] === "ciente");
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  const linhaDe = (crId: string) => pendentes.find((p) => p.crId === crId);
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{
        justificativas: pendentes.map((p) => ({ crId: p.crId, motivo: "" })),
        ciente: false,
      }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={`${agrupadorId}-${mes}`}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Conciliar o mês"
      mensagemConcluido="Mês conciliado e travado."
      fecharAoGravar
      aoGravar={() => router.refresh()}
      aoConcluir={(valores, chaveDeEnvio) =>
        conciliarOMesAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Mês do acionista",
          linhas: [
            { rotulo: "Parceiro", valor: parceiro },
            { rotulo: "Mês", valor: formatarMes(mes) },
            { rotulo: "CRs no mês", valor: formatarInteiro(resumo.linhas) },
            { rotulo: "Conferem", valor: formatarInteiro(resumo.conferem) },
            { rotulo: "Já justificadas", valor: formatarInteiro(resumo.justificadas) },
            {
              rotulo: "Justificar agora",
              valor: formatarInteiro((v.justificativas ?? []).length),
            },
            { rotulo: "Trava", valor: v.ciente ? "Confirmada" : undefined },
          ],
        },
      ]}
      efeitos={(v) => [
        ...((v.justificativas ?? []).length > 0
          ? [
              `${formatarInteiro((v.justificativas ?? []).length)} linhas passam a Justificada, tudo ou nada.`,
            ]
          : []),
        "O mês do acionista fica conferido e travado: nenhuma justificativa nova entra.",
        "Correção depois disso só como ajuste de período anterior, em Resultados › Ajustes.",
        "O lançamento do Sankhya continua igual: o Eixo só registra a explicação e a conferência.",
      ]}
      renderPasso={(passo, form) => {
        if (passo.id === "justificar") {
          const itens = form.getValues("justificativas") ?? [];
          if (itens.length === 0) {
            return (
              <p className="text-muted-foreground text-sm">
                Nenhuma diferença sem justificativa neste mês. Siga para travar o mês.
              </p>
            );
          }
          return (
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">
                {formatarInteiro(itens.length)} {itens.length === 1 ? "linha pede" : "linhas pedem"}{" "}
                justificativa. O mês só trava com todas justificadas.
              </p>
              {itens.map((item, i) => {
                const l = linhaDe(item.crId);
                return (
                  <Campo
                    key={item.crId}
                    rotulo={`CR ${l?.crCodigo ?? ""} · ${l ? NOMES_DAS_SITUACOES_DA_CONCILIACAO[l.situacao] : ""}`}
                    erro={form.formState.errors.justificativas?.[i]?.motivo?.message}
                    ajuda={
                      l
                        ? `Placas esperadas: ${l.placas.join(", ") || "nenhuma"} · despesa lançada ${formatarMoeda(l.despesaCentavos)}`
                        : undefined
                    }
                  >
                    {(p) => (
                      <textarea
                        {...p}
                        {...form.register(`justificativas.${i}.motivo`)}
                        rows={2}
                        maxLength={500}
                        className={`${CLASSE_DO_CAMPO} h-auto py-2`}
                      />
                    )}
                  </Campo>
                );
              })}
            </div>
          );
        }
        if (passo.id === "travar") {
          return (
            <Campo
              rotulo="Travar o mês"
              erro={form.formState.errors.ciente?.message}
              ajuda="Depois de conferido, o mês não aceita justificativa nova. Correção só como ajuste de período anterior, registrado."
            >
              {(p) => (
                <label className="flex items-center gap-2 text-sm">
                  <input {...p} type="checkbox" {...form.register("ciente")} className="size-4" />
                  Entendo que o mês de {parceiro} em {formatarMes(mes)} fica travado.
                </label>
              )}
            </Campo>
          );
        }
        return null;
      }}
    />
  );
}

/** O botão "Conciliar o mês" e o assistente aberto pela URL (`?assistente=conciliar-o-mes`). */
export function ConciliarOMes(props: Props) {
  const parametros = useSearchParams();
  const rota = usePathname();
  const router = useRouter();
  const quemAbriu = useRef<HTMLElement | null>(null);
  const aberto = parametros.get("assistente") === ID_DO_ASSISTENTE;
  const comAssistente = (abrir: boolean) => {
    const novos = new URLSearchParams(parametros.toString());
    if (abrir) novos.set("assistente", ID_DO_ASSISTENTE);
    else novos.delete("assistente");
    const busca = novos.toString();
    return busca ? `${rota}?${busca}` : rota;
  };
  return (
    <>
      <Button
        aria-haspopup="dialog"
        onClick={(evento) => {
          quemAbriu.current = evento.currentTarget;
          router.push(comAssistente(true), { scroll: false });
        }}
      >
        <IconChecks aria-hidden className="size-4" />
        Conciliar o mês
      </Button>
      {aberto ? (
        <AssistenteConciliarOMes
          {...props}
          focoFinal={quemAbriu}
          aoFechar={() => router.replace(comAssistente(false), { scroll: false })}
        />
      ) : null}
    </>
  );
}
