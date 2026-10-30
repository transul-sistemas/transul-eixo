import { describe, expect, it } from "vitest";
import { normalizarPlaca, placaNormalizadaValida } from "./placa";

describe("normalizarPlaca", () => {
  it("põe em maiúscula e tira hífen e espaços", () => {
    expect(normalizarPlaca(" abc-1d23 ")).toBe("ABC1D23");
  });
  it("mantém o formato antigo como foi escrito (a conversão é regra da Fase 4)", () => {
    expect(normalizarPlaca("ABC-1234")).toBe("ABC1234");
  });
  it("texto vazio continua vazio", () => {
    expect(normalizarPlaca("")).toBe("");
    expect(normalizarPlaca("  - ")).toBe("");
  });
  it("tira acento e símbolo", () => {
    expect(normalizarPlaca("ab ç.1/2")).toBe("AB12");
  });
});

describe("placaNormalizadaValida: a regra única da placa já normalizada", () => {
  it.each(["AAA0A00", "ABC1234", "BRA2E19", "AAA0C17", "ZZZ9Z99"])("aceita %s", (placa) => {
    expect(placaNormalizadaValida(placa)).toBe(true);
  });
  it.each([
    ["minúscula", "aaa0a00"],
    ["com hífen", "AAA-0A00"],
    ["com espaço", "AAA 0A00"],
    ["espaço nas pontas", " AAA0A00 "],
    ["curta", "AAA0A0"],
    ["longa", "AAA0A000"],
    ["só letras", "AAAAAAA"],
    ["só números", "1234567"],
    ["letra no lugar do algarismo", "AAAAA00"],
    ["vazia", ""],
    ["HTML", "<script>"],
    ["byte nulo", "AAA0A0\u0000"],
    ["acento", "AÁA0A00"],
    ["enorme", "A".repeat(500)],
    ["quebra de linha no fim", "AAA0A00\n"],
  ])("rejeita: %s", (_nome, texto) => {
    expect(placaNormalizadaValida(texto)).toBe(false);
  });
});
