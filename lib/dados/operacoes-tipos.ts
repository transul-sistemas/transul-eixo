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

// ---- Ficha completa (período, contexto) ----

/** Os totais de um período (mês ou acumulado). Dinheiro em centavos. */
export interface TotaisDoPeriodo {
  receitaCentavos: number;
  documentos: number;
  custoFrotaCentavos: number;
  custoServicoCentavos: number;
  margemCentavos: number;
  /** Margem ÷ receita, em pontos com uma casa; nulo sem receita. */
  margemPercentual: number | null;
  /** Placas distintas montadas na operação em algum momento do período. */
  placas: number;
  /** Receita ÷ placas do período, em centavos; nulo sem placa. */
  receitaPorPlacaCentavos: number | null;
}

export interface PontoMensal {
  /** `aaaa-mm` */
  mes: string;
  receitaCentavos: number;
  custoFrotaCentavos: number;
  custoServicoCentavos: number;
  margemCentavos: number;
}

export interface PontoDiario {
  /** `aaaa-mm-dd` */
  dia: string;
  receitaCentavos: number;
  custoCentavos: number;
}

/** O resultado da operação no período; nulo para quem não vê Resultados. */
export interface ResultadoDoPeriodo {
  inicio: string;
  fim: string;
  atual: TotaisDoPeriodo;
  anterior: TotaisDoPeriodo;
  /** Doze meses terminando no último mês do período. */
  serie: PontoMensal[];
  mesesDoPeriodo: PontoMensal[];
  /** A curva dia a dia (só quando o período é um mês). */
  dias: PontoDiario[];
  frotaPorNatureza: ValorPorNatureza[];
  servicoPorNatureza: ValorPorNatureza[];
}

export interface PessoasPorFuncao {
  funcao: string;
  nomeDaFuncao: string;
  pessoas: number;
  /** Marcações da escala no mês, por sigla (T, F, FE, AT). */
  escala: Record<string, number>;
  /** Só para quem vê Pessoas; nulo para os demais. */
  nomes: string[] | null;
}

export type TipoDeEventoDaOperacao =
  | "placa_entrou"
  | "placa_saiu"
  | "cr_montado"
  | "cr_desmontado"
  | "pessoa_vinculada"
  | "pessoa_desvinculada";

export interface EventoDaOperacao {
  /** ISO com fuso. */
  quando: string;
  tipo: TipoDeEventoDaOperacao;
  objeto: string;
  detalhe: string | null;
}

export interface FilialDoMapa {
  filial: string;
  cidade: string | null;
  uf: string | null;
  placas: number;
  emAtividade: number;
  impedidas: number;
}

export interface CrDaArvore {
  codigo: string | null;
  nome: string | null;
  frota: boolean;
  placas: string[];
  totalDePlacas: number;
}

export interface ContextoDaOperacao {
  mes: string;
  vePessoas: boolean;
  pessoas: PessoasPorFuncao[];
  linhaDoTempo: EventoDaOperacao[];
  mapa: {
    base: { cidade: string | null; uf: string | null; filial: string | null };
    filiais: FilialDoMapa[];
  };
  arvore: { crs: CrDaArvore[]; placasSemCr: number };
}
