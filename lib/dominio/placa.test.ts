import { describe, expect, it } from "vitest";
import { normalizarPlaca } from "./placa";

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
