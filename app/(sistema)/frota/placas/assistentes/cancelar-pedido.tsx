"use client";

import { type RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { Assistente } from "@/components/wizard/assistente";
import type { PlacaGravada } from "@/lib/dados/escrita-tipos";
import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import { esquemaCancelarPedido } from "@/lib/dominio/esquemas/placa";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { cancelarPedidoAcao } from "../acoes";
import { errosDoResolvedor } from "./erros-do-resolvedor";
import { OQueChegou } from "./receber-placa";

// Cancelar pedido: o gestor de origem desiste do pedido de transferência enquanto o destino ainda
// não recebeu a placa. A carteira não muda. Ação destrutiva: pede a confirmação com a placa.

interface Valores {
  confirmado: boolean;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "cancelar-pedido",
  titulo: "Cancelar pedido",
  versaoDoEsquema: 1,
  passos: [
    { id: "pedido", titulo: "Pedido", campos: ["confirmado"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function CancelarPedido({
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
    confirmado: v.confirmado,
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaCancelarPedido.safeParse(entrada(valores));
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
      valoresIniciais={{ confirmado: false }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Cancelar pedido"
      mensagemConcluido={`Pedido cancelado. A placa ${placa.placa} continua na sua carteira.`}
      aoConcluir={(valores, chaveDeEnvio) =>
        cancelarPedidoAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>
          O pedido mudou desde que você o abriu (talvez {pedido.paraGestor} já tenha recebido a
          placa). Feche e abra de novo para ver como está.
        </p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Pedido",
          linhas: [
            { rotulo: "Placa", valor: placa.placa },
            { rotulo: "Para", valor: pedido.paraGestor },
            { rotulo: "Motivo", valor: pedido.motivo },
            { rotulo: "Confirmado", valor: v.confirmado ? "Sim" : "Não" },
          ],
        },
      ]}
      efeitos={() => [
        <>
          O pedido para <b>{pedido.paraGestor}</b> fica cancelado e sai de Para receber.
        </>,
        <>
          A placa <b>{placa.placa}</b> continua na sua carteira.
        </>,
      ]}
      renderPasso={(_, form) => {
        const erro = form.formState.errors.confirmado?.message;
        return (
          <>
            <OQueChegou pedido={pedido} />
            <div className="flex flex-col gap-1">
              <label className="flex min-h-9 items-center gap-2 text-sm max-sm:min-h-11">
                <input
                  type="checkbox"
                  className="size-4"
                  aria-invalid={erro ? true : undefined}
                  {...form.register("confirmado")}
                />
                <span>Quero cancelar o pedido da placa {placa.placa}</span>
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
