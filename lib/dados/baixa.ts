import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";

// S4, Baixa de placa com quatro olhos. Funções do banco (migration 20261117300000_baixa_com_quatro_olhos.sql):
//  nucleo.pedir_baixa(p_ativo_id, p_motivo, p_em, p_justificativa, p_documento, p_chave) -> uuid
//  nucleo.aprovar_baixa(p_pedido_id, p_versao, p_chave) · nucleo.recusar_baixa(p_pedido_id, p_motivo, p_versao, p_chave)
//  nucleo.cancelar_pedido_de_baixa(p_pedido_id, p_chave) · nucleo.impacto_da_baixa(p_ativo_id, p_em)
//  nucleo.pedidos_de_baixa(p_situacao)

/** Por motivo, sem sigla nova: venda e devolução gravam VND; sucata e sinistro, SUC. */
export type MotivoDaBaixa = "venda" | "sinistro" | "sucata" | "devolucao";
export type SituacaoDoPedido = "pedida" | "aprovada" | "recusada" | "cancelada";

export interface PedidoDeBaixa {
  id: string;
  versao: number;
  ativo_id: string;
  placa: string | null;
  motivo: MotivoDaBaixa;
  sigla: "VND" | "SUC";
  em: string;
  justificativa: string;
  documento: string | null;
  situacao: SituacaoDoPedido;
  pedido_por: string;
  pedido_por_nome: string | null;
  pedido_em: string;
  decidido_por_nome: string | null;
  decidido_em: string | null;
  motivo_da_decisao: string | null;
  prazo_ate: string;
  atrasado: boolean;
}

export interface ImpactoDaBaixa {
  ja_baixada: boolean;
  pedido_aberto: boolean;
  transferencia_aberta: boolean;
  em_conjunto: boolean;
  operacao: string | null;
  crs_que_encerram: { cr_id: string; codigo: string; tipo: string }[];
}

export interface PedidoNovoDeBaixa {
  ativoId: string;
  motivo: MotivoDaBaixa;
  em: string;
  justificativa: string;
  /** Caminho do anexo no Storage (o comprador e o valor ficam nele, nunca no sistema). */
  documento: string | null;
}

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
