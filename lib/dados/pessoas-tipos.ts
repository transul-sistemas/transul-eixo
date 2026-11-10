import type { SiglaDaEscala } from "@/lib/dominio/esquemas/pessoa";

// Os tipos de Pessoas › lista, ficha e Escala, como a tela usa (o banco entrega pronto; lib/dados só
// converte o formato). O CPF só aparece mascarado.

export type SituacaoDaPessoa = "com_vinculo" | "sem_vinculo" | "pendente";

export const NOMES_DAS_SITUACOES: Record<SituacaoDaPessoa, string> = {
  com_vinculo: "Com vínculo",
  sem_vinculo: "Sem vínculo",
  pendente: "Cadastro pendente",
};

export interface OperacaoParaEscolher {
  id: string;
  nome: string;
}

export interface LinhaDePessoa {
  id: string;
  nome: string;
  documentoMascarado: string | null;
  situacao: SituacaoDaPessoa;
  funcao: string | null;
  funcaoNome: string | null;
  operacaoId: string | null;
  operacao: string | null;
  /** `aaaa-mm-dd`: o início do vínculo de hoje. */
  desde: string | null;
}

export interface PessoasDaLista {
  linhas: LinhaDePessoa[];
  filtradas: number;
  pagina: number;
  paginas: number;
  tam: number;
  chips: Record<string, number>;
  operacoes: OperacaoParaEscolher[];
}

export interface VinculoDaPessoa {
  id: string;
  operacaoId: string;
  operacao: string;
  funcao: string;
  funcaoNome: string;
  inicio: string;
  fim: string | null;
  vigente: boolean;
}

export interface FichaDaPessoa {
  pessoa: {
    id: string;
    nome: string;
    documentoMascarado: string | null;
    email: string | null;
    codparc: number | null;
    cadastroPendente: boolean;
    versao: number;
    papeis: string[];
  };
  vinculos: VinculoDaPessoa[];
  vinculoAtual: VinculoDaPessoa | null;
  escala: { mes: string } & Record<SiglaDaEscala, number>;
  /** As operações para o assistente Editar pessoa. */
  operacoes: OperacaoParaEscolher[];
}

export interface MarcacaoDoDia {
  sigla: SiglaDaEscala;
  versao: number;
}

export interface PessoaDaEscala {
  id: string;
  nome: string;
  funcaoNome: string;
  /** Os períodos de vínculo com a operação que tocam o mês, `[início, fim)`. */
  periodos: { inicio: string; fim: string | null }[];
  /** Por dia (`aaaa-mm-dd`). */
  dias: Record<string, MarcacaoDoDia>;
}

export interface EscalaDoMes {
  /** `aaaa-mm`. */
  mes: string;
  diasNoMes: number;
  operacao: OperacaoParaEscolher | null;
  operacoes: OperacaoParaEscolher[];
  podeMarcar: boolean;
  pessoas: PessoaDaEscala[];
  totais: { pessoas: number } & Record<SiglaDaEscala, number>;
}
