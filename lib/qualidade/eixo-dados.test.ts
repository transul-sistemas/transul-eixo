import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listarArquivos, lerTexto } from "./armadilhas";
import { liberadoParaEixoDados } from "./eixo-dados";

// EIXO_DADOS=exemplo liga os dados fictícios de lib/exemplo/. Só pode existir onde foi liberada
// (desenvolvimento, testes) e nunca na Vercel, em produção ou em arquivo com segredo.

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
    const fora = usam.filter((c) => !liberadoParaEixoDados(c));
    expect(fora).toEqual([]);
  });
  it("o roteiro de abrir o Eixo no computador (3.9a) pode citar a variável", () => {
    expect(liberadoParaEixoDados("docs/como-abrir-o-eixo.md")).toBe(true);
    expect(liberadoParaEixoDados("docs/outro-roteiro.md")).toBe(false);
  });
  it("o e2e do modo banco (3.9a) liga o banco de forma explícita, e só ele", () => {
    expect(liberadoParaEixoDados("playwright.banco.config.ts")).toBe(true);
    expect(lerTexto("playwright.banco.config.ts")).toContain('EIXO_DADOS: "banco"');
    expect(lerTexto("playwright.banco.config.ts")).not.toContain('EIXO_DADOS: "exemplo"');
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

describe("quem pode citar EIXO_DADOS (a regra, sem olhar o repositório)", () => {
  it("qualquer arquivo de docs/superpowers/plans/ é liberado por padrão, inclusive um plano que ainda não existe", () => {
    expect(liberadoParaEixoDados("docs/superpowers/plans/2027-01-15-fase-9-um-plano-novo.md")).toBe(
      true,
    );
    expect(
      liberadoParaEixoDados("docs/superpowers/plans/2026-10-31-fase-3-nucleo-de-dados.md"),
    ).toBe(true);
    expect(liberadoParaEixoDados("docs/superpowers/plans/rascunhos/ideia.md")).toBe(true);
  });

  it("o mesmo texto em outro lugar de docs/ continua barrado", () => {
    for (const caminho of [
      "docs/glossario.md",
      "docs/projeto-tecnico.md",
      "docs/superpowers/specs/2026-11-01-um-desenho.md",
      "docs/sankhya/mapa.md",
      "docs/superpowers/plansx/falso.md",
    ]) {
      expect(liberadoParaEixoDados(caminho), caminho).toBe(false);
    }
  });

  it("o mesmo texto em arquivo de código ou configuração continua barrado", () => {
    for (const caminho of [
      "app/(sistema)/frota/placas/pagina-de-placas.tsx",
      "components/wizard/assistente.tsx",
      "lib/dominio/status.ts",
      "lib/dados/placas.ts",
      "supabase/seed.sql",
      "scripts/db-tipos.mjs",
      "vercel.json",
      ".env.production",
    ]) {
      expect(liberadoParaEixoDados(caminho), caminho).toBe(false);
    }
  });

  it("não deixa escapar por um caminho que sobe de pasta", () => {
    expect(liberadoParaEixoDados("docs/superpowers/plans/../../glossario.md")).toBe(false);
    expect(liberadoParaEixoDados("docs/superpowers/plans/../../../app/x.ts")).toBe(false);
  });

  it("a lista fixa continua valendo para o resto do repositório", () => {
    for (const caminho of [
      ".env.development",
      ".env.example",
      "playwright.config.ts",
      "docs/decisoes.md",
    ]) {
      expect(liberadoParaEixoDados(caminho), caminho).toBe(true);
    }
    expect(liberadoParaEixoDados("lib/dados/fonte-de-exemplo.ts")).toBe(true);
    expect(liberadoParaEixoDados("lib/dados/fonte.test.ts")).toBe(true);
    expect(liberadoParaEixoDados("e2e/ficha.spec.ts")).toBe(false);
  });
});
