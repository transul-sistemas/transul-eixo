import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// O workflow de verificação (decisão de 03/11/2026: push direto na main) roda em pull request e em
// push na main. Pula build, navegador e e2e quando só docs/**, supabase/** e *.md mudam, sem nunca
// pular lint, tipos e testes unitários, e sem mudar o nome dos jobs que o ruleset exige.

const CAMINHO = ".github/workflows/verificacao.yml";
const texto = readFileSync(CAMINHO, "utf-8");
const noturno = readFileSync(".github/workflows/e2e-noturno.yml", "utf-8");

/** O texto de um job, até o próximo job. */
const jobDe = (fonte: string, nome: string) => {
  const inicio = fonte.indexOf(`\n  ${nome}:\n`);
  const resto = fonte.slice(inicio + 1);
  const proximo = resto.slice(1).search(/\n  [a-z]+:\n/);
  return proximo === -1 ? resto : resto.slice(0, proximo + 1);
};
const job = (nome: string) => jobDe(texto, nome);
/** Os passos do job, cada um com o texto da sua entrada (`- ...`). */
const passosDe = (fonte: string, nome: string) =>
  jobDe(fonte, nome)
    .split(/\n      - /)
    .slice(1);
const passoCom = (nome: string, trecho: string) =>
  passosDe(texto, nome).find((p) => p.includes(trecho)) ?? "";

/** Roda o script que decide se o e2e é pulado, com a lista de arquivos mudados. */
const pulaE2e = (arquivos: string[]) =>
  spawnSync("bash", ["scripts/ci/pula-e2e.sh"], {
    input: arquivos.join("\n"),
    encoding: "utf-8",
  }).stdout.trim();

describe("workflow de verificação: gatilhos, nomes e concorrência", () => {
  it("o arquivo antigo do pull request saiu e o novo se chama verificação", () => {
    expect(existsSync(".github/workflows/pull-request.yml")).toBe(false);
    expect(texto).toMatch(/^name: verificação\n/);
  });

  it("roda em pull request e em push na main", () => {
    expect(texto).toMatch(/\n  pull_request:\n    branches: \[main\]\n/);
    expect(texto).toMatch(/\n  push:\n    branches: \[main\]\n/);
  });

  it("os dois jobs que o ruleset exige continuam com o nome app e banco", () => {
    expect(texto).toMatch(/\n  app:\n/);
    expect(texto).toMatch(/\n  banco:\n/);
    expect(job("app")).not.toMatch(/\n    name:/);
    expect(job("banco")).not.toMatch(/\n    name:/);
  });

  it("cancela a execução anterior só em pull request; na main cada push termina a sua", () => {
    expect(texto).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  });
});

describe("workflow de verificação: quais arquivos mudaram", () => {
  it("o checkout traz o histórico inteiro (fetch-depth 0)", () => {
    expect(passoCom("app", "actions/checkout")).toMatch(/fetch-depth:\s*0/);
  });

  it("no push compara github.event.before com github.sha; antes zerado ou ausente roda tudo", () => {
    const passo = passoCom("app", "id: mudancas");
    expect(passo).toContain("github.event.before");
    expect(passo).toContain("github.sha");
    expect(passo).toContain("0000000000000000000000000000000000000000");
    expect(passo).toMatch(/git cat-file -e/);
  });

  it("no pull request compara o merge com a base (HEAD^1)", () => {
    expect(passoCom("app", "id: mudancas")).toContain("git diff --name-only HEAD^1 HEAD");
  });

  it("a decisão de pular vem de um script único, testado abaixo", () => {
    expect(passoCom("app", "id: mudancas")).toContain("scripts/ci/pula-e2e.sh");
  });
});

describe("scripts/ci/pula-e2e.sh: pula só quando tudo é docs/**, supabase/** ou *.md", () => {
  it("só docs, só supabase, só .md ou a mistura dos três: pula", () => {
    expect(pulaE2e(["docs/decisoes.md"])).toBe("true");
    expect(pulaE2e(["supabase/migrations/1_x.sql", "supabase/tests/x.test.sql"])).toBe("true");
    expect(pulaE2e(["CLAUDE.md", "README.md"])).toBe("true");
    expect(pulaE2e(["docs/sankhya/mapa.md", "supabase/seed.sql", "CLAUDE.md"])).toBe("true");
  });

  it("qualquer outro arquivo (tela, componente, regra, workflow): roda tudo", () => {
    expect(pulaE2e(["docs/decisoes.md", "app/(sistema)/frota/placas/page.tsx"])).toBe("false");
    expect(pulaE2e(["components/tabela/tabela-de-placas.tsx"])).toBe("false");
    expect(pulaE2e(["lib/dominio/composicao.ts"])).toBe("false");
    expect(pulaE2e([".github/workflows/verificacao.yml"])).toBe("false");
    expect(pulaE2e(["docs/planilha.xlsx", "package.json"])).toBe("false");
  });

  it("um nome que só contém docs ou supabase no meio não engana", () => {
    expect(pulaE2e(["lib/docs/x.ts"])).toBe("false");
    expect(pulaE2e(["lib/supabase/cliente.ts"])).toBe("false");
    expect(pulaE2e(["lib/md.ts"])).toBe("false");
  });

  it("sem arquivos mudados, ou sem como saber: roda tudo", () => {
    expect(pulaE2e([])).toBe("false");
  });
});

