import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Os testes de tela e as capturas rodam como a TranSul usa: português do Brasil e o fuso de São
// Paulo (no CI o navegador vinha em inglês: "November 2026" no campo do período). Fatia 3.9a.

describe.each(["playwright.config.ts", "playwright.banco.config.ts"])("%s", (arquivo) => {
  const texto = readFileSync(arquivo, "utf8");
  it("o navegador em pt-BR e no fuso de São Paulo, para todos os projetos", () => {
    expect(texto).toMatch(/use: \{[^}]*locale: "pt-BR"/);
    expect(texto).toMatch(/use: \{[^}]*timezoneId: "America\/Sao_Paulo"/);
  });
});
