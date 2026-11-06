"use client";

import { type RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { agoraEmSaoPaulo, formatarDataEHora } from "@/components/formato/data";
import { Assistente } from "@/components/wizard/assistente";
import type { PlacaGravada } from "@/lib/dados/escrita-tipos";
import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import { esquemaReceberPlaca } from "@/lib/dominio/esquemas/placa";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { receberPlacaAcao } from "../acoes";
import { errosDoResolvedor } from "./erros-do-resolvedor";

// Receber placa (primeira etapa, opção B): o gestor de destino registra que a placa chegou e
// confere o que veio. A carteira ainda não muda: isso é o "Concluir recebimento", que responde cada
// pendência. Confere a versão do pedido (se alguém agiu antes, avisa).

interface Valores {
  conferido: boolean;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "receber-placa",
  titulo: "Receber placa",
  versaoDoEsquema: 2,
  passos: [
    { id: "chegada", titulo: "Chegada", campos: ["conferido"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

/** O que o gestor de origem deixou: o motivo e as pendências (comum às duas etapas). */
export function OQueChegou({ pedido }: { pedido: PedidoDeTransferencia }) {
  return (
    <div className="bg-muted/50 flex flex-col gap-2 rounded-lg p-3 text-sm">
      <p className="text-muted-foreground">Enviada por {pedido.deGestor}. Motivo:</p>
      <p data-testid="motivo-da-transferencia">{pedido.motivo}</p>
      {pedido.pendenciasConhecidas.length > 0 ? (
        <>
          <p className="text-muted-foreground">Pendências que o gestor deixou</p>
          <ul className="list-disc pl-5">
            {pedido.pendenciasConhecidas.map((p) => (
              <li key={p.id}>{p.texto}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-muted-foreground">Sem pendências conhecidas.</p>
      )}
    </div>
  );
}

export function ReceberPlaca({
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
    conferido: v.conferido,
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaReceberPlaca.safeParse(entrada(valores));
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
      valoresIniciais={{ conferido: false }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Receber placa"
      mensagemConcluido="Placa recebida. Agora conclua o recebimento, respondendo cada pendência."
      aoConcluir={(valores, chaveDeEnvio) =>
        receberPlacaAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>O pedido mudou desde que você o abriu. Feche e abra de novo para ver como está.</p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Chegada",
          linhas: [
            { rotulo: "Placa", valor: placa.placa },
            { rotulo: "De", valor: pedido.deGestor },
            { rotulo: "Motivo", valor: pedido.motivo },
            { rotulo: "Pendências", valor: String(pedido.pendenciasConhecidas.length) },
            { rotulo: "Conferido", valor: v.conferido ? "Sim" : "Não" },
          ],
        },
      ]}
      efeitos={() => [
        <>
          A chegada fica registrada em <b>{formatarDataEHora(agoraEmSaoPaulo(new Date()))}</b>.
        </>,
        <>
          A placa continua na carteira de <b>{pedido.deGestor}</b> até você concluir o recebimento.
        </>,
        "No próximo passo, Concluir recebimento, você responde cada pendência.",
      ]}
      renderPasso={(_, form) => {
        const erro = form.formState.errors.conferido?.message;
        return (
          <>
            <OQueChegou pedido={pedido} />
            <div className="flex flex-col gap-1">
              <label className="flex min-h-9 items-center gap-2 text-sm max-sm:min-h-11">
                <input
                  type="checkbox"
                  className="size-4"
                  aria-invalid={erro ? true : undefined}
                  {...form.register("conferido")}
                />
                <span>Conferi o que chegou</span>
              </label>
              <p role="alert" className="text-destructive min-h-4 text-xs">
                {erro}
              </p>
            </div>
          </>
        );
      }}
    />
  );
}