describe("workflow de verificação: o que nunca se pula e o que se pula", () => {
  it("lint, tipos e testes unitários nunca são pulados", () => {
    for (const comando of ["pnpm lint", "pnpm typecheck", "pnpm test\n", "pnpm install"]) {
      const passo = passoCom("app", `run: ${comando.trim()}`);
      expect(passo, comando).not.toBe("");
      expect(passo, comando).not.toMatch(/\bif:/);
    }
  });

  it("build, navegador do Playwright e e2e só rodam quando não é pulado", () => {
    for (const trecho of [
      "run: pnpm build",
      "id: playwright",
      "actions/cache@",
      "playwright install",
      "run: pnpm test:e2e",
    ]) {
      const passo = passoCom("app", trecho);
      expect(passo, trecho).not.toBe("");
      expect(passo, trecho).toMatch(/if: steps\.mudancas\.outputs\.pula_e2e != 'true'/);
    }
  });

  it("quando pula, avisa no resumo da execução", () => {
    expect(passoCom("app", "pula_e2e == 'true'")).toContain("GITHUB_STEP_SUMMARY");
  });

  it("o prazo de 55 minutos (desde a 3.8, com o Supabase local) e não usa workers: 2", () => {
    expect(job("app")).toContain("timeout-minutes: 55");
    expect(texto).not.toMatch(/workers[:=]\s*2/);
  });

  it("o job banco roda em todo push e pull request, sem condição", () => {
    expect(job("banco")).not.toContain("pula_e2e");
    expect(job("banco")).not.toMatch(/\bif:/);
  });
});

describe("workflow de verificação: os tipos do banco ficam em dia", () => {
  it("o job banco regenera os tipos (db:tipos) depois de subir o banco", () => {
    expect(passoCom("banco", "supabase start")).toContain("supabase start");
    expect(passoCom("banco", "db:tipos")).toContain("db:tipos");
  });

  it("e falha se o arquivo de tipos mudar (git diff --exit-code)", () => {
    const passo = passoCom("banco", "git diff --exit-code");
    expect(passo).toContain("git diff --exit-code");
    expect(passo).toContain("lib/dados/tipos-do-banco.ts");
  });
});

describe("e2e noturno: o e2e completo da main, uma vez por noite", () => {
  const passos = passosDe(noturno, "e2e");

  it("roda às 6h UTC e também por disparo manual, nunca por push", () => {
    expect(noturno).toContain('cron: "0 6 * * *"');
    expect(noturno).toMatch(/\n  workflow_dispatch:/);
    expect(noturno).not.toMatch(/\n  push:/);
    expect(noturno).not.toMatch(/\n  pull_request:/);
  });

  it("olha a main e encerra sem erro se não houve commit nas últimas 24 horas", () => {
    expect(passos.find((p) => p.includes("actions/checkout")) ?? "").toMatch(/ref: main/);
    const recente = passos.find((p) => p.includes("id: recente")) ?? "";
    expect(recente).toContain('--since="24 hours ago"');
    expect(recente).toContain("GITHUB_STEP_SUMMARY");
  });

  it("o disparo manual sempre roda", () => {
    const recente = passos.find((p) => p.includes("id: recente")) ?? "";
    expect(recente).toContain("workflow_dispatch");
    expect(recente).toContain("roda=true");
  });

  it("roda o e2e completo só quando houve commit (ou disparo manual)", () => {
    for (const trecho of ["run: pnpm build", "playwright install", "run: pnpm test:e2e"]) {
      const passo = passos.find((p) => p.includes(trecho)) ?? "";
      expect(passo, trecho).not.toBe("");
      expect(passo, trecho).toMatch(/if: steps\.recente\.outputs\.roda == 'true'/);
    }
  });
});

// Decisão de 04/11/2026 (máquina sem memória livre): as capturas das telas de acesso saem do CI, só
// no pull request, e chegam como artefato do GitHub (ver docs/decisoes.md).
describe("workflow de verificação: capturas das telas de acesso no pull request", () => {
  const capturas = passoCom("app", "id: capturas");
  const envio = passoCom("app", "name: capturas-do-acesso");

  it("o passo das capturas roda só no pull request, depois do e2e, mesmo se o e2e falhar", () => {
    expect(capturas).not.toBe("");
    expect(capturas).toContain("github.event_name == 'pull_request'");
    expect(capturas).toContain("!cancelled()");
    expect(capturas).toContain("steps.build.outcome == 'success'");
    expect(capturas).toContain('EIXO_CAPTURAS: "1"');
    expect(capturas).toContain("run: pnpm test:capturas");
    const passos = passosDe(texto, "app");
    const indice = (trecho: string) => passos.findIndex((p) => p.includes(trecho));
    expect(indice("id: capturas")).toBeGreaterThan(indice("run: pnpm test:e2e"));
  });

  it("o build tem id (as capturas dependem dele) e continua só quando o e2e não é pulado", () => {
    const build = passoCom("app", "run: pnpm build");
    expect(build).toContain("id: build");
    expect(build).toMatch(/if: steps\.mudancas\.outputs\.pula_e2e != 'true'/);
  });

  it("as capturas sobem como artefato sempre (no pull request), com retenção de 7 dias", () => {
    expect(envio).toContain("actions/upload-artifact@v4");
    expect(envio).toContain("always()");
    expect(envio).toContain("github.event_name == 'pull_request'");
    expect(envio).toContain("path: capturas/");
    expect(envio).toContain("retention-days: 7");
  });

  it("o e2e noturno (main) não tira capturas", () => {
    expect(noturno).not.toContain("capturas");
  });
});
