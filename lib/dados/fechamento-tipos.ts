// Os tipos de fechamento.ts, sem código do servidor: a tela (cliente) importa só daqui.
// Valores em reais (numeric do banco); a tela formata só por components/formato/.

export interface FotoDoFechamento {
  id: string;
  versao: number;
  mes: string;
  situacao: "fechado" | "reaberto";
  receita: number;
  custo: number;
  resultado: number;
  fechado_em: string;
  fechado_por: string | null;
  reaberto_em: string | null;
  reaberto_por: string | null;
  motivo_da_reabertura: string | null;
}

/** nucleo.fechamentos_do_resultado (Resultados › Fechamentos). */
export interface FechamentosDoResultado {
  mes_que_pode_fechar: string;
  kpis: {
    fechados: number;
    ultimo: { mes: string; fechado_em: string; fechado_por: string | null } | null;
    /** Resultado da Visão geral hoje − foto do último fechado; nulo sem fechamento. */
    diferenca_contra_o_vivo: number | null;
    reaberturas: number;
  };
  linhas: FotoDoFechamento[];
}

export type LinhaDoAjuste = "receita" | "custo_frota" | "custo_servico";
export type SituacaoDoAjuste = "pedido" | "aprovado" | "recusado";

export interface Ajuste {
  id: string;
  versao: number;
  numero: number;
  mes: string;
  operacao_id: string | null;
  operacao: string | null;
  cr: string | null;
  linha: LinhaDoAjuste;
  valor: number;
  justificativa: string;
  situacao: SituacaoDoAjuste;
  pedido_por: string | null;
  pedido_em: string;
  decidido_por: string | null;
  decidido_em: string | null;
  motivo_da_decisao: string | null;
}

/** nucleo.ajustes_do_resultado (Resultados › Ajustes). */
export interface AjustesDoResultado {
  mes: string | null;
  kpis: { pendentes: number; aprovados_no_mes: number; recusados: number; valor_ajustado: number };
  contagens: { todas: number; pedido: number; aprovado: number; recusado: number };
  por_situacao: { situacao: SituacaoDoAjuste; n: number; valor: number }[];
  por_operacao: { operacao: string; n: number; valor: number }[];
  por_linha: { linha: LinhaDoAjuste; n: number; valor: number }[];
  linhas: Ajuste[];
  total: number;
  pagina: number;
  paginas: number;
  tam: number;
}

/** nucleo.maturacao_da_divida (Resultados › Maturação). */
export interface MaturacaoDaDivida {
  inicio: string;
  fim: string;
  kpis: { negociado: number; pago: number; saldo: number; percentual: number | null };
  pago_por_mes: { mes: string; valor: number }[];
  saldo_por_operacao: { operacao: string; saldo: number }[];
  titulos_com_saldo: number;
  linhas: {
    titulo: string;
    operacao: string | null;
    negociado_em: string;
    valor: number;
    saldo: number;
  }[];
  pagina: number;
  tam: number;
}
