"use client";

import type { RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { formatarData } from "@/components/formato/data";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Assistente } from "@/components/wizard/assistente";
import type { OperacaoAEscolher, PlacaDoPatio } from "@/lib/dados/operacional-tipos";
import { esquemaCriarOrdem } from "@/lib/dominio/esquemas/operacional";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { errosDoResolvedor } from "../../frota/placas/assistentes/erros-do-resolvedor";
import { criarOrdemAcao } from "../acoes";

// Criar ordem: escolher a placa aceita no pátio (a fila primeiro, pela ordem de chegada), dizer a
// operação, o destino e a data prevista de saída, conferir e gravar. O banco grava a ordem e o CAr
// juntos e tira a placa da fila.

interface Valores {
  ativoId: string;
  operacaoId: string;
  destino: string;
  dataPrevista: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "criar-ordem",
  titulo: "Criar ordem",
  versaoDoEsquema: 1,
  passos: [
    { id: "placa", titulo: "Placa", campos: ["ativoId"] },
    { id: "carga", titulo: "Carga", campos: ["operacaoId", "destino", "dataPrevista"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const campo = "border-input bg-card h-10 rounded-lg border px-3";

export function CriarOrdem({
  placas,
  operacoes,
  hoje,
  placaInicial,
  aoFechar,
  aoGravar,
  focoFinal,
}: {
  placas: PlacaDoPatio[];
  operacoes: OperacaoAEscolher[];
  hoje: string;
  placaInicial?: string;
  aoFechar: () => void;
  aoGravar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const esquema = esquemaCriarOrdem(hoje);
  const placaDe = (id: string) => placas.find((p) => p.ativoId === id);
  const entrada = (v: Valores) => ({ ...v, placa: placaDe(v.ativoId)?.placa ?? "" });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquema.safeParse(entrada(valores));
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
        ativoId: placaInicial ?? (placas.length === 1 ? placas[0]!.ativoId : ""),
        operacaoId: "",
        destino: "",
        dataPrevista: hoje,
      }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placaInicial ?? "nova"}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Criar ordem"
      mensagemConcluido="Ordem criada."
      fecharAoGravar
      aoGravar={aoGravar}
      aoConcluir={(valores, chaveDeEnvio) =>
        criarOrdemAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Ordem de carregamento",
          linhas: [
            { rotulo: "Placa", valor: placaDe(v.ativoId)?.placa ?? "—" },
            {
              rotulo: "Operação",
              valor: operacoes.find((o) => o.id === v.operacaoId)?.nome ?? "—",
            },
            { rotulo: "Destino", valor: v.destino.trim() || "—" },
            {
              rotulo: "Saída prevista",
              valor: v.dataPrevista ? formatarData(v.dataPrevista) : "—",
            },
          ],
        },
      ]}
      efeitos={(v) => [
        <>
          A placa <b>{placaDe(v.ativoId)?.placa ?? "—"}</b> passa a carregando (CAr) e sai da fila.
        </>,
        "A ordem nasce carregando; concluir o carregamento e liberar a viagem se fazem pelo Pátio.",
      ]}
      renderPasso={(passo, form) => {
        const erros = form.formState.errors;
        if (passo.id === "placa") {
          if (placas.length === 0) {
            return (
              <p role="status" className="text-sm">
                Nenhuma placa aguardando carregamento. Aceite uma placa no Pátio para criar a ordem.
              </p>
            );
          }
          return (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm">Placa aguardando carregamento (ACe)</legend>
              {placas.map((p) => (
                <label
                  key={p.ativoId}
                  className="hover:bg-muted flex min-h-9 items-center gap-2 rounded-md px-2 text-sm max-sm:min-h-11"
                >
                  <input
                    type="radio"
                    value={p.ativoId}
                    className="size-4"
                    {...form.register("ativoId")}
                  />
                  <span className="font-semibold">{p.placa}</span>
                  <span className="text-muted-foreground">
                    {p.posicao ? `${p.posicao}º na fila · ` : ""}
                    {p.filial}
                  </span>
                </label>
              ))}
              <p role="alert" className="text-destructive min-h-4 text-xs">
                {erros.ativoId?.message}
              </p>
            </fieldset>
          );
        }
        return (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span>Operação</span>
              <select
                className={campo}
                aria-invalid={erros.operacaoId ? true : undefined}
                {...form.register("operacaoId")}
              >
                <option value="">Escolha a operação</option>
                {operacoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
              <span role="alert" className="text-destructive min-h-4 text-xs">
                {erros.operacaoId?.message}
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Destino</span>
              <input
                type="text"
                maxLength={120}
                className={campo}
                aria-invalid={erros.destino ? true : undefined}
                {...form.register("destino")}
              />
              <span role="alert" className="text-destructive min-h-4 text-xs">
                {erros.destino?.message}
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Saída prevista</span>
              <input
                type="date"
                min={hoje}
                className={campo}
                aria-invalid={erros.dataPrevista ? true : undefined}
                {...form.register("dataPrevista")}
              />
              <span role="alert" className="text-destructive min-h-4 text-xs">
                {erros.dataPrevista?.message}
              </span>
            </label>
          </div>
        );
      }}
    />
  );
}
