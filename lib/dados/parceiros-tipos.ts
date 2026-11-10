import type { TipoDeParceiro } from "@/lib/dominio/esquemas/parceiros";
import type { TipoDeAtivo } from "./placas-tipos";

// Os tipos da leitura de Parceiros (lista, ficha, conciliação e locação). Dinheiro sempre em
// centavos inteiros; o banco entrega os totais prontos.

export interface Agrupador {
  id: string;
  codigo: string;
  nome: string | null;
}

export interface LinhaDeParceiro {
  id: string;
  nome: string;
  documentoMascarado: string | null;
  codparc: number | null;
  tipos: TipoDeParceiro[];
  agrupador: Agrupador | null;
  placas: number;
  despesaCentavos: number;
  receitaCentavos: number;
  locacaoMensalCentavos: number;
  versao: number;
}

export interface ParceirosDoMes {
  mes: string;
  meses: string[];
  /** A página que o banco entregou (20 por padrão, até 100); além do fim, a última. */
  linhas: LinhaDeParceiro[];
  pagina: number;
  paginas: number;
  tam: number;
  /** Os parceiros do filtro inteiro (não só da página). */
  total: number;
  totais: {
    parceiros: number;
    placas: number;
    despesaCentavos: number;
    receitaCentavos: number;
    locacaoMensalCentavos: number;
  };
  chips: Record<TipoDeParceiro, number>;
  agrupadoresLivres: (Agrupador & { crs: number })[];
}

export type OrigemDaPlaca = "cr_de_acionista" | "posse" | "locacao";

export interface PlacaDoParceiro {
  ativoId: string;
  placa: string;
  tipo: TipoDeAtivo;
  modelo: string | null;
  origens: OrigemDaPlaca[];
}

export interface LocacaoDoParceiro {
  id: string;
  placa: string;
  inicio: string;
  fim: string | null;
  valorMensalCentavos: number;
  vigente: boolean;
}

export interface FichaDoParceiro {
  parceiro: Omit<
    LinhaDeParceiro,
    "placas" | "despesaCentavos" | "receitaCentavos" | "locacaoMensalCentavos"
  >;
  mes: string;
  meses: string[];
  totais: {
    despesaCentavos: number;
    receitaCentavos: number;
    crs: number;
    confere: number;
    diferenca: number;
    semLancamento: number;
  } | null;
  placas: PlacaDoParceiro[];
  locacoes: LocacaoDoParceiro[];
}

export type SituacaoDaConciliacao = "confere" | "diferenca" | "sem_lancamento" | "justificada";

export const NOMES_DAS_SITUACOES_DA_CONCILIACAO: Record<SituacaoDaConciliacao, string> = {
  confere: "Confere",
  diferenca: "Diferença",
  sem_lancamento: "Sem lançamento",
  justificada: "Justificada",
};

export interface LinhaDaConciliacao {
  crId: string;
  crCodigo: string;
  crNome: string | null;
  agrupadorId: string;
  agrupadorCodigo: string;
  agrupadorNome: string | null;
  parceiroId: string | null;
  parceiroNome: string | null;
  tipos: TipoDeParceiro[];
  placas: string[];
  dias: number;
  despesaCentavos: number;
  receitaCentavos: number;
  lancamentos: number;
  foraDaPlacaCentavos: number;
  situacao: SituacaoDaConciliacao;
  motivo: string | null;
  justificadaEm: string | null;
}

export interface ConciliacaoDoMes {
  mes: string;
  meses: string[];
  linhas: LinhaDaConciliacao[];
  contagens: Record<SituacaoDaConciliacao | "todas", number>;
  totais: { despesaCentavos: number; receitaCentavos: number; foraDaPlacaCentavos: number };
  parceiros: { agrupadorId: string; nome: string; cadastrado: boolean }[];
}

export type SituacaoDaLocacao = "vigente" | "futura" | "encerrada";

export const NOMES_DAS_SITUACOES_DA_LOCACAO: Record<SituacaoDaLocacao | "todas", string> = {
  todas: "Todas",
  vigente: "Vigentes",
  futura: "Futuras",
  encerrada: "Encerradas",
};

export interface Locacao {
  id: string;
  parceiroId: string;
  parceiroNome: string;
  ativoId: string;
  placa: string;
  inicio: string;
  fim: string | null;
  valorMensalCentavos: number;
  motivoDoEncerramento: string | null;
  situacao: SituacaoDaLocacao;
  versao: number;
}

export interface Locacoes {
  hoje: string;
  linhas: Locacao[];
  contagens: Record<SituacaoDaLocacao | "todas", number>;
  totais: { valorMensalVigenteCentavos: number; placasVigentes: number };
  parceiros: { id: string; nome: string; tipos: TipoDeParceiro[] }[];
}

export interface ParceiroCadastrado {
  parceiroId: string;
  nome: string;
  pessoaExistente: boolean;
}
export interface JustificativaGravada {
  justificativaId: string;
}
export interface LocacaoGravada {
  locacaoId: string;
  placa: string;
}
