import { describe, expect, it } from "vitest";
import { decidirFicha } from "./proxy-da-ficha";

describe("decidirFicha: a placa mal escrita nunca chega à rota da ficha (404 de verdade, antes de renderizar)", () => {
  it.each(["/frota/placas/AAA0A00", "/frota/placas/ABC1234", "/frota/placas/BRA2E19"])(
    "deixa seguir a placa bem escrita %s",
    (caminho) => {
      expect(decidirFicha(caminho)).toBe("seguir");
    },
  );

  it.each([
    ["minúscula", "/frota/placas/aaa0a00"],
    ["com hífen", "/frota/placas/aaa-0a00"],
    ["curta", "/frota/placas/AAA0A0"],
    ["longa", "/frota/placas/AAA0A000"],
    ["com espaço", "/frota/placas/AAA%200A00"],
    ["HTML", "/frota/placas/%3Cscript%3E"],
    ["byte nulo", "/frota/placas/AAA0A0%00"],
    ["escape quebrado", "/frota/placas/%E0%A4%A"],
    ["só letras", "/frota/placas/AAAAAAA"],
    ["enorme", `/frota/placas/${"A".repeat(500)}`],
    ["ponto-ponto", "/frota/placas/.."],
  ])("barra a placa mal escrita: %s", (_nome, caminho) => {
    expect(decidirFicha(caminho)).toBe("nao-encontrada");
  });

  it("a barra final é ignorada, como no roteador", () => {
    expect(decidirFicha("/frota/placas/AAA0A00/")).toBe("seguir");
    expect(decidirFicha("/frota/placas/aaa0a00/")).toBe("nao-encontrada");
  });

  it("não mexe no que não é a ficha: a lista, outras telas e rotas mais fundas", () => {
    for (const caminho of [
      "/frota/placas",
      "/frota/placas/",
      "/frota/acompanhamento/aaa",
      "/inicio",
      "/",
      "/frota/placas/AAA0A00/extra",
      "/frota/placas/aaa/extra",
    ]) {
      expect(decidirFicha(caminho), caminho).toBe("seguir");
    }
  });
});
