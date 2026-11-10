import { lerMes } from "./operacoes";
import { type ConsultaDeTabela, lerTabela, type PadraoDaTabela } from "./tabela";

// O estado de Parceiros na URL. Lista: o mês (`mes=aaaa-mm`), a busca `q` e os chips de tipo.
// Conciliação: o mês, o parceiro (`agrupador=`, o CR pai do Sankhya) e a situação. Locação: a
// situação. Valor desconhecido volta ao padrão; recarregar ou compartilhar devolve a mesma visão.

export const ROTA_DOS_PARCEIROS = "/parceiros/lista";
export const ROTA_DA_CONCILIACAO = "/parceiros/conciliacao";
export const ROTA_DA_LOCACAO = "/parceiros/locacao";

export const PADRAO_DOS_PARCEIROS: PadraoDaTabela = { tam: 100, ordem: "nome" };

export const CHIPS_DE_TIPO_DE_PARCEIRO = [
  { id: "acionista", nome: "Acionista" },
  { id: "agregado", nome: "Agregado" },
  { id: "locador", nome: "Locador" },
] as const;

export interface EstadoDosParceiros {
  mes: string | null;
  consulta: ConsultaDeTabela;
}

export function lerParceiros(parametros: URLSearchParams): EstadoDosParceiros {
  const conhecidos: readonly string[] = CHIPS_DE_TIPO_DE_PARCEIRO.map((c) => c.id);
  const consulta = lerTabela(parametros, PADRAO_DOS_PARCEIROS, ["nome"]);
  return {
    mes: lerMes(parametros),
    consulta: { ...consulta, chips: consulta.chips.filter((c) => conhecidos.includes(c)) },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** O identificador do parceiro (ou do agrupador) na rota é o id (uuid, minúsculo). O resto é 404. */
export function idValido(id: string | null | undefined): id is string {
  return typeof id === "string" && UUID.test(id);
}

/** A ficha do parceiro, levando o mês da lista. */
export function enderecoDaFichaDoParceiro(id: string, mes: string | null): string {
  return `${ROTA_DOS_PARCEIROS}/${id}${mes ? `?mes=${mes}` : ""}`;
}

export const SITUACOES_DA_CONCILIACAO = [
  "todas",
  "diferenca",
  "sem_lancamento",
  "justificada",
  "confere",
] as const;
export type FiltroDaConciliacao = (typeof SITUACOES_DA_CONCILIACAO)[number];

export interface EstadoDaConciliacao {
  mes: string | null;
  agrupador: string | null;
  situacao: FiltroDaConciliacao;
}

export function lerConciliacao(parametros: URLSearchParams): EstadoDaConciliacao {
  const situacao = parametros.get("situacao");
  const agrupador = parametros.get("agrupador");
  return {
    mes: lerMes(parametros),
    agrupador: idValido(agrupador) ? agrupador : null,
    situacao: (SITUACOES_DA_CONCILIACAO as readonly string[]).includes(situacao ?? "")
      ? (situacao as FiltroDaConciliacao)
      : "todas",
  };
}

export function enderecoDaConciliacao(estado: EstadoDaConciliacao): string {
  const p = new URLSearchParams();
  if (estado.mes) p.set("mes", estado.mes);
  if (estado.agrupador) p.set("agrupador", estado.agrupador);
  if (estado.situacao !== "todas") p.set("situacao", estado.situacao);
  const busca = p.toString();
  return busca ? `${ROTA_DA_CONCILIACAO}?${busca}` : ROTA_DA_CONCILIACAO;
}

export const SITUACOES_DA_LOCACAO = ["todas", "vigente", "futura", "encerrada"] as const;
export type FiltroDaLocacao = (typeof SITUACOES_DA_LOCACAO)[number];

export function lerLocacao(parametros: URLSearchParams): FiltroDaLocacao {
  const situacao = parametros.get("situacao");
  return (SITUACOES_DA_LOCACAO as readonly string[]).includes(situacao ?? "")
    ? (situacao as FiltroDaLocacao)
    : "todas";
}

export function enderecoDaLocacao(situacao: FiltroDaLocacao): string {
  return situacao === "todas" ? ROTA_DA_LOCACAO : `${ROTA_DA_LOCACAO}?situacao=${situacao}`;
}

/** As abas da ficha do parceiro: as seis de toda raiz e, depois do Resumo, Placas e Locações. */
export const ABAS_DO_PARCEIRO = [
  { id: "resumo", nome: "Resumo" },
  { id: "placas", nome: "Placas" },
  { id: "locacoes", nome: "Locações" },
  { id: "linha-do-tempo", nome: "Linha do tempo" },
  { id: "documentos", nome: "Documentos" },
  { id: "resultado", nome: "Resultado" },
  { id: "mapa", nome: "Mapa" },
  { id: "mapa-mental", nome: "Mapa mental" },
] as const;

export type AbaDoParceiro = (typeof ABAS_DO_PARCEIRO)[number]["id"];

export const IDS_DAS_ABAS_DO_PARCEIRO: readonly AbaDoParceiro[] = ABAS_DO_PARCEIRO.map((a) => a.id);
