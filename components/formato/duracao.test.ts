import { describe, expect, it } from "vitest";
import { formatarDuracao } from "./duracao";

describe("formatarDuracao: minutos para texto", () => {
  it("menos de uma hora: só minutos", () => {
    expect(formatarDuracao(0)).toBe("0 min");
    expect(formatarDuracao(1)).toBe("1 min");
    expect(formatarDuracao(59)).toBe("59 min");
  });
  it("de uma hora a menos de um dia: horas e minutos", () => {
    expect(formatarDuracao(60)).toBe("1 h");
    expect(formatarDuracao(90)).toBe("1 h 30 min");
    expect(formatarDuracao(23 * 60 + 59)).toBe("23 h 59 min");
  });
  it("um dia ou mais: dias e, se sobrar, horas (os minutos não aparecem)", () => {
    expect(formatarDuracao(1440)).toBe("1 dia");
    expect(formatarDuracao(1440 + 60)).toBe("1 dia e 1 h");
    expect(formatarDuracao(2 * 1440)).toBe("2 dias");
    expect(formatarDuracao(12 * 1440 + 4 * 60)).toBe("12 dias e 4 h");
    expect(formatarDuracao(12 * 1440 + 30)).toBe("12 dias");
  });
  it("não usa casas decimais: minutos fracionados são arredondados para baixo", () => {
    expect(formatarDuracao(59.9)).toBe("59 min");
    expect(formatarDuracao(89.99)).toBe("1 h 29 min");
  });
  it("vazio, negativo e inválido viram traço", () => {
    for (const valor of [null, undefined, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatarDuracao(valor as number | null | undefined)).toBe("—");
    }
  });
});
