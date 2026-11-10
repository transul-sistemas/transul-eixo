import { describe, expect, it } from "vitest";
import { chaveDaCascata, passosDaCascata, semLancamentos } from "./resultado-da-operacao";

const zero = { receitaCentavos: 0, custoFrotaCentavos: 0, custoServicoCentavos: 0 };

describe("semLancamentos: zero sem lançamento nenhum não é resultado", () => {
  it("sem receita nem custo em nenhum mês da janela, não há dado", () => {
    expect(semLancamentos([zero, zero, zero])).toBe(true);
    expect(semLancamentos([])).toBe(true);
  });
  it("qualquer receita ou custo na janela já é dado", () => {
    expect(semLancamentos([zero, { ...zero, receitaCentavos: 100 }])).toBe(false);
    expect(semLancamentos([{ ...zero, custoFrotaCentavos: 1 }])).toBe(false);
    expect(semLancamentos([{ ...zero, custoServicoCentavos: -5 }])).toBe(false);
  });
});

describe("passosDaCascata (receita, custos, margem)", () => {
  it("receita sobe, custos descem a partir dali e a margem fecha a conta", () => {
    const p = passosDaCascata({
      receitaCentavos: 10_000,
      custoFrotaCentavos: 3_000,
      custoServicoCentavos: 2_000,
      margemCentavos: 5_000,
    });
    expect(p.map((x) => x.rotulo)).toEqual([
      "Receita",
      "Custo da frota",
      "Custo de serviço e pessoal",
      "Margem",
    ]);
    expect(p.map((x) => [x.base, x.altura])).toEqual([
      [0, 10_000],
      [7_000, 3_000],
      [5_000, 2_000],
      [0, 5_000],
    ]);
    expect(p.map((x) => x.tipo)).toEqual(["total", "custo", "custo", "total"]);
  });
  it("margem negativa vira barra para baixo do zero, sem esconder o custo", () => {
    const p = passosDaCascata({
      receitaCentavos: 1_000,
      custoFrotaCentavos: 2_000,
      custoServicoCentavos: 0,
      margemCentavos: -1_000,
    });
    expect(p[3]).toMatchObject({ rotulo: "Margem", valor: -1_000 });
    expect(chaveDaCascata(p)).toBe("1000|-2000|0|-1000");
  });
});
