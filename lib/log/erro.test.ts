import { describe, expect, it } from "vitest";
import { ErroDoEixo, textoDoErro } from "./erro.ts";

// O que o log mostra de um erro: o código (SQLSTATE ou do PostgREST) e o nome; a mensagem só quando o
// texto é nosso (ErroDoEixo). Nunca message, details nem hint do banco. Placas fictícias.

describe("textoDoErro", () => {
  it("erro do banco: só o código, nunca a mensagem, os detalhes nem a dica", () => {
    const doBanco = {
      code: "23505",
      message: "duplicate key value violates unique constraint (placa)=(AAA0A00)",
      details: "Key (placa)=(AAA0A00) already exists.",
      hint: "dica com dado",
    };
    expect(textoDoErro(doBanco)).toBe("código 23505");
    const comNome = Object.assign(new Error("valor cru AAA0A00"), { code: "P0001" });
    expect(textoDoErro(comNome)).toBe("Error, código P0001");
    expect(textoDoErro({ code: "PGRST116", message: "x" })).toBe("código PGRST116");
    expect(textoDoErro({ code: "weak_password", message: "x" })).toBe("código weak_password");
  });

  it("erro sem código: só o nome", () => {
    expect(textoDoErro(new TypeError("fetch failed para AAA0A00"))).toBe("TypeError");
    expect(textoDoErro("texto solto AAA0A00")).toBe("erro sem detalhe");
    expect(textoDoErro(null)).toBe("erro sem detalhe");
  });

  it("texto nosso (ErroDoEixo e as classes que o estendem) sai inteiro", () => {
    class ErroDoScript extends ErroDoEixo {}
    expect(textoDoErro(new ErroDoEixo("Recusado: só no Supabase local."))).toBe(
      "Recusado: só no Supabase local.",
    );
    expect(textoDoErro(new ErroDoScript("Uso: pnpm x"))).toBe("Uso: pnpm x");
  });

  it("código fora do formato não entra (nada de texto livre no lugar do código)", () => {
    expect(textoDoErro({ code: "placa AAA0A00 duplicada" })).toBe("erro sem detalhe");
  });
});
