// Os tipos de saude-do-cr.ts, sem código do servidor: a tela (cliente) importa só daqui.

export type ProblemaDaSaude =
  "placa_sem_cr" | "cr_sem_operacao" | "dois_do_mesmo_tipo" | "lancamento_sem_cr";

export interface ResumoDaSaudeDoCr {
  cartoes: {
    crs_ativos: number;
    placas_sem_cr: number;
    crs_sem_operacao: number;
    placas_com_dois_do_mesmo_tipo: number;
    centros_sem_cr: number;
  };
  problemas: {
    problema: ProblemaDaSaude;
    quantidade: number;
    dono: string | null;
    prazo_dias: number | null;
  }[];
}

/** A linha de um problema: os campos variam com o problema; dono e prazo são os atribuídos (ou nulos). */
export interface LinhaDoProblema {
  ativo_id?: string;
  placa?: string;
  tipo?: string;
  gestor?: string | null;
  operacao?: string | null;
  cr_id?: string;
  codigo?: string;
  nome?: string | null;
  codcencus?: string | number | null;
  tipo_de_cr?: string;
  crs?: { vinculo_id: string; versao: number; cr_id: string; codigo: string; inicio: string }[];
  lancamentos?: number;
  valor?: number;
  ultima_competencia?: string | null;
  dono: string | null;
  dono_id: string | null;
  prazo: string | null;
}

export interface PaginaDoProblema {
  problema: ProblemaDaSaude;
  total: number;
  pagina: number;
  tamanho: number;
  linhas: LinhaDoProblema[];
}
