import { describe, expect, it } from "vitest";
import { formatarMoeda } from "@/components/formato/moeda-valor";
import { textoDoValor } from "@/components/formato/texto";
import { TETO_DE_LINHAS, todasAsPaginas } from "./exportadores";

describe("exportadores do CSV", () => {
  it("lê todas as páginas até acabar", async () => {
    const pedidos: number[] = [];
    const r = await todasAsPaginas(async (pagina) => {
      pedidos.push(pagina);
      return { linhas: [pagina * 10, pagina * 10 + 1], paginas: 3 };
    });
    expect(pedidos).toEqual([1, 2, 3]);
    expect(r).toEqual({ linhas: [10, 11, 20, 21, 30, 31], cortada: false });
  });

  it("para no teto e avisa que cortou", async () => {
    const r = await todasAsPaginas(async (_pagina, tam) => ({
      linhas: Array.from({ length: tam }, (_, i) => i),
      paginas: 1_000_000,
    }));
    expect(r.linhas).toHaveLength(TETO_DE_LINHAS);
    expect(r.cortada).toBe(true);
  });

  it("o texto de cada formato sai pelos formatadores do Eixo; vazio é célula vazia", () => {
    expect(textoDoValor(128430000, "moeda")).toBe(formatarMoeda(128430000));
    expect(textoDoValor("2026-11-13", "data")).toBe("13/11/2026");
    expect(textoDoValor(null, "moeda")).toBeNull();
    expect(textoDoValor("ZDM1A23", "placa")).toBe("ZDM1A23");
  });
});
