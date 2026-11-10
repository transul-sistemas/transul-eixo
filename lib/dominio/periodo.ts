// O período das telas de Operações: um mês fechado ou um acumulado (ano, últimos 12 meses, todos os
// meses). Regras puras, sem fuso: só texto `aaaa-mm` e `aaaa-mm-dd`. Intervalos sempre [início, fim).
// O dia do corte é parâmetro (config.parametro 'dia_do_corte_da_competencia'); a mesma regra vive no
// banco (nucleo.mes_fechado_mais_recente) e este arquivo só a usa para montar chips e intervalos.

export type ModoAcumulado = "ano" | "12m" | "todos";
export const MODOS_DO_ACUMULADO: readonly { id: ModoAcumulado; nome: string }[] = [
  { id: "ano", nome: "Ano até aqui" },
  { id: "12m", nome: "Últimos 12 meses" },
  { id: "todos", nome: "Todos os meses" },
];

export type Periodo = { tipo: "mes"; mes: string } | { tipo: "acumulado"; modo: ModoAcumulado };

export interface Intervalo {
  /** `aaaa-mm-01`, incluído. */
  inicio: string;
  /** `aaaa-mm-01`, excluído. */
  fim: string;
}

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

function indiceDoMes(mes: string): number {
  const m = MES.exec(mes.slice(0, 7));
  if (!m) throw new Error(`Mês inválido: ${mes}`);
  return Number(m[1]) * 12 + Number(m[2]) - 1;
}

function mesDoIndice(indice: number): string {
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
}

/** Soma (ou subtrai) meses a um `aaaa-mm`. */
export function somarMeses(mes: string, n: number): string {
  return mesDoIndice(indiceDoMes(mes) + n);
}

/**
 * O mês fechado mais recente: o mês M fecha quando passa o dia do corte do mês seguinte (o título
 * lançado até o dia do corte ainda cai em M). Em 10/11 com corte 10, o último fechado é setembro.
 */
export function mesFechadoMaisRecente(hoje: string, corte: number): string {
  const mesDeHoje = hoje.slice(0, 7);
  const dia = Number(hoje.slice(8, 10));
  return somarMeses(mesDeHoje, dia > corte ? -1 : -2);
}

export function lerPeriodo(parametros: URLSearchParams, mesPadrao: string): Periodo {
  const acum = parametros.get("acum");
  if (acum === "ano" || acum === "12m" || acum === "todos") {
    return { tipo: "acumulado", modo: acum };
  }
  const mes = parametros.get("mes");
  return { tipo: "mes", mes: mes !== null && MES.test(mes) ? mes : mesPadrao };
}

/** O intervalo do período. `primeiroMes` (`aaaa-mm`) é o mais antigo com dados, para "todos". */
export function intervaloDoPeriodo(
  periodo: Periodo,
  mesFechado: string,
  primeiroMes: string | null = null,
): Intervalo {
  const fimDoFechado = `${somarMeses(mesFechado, 1)}-01`;
  if (periodo.tipo === "mes") {
    return { inicio: `${periodo.mes}-01`, fim: `${somarMeses(periodo.mes, 1)}-01` };
  }
  if (periodo.modo === "ano") {
    return { inicio: `${mesFechado.slice(0, 4)}-01-01`, fim: fimDoFechado };
  }
  if (periodo.modo === "12m") {
    return { inicio: `${somarMeses(mesFechado, -11)}-01`, fim: fimDoFechado };
  }
  return { inicio: `${primeiroMes ?? somarMeses(mesFechado, -11)}-01`, fim: fimDoFechado };
}

export function mesesDoIntervalo(i: Intervalo): string[] {
  const de = indiceDoMes(i.inicio);
  const ate = indiceDoMes(i.fim);
  return Array.from({ length: Math.max(ate - de, 0) }, (_, k) => mesDoIndice(de + k));
}

/** O período de comparação: a mesma quantidade de meses logo antes. */
export function periodoAnterior(i: Intervalo): Intervalo {
  const n = indiceDoMes(i.fim) - indiceDoMes(i.inicio);
  return { inicio: `${somarMeses(i.inicio, -n)}-01`, fim: i.inicio };
}

/** Quanto o valor mudou sobre o anterior, em pontos percentuais; nulo sem base de comparação. */
export function variacaoPercentual(
  atual: number | null | undefined,
  anterior: number | null | undefined,
): number | null {
  if (atual === null || atual === undefined) return null;
  if (anterior === null || anterior === undefined || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/** Os chips de mês: doze meses terminando no mês fechado, do mais antigo ao mais recente. */
export function chipsDeMes(mesFechado: string, quantos = 12): string[] {
  return Array.from({ length: quantos }, (_, k) => somarMeses(mesFechado, k - (quantos - 1)));
}
