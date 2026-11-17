import { describe, expect, it } from "vitest";
import { enderecoDoPainel, lerEstadoDoPainel } from "./painel";

describe("estado das telas de painel na URL", () => {
  it("lê mês, filtro, busca, página e tamanho; o desconhecido volta ao padrão", () => {
    expect(
      lerEstadoDoPainel(
        new URLSearchParams("mes=2026-10&filtro=aberto&busca= demo &pagina=3&tam=50"),
      ),
    ).toEqual({ mes: "2026-10", filtro: "aberto", busca: "demo", pagina: 3, tam: 50 });
    expect(
      lerEstadoDoPainel(new URLSearchParams("mes=2026-13&filtro=<x>&pagina=-1&tam=7"), 100),
    ).toEqual({ mes: null, filtro: null, busca: "", pagina: 1, tam: 100 });
  });

  it("o endereço leva só o que difere do padrão, e ida e volta dão a mesma visão", () => {
    expect(enderecoDoPainel("/r", { mes: null, filtro: null, busca: "", pagina: 1, tam: 20 })).toBe(
      "/r",
    );
    const estado = { mes: "2026-09", filtro: "fechado", busca: "ab", pagina: 2, tam: 50 };
    const url = enderecoDoPainel("/r", estado);
    expect(lerEstadoDoPainel(new URLSearchParams(url.split("?")[1]))).toEqual(estado);
  });
});
