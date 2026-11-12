import type { Vigencia } from "@/lib/dominio/vigencia";

// As regras puras da grade por conjunto (Frota › Acompanhamento). A fonte é o banco
// (nucleo.grade_por_conjunto); isto é o espelho que dá nome aos limites e monta as colunas:
//  * a célula de um dia vale pelo fim do dia (hoje, pelo agora), com vigência [início, fim);
//  * o implemento engatado herda a sigla do cavalo; fora do conjunto, fica sem sigla;
//  * X e Y vêm do banco e nunca se somam na tela.
// São Paulo não tem horário de verão desde 2019; o dia é sempre o de UTC-3.

const FUSO = "-03:00";
const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

export interface DiaDaColuna {
  /** `aaaa-mm-dd`. */
  dia: string;
  /** Os dois dígitos do dia ("01" a "31"), para o cabeçalho. */
  numero: string;
  diaDaSemana: (typeof DIAS_DA_SEMANA)[number];
  fimDeSemana: boolean;
  hoje: boolean;
  futuro: boolean;
}

/** As colunas do mês `aaaa-mm`: uma por dia (28 a 31), com o dia da semana, o fim de semana e o hoje. */
export function diasDoMes(mes: string, hoje: string): DiaDaColuna[] {
  const [ano, m] = mes.split("-").map(Number) as [number, number];
  const quantidade = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return Array.from({ length: quantidade }, (_, i) => {
    const numero = String(i + 1).padStart(2, "0");
    const dia = `${mes}-${numero}`;
    const semana = new Date(Date.UTC(ano, m - 1, i + 1)).getUTCDay();
    return {
      dia,
      numero,
      diaDaSemana: DIAS_DA_SEMANA[semana] ?? "dom",
      fimDeSemana: semana === 0 || semana === 6,
      hoje: dia === hoje,
      futuro: dia > hoje,
    };
  });
}

/** O instante que representa o dia: o último instante dele em São Paulo, ou o agora se o dia é hoje ou futuro. */
export function instanteDoDia(dia: string, agora: string): number {
  const fim = Date.parse(`${dia}T23:59:59.999${FUSO}`);
  return Math.min(fim, Date.parse(agora));
}

/** O implemento estava no conjunto naquele dia? Vigência [início, fim), vista no fim do dia. */
export function engatadoNoDia(vigencias: readonly Vigencia[], dia: string, agora: string): boolean {
  const t = instanteDoDia(dia, agora);
  return vigencias.some(
    (v) => Date.parse(v.inicio) <= t && (v.fim === null || t < Date.parse(v.fim)),
  );
}

/** A sigla do implemento no dia: a do cavalo, se engatado; sem sigla fora do conjunto. */
export function siglaDoImplementoNoDia(entrada: {
  engatado: boolean;
  siglaDoCavalo: string | null;
}): string | null {
  return entrada.engatado ? entrada.siglaDoCavalo : null;
}

/** O texto do selo de uma célula ("2 lançamentos, com correção tardia"), ou nulo se o dia não teve lançamento. */
export function rotuloDoSelo(selo: {
  eventos: number;
  manual: boolean;
  tardia: boolean;
}): string | null {
  if (selo.eventos <= 0) return null;
  const base = `${selo.eventos} ${selo.eventos === 1 ? "lançamento" : "lançamentos"}`;
  const marcas = [
    ...(selo.manual ? ["lançamento manual"] : []),
    ...(selo.tardia ? ["correção tardia"] : []),
  ];
  return marcas.length > 0 ? `${base}, com ${marcas.join(" e ")}` : base;
}

export type MedidaDoDia =
  | { tipo: "vazia" }
  | { tipo: "medida"; x: number; y: number; completa: boolean };

/** "X de Y conjuntos com lançamento hoje": sem Y, a medida é vazia (nunca "0 de 0"). */
export function medidaDoDia(x: number, y: number): MedidaDoDia {
  if (y <= 0) return { tipo: "vazia" };
  return { tipo: "medida", x, y, completa: x >= y };
}
