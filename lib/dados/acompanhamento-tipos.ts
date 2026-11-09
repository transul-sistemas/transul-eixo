import type { TipoDeAtivo } from "./placas-tipos";

// Os tipos do Acompanhamento e da Carteira, sem nada de servidor: as telas (client) importam daqui.

export interface CelulaDaGrade {
  dia: string;
  sigla: string | null;
  grupo: string | null;
  lancado: boolean;
}

export interface LinhaDaGrade {
  ativoId: string;
  placa: string;
  tipo: TipoDeAtivo;
  modelo: string;
  operacao: string | null;
  gestor: string | null;
  emConjunto: boolean;
  dias: CelulaDaGrade[];
}

export interface GradeDoMes {
  mes: string;
  hoje: string;
  linhas: LinhaDaGrade[];
  total: number;
  pagina: number;
  paginas: number;
  tam: number;
}

export interface LinhaDoAgora {
  chave: string | null;
  rotulo: string;
  total: number;
  emAtividade: number;
  atencao: number;
  impedida: number;
  patio: number;
  fora: number;
  pendente: number;
}

export interface LinhaDoCenso {
  sigla: string;
  nome: string;
  grupo: string;
  quantidade: number;
}

export interface PlacaDaCarteira {
  ativoId: string;
  placa: string;
  tipo: TipoDeAtivo;
  modelo: string;
  sigla: string;
  grupo: string | null;
  nomeDaSituacao: string | null;
  /** `null` = pendente. */
  confere: boolean | null;
  observacao: string | null;
  confirmadoEm: string | null;
}

export interface CarteiraDoMes {
  mes: string;
  /** Quem usa é gestor de frota (tem carteira). */
  gestor: boolean;
  linhas: PlacaDaCarteira[];
  total: number;
  conferem: number;
  naoConferem: number;
  pendentes: number;
  filtradas: number;
  pagina: number;
  paginas: number;
  tam: number;
}

export interface SituacaoLancada {
  ativoId: string;
  placa: string;
  dia: string;
  sigla: string;
}

export interface CarteiraConfirmada {
  mes: string;
  gravadas: number;
  pedidas: number;
}
