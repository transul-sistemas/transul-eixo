import { FUNCOES_DA_PESSOA } from "@/lib/dominio/esquemas/pessoa";
import { type ConsultaDeTabela, lerTabela, type PadraoDaTabela } from "./tabela";

// O estado de Pessoas › lista e de Pessoas › Escala na URL. A lista: busca `q`, chips de situação e
// de função, a operação (`operacao=<id>`), ordem, página e tamanho (paginação no servidor). A escala:
// a operação e o mês (`mes=aaaa-mm`; sem eles, o banco escolhe).

export const ROTA_DAS_PESSOAS = "/pessoas/lista";
export const ROTA_DA_ESCALA = "/pessoas/escala";

/** Os campos de ordem que nucleo.pessoas_da_lista aceita (o desempate é o nome e o id). */
export const CAMPOS_DAS_PESSOAS = ["nome", "funcao", "operacao", "desde"] as const;

export const PADRAO_DAS_PESSOAS: PadraoDaTabela = { tam: 50, ordem: "nome" };

export const CHIPS_DE_SITUACAO = [
  { id: "com_vinculo", nome: "Com vínculo" },
  { id: "sem_vinculo", nome: "Sem vínculo" },
  { id: "pendente", nome: "Cadastro pendente" },
] as const;

export const CHIPS_DE_FUNCAO = FUNCOES_DA_PESSOA;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** O identificador da pessoa (e da operação) na rota é o id (uuid, minúsculo). O resto é 404. */
export function idValido(id: string | null | undefined): id is string {
  return typeof id === "string" && UUID.test(id);
}

export interface EstadoDasPessoas {
  operacao: string | null;
  consulta: ConsultaDeTabela;
}

export function lerPessoas(parametros: URLSearchParams): EstadoDasPessoas {
  const conhecidos: readonly string[] = [...CHIPS_DE_SITUACAO, ...CHIPS_DE_FUNCAO].map((c) => c.id);
  const consulta = lerTabela(parametros, PADRAO_DAS_PESSOAS, CAMPOS_DAS_PESSOAS);
  const operacao = parametros.get("operacao");
  return {
    operacao: idValido(operacao) ? operacao : null,
    consulta: { ...consulta, chips: consulta.chips.filter((c) => conhecidos.includes(c)) },
  };
}

/** A mesma visão com outra operação (ou todas): volta à página 1 e mantém o resto. */
export function enderecoDaOperacao(
  rota: string,
  parametros: URLSearchParams,
  operacao: string | null,
): string {
  const novos = new URLSearchParams(parametros.toString());
  novos.delete("pagina");
  novos.delete("operacao");
  if (operacao) novos.set("operacao", operacao);
  const texto = novos.toString();
  return texto ? `${rota}?${texto}` : rota;
}

/** A ficha de uma pessoa. */
export function enderecoDaFichaDaPessoa(id: string): string {
  return `${ROTA_DAS_PESSOAS}/${id}`;
}

export interface EstadoDaEscala {
  operacao: string | null;
  /** `aaaa-mm`, ou nulo para o mês corrente. */
  mes: string | null;
}

export function lerEscala(parametros: URLSearchParams): EstadoDaEscala {
  const operacao = parametros.get("operacao");
  const mes = parametros.get("mes");
  return {
    operacao: idValido(operacao) ? operacao : null,
    mes: mes !== null && MES.test(mes) ? mes : null,
  };
}

/** O endereço da escala de uma operação num mês. */
export function enderecoDaEscala(operacao: string | null, mes: string | null): string {
  const p = new URLSearchParams();
  if (operacao) p.set("operacao", operacao);
  if (mes) p.set("mes", mes);
  const texto = p.toString();
  return texto ? `${ROTA_DA_ESCALA}?${texto}` : ROTA_DA_ESCALA;
}

/** O mês anterior e o seguinte de `aaaa-mm`. */
export function mesVizinho(mes: string, passo: -1 | 1): string {
  const [ano, m] = mes.split("-").map(Number) as [number, number];
  const total = ano * 12 + (m - 1) + passo;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** As abas da ficha da pessoa: Resumo e Vínculos, depois as de toda raiz. */
export const ABAS_DA_PESSOA = [
  { id: "resumo", nome: "Resumo" },
  { id: "vinculos", nome: "Vínculos" },
  { id: "linha-do-tempo", nome: "Linha do tempo" },
  { id: "documentos", nome: "Documentos" },
  { id: "resultado", nome: "Resultado" },
  { id: "mapa", nome: "Mapa" },
  { id: "mapa-mental", nome: "Mapa mental" },
] as const;

export type AbaDaPessoa = (typeof ABAS_DA_PESSOA)[number]["id"];

export const IDS_DAS_ABAS_DA_PESSOA: readonly AbaDaPessoa[] = ABAS_DA_PESSOA.map((a) => a.id);
