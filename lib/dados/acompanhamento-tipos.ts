import type { TipoDeAtivo } from "./placas-tipos";

// Os tipos do Acompanhamento e da Carteira, sem nada de servidor: as telas (client) importam daqui.

/** O que o assistente "Lançar situação" precisa saber da linha onde a célula foi clicada. */
export interface AlvoDoLancamento {
  ativoId: string;
  placa: string;
  tipo: TipoDeAtivo;
  /** O cavalo está num conjunto (com implemento engatado) no dia do lançamento. */
  emConjunto: boolean;
  /** A sigla de cada dia, para o "antes" do resumo. */
  dias: { dia: string; sigla: string | null }[];
}

/** A célula de um dia do cavalo (ou de uma placa fora de conjunto). */
export interface CelulaDoConjunto {
  dia: string;
  sigla: string | null;
  grupo: string | null;
  /** Quantos eventos de situação o dia teve (o selo). */
  eventos: number;
  manual: boolean;
  /** Algum lançamento do dia foi feito depois do dia (correção tardia). */
  tardia: boolean;
}

/** A célula de um dia do implemento: só tem sigla nos dias em que estava engatado no cavalo. */
export interface CelulaDoImplemento {
  dia: string;
  engatado: boolean;
  sigla: string | null;
  grupo: string | null;
}

export type TipoDeCrDaGrade = "frota" | "acionista";

export interface ImplementoDoConjunto {
  ativoId: string;
  placa: string;
  modelo: string;
  funcao: string | null;
  posicao: number;
  dias: CelulaDoImplemento[];
}

/** Uma linha da grade: o conjunto (o cavalo com os implementos engatados no mês). */
export interface ConjuntoDaGrade {
  ativoId: string;
  placa: string;
  modelo: string;
  ano: number | null;
  operacao: string | null;
  siglaAtual: string;
  grupoAtual: string | null;
  tiposDeCr: TipoDeCrDaGrade[];
  /** O nome pela nomenclatura ("Rodotrem", "pendente"...); nulo se não há implemento no fim do mês. */
  nomeDoConjunto: string | null;
  dias: CelulaDoConjunto[];
  implementos: ImplementoDoConjunto[];
}

/** Uma linha de "Fora de conjunto": uma placa que não esteve em conjunto no mês. */
export interface PlacaForaDeConjunto {
  ativoId: string;
  placa: string;
  tipo: TipoDeAtivo;
  modelo: string;
  ano: number | null;
  operacao: string | null;
  siglaAtual: string;
  grupoAtual: string | null;
  tiposDeCr: TipoDeCrDaGrade[];
  dias: CelulaDoConjunto[];
}

/** A contagem dos chips por grupo de situação, calculada no banco. */
export interface ChipsDaGrade {
  todos: number;
  "em-atividade": number;
  atencao: number;
  impedida: number;
  patio: number;
  fora: number;
}

export interface GradePorConjunto {
  mes: string;
  hoje: string;
  diasNoMes: number;
  linhas: ConjuntoDaGrade[];
  /** Conjuntos que passam pelos filtros (a paginação). */
  total: number;
  pagina: number;
  paginas: number;
  tam: number;
  chips: ChipsDaGrade;
  /** "X de Y conjuntos com lançamento hoje". */
  lancamentoHoje: { x: number; y: number };
  fora: { linhas: PlacaForaDeConjunto[]; total: number; pagina: number; paginas: number };
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
