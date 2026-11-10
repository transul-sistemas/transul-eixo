import { describe, expect, it } from "vitest";
import { esquemaEditarOperacao } from "./operacao";

// O esquema do assistente "Editar operação" (o mesmo na tela e na Server Action). Dados fictícios.
const valida = {
  id: "00000000-0000-4000-8000-000000000001",
  versao: 3,
  nome: "  Operação Fictícia  ",
  tipo: "operacao",
  baseCidade: "Cordeirópolis",
  baseUf: "sp",
};

describe("esquemaEditarOperacao", () => {
  it("aceita a operação, aparando o nome e pondo a UF em maiúsculas", () => {
    const r = esquemaEditarOperacao.parse(valida);
    expect(r.nome).toBe("Operação Fictícia");
    expect(r.baseUf).toBe("SP");
  });
  it("a base pode ficar vazia", () => {
    expect(esquemaEditarOperacao.safeParse({ ...valida, baseCidade: "", baseUf: "" }).success).toBe(
      true,
    );
  });
  it("recusa nome curto, tipo desconhecido, UF inválida e versão que falta", () => {
    const erros = (dados: object) =>
      esquemaEditarOperacao.safeParse({ ...valida, ...dados }).error?.issues.map((i) => i.path[0]);
    expect(erros({ nome: "a" })).toEqual(["nome"]);
    expect(erros({ tipo: "frota" })).toEqual(["tipo"]);
    expect(erros({ baseUf: "São Paulo" })).toEqual(["baseUf"]);
    expect(erros({ versao: 0 })).toEqual(["versao"]);
    expect(erros({ id: "x" })).toEqual(["id"]);
  });
});
