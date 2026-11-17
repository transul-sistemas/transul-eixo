// Os tipos de resultado-por-operacao.ts, sem código do servidor: a tela (cliente) importa só daqui.
// Valores em reais (numeric do banco); a tela formata só por components/formato/.

export interface CascataDaOperacao {
  receita: number;
  receita_cte: number;
  receita_nfse: number;
  custo_frota: number;
  custo_servico: number;
  custo: number;
  resultado: number;
  /** Uma casa; nulo sem receita. */
  margem_percentual: number | null;
}

/** nucleo.resultado_por_operacao (Operações › Comparativo e Resultados › Por operação). */
export type ResultadoPorOperacao =
  | { ve_resultado: false; mes: string }
  | {
      ve_resultado: true;
      mes: string;
      kpis: CascataDaOperacao;
      operacoes: (CascataDaOperacao & {
        operacao_id: string;
        nome: string;
        peso_na_receita: number | null;
      })[];
      visao_geral: { receita: number; custo: number; resultado: number };
      /** Visão geral − operações; nulo quando quem consulta não vê todas as operações. */
      fora_das_operacoes: { receita: number; custo: number; resultado: number } | null;
      custo_por_natureza: {
        codnat: string;
        descricao: string;
        valor: number;
        participacao: number | null;
      }[];
      outras_naturezas: { naturezas: number; valor: number; participacao: number | null } | null;
    };

export interface VariacaoDaOperacao {
  operacao_id: string;
  nome: string;
  resultado: number;
  resultado_anterior: number;
  variacao: number;
  variacao_receita: number;
  variacao_custo_frota: number;
  variacao_custo_servico: number;
}

/** nucleo.variacao_das_operacoes (Operações › Análise). */
export type VariacaoDasOperacoes =
  | { ve_resultado: false; mes: string; mes_anterior: string }
  | {
      ve_resultado: true;
      mes: string;
      mes_anterior: string;
      kpis: {
        resultado: number;
        resultado_anterior: number;
        variacao: number;
        maior_alta: { operacao_id: string; nome: string; variacao: number } | null;
        maior_queda: { operacao_id: string; nome: string; variacao: number } | null;
      };
      cascata: {
        resultado_anterior: number;
        variacao_receita: number;
        variacao_custo_frota: number;
        variacao_custo_servico: number;
        resultado: number;
      };
      operacoes: VariacaoDaOperacao[];
    };
