"use client";

import { type RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { agoraEmSaoPaulo, formatarDataEHora } from "@/components/formato/data";
import { Assistente } from "@/components/wizard/assistente";
import { CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { PlacaGravada } from "@/lib/dados/escrita-tipos";
import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import { esquemaConcluirRecebimento } from "@/lib/dominio/esquemas/placa";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { concluirRecebimentoAcao } from "../acoes";
import { errosDoResolvedor } from "./erros-do-resolvedor";
import { OQueChegou } from "./receber-placa";

// Concluir recebimento (segunda etapa, opção B): o gestor de destino responde cada pendência
// (resolvida: sim ou não; quando não, a nota diz o que ficou) e a placa passa para a carteira dele.

interface Valores {
  /** Uma resposta por pendência, na ordem do pedido. "" ainda sem resposta. */
  pendencias: { id: string; resolvida: "" | "sim" | "nao"; nota: string }[];
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "concluir-recebimento",
  titulo: "Concluir recebimento",
  versaoDoEsquema: 1,
  passos: [
    { id: "pendencias", titulo: "Pendências", campos: ["pendencias"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

const SEM_RESPOSTA = "Diga se a pendência foi resolvida.";

export function ConcluirRecebimento({
  placa,
  pedido,
  aoFechar,
  focoFinal,
}: {
  placa: PlacaGravada;
  pedido: PedidoDeTransferencia;
  aoFechar: () => void;
  focoFinal?: RefObject<HTMLElement | null>;
}) {
  const usuario = useUsuarioDaSessao();
  const entrada = (v: Valores) => ({
    placa: placa.placa,
    pedidoId: pedido.id,
    versaoDoPedido: pedido.versao,
    pendencias: (v.pendencias ?? []).map((p) => ({
      id: p.id,
      resolvida: p.resolvida === "" ? undefined : p.resolvida === "sim",
      nota: p.nota,
    })),
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaConcluirRecebimento.safeParse(entrada(valores));
    const problemas = r.success
      ? []
      : r.error.issues.map((i) => ({
          path: i.path,
          message: i.path.at(-1) === "resolvida" ? SEM_RESPOSTA : i.message,
        }));
    return problemas.length === 0
      ? { values: valores, errors: {} }
      : { values: {}, errors: errosDoResolvedor<Valores>(problemas) };
  };
  const textoDe = (id: string) => pedido.pendenciasConhecidas.find((p) => p.id === id)?.texto ?? id;
  return (
    <Assistente<Valores>
      definicao={DEFINICAO}
      resolver={resolver}
      valoresIniciais={{
        pendencias: pedido.pendenciasConhecidas.map((p) => ({ id: p.id, resolvida: "", nota: "" })),
      }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Concluir recebimento"
      mensagemConcluido="Recebimento concluído. A placa está na sua carteira."
      aoConcluir={(valores, chaveDeEnvio) =>
        concluirRecebimentoAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>O pedido mudou desde que você o abriu. Feche e abra de novo para ver como está.</p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Pendências",
          linhas: (v.pendencias ?? []).map((p) => ({
            rotulo: textoDe(p.id),
            valor:
              p.resolvida === "sim"
                ? "Resolvida"
                : p.resolvida === "nao"
                  ? `Não resolvida${p.nota.trim() ? `: ${p.nota.trim()}` : ""}`
                  : "",
          })),
        },
      ]}
      efeitos={() => [
        <>
          A placa passa da carteira de <b>{pedido.deGestor}</b> para a de <b>{pedido.paraGestor}</b>
          , em <b>{formatarDataEHora(agoraEmSaoPaulo(new Date()))}</b>.
        </>,
        "Cada resposta fica registrada no pedido, com quem respondeu e quando.",
        "A situação, a operação e o conjunto da placa não mudam por esta ação.",
      ]}
      renderPasso={(_, form) => {
        const respostas = form.watch("pendencias") ?? [];
        const erros = form.formState.errors.pendencias;
        return (
          <>
            <OQueChegou pedido={pedido} />
            {pedido.pendenciasConhecidas.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhuma pendência para responder. Siga para conferir e concluir.
              </p>
            ) : (
              pedido.pendenciasConhecidas.map((p, i) => {
                const erroDaResposta = erros?.[i]?.resolvida?.message;
                const erroDaNota = erros?.[i]?.nota?.message;
                return (
                  <fieldset key={p.id} className="flex flex-col gap-2 rounded-lg border p-3">
                    <legend className="px-1 text-sm">{p.texto}</legend>
                    <div
                      role="radiogroup"
                      aria-label={`Resolvida: ${p.texto}`}
                      className="flex gap-4"
                    >
                      {(["sim", "nao"] as const).map((opcao) => (
                        <label key={opcao} className="flex min-h-9 items-center gap-2 text-sm">
                          <input
                            type="radio"
                            className="size-4"
                            value={opcao}
                            {...form.register(`pendencias.${i}.resolvida`)}
                          />
                          {opcao === "sim" ? "Resolvida" : "Não resolvida"}
                        </label>
                      ))}
                    </div>
                    <p role="alert" className="text-destructive min-h-4 text-xs">
                      {erroDaResposta}
                    </p>
                    <label className="flex flex-col gap-1 text-sm">
                      <span>
                        Nota
                        {respostas[i]?.resolvida === "nao" ? " (diga o que ficou pendente)" : ""}
                      </span>
                      <input
                        {...form.register(`pendencias.${i}.nota`)}
                        autoComplete="off"
                        aria-invalid={erroDaNota ? true : undefined}
                        className={CLASSE_DO_CAMPO}
                      />
                    </label>
                    <p role="alert" className="text-destructive min-h-4 text-xs">
                      {erroDaNota}
                    </p>
                  </fieldset>
                );
              })
            )}
          </>
        );
      }}
    />
  );
}
