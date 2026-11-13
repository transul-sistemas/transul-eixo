// Os tipos de operacional-lote.ts, sem código do servidor: a tela (cliente) importa só daqui.

/** Os KPIs do Pátio, do Totem e das Ordens (nucleo.kpis_do_operacional), prontos no banco. */
export interface KpisDoOperacional {
  no_patio: number;
  na_fila: number;
  /** Minutos desde a chegada mais antiga na fila; nulo sem fila. */
  maior_espera_min: number | null;
  /** Média dos minutos desde a entrega ao Operacional; nulo sem placa. */
  tempo_medio_no_patio_min: number | null;
  por_situacao: { DOp: number; ACe: number; CAr: number; CAn: number };
  ordens_abertas: number;
  ordens_criadas_hoje: number;
  ordens_em_viagem_hoje: number;
}

export type AcaoNoPatio = "aceitar" | "concluir" | "liberar" | "devolver";

/** O lote do pátio: tudo ou nada, com "avançadas de total" e os recusados com o motivo. */
export interface ResultadoDoLoteDoPatio {
  lote_id: string;
  total: number;
  /** Nulo quando a chave de envio já tinha sido usada (repetido). */
  avancados: number | null;
  recusados: { ativo_id: string; motivo: string; codigo: string }[];
  repetido: boolean;
}
