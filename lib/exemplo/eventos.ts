import type { EventoDeStatus } from "@/lib/dominio/linha-do-tempo";
import { SIGLAS, SIGLAS_DE_BAIXA } from "@/lib/dominio/status";
import type { PlacaDeExemplo } from "./tipos";

// A história de situações de cada placa de exemplo: o último evento é sempre a situação atual (a
// sigla e o `desde` da placa) e os anteriores andam para trás no tempo, sem sorteio, para a mesma
// placa ter sempre a mesma história. Alguns intervalos são de poucas horas (vários eventos no mesmo
// dia) e outros de semanas. A baixa (VND e SUC) só aparece no fim. Nunca é importada fora de
// desenvolvimento e testes (ver lib/qualidade/barramento-do-exemplo.ts).

const ATIVAS = SIGLAS.filter((sigla) => !SIGLAS_DE_BAIXA.includes(sigla));

/** Intervalos entre eventos, em minutos: de uma hora e meia a quase duas semanas. */
const INTERVALOS = [180, 1560, 420, 2900, 90, 5400, 360, 12000];

function semente(texto: string): number {
  let soma = 0;
  for (let i = 0; i < texto.length; i++) soma += texto.charCodeAt(i) * (i + 1);
  return soma;
}

function somarMinutos(texto: string, minutos: number): string {
  const ms = Date.parse(`${texto}:00Z`) + minutos * 60_000;
  return new Date(ms).toISOString().slice(0, 16);
}

export function eventosDeExemplo(placa: PlacaDeExemplo): EventoDeStatus[] {
  const base = semente(placa.placa);
  const total = 3 + (base % 8);
  const eventos: EventoDeStatus[] = [{ sigla: placa.sigla, em: placa.desde }];
  for (let k = 1; k < total; k++) {
    const seguinte = eventos[0] as EventoDeStatus;
    const intervalo = (INTERVALOS[(base + k * 3) % INTERVALOS.length] as number) + (base % 17);
    let indice = (base * 7 + k * 11) % ATIVAS.length;
    if (ATIVAS[indice] === seguinte.sigla) indice = (indice + 1) % ATIVAS.length;
    eventos.unshift({ sigla: ATIVAS[indice]!, em: somarMinutos(seguinte.em, -intervalo) });
  }
  return eventos;
}
