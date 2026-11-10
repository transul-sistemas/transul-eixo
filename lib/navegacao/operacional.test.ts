import { describe, expect, it } from "vitest";
import { enderecoDasOrdens, enderecoDoPatio, lerOrdensDaUrl, lerPatioDaUrl } from "./operacional";

describe("estado do Pátio e das Ordens na URL", () => {
  it("lê o filtro, a página e o tamanho (20 por padrão)", () => {
    expect(lerPatioDaUrl(new URLSearchParams("filtro=fila&pagina=2"))).toEqual({
      filtro: "fila",
      pagina: 2,
      tam: 20,
    });
    expect(lerOrdensDaUrl(new URLSearchParams("filtro=em_viagem"))).toEqual({
      filtro: "em_viagem",
      pagina: 1,
      tam: 20,
    });
  });
  it("valor desconhecido volta ao padrão", () => {
    expect(lerPatioDaUrl(new URLSearchParams("filtro=xyz&pagina=-3&tam=7"))).toEqual({
      filtro: "todas",
      pagina: 1,
      tam: 20,
    });
  });
  it("o tamanho lembrado vale sem tam na URL; o da URL vale se for 20, 50 ou 100", () => {
    expect(lerPatioDaUrl(new URLSearchParams(""), 50).tam).toBe(50);
    expect(lerPatioDaUrl(new URLSearchParams("tam=100"), 50).tam).toBe(100);
    expect(lerOrdensDaUrl(new URLSearchParams("tam=33"), 50).tam).toBe(50);
  });
  it("o endereço leva só o que difere do padrão (ida e volta)", () => {
    expect(enderecoDoPatio({ filtro: "todas", pagina: 1, tam: 20 })).toBe("/operacional/patio");
    const url = enderecoDasOrdens({ filtro: "carregada", pagina: 3, tam: 20 });
    expect(url).toBe("/operacional/ordens-de-carregamento?filtro=carregada&pagina=3");
    expect(lerOrdensDaUrl(new URLSearchParams(url.split("?")[1]))).toEqual({
      filtro: "carregada",
      pagina: 3,
      tam: 20,
    });
  });
  it("o tamanho diferente de 20 vai para a URL", () => {
    expect(enderecoDoPatio({ filtro: "fila", pagina: 1, tam: 50 })).toBe(
      "/operacional/patio?filtro=fila&tam=50",
    );
  });
});
