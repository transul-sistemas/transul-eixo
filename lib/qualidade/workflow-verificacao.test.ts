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
  const proximo = resto.slice(1).search(/\n  [a-z0-9-]+:\n/);
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

  it("na main cada execução tem o seu grupo: nenhuma espera nem cancela a outra (só o pull request agrupa por ramo)", () => {
    expect(texto).toContain(
      "group: verificacao-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}",
    );
    expect(texto).not.toContain("group: verificacao-${{ github.ref }}");
  });
});

describe("workflow de verificação: quais arquivos mudaram", () => {
  it("o job mudancas é pequeno e entrega pula_e2e como saída para os outros jobs", () => {
    expect(job("mudancas")).toMatch(
      /outputs:\s*\n\s*pula_e2e: \$\{\{ steps\.mudancas\.outputs\.pula_e2e \}\}/,
    );
    expect(job("mudancas")).not.toContain("pnpm install");
    expect(job("mudancas")).not.toContain("supabase start");
  });

  it("o checkout do mudancas traz o histórico inteiro (fetch-depth 0)", () => {
    expect(passoCom("mudancas", "actions/checkout")).toMatch(/fetch-depth:\s*0/);
  });

  it("no push compara github.event.before com github.sha; antes zerado ou ausente roda tudo", () => {
    const passo = passoCom("mudancas", "id: mudancas");
    expect(passo).toContain("github.event.before");
    expect(passo).toContain("github.sha");
    expect(passo).toContain("0000000000000000000000000000000000000000");
    expect(passo).toMatch(/git cat-file -e/);
  });

  it("no pull request compara o merge com a base (HEAD^1)", () => {
    expect(passoCom("mudancas", "id: mudancas")).toContain("git diff --name-only HEAD^1 HEAD");
  });

  it("a decisão de pular vem de um script único, testado abaixo", () => {
    expect(passoCom("mudancas", "id: mudancas")).toContain("scripts/ci/pula-e2e.sh");
  });
});

