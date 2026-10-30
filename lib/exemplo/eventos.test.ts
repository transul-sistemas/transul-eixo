import { describe, expect, it } from "vitest";
import { SIGLAS, SIGLAS_DE_BAIXA } from "@/lib/dominio/status";
import { eventosDeExemplo } from "./eventos";
import { placasDeExemplo } from "./placas";

const HOJE = "2026-10-29";
const PLACAS = placasDeExemplo(HOJE);
const FORMATO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const minutos = (texto: string) => Date.parse(`${texto}:00Z`) / 60_000;

describe("eventosDeExemplo: o histórico de situações de cada placa", () => {
  it("o último evento é a situação atual da placa, no horário do `desde`", () => {
    for (const placa of PLACAS) {
      const eventos = eventosDeExemplo(placa);
      expect(eventos.at(-1), placa.placa).toEqual({ sigla: placa.sigla, em: placa.desde });
    }
  });

  it("os eventos andam para a frente no tempo, minuto a minuto, sem repetir o instante", () => {
    for (const placa of PLACAS) {
      const eventos = eventosDeExemplo(placa);
      for (let i = 1; i < eventos.length; i++) {
        expect(minutos(eventos[i]!.em), `${placa.placa} #${i}`).toBeGreaterThan(
          minutos(eventos[i - 1]!.em),
        );
      }
    }
  });

  it("cada placa tem entre 3 e 12 eventos", () => {
    for (const placa of PLACAS) {
      const total = eventosDeExemplo(placa).length;
      expect(total, placa.placa).toBeGreaterThanOrEqual(3);
      expect(total, placa.placa).toBeLessThanOrEqual(12);
    }
  });

  it("só usa siglas da régua, e nunca a mesma sigla duas vezes em seguida", () => {
    for (const placa of PLACAS) {
      const eventos = eventosDeExemplo(placa);
      for (let i = 0; i < eventos.length; i++) {
        expect(SIGLAS, `${placa.placa} #${i}`).toContain(eventos[i]!.sigla);
        if (i > 0) expect(eventos[i]!.sigla).not.toBe(eventos[i - 1]!.sigla);
      }
    }
  });

  it("a baixa (VND e SUC) é sempre o fim da história, nunca no meio", () => {
    for (const placa of PLACAS) {
      const eventos = eventosDeExemplo(placa);
      eventos.slice(0, -1).forEach((evento, i) => {
        expect(SIGLAS_DE_BAIXA, `${placa.placa} #${i}`).not.toContain(evento.sigla);
      });
    }
    expect(PLACAS.some((p) => SIGLAS_DE_BAIXA.includes(p.sigla))).toBe(true);
  });

  it("o horário vem como aaaa-mm-ddThh:mm e nenhum evento está no futuro", () => {
    for (const placa of PLACAS) {
      for (const evento of eventosDeExemplo(placa)) {
        expect(evento.em).toMatch(FORMATO);
        expect(evento.em <= `${HOJE}T23:59`, `${placa.placa} ${evento.em}`).toBe(true);
      }
    }
  });

  it("há variedade: placas com vários eventos no mesmo dia e placas com a história longa", () => {
    const mesmoDia = PLACAS.some((placa) => {
      const dias = eventosDeExemplo(placa).map((e) => e.em.slice(0, 10));
      return new Set(dias).size < dias.length;
    });
    expect(mesmoDia).toBe(true);
    const longa = PLACAS.some((placa) => eventosDeExemplo(placa).length >= 8);
    expect(longa).toBe(true);
  });

  it("é determinístico: a mesma placa no mesmo dia tem sempre a mesma história", () => {
    for (const placa of PLACAS.slice(0, 40)) {
      expect(eventosDeExemplo(placa)).toEqual(eventosDeExemplo(placa));
    }
    expect(eventosDeExemplo(placasDeExemplo(HOJE)[7]!)).toEqual(eventosDeExemplo(PLACAS[7]!));
  });

  it("os casos feios têm história coerente com o alerta (AAA0C17: no pátio há 35 dias)", () => {
    const solto = PLACAS.find((p) => p.placa === "AAA0C17")!;
    const eventos = eventosDeExemplo(solto);
    expect(eventos.at(-1)?.sigla).toBe("PÁT");
    expect(eventos.at(-1)?.em.slice(0, 10)).toBe("2026-09-24");
  });

  it("não altera a placa recebida", () => {
    const placa = PLACAS[3]!;
    const copia = JSON.parse(JSON.stringify(placa));
    eventosDeExemplo(placa);
    expect(placa).toEqual(copia);
  });
});
