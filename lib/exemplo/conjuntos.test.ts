import { describe, expect, it } from "vitest";
import { carroceriaDoModelo, conjuntoMisto } from "@/lib/dominio/conjunto";
import { placasDeExemplo } from "./placas";

describe("os conjuntos de exemplo respeitam a regra: nenhum cavalo tem carrocerias misturadas", () => {
  const placas = placasDeExemplo("2026-10-31");
  const modeloDe = new Map(placas.map((p) => [p.id, p.modelo]));
  it("todo cavalo tem implementos de uma carroceria só", () => {
    const cavalos = placas.filter((p) => p.tipo === "cavalo");
    expect(cavalos.length).toBeGreaterThan(0);
    for (const cavalo of cavalos) {
      const carrocerias = cavalo.conjunto.implementoIds.map((id) =>
        carroceriaDoModelo(modeloDe.get(id) ?? ""),
      );
      expect(conjuntoMisto(carrocerias), cavalo.placa).toBe(false);
    }
  });
  it("ainda há conjuntos montados no exemplo", () => {
    expect(placas.some((p) => p.tipo === "cavalo" && p.conjunto.implementoIds.length > 0)).toBe(
      true,
    );
  });
});
