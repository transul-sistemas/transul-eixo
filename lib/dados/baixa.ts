import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";
import type {
  SituacaoDoPedido,
  PedidoDeBaixa,
  ImpactoDaBaixa,
  PedidoNovoDeBaixa,
} from "./baixa-tipos";

export type {
  MotivoDaBaixa,
  SituacaoDoPedido,
  PedidoDeBaixa,
  ImpactoDaBaixa,
  PedidoNovoDeBaixa,
} from "./baixa-tipos";

// S4, Baixa de placa com quatro olhos. Funções do banco (migration 20261117300000_baixa_com_quatro_olhos.sql):
//  nucleo.pedir_baixa(p_ativo_id, p_motivo, p_em, p_justificativa, p_documento, p_chave) -> uuid
//  nucleo.aprovar_baixa(p_pedido_id, p_versao, p_chave) · nucleo.recusar_baixa(p_pedido_id, p_motivo, p_versao, p_chave)
//  nucleo.cancelar_pedido_de_baixa(p_pedido_id, p_chave) · nucleo.impacto_da_baixa(p_ativo_id, p_em)
//  nucleo.pedidos_de_baixa(p_situacao)

async function ler<T>(
  cliente: ClienteDeEscrita,
  funcao: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await cliente.schema("nucleo").rpc(funcao, args);
  if (error) throw new Error(`${funcao}: ${error.message}`);
  return data as T;
}

async function gravar<K extends string>(
  cliente: ClienteDeEscrita,
  funcao: string,
  args: Record<string, unknown>,
  chave: K,
): Promise<ResultadoDaAcao<Record<K, string>>> {
  const { data, error } = await cliente.schema("nucleo").rpc(funcao, args);
  if (error) return resultadoDoErro(error);
  return sucesso({ [chave]: data as string } as Record<K, string>);
}

export const lerPedidosDeBaixa = async (
  cliente: ClienteDeEscrita,
  situacao: SituacaoDoPedido | null,
) =>
  (await ler<PedidoDeBaixa[] | null>(cliente, "pedidos_de_baixa", { p_situacao: situacao })) ?? [];

export const lerImpactoDaBaixa = (cliente: ClienteDeEscrita, ativoId: string, em: string) =>
  ler<ImpactoDaBaixa>(cliente, "impacto_da_baixa", { p_ativo_id: ativoId, p_em: em });

export const pedirBaixa = (cliente: ClienteDeEscrita, p: PedidoNovoDeBaixa, chave: string) =>
  gravar(
    cliente,
    "pedir_baixa",
    {
      p_ativo_id: p.ativoId,
      p_motivo: p.motivo,
      p_em: p.em,
      p_justificativa: p.justificativa,
      p_documento: p.documento,
      p_chave: chave,
    },
    "pedidoId",
  );

export const aprovarBaixa = (
  cliente: ClienteDeEscrita,
  pedidoId: string,
  versao: number,
  chave: string,
) =>
  gravar(
    cliente,
    "aprovar_baixa",
    { p_pedido_id: pedidoId, p_versao: versao, p_chave: chave },
    "pedidoId",
  );

export const recusarBaixa = (
  cliente: ClienteDeEscrita,
  pedidoId: string,
  motivo: string,
  versao: number,
  chave: string,
) =>
  gravar(
    cliente,
    "recusar_baixa",
    { p_pedido_id: pedidoId, p_motivo: motivo, p_versao: versao, p_chave: chave },
    "pedidoId",
  );

export const cancelarPedidoDeBaixa = (cliente: ClienteDeEscrita, pedidoId: string, chave: string) =>
  gravar(
    cliente,
    "cancelar_pedido_de_baixa",
    { p_pedido_id: pedidoId, p_chave: chave },
    "pedidoId",
  );
