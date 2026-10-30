import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listarArquivos, lerTexto } from "./armadilhas";

// EIXO_DADOS=exemplo liga os dados fictícios de lib/exemplo/. Só pode existir onde foi liberada
// (desenvolvimento, testes) e nunca na Vercel, em produção ou em arquivo com segredo.

const LIBERADOS = [
  ".env.development",
  ".env.example",
  "playwright.config.ts",
  "lib/qualidade/eixo-dados.test.ts",
  "docs/decisoes.md",
  "docs/superpowers/plans/2026-10-29-fase-2c-1-lista-de-placas.md",
  "docs/superpowers/plans/2026-10-30-fase-2c-2-painel-de-espiar.md",
];
const SEM_VARREDURA =
  /^(node_modules|\.next|\.git|test-results|playwright-report|supabase\/\.temp)/;

describe(".env.development", () => {
  it("existe, está no Git e só liga os dados de exemplo", () => {
    expect(existsSync(".env.development")).toBe(true);
    const linhas = readFileSync(".env.development", "utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#"));
    expect(linhas).toEqual(["EIXO_DADOS=exemplo"]);
  });
  it("não está no .gitignore", () => {
    const ignorados = readFileSync(".gitignore", "utf-8").split("\n");
    expect(ignorados).not.toContain(".env.development");
    expect(ignorados).not.toContain(".env*");
  });
});

describe("EIXO_DADOS nunca vai para a Vercel nem para produção", () => {
  const candidatos = [
    ".env",
    ".env.production",
    ".env.local",
    "vercel.json",
    "vercel.ts",
    ".vercel/project.json",
  ];
  it("não aparece nos arquivos de configuração da Vercel nem em .env.production", () => {
    const achados = candidatos.filter(
      (c) => existsSync(c) && lerTexto(c).includes("EIXO_DADOS") && c !== ".env.local",
    );
    expect(achados).toEqual([]);
  });
  it("não aparece em nenhum workflow de deploy", () => {
    const workflows = listarArquivos(".github/workflows", /\.ya?ml$/).filter((c) =>
      /deploy|vercel|release|producao/i.test(c),
    );
    expect(workflows.filter((c) => lerTexto(c).includes("EIXO_DADOS"))).toEqual([]);
  });
  it("só aparece nos arquivos liberados e no código da fonte de exemplo", () => {
    const pastas = ["app", "components", "lib", "e2e", "supabase", "docs", ".github"];
    const arquivos = [
      ...pastas.flatMap((p) => listarArquivos(p, /\.(ts|tsx|md|sql|ya?ml|mjs)$/)),
      "playwright.config.ts",
      ".env.example",
    ].filter((c) => existsSync(c) && !SEM_VARREDURA.test(c));
    const usam = arquivos.filter((c) => lerTexto(c).includes("EIXO_DADOS"));
    const fora = usam.filter(
      (c) =>
        !LIBERADOS.includes(c) &&
        !/^lib\/dados\/(fonte-de-exemplo|fonte)(\.test)?\.tsx?$/.test(c) &&
        !/\.test\.tsx?$/.test(c) &&
        !c.startsWith(".github/workflows/pull-request.yml"),
    );
    expect(fora).toEqual([]);
  });
  it("o servidor de testes liga o exemplo de forma explícita", () => {
    expect(lerTexto("playwright.config.ts")).toContain('EIXO_DADOS: "exemplo"');
  });
  it(".env.example avisa que a Vercel nunca define a variável", () => {
    const texto = lerTexto(".env.example");
    expect(texto).toContain("EIXO_DADOS");
    expect(texto.toLowerCase()).toContain("nunca");
    expect(texto.toLowerCase()).toContain("vercel");
  });
});
