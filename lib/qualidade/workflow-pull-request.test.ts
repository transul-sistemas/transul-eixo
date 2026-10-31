import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// O workflow do pull request pula o e2e (e o que só ele usa) quando só `docs/` muda, sem nunca
// pular lint, tipos e testes unitários, e sem mudar o nome dos jobs que o ruleset exige.

const texto = readFileSync(".github/workflows/pull-request.yml", "utf-8");

/** O texto do job `app`, até o próximo job (`banco`). */
const job = (nome: string) => {
  const inicio = texto.indexOf(`\n  ${nome}:\n`);
  const resto = texto.slice(inicio + 1);
  const proximo = resto.slice(1).search(/\n  [a-z]+:\n/);
  return proximo === -1 ? resto : resto.slice(0, proximo + 1);
};
/** Os passos do job, cada um com o texto da sua entrada (`- ...`). */
const passos = (nome: string) =>
  job(nome)
    .split(/\n      - /)
    .slice(1);
const passoCom = (nome: string, trecho: string) =>
  passos(nome).find((p) => p.includes(trecho)) ?? "";

describe("workflow do pull request: pular o e2e quando só docs/ muda", () => {
  it("os dois jobs que o ruleset exige continuam com o nome app e banco", () => {
    expect(texto).toMatch(/\n  app:\n/);
    expect(texto).toMatch(/\n  banco:\n/);
    expect(job("app")).not.toMatch(/\n    name:/);
  });

  it("o job app decide, por um passo, se só docs/ mudou, olhando o pull request contra a base", () => {
    const passo = passoCom("app", "id: mudancas");
    expect(passo).toContain("git diff --name-only");
    expect(passo).toMatch(/\^docs\//);
    expect(passo).toContain("so_docs");
  });

  it("sem arquivos mudados, ou sem como saber, o e2e roda (só docs/ exige ter arquivos e todos em docs/)", () => {
    const passo = passoCom("app", "id: mudancas");
    expect(passo).toMatch(/-n "\$arquivos"/);
    expect(passo).toContain("so_docs=false");
  });

  it("o checkout traz o commit anterior, para o git diff do merge do pull request funcionar", () => {
    expect(passoCom("app", "actions/checkout")).toMatch(/fetch-depth:\s*2/);
  });

  it("lint, tipos e testes unitários nunca são pulados", () => {
    for (const comando of ["pnpm lint", "pnpm typecheck", "pnpm test\n", "pnpm install"]) {
      const passo = passoCom("app", `run: ${comando.trim()}`);
      expect(passo, comando).not.toBe("");
      expect(passo, comando).not.toMatch(/\bif:/);
    }
  });

  it("build, navegador do Playwright e e2e só rodam quando não é só docs/", () => {
    for (const trecho of [
      "run: pnpm build",
      "id: playwright",
      "actions/cache@",
      "playwright install",
      "run: pnpm test:e2e",
    ]) {
      const passo = passoCom("app", trecho);
      expect(passo, trecho).not.toBe("");
      expect(passo, trecho).toMatch(/if: steps\.mudancas\.outputs\.so_docs != 'true'/);
    }
  });

  it("quando pula, avisa no resumo da execução", () => {
    expect(passoCom("app", "so_docs == 'true'")).toContain("GITHUB_STEP_SUMMARY");
  });

  it("o prazo de 45 minutos continua e não usa workers: 2", () => {
    expect(job("app")).toContain("timeout-minutes: 45");
    expect(texto).not.toMatch(/workers[:=]\s*2/);
  });

  it("o job banco não muda: sempre roda", () => {
    expect(job("banco")).not.toContain("so_docs");
  });
});
