"use client";

import { type RefObject } from "react";
import type { Resolver } from "react-hook-form";
import { Assistente } from "@/components/wizard/assistente";
import { Campo, CLASSE_DO_CAMPO } from "@/components/wizard/campos";
import type { PlacaGravada } from "@/lib/dados/escrita-tipos";
import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import { esquemaDevolverPlaca } from "@/lib/dominio/esquemas/placa";
import { useUsuarioDaSessao } from "@/components/navegacao/usuario-da-sessao";
import type { DefinicaoDeAssistente } from "@/lib/wizard/passos";
import { cn } from "@/lib/utils";
import { devolverPlacaAcao } from "../acoes";
import { errosDoResolvedor } from "./erros-do-resolvedor";
import { OQueChegou } from "./receber-placa";

const CLASSE_DO_TEXTO = cn(CLASSE_DO_CAMPO, "h-auto py-2 max-sm:h-auto");

// Devolver placa: o gestor de destino, depois de receber (pedido em conferência), recusa a placa com
// o motivo. A placa continua na carteira de quem enviou; o pedido fica devolvido.

interface Valores {
  motivo: string;
}

const DEFINICAO: DefinicaoDeAssistente = {
  id: "devolver-placa",
  titulo: "Devolver placa",
  versaoDoEsquema: 1,
  passos: [
    { id: "motivo", titulo: "Motivo", campos: ["motivo"] },
    { id: "conferir", titulo: "Conferir", campos: [] },
  ],
};

export function DevolverPlaca({
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
    motivo: v.motivo,
  });
  const resolver: Resolver<Valores> = async (valores) => {
    const r = esquemaDevolverPlaca.safeParse(entrada(valores));
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
      valoresIniciais={{ motivo: "" }}
      validarRascunho={() => null}
      usuario={usuario}
      registro={placa.placa}
      rascunho={false}
      focoFinal={focoFinal}
      rotuloConcluir="Devolver placa"
      mensagemConcluido={`Placa devolvida. Ela continua na carteira de ${pedido.deGestor}.`}
      aoConcluir={(valores, chaveDeEnvio) =>
        devolverPlacaAcao({ chaveDeEnvio, dados: entrada(valores) })
      }
      descreverAtual={() => (
        <p>O pedido mudou desde que você o abriu. Feche e abra de novo para ver como está.</p>
      )}
      aoFechar={aoFechar}
      resumo={(v) => [
        {
          titulo: "Devolução",
          linhas: [
            { rotulo: "Placa", valor: placa.placa },
            { rotulo: "De", valor: pedido.deGestor },
            { rotulo: "Motivo", valor: v.motivo },
          ],
        },
      ]}
      efeitos={() => [
        <>
          O pedido fica devolvido a <b>{pedido.deGestor}</b>, com o seu motivo.
        </>,
        <>
          A placa <b>{placa.placa}</b> continua na carteira de {pedido.deGestor}.
        </>,
      ]}
      renderPasso={(_, form) => (
        <>
          <OQueChegou pedido={pedido} />
          <Campo
            rotulo="Motivo da devolução"
            erro={form.formState.errors.motivo?.message}
            ajuda="Diga o que impede receber a placa, como avaria ou documento que não veio."
          >
            {(p) => (
              <textarea {...p} {...form.register("motivo")} rows={3} className={CLASSE_DO_TEXTO} />
            )}
          </Campo>
        </>
      )}
    />
  );
}
