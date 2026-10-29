import { describe, expect, it } from "vitest";
import { CATALOGO, todasAsTelas } from "@/lib/navegacao/catalogo";
import { iconeDe } from "./icones";

describe("iconeDe", () => {
  const nomes = [
    ...new Set([...CATALOGO.map((m) => m.icone), ...todasAsTelas().map((t) => t.icone)]),
  ];

  it.each(nomes)("%s resolve para um componente do Tabler", (nome) => {
    const Icone = iconeDe(nome);
    // Componentes do Tabler são funções ou objetos de forwardRef.
    expect(["function", "object"]).toContain(typeof Icone);
    expect(Icone).toBeTruthy();
  });
  it("nome que não existe no mapa dá erro claro, e não uma tela quebrada", () => {
    expect(() => iconeDe("IconQueNaoExiste")).toThrow(/IconQueNaoExiste/);
  });
});
