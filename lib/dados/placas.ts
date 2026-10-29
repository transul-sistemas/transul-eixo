import type { Alerta } from "@/lib/dominio/alertas";
import type { Sigla } from "@/lib/dominio/status";
import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import type { Status } from "@/lib/visual/tons";
import { fonteDePlacas } from "./fonte";

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

/** `hoje` é o dia `aaaa-mm-dd` em São Paulo (de onde vêm os dias na situação e os alertas). */
export async function listarPlacas(
  consulta: ConsultaDeTabela,
  hoje: string,
  opcoes: OpcoesDaConsulta = {},
): Promise<PaginaDePlacas> {
  const fonte = await fonteDePlacas();
  return fonte.consultar(consulta, hoje, opcoes);
}
