import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import { crsVigentesEm, type LinhaDoPedido } from "@/lib/dominio/meu-dia";
import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, paraPedido, resultadoDoErro } from "./escrita-do-banco";
import type { FonteDeEscrita } from "./fonte";

/** Um pedido aberto com o que só a leitura do Meu dia traz: a data de envio e o prazo. */
export interface PedidoAberto {
  pedido: PedidoDeTransferencia;
  enviadaEm: string | null;
  prazoDias: number | null;
}

type PedidoDoMeuDia = Parameters<typeof paraPedido>[0] & {
  enviada_em?: string | null;
  prazo_dias?: number | null;
};

/**
 * Os pedidos abertos pela função de leitura nucleo.pedidos_do_meu_dia (security invoker: a RLS de quem
 * chama vale). `todos` é o modo leitura do Administrador; sem ele, só o que espera o próprio usuário.
 * Erro de leitura vira exceção (a tela mostra "tentar de novo"); nunca lista vazia calada.
 */
export async function lerPedidosAbertosDoMeuDia(
  cliente: ClienteDeEscrita,
  todos: boolean,
): Promise<PedidoAberto[]> {
  const { data, error } = await cliente
    .schema("nucleo")
    .rpc("pedidos_do_meu_dia", { p_todos: todos });
  if (error) throw new Error(`pedidos_do_meu_dia: ${error.message}`);
  return ((data ?? []) as PedidoDoMeuDia[]).map((p) => ({
    pedido: paraPedido(p),
    enviadaEm: p.enviada_em ?? null,
    prazoDias: p.prazo_dias ?? null,
  }));
}

/**
 * Depois de aceitar uma placa sem CR vigente: abre a exceção "placa sem CR" (função atômica, com chave
 * de envio; fecha a aberta se a placa já ganhou CR). Só o gestor de destino do pedido concluído.
 */
export async function registrarPlacaSemCr(
  cliente: ClienteDeEscrita,
  pedidoId: string,
  chaveDeEnvio: string,
): Promise<ResultadoDaAcao<{ pedidoId: string }>> {
  const { error } = await cliente
    .schema("nucleo")
    .rpc("registrar_placa_aceita_sem_cr", { p_transferencia_id: pedidoId, p_chave: chaveDeEnvio });
  if (error) return resultadoDoErro(error);
  return sucesso({ pedidoId });
}

// Meu dia › Receber placas: os pedidos que esperam o gestor, cada um com o CR vigente de hoje e a
// operação da placa. Só lê, pelas funções que já existem (pedidos_para_receber e a leitura da placa
// dos assistentes); nenhuma função nova do banco.

export async function lerPedidosDoMeuDia(
  fonte: Pick<FonteDeEscrita, "pedidosParaReceber" | "placaParaAssistente">,
  gestorId: string,
  hoje: string,
  abertos?: () => Promise<PedidoAberto[]>,
): Promise<LinhaDoPedido[]> {
  // Sem a leitura do banco (modo exemplo), vale a da fonte, sem data de envio.
  const lidos: PedidoAberto[] = abertos
    ? await abertos()
    : (await fonte.pedidosParaReceber(gestorId)).map((pedido) => ({
        pedido,
        enviadaEm: null,
        prazoDias: null,
      }));
  return Promise.all(
    lidos.map(async ({ pedido, enviadaEm, prazoDias }): Promise<LinhaDoPedido> => {
      const envio = { enviadaEm, prazoDias };
      try {
        const placa = await fonte.placaParaAssistente(pedido.placa);
        if (placa === null) return { pedido, crs: null, operacao: null, ...envio };
        return {
          pedido,
          crs: crsVigentesEm(placa.crs, hoje).map(({ codigo, nome }) => ({ codigo, nome })),
          operacao: placa.operacao,
          ...envio,
        };
      } catch {
        // Uma placa que não se consegue ler não derruba a lista: a linha diz que o CR não foi lido.
        return { pedido, crs: null, operacao: null, ...envio };
      }
    }),
  );
}
