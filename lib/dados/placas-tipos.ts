import type { Alerta } from "@/lib/dominio/alertas";
import type { Sigla } from "@/lib/dominio/status";
import type { Status } from "@/lib/visual/tons";

/** Tipos de ativo: o segundo grupo de chips da lista de placas. */
export const TIPOS_DE_ATIVO = [
  "cavalo",
  "implemento",
  "equipamento",
  "caminhao",
  "veiculo-pequeno",
  "apoio",
] as const;
export type TipoDeAtivo = (typeof TIPOS_DE_ATIVO)[number];

/** Campos pelos quais a lista pode ser ordenada (parâmetro `ordem` da URL). */
export const CAMPOS_ORDENAVEIS_DE_PLACAS = [
  "placa",
  "tipo",
  "modelo",
  "conjunto",
  "gestor",
  "operacao",
  "situacao",
  "alertas",
  "km",
  "cr",
  "fipe",
  "dias",
  "motorista",
  "crlv",
] as const;

/** Todas as colunas que a lista pode mostrar (o cookie de preferências só aceita estas). */
export const IDS_DAS_COLUNAS_DE_PLACAS = [
  "placa",
  "tipo",
  "modelo",
  "conjunto",
  "gestor",
  "operacao",
  "situacao",
  "alertas",
  "km",
  "cr",
  "fipe",
  "motorista",
  "filial",
  "dias",
] as const;

export interface LinhaDePlaca {
  id: string;
  placa: string;
  tipo: TipoDeAtivo;
  modelo: string;
  /** Placas (não ids) do conjunto vigente: o cavalo, ou os implementos. */
  conjunto: { cavalo: string | null; implementos: string[] };
  gestor: string;
  operacao: string | null;
  /** Código do CR vigente hoje. */
  cr: string | null;
  sigla: Sigla;
  nomeDaSituacao: string;
  grupo: Status;
  diasNoStatus: number;
  alertas: Alerta[];
  km: number | null;
  valorFipeCentavos: number | null;
  motorista: string | null;
  crlvVenceEm: string | null;
  filial: string;
}

export interface PaginaDePlacas {
  linhas: LinhaDePlaca[];
  /** Quantas placas passam por todos os filtros (a soma é do servidor, nunca do navegador). */
  total: number;
  pagina: number;
  paginas: number;
  tam: number;
  /** Contagem por chip; a de cada grupo ignora a seleção do próprio grupo. */
  contagens: Record<string, number>;
}

export interface OpcoesDaConsulta {
  /** Só para testar os estados da tela, e só na fonte de exemplo. */
  simulacao?: { lentoMs?: number; falha?: boolean };
}

/** Nomes para a tela. */
export const NOMES_DOS_TIPOS: Record<TipoDeAtivo, string> = {
  cavalo: "Cavalo",
  implemento: "Implemento",
  equipamento: "Equipamento",
  caminhao: "Caminhão",
  "veiculo-pequeno": "Veículo pequeno",
  apoio: "Apoio",
};

/** Padrões da lista de placas: 25 linhas por página, ordenada por placa. */
export const PADRAO_DA_LISTA_DE_PLACAS = { tam: 25, ordem: "placa" } as const;
