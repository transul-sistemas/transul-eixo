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

/** Uma peça do conjunto num dia: a placa, a sigla do dia e o grupo da régua. */
export interface PecaNoDia {
  placa: string;
  sigla: string | null;
  grupo: string | null;
}

/** A peça que impede o conjunto: o implemento engatado impedido e a sigla dele. */
export interface CausaDoImpedimento {
  placa: string;
  sigla: string;
}

/**
 * A situação do conjunto no dia (regra de 12/11/2026): a do cavalo, EXCETO quando um implemento engatado
 * naquele dia está impedido (manutenção, sem documento, problema documental): aí o conjunto fica impedido
 * e as causas são as placas dos implementos impedidos. Cavalo impedido por si mesmo não tem causa de
 * implemento (é ele). Com mais de um implemento impedido a sigla do conjunto é a do primeiro (posição mais
 * baixa) e TODOS aparecem nas causas, na ordem. O banco calcula o mesmo em `nucleo.dias_do_conjunto`
 * (a situação vem de `nucleo.situacao_com_causa`); isto dá nome à regra e cobre os limites.
 */
export function situacaoDoConjuntoNoDia(entrada: {
  cavalo: PecaNoDia;
  implementosEngatados: readonly PecaNoDia[];
}): { sigla: string | null; causas: CausaDoImpedimento[] } {
  if (entrada.cavalo.grupo === "impedida") return { sigla: entrada.cavalo.sigla, causas: [] };
  const causas = entrada.implementosEngatados.flatMap((i): CausaDoImpedimento[] =>
    i.grupo === "impedida" && i.sigla ? [{ placa: i.placa, sigla: i.sigla }] : [],
  );
  const primeira = causas[0];
  return { sigla: primeira ? primeira.sigla : entrada.cavalo.sigla, causas };
}

/**
 * O texto das causas, para a dica, o aria-label e o painel: uma peça, "impedido por <placa> · <sigla>"; duas
 * ou mais, "impedido por N peças: <placa> <sigla>, <placa> <sigla>". Sem causa, nulo.
 */
export function rotuloDaCausa(causas: readonly CausaDoImpedimento[]): string | null {
  const [unica, ...resto] = causas;
  if (!unica) return null;
  if (resto.length === 0) return `impedido por ${unica.placa} · ${unica.sigla}`;
  return `impedido por ${causas.length} peças: ${causas.map((c) => `${c.placa} ${c.sigla}`).join(", ")}`;
}

export type TamanhoDaPagina = number | "auto";

/** A altura que o servidor assume quando a janela ainda não disse a dela (cookie ausente). */
export const ALTURA_PADRAO_DA_JANELA = 768;
/**
 * A altura que a grade deixa para fora das linhas: topo do sistema, título e abas, faixa do dia, chips,
 * barra de consulta, cabeçalho dos dias, paginador, legenda rápida e os respiros. Calibrada com a
 * captura de 1366 × 768 (revisar quando o layout da tela mudar).
 */
export const ALTURA_FIXA_DA_GRADE = 456;
/** A altura de uma linha de conjunto: o cavalo, o modelo e os chips dos implementos. */
export const ALTURA_DA_LINHA = { compacta: 64, confortavel: 84 } as const;
export const MINIMO_DE_LINHAS = 3;
export const MAXIMO_DE_LINHAS = 100;

/** Quantas linhas cabem na altura da janela (a página nunca rola na vertical). Entre 3 e 100. */
export function linhasQueCabem(
  alturaDaJanela: number,
  densidade: keyof typeof ALTURA_DA_LINHA,
): number {
  const altura =
    Number.isFinite(alturaDaJanela) && alturaDaJanela > 0
      ? alturaDaJanela
      : ALTURA_PADRAO_DA_JANELA;
  const n = Math.floor((altura - ALTURA_FIXA_DA_GRADE) / ALTURA_DA_LINHA[densidade]);
  return Math.min(Math.max(n, MINIMO_DE_LINHAS), MAXIMO_DE_LINHAS);
}

/** O tamanho da página: "auto" cabe na janela; 20, 50 e 100 valem como estão (a tabela rola por dentro). */
export function tamanhoEfetivoDaPagina(
  tam: TamanhoDaPagina,
  alturaDaJanela: number,
  densidade: keyof typeof ALTURA_DA_LINHA,
): number {
  return tam === "auto" ? linhasQueCabem(alturaDaJanela, densidade) : tam;
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
  { tipo: "vazia" } | { tipo: "medida"; x: number; y: number; completa: boolean };

/** "X de Y conjuntos com lançamento hoje": sem Y, a medida é vazia (nunca "0 de 0"). */
export function medidaDoDia(x: number, y: number): MedidaDoDia {
  if (y <= 0) return { tipo: "vazia" };
  return { tipo: "medida", x, y, completa: x >= y };
}
