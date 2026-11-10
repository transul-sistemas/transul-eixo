import { describe, expect, it } from "vitest";
import { cpfValido, digitosDoCpf, mascararCpfDigitado } from "./documento";

// CPFs fictícios gerados só pelo dígito verificador (nenhum é de pessoa real conhecida).
describe("digitosDoCpf", () => {
  it("tira pontos, traço e espaços", () => {
    expect(digitosDoCpf(" 529.982.247-25 ")).toBe("52998224725");
  });
});

describe("cpfValido", () => {
  it("aceita o CPF com os dois dígitos verificadores certos, com ou sem máscara", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
  });
  it("recusa dígito verificador errado", () => {
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("12345678900")).toBe(false);
  });
  it("recusa todos os dígitos iguais", () => {
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
  });
  it("recusa tamanho diferente de 11 (CNPJ inclusive)", () => {
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("11222333000181")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });
  it("zeros à esquerda contam como dígitos", () => {
    expect(cpfValido("00000001910")).toBe(true);
  });
});

describe("mascararCpfDigitado", () => {
  it("põe pontos e traço conforme a pessoa digita, até 11 dígitos", () => {
    expect(mascararCpfDigitado("529")).toBe("529");
    expect(mascararCpfDigitado("5299")).toBe("529.9");
    expect(mascararCpfDigitado("5299822")).toBe("529.982.2");
    expect(mascararCpfDigitado("52998224725")).toBe("529.982.247-25");
    expect(mascararCpfDigitado("529982247250000")).toBe("529.982.247-25");
  });
});
