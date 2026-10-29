import { describe, expect, it } from "vitest";
import { formatarKm, formatarKmPorLitro, formatarLitros, formatarPercentual } from "./numero";

describe("números", () => {
  it("km sem casas, com milhar", () => {
    expect(formatarKm(12345)).toBe("12.345 km");
    expect(formatarKm(12345.6)).toBe("12.346 km");
  });
  it("litros com duas casas", () => {
    expect(formatarLitros(1234.5)).toBe("1.234,50 L");
  });
  it("km/l com duas casas", () => {
    expect(formatarKmPorLitro(3.25)).toBe("3,25 km/l");
    expect(formatarKmPorLitro(3)).toBe("3,00 km/l");
  });
  it("percentual com uma casa, recebendo pontos percentuais", () => {
    expect(formatarPercentual(12.34)).toBe("12,3%");
    expect(formatarPercentual(0)).toBe("0,0%");
    expect(formatarPercentual(-5.55)).toBe("-5,6%");
  });
  it("arredondamento para zero não deixa sinal de menos", () => {
    expect(formatarKm(-0.4)).toBe("0 km");
    expect(formatarPercentual(-0.01)).toBe("0,0%");
  });
  it("valor ausente ou inválido vira travessão", () => {
    for (const f of [formatarKm, formatarLitros, formatarKmPorLitro, formatarPercentual]) {
      expect(f(null)).toBe("—");
      expect(f(undefined)).toBe("—");
      expect(f(Number.NaN)).toBe("—");
    }
  });
});
