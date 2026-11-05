import { describe, expect, it } from "vitest";
import {
  camposOrdenaveisDePlacas,
  colunasDePlacas,
  TITULOS_DAS_COLUNAS_DE_PLACAS,
} from "./placas-tipos";

// Fatia 3.9a: KM, motorista e CRLV ainda não têm fonte no banco (Documentos, Sankhya ou leitura manual
// e o módulo Pessoas, no backlog). No modo banco, as colunas e a ordem por eles somem; no exemplo, ficam.
// Garagem (as 3, derivada do CR) e Filial (a do CR, as 13 do Sankhya) são colunas separadas.

const ids = (modo: "exemplo" | "banco") => colunasDePlacas(modo).map((c) => c.id);

describe("colunasDePlacas", () => {
  it("no banco, sem KM nem motorista", () => {
    expect(ids("banco")).not.toContain("km");
    expect(ids("banco")).not.toContain("motorista");
  });
  it("no exemplo, todas", () => {
    expect(ids("exemplo")).toEqual(expect.arrayContaining(["km", "motorista"]));
  });
  it.each(["exemplo", "banco"] as const)("em %s, Garagem e Filial separadas", (modo) => {
    expect(ids(modo)).toEqual(expect.arrayContaining(["garagem", "filial"]));
    expect(TITULOS_DAS_COLUNAS_DE_PLACAS.garagem).toBe("Garagem");
    expect(TITULOS_DAS_COLUNAS_DE_PLACAS.filial).toBe("Filial");
  });
});

describe("camposOrdenaveisDePlacas", () => {
  it("no banco, não ordena por KM, motorista nem CRLV", () => {
    for (const campo of ["km", "motorista", "crlv"]) {
      expect(camposOrdenaveisDePlacas("banco")).not.toContain(campo);
    }
    expect(camposOrdenaveisDePlacas("banco")).toContain("filial");
  });
  it("no exemplo, ordena por todos", () => {
    expect(camposOrdenaveisDePlacas("exemplo")).toEqual(
      expect.arrayContaining(["km", "motorista", "crlv"]),
    );
  });
});
