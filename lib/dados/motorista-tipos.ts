// Os tipos de motorista.ts, sem código do servidor: a tela (cliente) importa só daqui.

/** Os códigos do realizado do motorista (os da v1). */
export const CODIGOS_DO_MOTORISTA = [
  "TBV",
  "TBE",
  "TBX",
  "FOL",
  "FÉR",
  "ATS",
  "FRD",
  "FLT",
] as const;
export type CodigoDoMotorista = (typeof CODIGOS_DO_MOTORISTA)[number];

/** Um dia da linha fina do motorista sob o conjunto (nucleo.linha_do_motorista). */
export interface DiaDoMotorista {
  ativo_id: string;
  placa: string;
  dia: string;
  pessoa_id: string;
  nome: string;
  /** O substituto dirige o conjunto neste dia (vale sobre o titular). */
  substituto: boolean;
  /** O realizado (contorno liso); nulo é "sem lançamento", nunca TBV presumido. */
  realizado: CodigoDoMotorista | null;
  /** A marcação da escala (T, F, FE, AT): o planejado. */
  escala: string | null;
  /** O código que a escala sugere (pontilhado); não conta no realizado. */
  sugestao: CodigoDoMotorista | null;
}

/** A faixa do motorista no topo da grade (nucleo.motoristas_no_dia). */
export interface MotoristasNoDia {
  dia: string;
  com_motorista: number;
  sem_motorista: number;
  sem_lancamento: number;
  por_codigo: Partial<Record<CodigoDoMotorista, number>>;
}

/** A aba Motorista do conjunto no mês (nucleo.motorista_do_conjunto_no_mes). */
export interface MotoristaDoConjuntoNoMes {
  ativo_id: string;
  mes: string;
  vigente: { pessoa_id: string; nome: string; desde: string } | null;
  vinculos: { pessoa_id: string; nome: string; inicio: string; fim: string | null }[];
  substituicoes: {
    id: string;
    versao: number;
    titular: string;
    substituto: string;
    inicio: string;
    fim: string;
    motivo: string;
  }[];
  dias: Omit<DiaDoMotorista, "ativo_id" | "placa">[];
  totais: {
    trabalhados: number;
    folgas: number;
    ferias: number;
    atestados: number;
    feriados: number;
    faltas: number;
    sem_lancamento: number;
  };
  ferias_sem_substituto_a_partir_de: string | null;
}

/** A tarefa "Indicar substituto" (nucleo.ferias_sem_substituto). */
export interface FeriasSemSubstituto {
  titular_id: string;
  nome: string;
  ativo_id: string;
  placa: string | null;
  primeiro_dia: string;
  ultimo_dia: string;
  dias: number;
}