describe("scripts/ci/pula-e2e.sh: pula só quando tudo é docs/**, supabase/**, importacao/** ou *.md", () => {
  it("commit só de documentação (docs/**, *.md ou importacao/) pode subir direto: o e2e é pulado", () => {
    expect(pulaE2e(["docs/fichas-de-tela/inicio-tarefas.md"])).toBe("true");
    expect(pulaE2e(["CLAUDE.md"])).toBe("true");
    expect(pulaE2e(["importacao/README.md"])).toBe("true");
    expect(pulaE2e(["importacao/datas.csv"])).toBe("true");
    expect(pulaE2e(["docs/decisoes.md", "importacao/README.md", "CLAUDE.md"])).toBe("true");
  });

  it("só docs, só supabase, só .md ou a mistura dos três: pula", () => {
    expect(pulaE2e(["docs/decisoes.md"])).toBe("true");
    expect(pulaE2e(["supabase/migrations/1_x.sql", "supabase/tests/x.test.sql"])).toBe("true");
    expect(pulaE2e(["CLAUDE.md", "README.md"])).toBe("true");
    expect(pulaE2e(["docs/sankhya/mapa.md", "supabase/seed.sql", "CLAUDE.md"])).toBe("true");
  });

  it("qualquer outro arquivo (tela, componente, regra, workflow): roda tudo", () => {
    expect(pulaE2e(["docs/decisoes.md", "app/(sistema)/frota/placas/page.tsx"])).toBe("false");
    expect(pulaE2e(["importacao/README.md", "lib/dominio/composicao.ts"])).toBe("false");
    expect(pulaE2e(["components/tabela/tabela-de-placas.tsx"])).toBe("false");
    expect(pulaE2e(["lib/dominio/composicao.ts"])).toBe("false");
    expect(pulaE2e([".github/workflows/verificacao.yml"])).toBe("false");
    expect(pulaE2e(["docs/planilha.xlsx", "package.json"])).toBe("false");
  });

  it("um nome que só contém docs ou supabase no meio não engana", () => {
    expect(pulaE2e(["lib/docs/x.ts"])).toBe("false");
    expect(pulaE2e(["lib/supabase/cliente.ts"])).toBe("false");
    expect(pulaE2e(["lib/md.ts"])).toBe("false");
    expect(pulaE2e(["lib/importacao/x.ts"])).toBe("false");
    expect(pulaE2e(["app/importacao/page.tsx"])).toBe("false");
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

  it("o app só tem lint, tipos e testes unitários: o build, o navegador e o e2e saíram para o job e2e", () => {
    for (const trecho of [
      "pnpm build",
      "playwright",
      "test:e2e",
      "supabase start",
      "instalar-chromium",
    ]) {
      expect(job("app"), trecho).not.toContain(trecho);
    }
    expect(job("app")).not.toMatch(/\n    needs:/);
    expect(job("app")).not.toContain("pula_e2e");
  });

  it("o job e2e só roda quando não é pulado (condição no job) e tem build, navegador e e2e", () => {
    expect(job("e2e")).toMatch(/\n    needs: mudancas\n/);
    expect(job("e2e")).toMatch(/\n    if: needs\.mudancas\.outputs\.pula_e2e != 'true'\n/);
    for (const trecho of [
      "run: pnpm build",
      "id: playwright",
      "actions/cache@",
      "instalar-chromium.sh",
      "pnpm test:e2e",
      "supabase start",
    ]) {
      const passo = passoCom("e2e", trecho);
      expect(passo, trecho).not.toBe("");
      expect(passo, trecho).not.toMatch(/\bif:/);
    }
  });

  it("quando pula, o mudancas avisa no resumo da execução", () => {
    expect(passoCom("mudancas", "pula_e2e == 'true'")).toContain("GITHUB_STEP_SUMMARY");
  });

  it("os prazos continuam como rede de segurança e nenhum teste usa workers: 2", () => {
    expect(job("app")).toContain("timeout-minutes: 30");
    expect(job("e2e")).toContain("timeout-minutes: 45");
    expect(texto).not.toMatch(/workers[:=]\s*2/);
  });

  it("o job banco roda em todo push e pull request, sem condição (só o envio na falha tem if)", () => {
    expect(job("banco")).not.toContain("pula_e2e");
    const comCondicao = passosDe(texto, "banco").filter((p) => /\bif:/.test(p));
    for (const passo of comCondicao) {
      expect(passo).toContain("actions/upload-artifact@");
      expect(passo).toMatch(/if: failure\(\)/);
    }
  });

  it("quando os tipos do banco divergem, o arquivo gerado sobe como artefato (7 dias)", () => {
    const envio = passoCom("banco", "name: tipos-do-banco");
    expect(envio).toContain("path: lib/dados/tipos-do-banco.ts");
    expect(envio).toContain("retention-days: 7");
    const passos = passosDe(texto, "banco");
    expect(passos.findIndex((p) => p.includes("name: tipos-do-banco"))).toBeGreaterThan(
      passos.findIndex((p) => p.includes("git diff --exit-code")),
    );
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
    for (const trecho of ["run: pnpm build", "instalar-chromium.sh", "run: pnpm test:e2e"]) {
      const passo = passos.find((p) => p.includes(trecho)) ?? "";
      expect(passo, trecho).not.toBe("");
      expect(passo, trecho).toMatch(/if: steps\.recente\.outputs\.roda == 'true'/);
    }
  });
});

// Decisão de 04/11/2026 (máquina sem memória livre): as capturas das telas de acesso saem do CI, só
// no pull request, e chegam como artefato do GitHub (ver docs/decisoes.md).
describe("workflow de verificação: jobs só do pull request (capturas e modo banco)", () => {
  const ehDoPullRequest = (nome: string) =>
    expect(job(nome)).toMatch(/\n    if: github\.event_name == 'pull_request'\n/);

  it("o app não tira mais capturas: elas têm job próprio e paralelo", () => {
    expect(job("app")).not.toContain("capturas");
    expect(job("capturas")).not.toMatch(/\n    needs:/);
    ehDoPullRequest("capturas");
  });

  it("as capturas rodam o pnpm test:capturas com EIXO_CAPTURAS e sobem sempre, por 7 dias", () => {
    const capturas = passoCom("capturas", "run: pnpm test:capturas");
    expect(capturas).toContain('EIXO_CAPTURAS: "1"');
    for (const anterior of ["supabase start", "run: pnpm build", "instalar-chromium.sh"]) {
      expect(passoCom("capturas", anterior), anterior).not.toBe("");
    }
    const envio = passoCom("capturas", "name: capturas-do-acesso");
    expect(envio).toContain("actions/upload-artifact@v4");
    expect(envio).toContain("if: always()");
    expect(envio).toContain("path: capturas/");
    expect(envio).toContain("retention-days: 7");
  });

  it("o modo banco gera os ~200 ativos e roda o e2e do modo banco (sem a carga, que tem job próprio)", () => {
    // Sem pull request (commits direto na main, 05/11/2026), roda também no push da main; não é
    // verificação obrigatória (as obrigatórias continuam app e banco).
    expect(job("modo-banco")).toMatch(
      /\n    if: github\.event_name == 'pull_request' \|\| \(github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'\)\n/,
    );
    const passos = passosDe(texto, "modo-banco");
    const indice = (trecho: string) => passos.findIndex((p) => p.includes(trecho));
    for (const trecho of [
      "run: pnpm db:dev-dados",
      "run: pnpm build",
      "run: pnpm test:e2e-banco",
    ]) {
      expect(indice(trecho), trecho).toBeGreaterThan(-1);
    }
    expect(indice("run: pnpm db:dev-dados")).toBeLessThan(indice("run: pnpm test:e2e-banco"));
    expect(job("modo-banco")).not.toContain("db:carga");
  });

  it("a medição tem job curto e próprio: 201, 1.000 e 5.000 ativos, banco recriado entre eles", () => {
    ehDoPullRequest("medicao");
    expect(job("medicao")).not.toMatch(/\n    needs:/);
    expect(job("medicao")).not.toContain("pnpm build");
    expect(job("medicao")).not.toContain("playwright");
    const passo = passoCom("medicao", "db-diagnostico.ts");
    expect(passo).toContain("for n in 201 1000 5000");
    expect(passo).toContain("supabase db reset");
    expect(passo).toContain("--quantidade");
    // A carga em lote: 2.000 ativos numa transação, com e sem os gatilhos (a regra fica para decisão).
    const carga = passoCom("medicao", "--sem-gatilhos");
    expect(carga).toContain("--quantidade 2000");
    expect(carga).toContain("supabase db reset");
    const envio = passoCom("medicao", "name: diagnostico-da-lista");
    expect(envio).toContain("if: always()");
    expect(envio).toContain("retention-days: 7");
  });

  it("o modo banco roda as mutações do SQL por último (elas recriam o banco)", () => {
    const passos = passosDe(texto, "modo-banco");
    const indice = (trecho: string) => passos.findIndex((p) => p.includes(trecho));
    expect(indice("node scripts/ci/mutacoes-sql.mjs")).toBeGreaterThan(
      indice("run: pnpm test:e2e-banco"),
    );
    expect(passoCom("modo-banco", "node scripts/ci/mutacoes-sql.mjs")).toMatch(
      /if: (\$\{\{ )?(always|!cancelled)\(\)/,
    );
  });

  // A chave mestra fora de workers/ já é barrada para o repositório inteiro (lib/qualidade/armadilhas).
  it("os jobs do pull request nunca falam com projeto na nuvem", () => {
    for (const nome of ["capturas", "modo-banco"]) {
      expect(job(nome)).not.toMatch(/supabase (link|login|db push)/);
    }
  });

  it("o e2e noturno (main) não tira capturas nem roda o modo banco", () => {
    expect(noturno).not.toContain("capturas");
    expect(noturno).not.toContain("e2e-banco");
  });
});

// Falha de rede do runner (11/11/2026): "Temporary failure resolving" no apt derrubou dois jobs antes de
// qualquer teste. A instalação do Chromium passa por um script com nova tentativa, em todos os jobs.
describe("instalação do Chromium com nova tentativa", () => {
  const script = readFileSync("scripts/ci/instalar-chromium.sh", "utf-8");

  it("nenhum job chama o playwright install direto: todos passam pelo script", () => {
    expect(texto).not.toMatch(/run: pnpm exec playwright install/);
    expect(noturno).not.toMatch(/run: pnpm exec playwright install/);
    const chamadas = texto.match(/run: bash scripts\/ci\/instalar-chromium\.sh/g) ?? [];
    expect(chamadas).toHaveLength(3);
  });

  it("o script instala com as dependências, repete com espera crescente e pede ao apt para tentar de novo", () => {
    expect(script).toContain("pnpm exec playwright install --with-deps chromium");
    expect(script).toMatch(/for tentativa in \$\(seq 1 "\$total"\)/);
    expect(script).toContain("sleep");
    expect(script).toContain('Acquire::Retries "5";');
    expect(script).toMatch(/exit 1\s*$/);
  });

  it("o script tem sintaxe de bash válida", () => {
    const r = spawnSync("bash", ["-n", "scripts/ci/instalar-chromium.sh"], { encoding: "utf-8" });
    expect(r.status, r.stderr).toBe(0);
  });
});

// Frente 1 do "arrochar" (11/11/2026): o e2e do job app, que passava de 20 min, virou 4 shards em paralelo.
describe("e2e em shards: quatro partes em paralelo, com os relatórios juntados no fim", () => {
  it("o job e2e é uma matriz de 4 shards, sem fail-fast, e cada shard roda a sua fatia", () => {
    expect(job("e2e")).toMatch(/strategy:\s*\n\s*fail-fast: false/);
    expect(job("e2e")).toMatch(/matrix:\s*\n\s*shard: \[1, 2, 3, 4\]/);
    const execucao = passoCom("e2e", "pnpm test:e2e");
    expect(execucao).toContain("--shard=${{ matrix.shard }}/4");
    expect(execucao).toContain("--reporter=github,blob");
  });

  it("o total de shards da execução é o mesmo número de itens da matriz", () => {
    const itens = /shard: \[([\d, ]+)\]/.exec(job("e2e"))?.[1]?.split(",").length ?? 0;
    const total = Number(/--shard=\$\{\{ matrix\.shard \}\}\/(\d+)/.exec(job("e2e"))?.[1]);
    expect(itens).toBeGreaterThan(1);
    expect(total).toBe(itens);
  });

  it("cada shard sobe o seu relatório em blob (sempre), com nome próprio", () => {
    const envio = passoCom("e2e", "blob-report");
    expect(envio).toContain("actions/upload-artifact@v4");
    expect(envio).toContain("if: always()");
    expect(envio).toContain("name: blob-report-${{ matrix.shard }}");
    expect(envio).toContain("path: blob-report/");
    expect(envio).toContain("retention-days: 7");
  });

  it("o e2e-resultado junta os relatórios, publica o HTML e decide o resultado do e2e", () => {
    expect(job("e2e-resultado")).toMatch(/\n    needs: \[mudancas, e2e\]\n/);
    expect(job("e2e-resultado")).toMatch(/\n    if: always\(\)\n/);
    const baixar = passoCom("e2e-resultado", "actions/download-artifact");
    expect(baixar).toContain("pattern: blob-report-*");
    expect(baixar).toContain("merge-multiple: true");
    expect(passoCom("e2e-resultado", "merge-reports")).toContain("--reporter html");
    expect(passoCom("e2e-resultado", "name: playwright-report")).toContain(
      "path: playwright-report/",
    );
  });

  it("o resultado só passa se o e2e passou, ou se foi pulado por só mudar docs; falhar ou cancelar reprova", () => {
    const decisao = passoCom("e2e-resultado", "exit 1");
    expect(decisao).toContain("needs.mudancas.outputs.pula_e2e");
    expect(decisao).toContain("exit 1");
    expect(decisao).toMatch(/if: always\(\)/);
  });

  it("o e2e-resultado é o último passo do job (a decisão não depende dos passos de relatório)", () => {
    const passos = passosDe(texto, "e2e-resultado");
    expect(passos.at(-1) ?? "").toContain("needs.e2e.result");
  });
});
