import { describe, expect, it } from "vitest";
import { resumir } from "./resumo.ts";

describe("resumo da consulta (o que aparece na tela: só agregados)", () => {
  it("conta linhas e, por coluna, preenchidos, vazios e distintos; soma, mínimo e máximo só em coluna numérica", () => {
    const resumo = resumir({
      colunas: [
        { nome: "TIPOCAR", tipo: "S" },
        { nome: "QTD", tipo: "I" },
      ],
      linhas: [
        ["BAU", 10],
        ["BAU", 5],
        [null, 7],
        ["", null],
      ],
    });
    expect(resumo).toEqual({
      linhas: 4,
      colunas: [
        { nome: "TIPOCAR", tipo: "S", preenchidos: 2, vazios: 2, distintos: 1 },
        {
          nome: "QTD",
          tipo: "I",
          preenchidos: 3,
          vazios: 1,
          distintos: 3,
          soma: 22,
          minimo: 5,
          maximo: 10,
        },
      ],
    });
  });

  it("número que veio como texto conta como número", () => {
    const resumo = resumir({ colunas: [{ nome: "N", tipo: "I" }], linhas: [["3"], ["4"]] });
    expect(resumo.colunas[0]).toMatchObject({ soma: 7, minimo: 3, maximo: 4 });
  });

  it("consulta sem linhas", () => {
    expect(resumir({ colunas: [{ nome: "N", tipo: "I" }], linhas: [] })).toEqual({
      linhas: 0,
      colunas: [{ nome: "N", tipo: "I", preenchidos: 0, vazios: 0, distintos: 0 }],
    });
  });
});
