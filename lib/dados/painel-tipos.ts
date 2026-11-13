// Os tipos das telas de painel da Fase 1 (Comparativo, Análise, Resultados, Pessoas, Operacional):
// a leitura chega pronta do banco (ou do exemplo, só em desenvolvimento e testes) num formato único.
// Sem nada de servidor: o navegador também usa. Quem soma, conta, agrupa e pagina é a fonte; a tela
// só formata, sempre por components/formato/.

/** Como o valor aparece. `moeda` chega em centavos inteiros (a leitura converte os reais do banco). */
export type FormatoDoValor =
  | "moeda"
  | "inteiro"
  | "percentual"
  | "km"
  | "litros"
  | "km-por-litro"
  | "data"
  | "data-e-hora"
  | "mes"
  | "duracao"
  | "texto"
  | "placa";

export type ValorDoPainel = number | string | null;

export interface KpiDoPainel {
  id: string;
  rotulo: string;
  valor: ValorDoPainel;
  formato: FormatoDoValor;
  apoio?: string;
}

/** A cor de uma série: a do módulo da tela, o vermelho do negativo, o azul de ação ou o cinza neutro. */
export type CorDaSerie = "modulo" | "negativo" | "acao" | "neutro";

export interface SerieDoPainel {
  nome: string;
  tipo: "barra" | "linha";
  valores: (number | null)[];
  cor?: CorDaSerie;
  pilha?: string;
}

export interface CascataDoPainel {
  receitaCte: number;
  receitaNfse: number;
  custoFrota: number;
  custoServico: number;
  margem: number;
}

export interface GraficoDoPainel {
  id: string;
  titulo: string;
  descricao?: string;
  /** `barras` (barras e linhas), `rosca` (só a primeira série) ou `cascata` (receita até a margem). */
  tipo: "barras" | "rosca" | "cascata";
  categorias: string[];
  series: SerieDoPainel[];
  /** Os gráficos usam só três formatos: moeda (centavos), inteiro e percentual. */
  formato: "moeda" | "inteiro" | "percentual";
  deitado?: boolean;
  cascata?: CascataDoPainel;
  /** Largura na grade de 12 colunas (o primeiro gráfico é a visão principal, 12). */
  colunas: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
}

export interface ColunaDoPainel {
  id: string;
  rotulo: string;
  formato: FormatoDoValor;
}

export interface DetalheDoPainel {
  rotulo: string;
  valor: ValorDoPainel;
  formato: FormatoDoValor;
}

export interface LinhaDoPainel {
  /** A chave única da linha (desempate da ordem). */
  id: string;
  /** O nome do item, para o olho ("Ver detalhes de <item>"). */
  item: string;
  celulas: Record<string, ValorDoPainel>;
  detalhes: DetalheDoPainel[];
  /** A ficha da raiz (operação, pessoa, placa), quando houver. */
  href?: string;
}

export interface TabelaDoPainel {
  titulo: string;
  /** O que cada linha é ("operação", "pessoa"). */
  item: string;
  colunas: ColunaDoPainel[];
  linhas: LinhaDoPainel[];
  /** Total de linhas no filtro (não só na página). */
  total: number;
  pagina: number;
  paginas: number;
  tam: number;
}

export interface ChipDoPainel {
  id: string;
  nome: string;
  contagem: number;
}

export interface OpcaoDoPainel {
  id: string;
  nome: string;
}

/** De onde veio a leitura: do banco; do exemplo (só fora de produção); ou sem fonte ainda. */
export type OrigemDoPainel = "banco" | "exemplo" | "sem-fonte";

export interface LeituraDoPainel {
  origem: OrigemDoPainel;
  /** A função do banco que entrega esta tela (`nucleo.<nome>`). */
  funcao: string;
  /** O mês da leitura (`aaaa-mm`) e os meses que se podem escolher, do mais novo ao mais antigo. */
  mes: string | null;
  meses: string[];
  kpis: KpiDoPainel[];
  graficos: GraficoDoPainel[];
  chips: ChipDoPainel[];
  tabela: TabelaDoPainel;
  /** As listas que os assistentes da tela usam (meses abertos, operações, pessoas, placas...). */
  opcoes: Record<string, OpcaoDoPainel[]>;
  /** Avisos curtos da fonte (o que mudou de mês, o que falta). */
  avisos: string[];
}
