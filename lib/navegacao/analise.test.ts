import { describe, expect, it } from "vitest";
import { enderecoDaAnalise, lerAnalise } from "./analise";

const HOJE = "2026-11-09";
const OPERACAO = "6f1c2c1e-1111-4a6b-9a9a-2b2b2b2b2b2b";

describe("estado da Análise da Frota na URL", () => {
  it("sem parâmetros, abre no mês atual, sem filial nem operação, agrupada por operação", () => {
    expect(lerAnalise(new URLSearchParams(), HOJE)).toEqual({
      mes: "2026-11",
      filial: null,
      operacao: null,
      agrupamento: "operacao",
    });
    expect(enderecoDaAnalise(lerAnalise(new URLSearchParams(), HOJE), HOJE)).toBe("/frota/analise");
  });

  it("lê e escreve mês, filial, operação e agrupamento (ida e volta)", () => {
    const q = new URLSearchParams({
      periodo: "2026-01",
      filial: "Matriz",
      operacao: OPERACAO,
      por: "gestor",
    });
    const estado = lerAnalise(q, HOJE);
    expect(estado).toEqual({
      mes: "2026-01",
      filial: "Matriz",
      operacao: OPERACAO,
      agrupamento: "gestor",
    });
    expect(
      lerAnalise(new URL(enderecoDaAnalise(estado, HOJE), "http://x").searchParams, HOJE),
    ).toEqual(estado);
  });

  it('mês futuro ou inválido volta ao mês atual; operação que não é id, filial "todas" e agrupamento desconhecido são ignorados', () => {
    const q = new URLSearchParams({
      periodo: "2027-01",
      operacao: "abc",
      por: "cor",
      filial: "todas",
    });
    expect(lerAnalise(q, HOJE)).toEqual({
      mes: "2026-11",
      filial: null,
      operacao: null,
      agrupamento: "operacao",
    });
    expect(lerAnalise(new URLSearchParams({ periodo: "2026-13" }), HOJE).mes).toBe("2026-11");
  });
});
