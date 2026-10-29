import { afterEach, describe, expect, it, vi } from "vitest";
import { lerTexto } from "./armadilhas";

// O indicador "N" do Next, em desenvolvimento, cobre botões dos testes de tela (no celular ele
// cai sobre o botão Contexto). Some só quando o servidor sobe pelos testes do Playwright
// (EIXO_TESTES=1); o `pnpm dev` normal continua igual.

async function configuracao() {
  vi.resetModules();
  return (await import("../../next.config")).default;
}

afterEach(() => vi.unstubAllEnvs());

describe("indicador do Next em desenvolvimento", () => {
  it("no pnpm dev normal fica no canto inferior direito, como sempre", async () => {
    vi.stubEnv("EIXO_TESTES", "");
    expect((await configuracao()).devIndicators).toEqual({ position: "bottom-right" });
  });
  it("sem a variável definida, o comportamento é o mesmo", async () => {
    delete process.env.EIXO_TESTES;
    expect((await configuracao()).devIndicators).toEqual({ position: "bottom-right" });
  });
  it.each(["0", "false", "sim", "2"])("só o valor 1 desliga (%s não)", async (valor) => {
    vi.stubEnv("EIXO_TESTES", valor);
    expect((await configuracao()).devIndicators).toEqual({ position: "bottom-right" });
  });
  it("com EIXO_TESTES=1 o indicador some", async () => {
    vi.stubEnv("EIXO_TESTES", "1");
    expect((await configuracao()).devIndicators).toBe(false);
  });
  it("o servidor dos testes do Playwright define EIXO_TESTES=1", () => {
    expect(lerTexto("playwright.config.ts")).toMatch(/EIXO_TESTES:\s*"1"/);
  });
  it("EIXO_TESTES não aparece em arquivo de produção nem de Vercel", () => {
    for (const arquivo of [".env.development", ".env.example"]) {
      expect(lerTexto(arquivo), arquivo).not.toContain("EIXO_TESTES");
    }
  });
});
