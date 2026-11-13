// Os tipos de baixa.ts, sem código do servidor: a tela (cliente) importa só daqui.

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
