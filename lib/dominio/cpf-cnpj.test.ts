import { describe, expect, it } from "vitest";
import { documentoValido, normalizarDocumento, tipoDoDocumento } from "./cpf-cnpj";

// CPF e CNPJ fictícios, gerados só para o teste (dígitos verificadores calculados à mão).
describe("normalizarDocumento", () => {
  it("fica só com os dígitos", () => {
    expect(normalizarDocumento("529.982.247-25")).toBe("52998224725");
    expect(normalizarDocumento(" 11.222.333/0001-81 ")).toBe("11222333000181");
  });
});

describe("documentoValido", () => {
  it("aceita CPF com os dígitos verificadores certos", () => {
    expect(documentoValido("52998224725")).toBe(true);
    expect(documentoValido("529.982.247-25")).toBe(true);
  });
  it("recusa CPF com dígito errado, repetido ou do tamanho errado", () => {
    expect(documentoValido("52998224724")).toBe(false);
    expect(documentoValido("11111111111")).toBe(false);
    expect(documentoValido("5299822472")).toBe(false);
  });
  it("aceita CNPJ com os dígitos verificadores certos", () => {
    expect(documentoValido("11222333000181")).toBe(true);
    expect(documentoValido("11.222.333/0001-81")).toBe(true);
  });
  it("recusa CNPJ com dígito errado ou repetido", () => {
    expect(documentoValido("11222333000182")).toBe(false);
    expect(documentoValido("00000000000000")).toBe(false);
  });
  it("vazio não vale", () => {
    expect(documentoValido("")).toBe(false);
  });
});

describe("tipoDoDocumento", () => {
  it("11 dígitos é CPF, 14 é CNPJ, o resto é nulo", () => {
    expect(tipoDoDocumento("52998224725")).toBe("cpf");
    expect(tipoDoDocumento("11222333000181")).toBe("cnpj");
    expect(tipoDoDocumento("123")).toBeNull();
  });
});
