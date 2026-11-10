import { describe, expect, it } from "vitest";
import { enderecoDasOrdens, enderecoDoPatio, lerOrdensDaUrl, lerPatioDaUrl } from "./operacional";

describe("estado do Pátio e das Ordens na URL", () => {
  it("lê o filtro e a página", () => {
    expect(lerPatioDaUrl(new URLSearchParams("filtro=fila&pagina=2"))).toEqual({
      filtro: "fila",
      pagina: 2,
    });
    expect(lerOrdensDaUrl(new URLSearchParams("filtro=em_viagem"))).toEqual({
      filtro: "em_viagem",
      pagina: 1,
    });
  });
  it("valor desconhecido volta ao padrão", () => {
    expect(lerPatioDaUrl(new URLSearchParams("filtro=xyz&pagina=-3"))).toEqual({
      filtro: "todas",
      pagina: 1,
    });
  });
  it("o endereço leva só o que difere do padrão (ida e volta)", () => {
    expect(enderecoDoPatio({ filtro: "todas", pagina: 1 })).toBe("/operacional/patio");
    const url = enderecoDasOrdens({ filtro: "carregada", pagina: 3 });
    expect(url).toBe("/operacional/ordens-de-carregamento?filtro=carregada&pagina=3");
    expect(lerOrdensDaUrl(new URLSearchParams(url.split("?")[1]))).toEqual({
      filtro: "carregada",
      pagina: 3,
    });
  });
});
