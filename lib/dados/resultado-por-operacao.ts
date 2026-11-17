import type { ClienteDeEscrita } from "./escrita-do-banco";
import type { ResultadoPorOperacao, VariacaoDasOperacoes } from "./resultado-por-operacao-tipos";

export type {
  CascataDaOperacao,
  ResultadoPorOperacao,
  VariacaoDaOperacao,
  VariacaoDasOperacoes,
} from "./resultado-por-operacao-tipos";

// Funções do banco (migration 20261118400000_resultado_e_variacao_por_operacao.sql):
//  nucleo.resultado_por_operacao(p_mes) -> jsonb (Comparativo e Resultados › Por operação)
//  nucleo.variacao_das_operacoes(p_mes) -> jsonb (Operações › Análise)

export async function lerResultadoPorOperacao(
  cliente: ClienteDeEscrita,
  mes: string | null,
): Promise<ResultadoPorOperacao> {
  const { data, error } = await cliente
    .schema("nucleo")
    .rpc("resultado_por_operacao", { p_mes: mes });
  if (error) throw new Error(`resultado_por_operacao: ${error.message}`);
  return data as ResultadoPorOperacao;
}

export async function lerVariacaoDasOperacoes(
  cliente: ClienteDeEscrita,
  mes: string | null,
): Promise<VariacaoDasOperacoes> {
  const { data, error } = await cliente
    .schema("nucleo")
    .rpc("variacao_das_operacoes", { p_mes: mes });
  if (error) throw new Error(`variacao_das_operacoes: ${error.message}`);
  return data as VariacaoDasOperacoes;
}
