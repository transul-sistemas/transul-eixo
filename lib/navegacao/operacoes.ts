import { type ConsultaDeTabela, lerTabela, type PadraoDaTabela } from "./tabela";

// O estado de Operações › lista na URL: o mês (`mes=aaaa-mm`; sem ele, o banco abre o mês mais
// recente com viagens) e a tabela (busca `q`, chips de tipo e de filial, ordem, página e tamanho). O
// banco filtra, ordena e pagina (nucleo.operacoes_do_mes); o tamanho lembrado vem do cookie.

export const ROTA_DAS_OPERACOES = "/operacoes/lista";

/** Os campos de ordem que nucleo.operacoes_do_mes aceita (o desempate é o nome e o id). */
export const CAMPOS_DAS_OPERACOES = [
  "nome",
  "placas",
  "crs",
  "receita",
  "custo_frota",
  "custo_servico",
  "margem",
  "margem_percentual",
] as const;

export const PADRAO_DAS_OPERACOES: PadraoDaTabela = { tam: 20, ordem: "nome" };

/** Os chips da lista: o tipo da operação e a filial (a garagem da base). */
export const CHIPS_DE_TIPO = [
  { id: "operacao", nome: "Operação" },
  { id: "parada", nome: "Parada" },
  { id: "administrativa", nome: "Administrativa" },
  { id: "holding", nome: "Holding" },
] as const;
export const CHIPS_DE_FILIAL = [
  { id: "matriz", nome: "Matriz" },
  { id: "cordeiropolis", nome: "Cordeirópolis" },
  { id: "parauapebas", nome: "Parauapebas" },
] as const;

export type IdDoChipDeOperacao =
  (typeof CHIPS_DE_TIPO)[number]["id"] | (typeof CHIPS_DE_FILIAL)[number]["id"];

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface EstadoDasOperacoes {
  /** `aaaa-mm`, ou nulo para o mês mais recente com viagens. */
  mes: string | null;
  consulta: ConsultaDeTabela;
}

/** O mês da URL (`aaaa-mm`), ou nulo se falta ou não é um mês válido. */
export function lerMes(parametros: URLSearchParams): string | null {
  const mes = parametros.get("mes");
  return mes !== null && MES.test(mes) ? mes : null;
}

export function lerOperacoes(
  parametros: URLSearchParams,
  tamLembrado: number = PADRAO_DAS_OPERACOES.tam,
): EstadoDasOperacoes {
  const conhecidos: readonly string[] = [...CHIPS_DE_TIPO, ...CHIPS_DE_FILIAL].map((c) => c.id);
  const consulta = lerTabela(
    parametros,
    { ...PADRAO_DAS_OPERACOES, tam: tamLembrado },
    CAMPOS_DAS_OPERACOES,
  );
  return {
    mes: lerMes(parametros),
    consulta: { ...consulta, chips: consulta.chips.filter((c) => conhecidos.includes(c)) },
  };
}

/** A mesma visão em outro mês: mantém busca, chips e ordem (e a aba, na ficha). */
export function enderecoDoMes(rota: string, parametros: URLSearchParams, mes: string): string {
  const novos = new URLSearchParams(parametros.toString());
  novos.delete("pagina");
  novos.set("mes", mes);
  return `${rota}?${novos.toString()}`;
}

/** A ficha de uma operação, levando o mês da lista. */
export function enderecoDaFicha(id: string, mes: string | null): string {
  return `${ROTA_DAS_OPERACOES}/${id}${mes ? `?mes=${mes}` : ""}`;
}

/** As abas da ficha da operação: as seis de toda raiz e, depois do Resumo, Placas e Pessoas. */
export const ABAS_DA_OPERACAO = [
  { id: "resumo", nome: "Resumo" },
  { id: "placas", nome: "Placas" },
  { id: "pessoas", nome: "Pessoas" },
  { id: "resultado", nome: "Resultado" },
  { id: "linha-do-tempo", nome: "Linha do tempo" },
  { id: "documentos", nome: "Documentos" },
  { id: "mapa", nome: "Mapa" },
  { id: "mapa-mental", nome: "Mapa mental" },
] as const;

export type AbaDaOperacao = (typeof ABAS_DA_OPERACAO)[number]["id"];

export const IDS_DAS_ABAS_DA_OPERACAO: readonly AbaDaOperacao[] = ABAS_DA_OPERACAO.map((a) => a.id);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** O identificador da operação na rota é o id (uuid, minúsculo). O resto é 404. */
export function idDeOperacaoValido(id: string): boolean {
  return UUID.test(id);
}
