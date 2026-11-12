import { crsVigentesEm, type LinhaDoPedido } from "@/lib/dominio/meu-dia";
import type { FonteDeEscrita } from "./fonte";

// Meu dia › Receber placas: os pedidos que esperam o gestor, cada um com o CR vigente de hoje e a
// operação da placa. Só lê, pelas funções que já existem (pedidos_para_receber e a leitura da placa
// dos assistentes); nenhuma função nova do banco.

export async function lerPedidosDoMeuDia(
  fonte: Pick<FonteDeEscrita, "pedidosParaReceber" | "placaParaAssistente">,
  gestorId: string,
  hoje: string,
): Promise<LinhaDoPedido[]> {
  const pedidos = await fonte.pedidosParaReceber(gestorId);
  return Promise.all(
    pedidos.map(async (pedido): Promise<LinhaDoPedido> => {
      try {
        const placa = await fonte.placaParaAssistente(pedido.placa);
        if (placa === null) return { pedido, crs: null, operacao: null };
        return {
          pedido,
          crs: crsVigentesEm(placa.crs, hoje).map(({ codigo, nome }) => ({ codigo, nome })),
          operacao: placa.operacao,
        };
      } catch {
        // Uma placa que não se consegue ler não derruba a lista: a linha diz que o CR não foi lido.
        return { pedido, crs: null, operacao: null };
      }
    }),
  );
}
