import { describe, expect, it } from "vitest";
import { carroceriaDoModelo, conjuntoMisto } from "./conjunto";

describe("carroceriaDoModelo: a carroceria vem do nome do modelo (provisório, até a tabela de nomenclatura)", () => {
  it("tira a configuração de eixos", () => {
    expect(carroceriaDoModelo("Sider 3 eixos")).toBe("Sider");
    expect(carroceriaDoModelo("Graneleiro 3 eixos")).toBe("Graneleiro");
    expect(carroceriaDoModelo("Prancha 4 eixos")).toBe("Prancha");
  });
  it("modelo sem número fica inteiro, sem diferença de caixa ou espaço", () => {
    expect(carroceriaDoModelo("  Baú frigorífico ")).toBe("Baú frigorífico");
    expect(carroceriaDoModelo("sider 2 eixos")).toBe("Sider");
  });
});

describe("conjuntoMisto: conjunto misto de carrocerias é bloqueado", () => {
  it("sem implementos ou com um só, não é misto", () => {
    expect(conjuntoMisto([])).toBe(false);
    expect(conjuntoMisto(["Sider"])).toBe(false);
  });
  it("a mesma carroceria em configurações diferentes não é mista", () => {
    expect(conjuntoMisto(["Sider", "Sider"])).toBe(false);
  });
  it("duas carrocerias diferentes é misto", () => {
    expect(conjuntoMisto(["Sider", "Graneleiro"])).toBe(true);
    expect(conjuntoMisto(["Sider", "Sider", "Prancha"])).toBe(true);
  });
});
