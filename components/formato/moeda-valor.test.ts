import { describe, expect, it } from "vitest";
import { centavosDoTextoColado, formatarMoeda, proximoValorDoCampo } from "./moeda-valor";

const E = " "; // espaço sem quebra entre R$ e o número

describe("formatarMoeda", () => {
  it("mostra milhares, vírgula e sempre os centavos", () => {
    expect(formatarMoeda(128430000)).toBe(`R$${E}1.284.300,00`);
    expect(formatarMoeda(5)).toBe(`R$${E}0,05`);
    expect(formatarMoeda(0)).toBe(`R$${E}0,00`);
  });
  it("negativo leva o sinal na frente", () => {
    expect(formatarMoeda(-1234)).toBe(`-R$${E}12,34`);
    expect(formatarMoeda(-1)).toBe(`-R$${E}0,01`);
  });
  it("menos zero não vira negativo", () => {
    expect(formatarMoeda(-0)).toBe(`R$${E}0,00`);
  });
  it("aguenta 15 dígitos (numeric(15,2)) sem notação científica", () => {
    expect(formatarMoeda(999999999999999)).toBe(`R$${E}9.999.999.999.999,99`);
  });
  it("valor ausente ou inválido vira travessão", () => {
    expect(formatarMoeda(null)).toBe("—");
    expect(formatarMoeda(undefined)).toBe("—");
    expect(formatarMoeda(Number.NaN)).toBe("—");
    expect(formatarMoeda(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("proximoValorDoCampo", () => {
  it("preenche a partir dos centavos: 1, 2, 3, 4 resulta em 1234", () => {
    const valor = ["1", "2", "3", "4"].reduce(proximoValorDoCampo, 0);
    expect(valor).toBe(1234);
    expect(formatarMoeda(valor)).toBe(`R$${E}12,34`);
  });
  it("Backspace remove o último dígito, até zerar", () => {
    expect(proximoValorDoCampo(1234, "Backspace")).toBe(123);
    expect(proximoValorDoCampo(5, "Backspace")).toBe(0);
    expect(proximoValorDoCampo(0, "Backspace")).toBe(0);
  });
  it("tecla que não é dígito mantém o valor", () => {
    expect(proximoValorDoCampo(1234, "a")).toBe(1234);
    expect(proximoValorDoCampo(1234, ",")).toBe(1234);
    expect(proximoValorDoCampo(1234, "Enter")).toBe(1234);
  });
  it("o 16.º dígito é ignorado", () => {
    expect(proximoValorDoCampo(999999999999999, "1")).toBe(999999999999999);
    expect(proximoValorDoCampo(99999999999999, "9")).toBe(999999999999999);
  });
});

describe("centavosDoTextoColado", () => {
  it("fica só com os dígitos", () => {
    expect(centavosDoTextoColado("R$ 12,34abc")).toBe(1234);
  });
  it("texto sem dígito vira zero", () => {
    expect(centavosDoTextoColado("abc")).toBe(0);
    expect(centavosDoTextoColado("")).toBe(0);
  });
  it("limita a 15 dígitos", () => {
    expect(centavosDoTextoColado("1234567890123456789")).toBe(123456789012345);
  });
});
