import { describe, expect, it } from "vitest";
import { errosDoResolvedor } from "./erros-do-resolvedor";

// Os erros do Zod no formato do React Hook Form. Índice vira posição de lista: com um objeto de
// chaves "0", "1", o React Hook Form descartava o erro da pendência ao validar no blur do primeiro
// rádio (o "Diga se a pendência foi resolvida." nunca aparecia no Concluir recebimento).

describe("errosDoResolvedor", () => {
  it("caminho de objeto vira objeto aninhado, com a primeira mensagem de cada campo", () => {
    expect(
      errosDoResolvedor([
        { path: ["conjunto", "cavaloId"], message: "Escolha o cavalo." },
        { path: ["conjunto", "cavaloId"], message: "outra" },
      ]),
    ).toEqual({ conjunto: { cavaloId: { type: "validate", message: "Escolha o cavalo." } } });
  });

  it("índice vira posição de lista", () => {
    const erros = errosDoResolvedor([
      { path: ["pendencias", 1, "resolvida"], message: "Diga se a pendência foi resolvida." },
    ]) as unknown as { pendencias: unknown };
    expect(Array.isArray(erros.pendencias)).toBe(true);
    const lista = erros.pendencias as unknown[];
    expect(lista[0]).toBeUndefined();
    expect(lista[1]).toEqual({
      resolvida: { type: "validate", message: "Diga se a pendência foi resolvida." },
    });
  });
});
