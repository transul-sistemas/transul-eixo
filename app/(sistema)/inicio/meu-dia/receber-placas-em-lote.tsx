"use client";

import { useCallback, useRef, useState } from "react";
import type { Resolver } from "react-hook-form";
import { formatarInteiro } from "@/components/formato/numero";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import { Placa } from "@/components/placa";
import { Assistente } from "@/components/wizard/assistente";
import { CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import {
  type ChamadasDoLote,
  type Decisao,
  decisoesPermitidas,
  executarLote,
  type LinhaDoPedido,
  MOTIVO_MAXIMO,
  problemasDoLote,
  type ProgressoDoLote,
  ROTULO_DA_DECISAO,
  resumoDoLote,
  type ResultadoDaPlaca,
} from "@/lib/dominio/meu-dia";
import { novaChaveDeEnvio } from "@/lib/wizard/chave-de-envio";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { erroDaAcao, type ResultadoDaAcao } from "@/lib/wizard/resultado";
import {
  concluirRecebimentoAcao,
  devolverPlacaAcao,
  receberPlacaAcao,
} from "../../frota/placas/acoes";
import { errosDoResolvedor } from "../../frota/placas/assistentes/erros-do-resolvedor";
import { registrarPlacaSemCrAcao } from "./acoes";
import { ColunaDoCr, ColunaDoEnvio, OlhinhoDoPedido, PendenciasDoPedido } from "./colunas-do-lote";

// Receber placas em lote (Meu dia, tarefa 1): um popup central; para cada placa um pedido independente
// com Aceitar, Com pendências ou Recusar (motivo obrigatório). Usa só as funções atômicas que já existem
// (receber, concluir recebimento e devolver), uma por placa, cada uma na sua transação: uma falha não
// derruba as outras, e repetir o clique não duplica (a mesma chave de envio por placa e etapa).

interface Item {
  pedidoId: string;
  decisao: "" | Decisao;
  motivo: string;
}
interface Valores {
  itens: Item[];
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "receber-placas-em-lote",
  titulo: "Receber placas",
  versaoDoEsquema: 1,
  passos: [
    { id: "decisoes", titulo: "Decisões", campos: ["itens"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const DECISOES: readonly Decisao[] = ["aceitar", "aceitar_com_pendencias", "recusar"];

// As chamadas são as Server Actions que já existem; cada uma confere permissão e valida com Zod.
const CHAMADAS: ChamadasDoLote = {
  receber: (dados, chaveDeEnvio) => receberPlacaAcao({ chaveDeEnvio, dados }),
  concluir: (dados, chaveDeEnvio) => concluirRecebimentoAcao({ chaveDeEnvio, dados }),
  devolver: (dados, chaveDeEnvio) => devolverPlacaAcao({ chaveDeEnvio, dados }),
  // Placa aceita sem CR vigente: abre a exceção "placa sem CR" (a mesma chave a cada tentativa).
  registrarSemCr: (dados, chaveDeEnvio) => registrarPlacaSemCrAcao({ chaveDeEnvio, dados }),
};

export function ReceberPlacasEmLote({
  linhas,
  hoje,
  aoFechar,
}: {
  linhas: LinhaDoPedido[];
  /** Hoje em São Paulo (`aaaa-mm-dd`): de onde vem o "há N dias" de cada pedido. */
  hoje: string;
  aoFechar: () => void;
}) {
  const usuario = useUsuarioDaSessao();
  const pedidos = linhas.map((l) => l.pedido);
  // O que já foi gravado por pedido: "Tentar de novo" retoma de onde parou, sem duplicar.
  const progresso = useRef<ProgressoDoLote>(new Map());
  const [resultados, setResultados] = useState<ResultadoDaPlaca[]>([]);

  const itensDe = (v: Valores) =>
    pedidos.map((pedido, i) => ({
      pedido,
      decisao: (v.itens?.[i]?.decisao || null) as Decisao | null,
      motivo: v.itens?.[i]?.motivo ?? "",
      crs: linhas[i]?.crs ?? null,
    }));

  const resolver: Resolver<Valores> = async (valores) => {
    const itens = itensDe(valores);
    const problemas = problemasDoLote(itens).map((p) => {
      const i = pedidos.findIndex((x) => x.id === p.pedidoId);
      const recusando = i >= 0 && itens[i]?.decisao === "recusar";
      return {
        path: ["itens", Math.max(i, 0), recusando ? "motivo" : "decisao"],
        message: p.mensagem,
      };
    });
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };

  // O rascunho só vale para os pedidos que ainda existem (o que mudou desde então volta em branco).
  const validarRascunho = useCallback(
    (bruto: unknown): Partial<Valores> | null => {
      const guardados = (bruto as Valores | null)?.itens;
      if (!Array.isArray(guardados)) return null;
      return {
        itens: pedidos.map((p) => {
          const antigo = guardados.find((x) => x?.pedidoId === p.id);
          const guardada = antigo?.decisao as Decisao | undefined;
          const decisao: "" | Decisao =
            guardada !== undefined &&
            DECISOES.includes(guardada) &&
            decisoesPermitidas(p).includes(guardada)
              ? guardada
              : "";
          return {
            pedidoId: p.id,
            decisao,
            motivo: typeof antigo?.motivo === "string" ? antigo.motivo.slice(0, MOTIVO_MAXIMO) : "",
          };
        }),
      };
    },
    [pedidos],
  );

  const aoConcluir = useCallback(
    async (valores: Valores): Promise<ResultadoDaAcao<ResultadoDaPlaca[]>> => {
      const itens = pedidos.map((pedido, i) => ({
        pedido,
        decisao: (valores.itens?.[i]?.decisao || null) as Decisao | null,
        motivo: valores.itens?.[i]?.motivo ?? "",
        crs: linhas[i]?.crs ?? null,
      }));
      const feitos = await executarLote(itens, CHAMADAS, progresso.current, novaChaveDeEnvio);
      setResultados(feitos);
      const resumo = resumoDoLote(feitos);
      if (resumo.falhas > 0) return erroDaAcao("falha", { mensagem: resumo.texto });
      return { ok: true, linha: feitos };
    },
    [pedidos, linhas],
  );

  const resumoFinal = resumoDoLote(resultados);
  const nomeDe = (id: string) => pedidos.find((p) => p.id === id)?.placa ?? "";

  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{
        itens: pedidos.map((p) => ({ pedidoId: p.id, decisao: "", motivo: "" })),
      }}
      validarRascunho={validarRascunho}
      usuario={usuario}
      registro="lote"
      aoFechar={aoFechar}
      rotuloConcluir="Confirmar decisões"
      mensagemConcluido={`${resumoFinal.texto} Siga para a próxima tarefa do seu dia.`}
      aoConcluir={aoConcluir}
      descreverErro={() => (
        <ul
          className="flex w-full flex-col gap-2 text-left text-sm"
          aria-label="Placas que não foram gravadas"
        >
          {resultados
            .filter((r) => r.situacao === "falhou")
            .map((r) => (
              <li key={r.pedidoId} className="border-border rounded-lg border p-2">
                <span className="font-semibold">{nomeDe(r.pedidoId)}</span>
                <span className="text-muted-foreground block">{r.erro}</span>
              </li>
            ))}
          <li className="text-muted-foreground list-none text-xs">
            Tentar de novo grava só as placas que falharam; as que já foram gravadas não se repetem.
          </li>
        </ul>
      )}
      resumo={(v) => {
        const itens = itensDe(v);
        const contar = (d: Decisao) => itens.filter((i) => i.decisao === d).length;
        return [
          {
            titulo: "Decisões",
            linhas: [
              { rotulo: "Aceitas", valor: formatarInteiro(contar("aceitar")) },
              {
                rotulo: "Com pendências",
                valor: formatarInteiro(contar("aceitar_com_pendencias")),
              },
              { rotulo: "Recusadas", valor: formatarInteiro(contar("recusar")) },
              {
                rotulo: "Sem decisão",
                valor: formatarInteiro(itens.filter((i) => i.decisao === null).length),
              },
            ],
          },
          {
            titulo: "Placas",
            linhas: itens.map((i) => ({
              rotulo: i.pedido.placa,
              valor: i.decisao ? ROTULO_DA_DECISAO[i.decisao] : "Sem decisão",
            })),
          },
        ];
      }}
      efeitos={(v) => {
        const itens = itensDe(v);
        const n = (d: Decisao) => itens.filter((i) => i.decisao === d).length;
        return [
          "Cada placa é um pedido independente: se uma não for gravada, as outras seguem e a tela diz qual falhou e por quê.",
          `${formatarInteiro(n("aceitar") + n("aceitar_com_pendencias"))} placa(s) passam para a sua carteira; nas aceitas com pendências, cada pendência fica registrada no pedido.`,
          `${formatarInteiro(n("recusar"))} placa(s) voltam ao gestor de origem, com o motivo.`,
        ];
      }}
      renderPasso={(passo, form) => {
        if (passo.id !== "decisoes") return null;
        const atuais = form.watch("itens") ?? [];
        const erros = form.formState.errors.itens;
        return (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Tarefa 1 de 3 do seu dia ·{" "}
              {linhas.length === 1
                ? "1 pedido esperando você"
                : `${formatarInteiro(linhas.length)} pedidos esperando você`}
            </p>
            <div className="border-border overflow-x-auto rounded-xl border">
              <table className="w-full text-sm" aria-label="Placas para receber">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Placa
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Enviada por
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      CR vigente
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Pendências
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">
                      Sua decisão
                    </th>
                    <th scope="col" className="w-10 px-3 py-2">
                      <span className="sr-only">Detalhes</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha, i) => {
                    const { pedido } = linha;
                    const permitidas = decisoesPermitidas(pedido);
                    const decisao = atuais[i]?.decisao;
                    const erroDecisao = erros?.[i]?.decisao?.message;
                    const erroMotivo = erros?.[i]?.motivo?.message;
                    return (
                      <tr
                        key={pedido.id}
                        data-pedido={pedido.placa}
                        className="border-border border-t align-top"
                      >
                        <th scope="row" className="px-3 py-2 text-left font-normal">
                          <Placa placa={pedido.placa} tamanho="m" />
                          {pedido.situacao === "em_conferencia" ? (
                            <span className="text-muted-foreground mt-1 block text-xs">
                              Chegada já registrada
                            </span>
                          ) : null}
                        </th>
                        <td className="px-3 py-2">
                          <ColunaDoEnvio linha={linha} hoje={hoje} />
                        </td>
                        <td className="px-3 py-2">
                          <ColunaDoCr linha={linha} />
                        </td>
                        <td className="px-3 py-2">
                          <PendenciasDoPedido linha={linha} />
                        </td>
                        <td className="min-w-64 px-3 py-2">
                          <div
                            role="radiogroup"
                            aria-label={`Decisão para a placa ${pedido.placa}`}
                            className="flex flex-wrap gap-x-3 gap-y-1"
                          >
                            {DECISOES.map((d) => (
                              <label
                                key={d}
                                className={`flex min-h-8 items-center gap-1.5 ${permitidas.includes(d) ? "" : "text-muted-foreground opacity-50"}`}
                              >
                                <input
                                  type="radio"
                                  className="size-4"
                                  value={d}
                                  disabled={!permitidas.includes(d)}
                                  {...form.register(`itens.${i}.decisao`)}
                                />
                                {ROTULO_DA_DECISAO[d]}
                              </label>
                            ))}
                          </div>
                          <p role="alert" className="text-destructive min-h-4 text-xs">
                            {erroDecisao}
                          </p>
                          {decisao === "recusar" ? (
                            <label className="flex flex-col gap-1 text-sm">
                              <span>Motivo (obrigatório)</span>
                              <input
                                {...form.register(`itens.${i}.motivo`)}
                                autoComplete="off"
                                maxLength={MOTIVO_MAXIMO}
                                aria-invalid={erroMotivo ? true : undefined}
                                className={CLASSE_DO_CAMPO}
                              />
                              <span role="alert" className="text-destructive min-h-4 text-xs">
                                {erroMotivo}
                              </span>
                            </label>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <OlhinhoDoPedido linha={linha} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }}
    />
  );
}
