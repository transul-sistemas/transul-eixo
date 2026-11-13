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

/** A célula de um dia do conjunto (ou de uma placa solta). */
export interface CelulaDoConjunto {
  dia: string;
  sigla: string | null;
  grupo: string | null;
  /**
   * Os implementos engatados que impedem o conjunto neste dia, na ordem da posição (vazio se nenhum):
   * "impedido por <placa> · <sigla>" com uma peça, "impedido por N peças: ..." com mais.
   */
  causas?: { ativoId: string; placa: string; sigla: string }[];
  /** Quantos eventos de situação o dia teve (o selo). */
  eventos: number;
  manual: boolean;
  /** Algum lançamento do dia foi feito depois do dia (correção tardia). */
  tardia: boolean;
}

export type TipoDeCrDaGrade = "frota" | "acionista";

/** Um implemento do conjunto: um chip na célula da esquerda, sem células de dias próprias. */
export interface ImplementoDoConjunto {
  ativoId: string;
  placa: string;
  modelo: string;
  funcao: string | null;
  posicao: number;
  /** Primeiro dia do mês em que estava engatado (o dia vale pelo fim do dia). */
  engatadoDe: string;
  /** Último dia engatado; nulo se segue engatado no fim do mês. */
  engatadoAte: string | null;
  siglaAtual: string;
  grupoAtual: string | null;
}

/** Uma linha da grade: o conjunto (o cavalo ou o caminhão, com os implementos engatados no mês). */
export interface ConjuntoDaGrade {
  ativoId: string;
  placa: string;
  modelo: string;
  ano: number | null;
  operacao: string | null;
  siglaAtual: string;
  grupoAtual: string | null;
  tiposDeCr: TipoDeCrDaGrade[];
  /** O nome pela nomenclatura ("Rodotrem", "pendente"...), "Caminhão" (nunca engatou no mês) ou "Sem implemento". */
  nomeDoConjunto: string | null;
  dias: CelulaDoConjunto[];
  implementos: ImplementoDoConjunto[];
}

/** Uma linha da aba Soltas: implemento sem cavalo engatado no mês, apoio ou equipamento. */
export interface PlacaSolta {
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
}

export interface GradeDeSoltas {
  mes: string;
  hoje: string;
  diasNoMes: number;
  linhas: PlacaSolta[];
  total: number;
  pagina: number;
  paginas: number;
  tam: number;
  chips: ChipsDaGrade;
  /** "X de Y soltas com situação hoje". */
  situacaoHoje: { x: number; y: number };
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
