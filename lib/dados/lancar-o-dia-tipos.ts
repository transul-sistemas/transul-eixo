// Os tipos de lancar-o-dia.ts, sem código do servidor: a tela (cliente) importa só daqui.

export interface ResultadoDoLote {
  lote_id: string;
  total: number;
  /** Nulo quando a chave de envio já tinha sido usada (repetido). */
  lancados: number | null;
  recusados: { ativo_id: string; motivo: string; codigo: string }[];
  repetido: boolean;
}

export interface SituacaoProgramada {
  id: string;
  versao: number;
  ativo_id: string;
  placa: string | null;
  dia: string;
  hora: string;
  sigla: string;
  grupo: string | null;
}
