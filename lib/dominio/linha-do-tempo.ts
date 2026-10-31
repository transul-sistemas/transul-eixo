import type { Status } from "@/lib/visual/tons";
import { grupoDaSigla, type Sigla } from "./status";

/** Um evento da régua de status: a placa passou a estar nesta situação neste horário. */
export interface EventoDeStatus {
  sigla: Sigla;
  /** Hora de parede em São Paulo, `aaaa-mm-ddThh:mm`. */
  em: string;
}

/** Uma faixa da linha do tempo, `[de, ate)`. `sigla` nula é "sem registro". */
export interface Segmento {
  sigla: Sigla | null;
  grupo: Status | null;
  de: string;
  ate: string;
  minutos: number;
}

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function emMinutos(texto: string): number {
  const achado = FORMATO.exec(texto);
  if (!achado) return Number.NaN;
  const [, ano, mes, dia, hora, minuto] = achado.map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return Date.UTC(ano, mes - 1, dia, hora, minuto) / 60_000;
}

function paraTexto(minutos: number): string {
  return new Date(minutos * 60_000).toISOString().slice(0, 16);
}

/**
 * As faixas da linha do tempo pela régua de status dentro da janela. Cada faixa é `[início, fim)`
 * e as faixas são contíguas: a soma dos minutos é a janela inteira. A janela termina em `agora` se
 * pedir além. Evento em `agora` ou depois é ignorado; dois eventos no mesmo minuto ficam com o
 * último; o evento anterior à janela vale no começo dela; antes do primeiro evento a faixa é "sem
 * registro". Sigla repetida em seguida junta numa faixa só.
 */
export function segmentosDaLinhaDoTempo(
  eventos: readonly EventoDeStatus[],
  janela: { de: string; ate: string },
  agora: string,
): Segmento[] {
  const inicio = emMinutos(janela.de);
  const fim = Math.min(emMinutos(janela.ate), emMinutos(agora));
  if (!(fim > inicio)) return [];

  // Ordem do horário (a ordenação é estável); no mesmo minuto vale o último da entrada.
  const ordenados = eventos
    .map((evento) => ({ sigla: evento.sigla, minuto: emMinutos(evento.em) }))
    .filter((evento) => Number.isFinite(evento.minuto) && evento.minuto < fim)
    .sort((a, b) => a.minuto - b.minuto);
  const unicos: { sigla: Sigla; minuto: number }[] = [];
  for (const evento of ordenados) {
    if (unicos.at(-1)?.minuto === evento.minuto) unicos.pop();
    unicos.push(evento);
  }

  let atual: Sigla | null = null;
  for (const evento of unicos) if (evento.minuto <= inicio) atual = evento.sigla;

  const faixas: { sigla: Sigla | null; de: number; ate: number }[] = [];
  let cursor = inicio;
  for (const evento of unicos) {
    if (evento.minuto <= inicio) continue;
    faixas.push({ sigla: atual, de: cursor, ate: evento.minuto });
    atual = evento.sigla;
    cursor = evento.minuto;
  }
  faixas.push({ sigla: atual, de: cursor, ate: fim });

  const juntas: typeof faixas = [];
  for (const faixa of faixas) {
    const anterior = juntas.at(-1);
    if (anterior && anterior.sigla === faixa.sigla) anterior.ate = faixa.ate;
    else juntas.push({ ...faixa });
  }

  return juntas.map((faixa) => ({
    sigla: faixa.sigla,
    grupo: faixa.sigla === null ? null : grupoDaSigla(faixa.sigla),
    de: paraTexto(faixa.de),
    ate: paraTexto(faixa.ate),
    minutos: faixa.ate - faixa.de,
  }));
}
