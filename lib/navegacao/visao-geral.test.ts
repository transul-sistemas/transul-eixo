import { describe, expect, it } from "vitest";
import { enderecoDaVisaoGeral, lerVisaoGeral } from "./visao-geral";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("estado da Visão geral na URL", () => {
  it("sem parâmetros: o banco escolhe o mês, sem filial nem operação, por operação", () => {
    expect(lerVisaoGeral(new URLSearchParams())).toEqual({
      mes: null,
      filial: null,
      operacao: null,
      agrupamento: "operacao",
    });
  });
  it("lê período, filial, operação e agrupamento; descarta o inválido", () => {
    expect(
      lerVisaoGeral(
        new URLSearchParams({
          periodo: "2026-03",
          filial: UUID.toUpperCase(),
          operacao: UUID,
          por: "filial",
        }),
      ),
    ).toEqual({ mes: "2026-03", filial: UUID, operacao: UUID, agrupamento: "filial" });
    expect(
      lerVisaoGeral(
        new URLSearchParams({ periodo: "2026-13", filial: "x", operacao: "y", por: "placa" }),
      ),
    ).toEqual({ mes: null, filial: null, operacao: null, agrupamento: "operacao" });
  });
  it("o endereço só escreve o que difere do padrão e volta ao mesmo estado", () => {
    expect(
      enderecoDaVisaoGeral({ mes: null, filial: null, operacao: null, agrupamento: "operacao" }),
    ).toBe("/resultados/visao-geral");
    const estado = {
      mes: "2026-03",
      filial: UUID,
      operacao: null,
      agrupamento: "unidade",
    } as const;
    const endereco = enderecoDaVisaoGeral(estado);
    expect(endereco).toBe(`/resultados/visao-geral?periodo=2026-03&filial=${UUID}&por=unidade`);
    expect(lerVisaoGeral(new URL(endereco, "http://x").searchParams)).toEqual(estado);
  });
});
