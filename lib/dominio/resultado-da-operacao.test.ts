import { describe, expect, it } from "vitest";
import {
  chaveDaCascata,
  passosDaCascata,
  semLancamentos,
  tokenDoPasso,
} from "./resultado-da-operacao";

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

describe("passosDaCascata com a receita em duas barras (CT-e e NFS-e)", () => {
  const entrada = {
    receitaCentavos: 10_000,
    receitaCteCentavos: 7_500,
    receitaNfseCentavos: 2_500,
    custoFrotaCentavos: 3_000,
    custoServicoCentavos: 2_000,
    margemCentavos: 5_000,
  };
  it("duas barras de receita empilhadas: a NFS-e começa onde o CT-e termina", () => {
    const p = passosDaCascata(entrada);
    expect(p.map((x) => x.rotulo)).toEqual([
      "Receita de CT-e",
      "Receita de NFS-e",
      "Custo da frota",
      "Custo de serviço e pessoal",
      "Margem",
    ]);
    expect(p[0]).toMatchObject({ base: 0, altura: 7_500, valor: 7_500 });
    expect(p[1]).toMatchObject({ base: 7_500, altura: 2_500, valor: 2_500 });
  });
  it("o total das duas barras é a receita total, e os custos descem a partir dela", () => {
    const p = passosDaCascata(entrada);
    expect(p[0]!.altura + p[1]!.altura).toBe(entrada.receitaCentavos);
    expect(p[2]).toMatchObject({ base: 7_000, altura: 3_000 });
    expect(p[3]).toMatchObject({ base: 5_000, altura: 2_000 });
    expect(p[4]).toMatchObject({ valor: 5_000 });
  });
  it("se as duas linhas não fecham com o total, volta à barra única (nunca mostra número que não bate)", () => {
    const p = passosDaCascata({ ...entrada, receitaNfseCentavos: 1 });
    expect(p[0]!.rotulo).toBe("Receita");
  });
  it("sem NFS-e a barra de NFS-e fica com altura zero, e o rótulo continua presente", () => {
    const p = passosDaCascata({
      ...entrada,
      receitaCteCentavos: 10_000,
      receitaNfseCentavos: 0,
    });
    expect(p[1]).toMatchObject({ rotulo: "Receita de NFS-e", altura: 0, valor: 0 });
  });
  it("cada tipo de barra tem um token de cor (CT-e do módulo, NFS-e de ação, custo negativo)", () => {
    expect(tokenDoPasso("receita_cte")).toBe("operacoes");
    expect(tokenDoPasso("receita_nfse")).toBe("acao");
    expect(tokenDoPasso("custo")).toBe("negativo");
    expect(tokenDoPasso("total")).toBe("operacoes");
  });
  it("a chave muda quando uma das duas linhas muda", () => {
    expect(chaveDaCascata(passosDaCascata(entrada))).not.toBe(
      chaveDaCascata(
        passosDaCascata({ ...entrada, receitaCteCentavos: 7_000, receitaNfseCentavos: 3_000 }),
      ),
    );
  });
});
