// Os tipos de abastecimento-provisorio.ts, sem código do servidor: a tela (cliente) importa só daqui.

/** Os provisórios em aberto de uma placa no mês (à parte do total do Sankhya). */
export interface ProvisoriosDaPlaca {
  abastecimentos: number;
  litros: number;
  valor: number;
}

/** Um lançamento manual ainda provisório (a conferir com o Sankhya). */
export interface AbastecimentoProvisorio {
  id: string;
  versao: number;
  ativo_id: string;
  placa: string;
  dia: string;
  litros: number;
  valor: number | null;
  km: number | null;
  combustivel: string | null;
  posto: string | null;
  lancado_em: string;
}

/** O bloco que a leitura v2 (nucleo.abastecimento_do_mes_v2) acrescenta à v1. */
export interface ProvisoriosDoMes extends ProvisoriosDaPlaca {
  linhas: AbastecimentoProvisorio[];
}

export type DecisaoDoProvisorio = "conferido" | "descartado";
