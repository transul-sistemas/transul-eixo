import { z } from "zod";
import { SIGLAS, type Sigla } from "@/lib/dominio/status";
import { escreverConsulta, lerConsulta } from "./consulta";

// Estado de uma tabela na URL: busca, chips, siglas, "inclui baixadas", ordem, página e tamanho.
// Recarregar ou compartilhar o link devolve a mesma visão (Qualidade de interação, regra 2). O que
// vem da URL nunca é confiável: tudo é validado e cai no padrão ou no limite, sem erro.
//
// Parâmetros: `q`, `chip` (repetido), `sigla` (repetido), `baixadas=1`, `ordem` (`campo` ou
// `-campo` para decrescente), `pagina` (base 1) e `tam`.

/** Maior tamanho de página que o servidor entrega, mesmo que a URL peça mais. */
export const TETO_DE_TAM = 100;

export interface ConsultaDeTabela {
  busca: string;
  chips: string[];
  siglas: Sigla[];
  baixadas: boolean;
  ordem: { campo: string; sentido: "asc" | "desc" };
  pagina: number;
  tam: number;
}

export interface PadraoDaTabela {
  tam: number;
  /** Campo de ordem inicial; `-campo` para decrescente. */
  ordem: string;
}

const inteiroPositivo = z.coerce.number().int().min(1);

function lerOrdem(
  bruto: string | null,
  campos: readonly string[],
  padrao: string,
): ConsultaDeTabela["ordem"] {
  for (const texto of [bruto ?? "", padrao]) {
    const decrescente = texto.startsWith("-");
    const campo = decrescente ? texto.slice(1) : texto;
    if (campos.includes(campo)) return { campo, sentido: decrescente ? "desc" : "asc" };
  }
  return { campo: campos[0] ?? "", sentido: "asc" };
}

export function lerTabela(
  parametros: URLSearchParams,
  padrao: PadraoDaTabela,
  camposOrdenaveis: readonly string[],
): ConsultaDeTabela {
  const { busca, chips } = lerConsulta(parametros);
  const siglas = [...new Set(parametros.getAll("sigla"))].filter((s): s is Sigla =>
    (SIGLAS as readonly string[]).includes(s),
  );
  const tam = inteiroPositivo.catch(padrao.tam).parse(parametros.get("tam"));
  return {
    busca,
    chips: [...chips],
    siglas,
    baixadas: parametros.get("baixadas") === "1",
    ordem: lerOrdem(parametros.get("ordem"), camposOrdenaveis, padrao.ordem),
    pagina: inteiroPositivo.catch(1).parse(parametros.get("pagina")),
    tam: Math.min(tam, TETO_DE_TAM),
  };
}

/** Parâmetros novos com a consulta escrita; o que não é da tabela (contexto, modo) fica. */
export function escreverTabela(
  parametros: URLSearchParams,
  consulta: ConsultaDeTabela,
  padrao: PadraoDaTabela,
): URLSearchParams {
  const novos = escreverConsulta(parametros, { busca: consulta.busca, chips: consulta.chips });
  for (const chave of ["sigla", "baixadas", "ordem", "pagina", "tam"]) novos.delete(chave);
  for (const sigla of new Set(consulta.siglas)) novos.append("sigla", sigla);
  if (consulta.baixadas) novos.set("baixadas", "1");
  const padraoDeOrdem = lerOrdem(padrao.ordem, [padrao.ordem.replace(/^-/, "")], padrao.ordem);
  const ehPadrao =
    consulta.ordem.campo === padraoDeOrdem.campo &&
    consulta.ordem.sentido === padraoDeOrdem.sentido;
  if (!ehPadrao) {
    novos.set("ordem", `${consulta.ordem.sentido === "desc" ? "-" : ""}${consulta.ordem.campo}`);
  }
  if (consulta.pagina > 1) novos.set("pagina", String(consulta.pagina));
  const tam = Math.min(consulta.tam, TETO_DE_TAM);
  if (tam !== padrao.tam) novos.set("tam", String(tam));
  return novos;
}

/**
 * Aplica uma mudança à consulta da URL. Mudar qualquer filtro, a ordem ou o tamanho volta para a
 * página 1; pedir uma página, ou repetir a mesma consulta (atualizar), mantém a página.
 */
export function mudarConsulta(
  parametros: URLSearchParams,
  parcial: Partial<ConsultaDeTabela>,
  padrao: PadraoDaTabela,
  camposOrdenaveis: readonly string[],
): URLSearchParams {
  const atual = lerTabela(parametros, padrao, camposOrdenaveis);
  const novo: ConsultaDeTabela = { ...atual, ...parcial };
  const mudouFiltro = (Object.keys(parcial) as (keyof ConsultaDeTabela)[])
    .filter((chave) => chave !== "pagina")
    .some((chave) => JSON.stringify(parcial[chave]) !== JSON.stringify(atual[chave]));
  if (parcial.pagina === undefined && mudouFiltro) novo.pagina = 1;
  return escreverTabela(parametros, novo, padrao);
}
