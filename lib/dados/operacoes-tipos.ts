import type { TipoDeAtivo } from "./placas-tipos";
import type { Status } from "@/lib/visual/tons";

// Os tipos de Operações › lista e ficha (sem nada de servidor: os componentes do navegador também
// usam). Dinheiro em centavos; nulo quando o perfil não vê o resultado (sem Resultados).

export type TipoDeOperacao = "operacao" | "parada" | "administrativa" | "holding" | "acionista";

export const NOMES_DOS_TIPOS_DE_OPERACAO: Record<TipoDeOperacao, string> = {
  operacao: "Operação",
  parada: "Parada",
  administrativa: "Administrativa",
  holding: "Holding",
  acionista: "Acionista",
};

/** A cascata do mês: receita → custo da Frota → custo de Serviço → margem. */
export interface Cascata {
  receitaCentavos: number;
  documentos: number;
  custoFrotaCentavos: number;
  custoServicoCentavos: number;
  margemCentavos: number;
  /** Margem ÷ receita, em pontos com uma casa; nulo sem receita. */
  margemPercentual: number | null;
}

export interface LinhaDeOperacao {
  id: string;
  nome: string;
  tipo: TipoDeOperacao;
  baseCidade: string | null;
  baseUf: string | null;
  filial: string | null;
  placas: number;
  crs: number;
  /** Nulo quando o perfil não vê o resultado. */
  cascata: Cascata | null;
}

export interface OperacoesDoMes {
  /** `aaaa-mm` */
  mes: string;
  /** Os meses com viagem (`aaaa-mm`), do mais recente ao mais antigo. */
  meses: string[];
  veResultado: boolean;
  /** A página que o banco entregou (20 por padrão, até 100); além do fim, a última. */
  linhas: LinhaDeOperacao[];
  pagina: number;
  paginas: number;
  tam: number;
  /** As operações do filtro inteiro (não só da página). */
  total: number;
  totais: {
    operacoes: number;
    placas: number;
    cascata: Omit<Cascata, "documentos"> | null;
  };
  chips: Record<string, number>;
}

export interface ValorPorNatureza {
  natureza: string;
  valorCentavos: number;
}

export interface PlacaDaOperacao {
  ativoId: string;
  placa: string;
  tipo: TipoDeAtivo;
  modelo: string | null;
  sigla: string;
  grupo: Status;
  nomeDaSituacao: string;
  cr: string | null;
  gestor: string | null;
}

export interface PessoasDaOperacao {
  funcionarios: number;
  salarioBrutoCentavos: number;
  porDepartamento: { departamento: string; funcionarios: number; salarioBrutoCentavos: number }[];
}

export interface FichaDaOperacao {
  operacao: {
    id: string;
    nome: string;
    tipo: TipoDeOperacao;
    baseCidade: string | null;
    baseUf: string | null;
    filial: string | null;
    versao: number;
  };
  mes: string;
  meses: string[];
  veResultado: boolean;
  /** Nula quando o perfil não vê o resultado. */
  cascata:
    | (Cascata & {
        crs: number;
        frotaPorNatureza: ValorPorNatureza[];
        servicoPorNatureza: ValorPorNatureza[];
      })
    | null;
  placas: PlacaDaOperacao[];
  pessoas: PessoasDaOperacao | null;
}
