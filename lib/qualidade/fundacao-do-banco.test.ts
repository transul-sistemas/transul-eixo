import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A fundação do banco (Fase 3, fatia 3.0): o que é verificável sem subir o banco. O resto (as regras
// em si) é provado pelo pgTAP em `supabase/tests/`.

const lerArquivo = (caminho: string) => readFileSync(caminho, "utf-8");

const NOVE_SCHEMAS = [
  "nucleo",
  "operacional",
  "pessoas",
  "rh_clinico",
  "parceiros",
  "financeiro",
  "sync",
  "config",
  "auditoria",
];

/** O que o app enxerga pela Data API: só estes, e só com concessão explícita por tabela. */
const EXPOSTOS = ["public", "graphql_public", "nucleo", "config"];
const NUNCA_EXPOSTOS = NOVE_SCHEMAS.filter((s) => !EXPOSTOS.includes(s));

function schemasDaApi(toml: string): string[] {
  const api = /\[api\][\s\S]*?(?=\n\[)/.exec(toml)?.[0] ?? "";
  const linha = /^schemas\s*=\s*\[([^\]]*)\]/m.exec(api)?.[1] ?? "";
  return [...linha.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);
}

describe("config.toml: o que a Data API expõe", () => {
  const exposicao = schemasDaApi(lerArquivo("supabase/config.toml"));

  it("expõe só public, graphql_public, nucleo e config", () => {
    expect([...exposicao].sort()).toEqual([...EXPOSTOS].sort());
  });
  it("nunca expõe auditoria, sync, financeiro, rh_clinico, pessoas, parceiros nem operacional", () => {
    for (const schema of NUNCA_EXPOSTOS) expect(exposicao).not.toContain(schema);
  });
  it("o seed de produção é um arquivo só, e o dado de exemplo mora fora dele", () => {
    const toml = lerArquivo("supabase/config.toml");
    expect(toml).toMatch(/sql_paths\s*=\s*\["\.\/seed\.sql"\]/);
    expect(existsSync("supabase/seed.sql")).toBe(true);
    expect(lerArquivo("supabase/exemplo/LEIA-ME.md")).toMatch(/fora do seed/i);
  });
});

describe(".env.example: só nomes, nunca valores", () => {
  it("toda variável declarada está vazia", () => {
    const linhas = lerArquivo(".env.example")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#"));
    expect(linhas.length).toBeGreaterThan(0);
    for (const linha of linhas) expect(linha).toMatch(/^[A-Z][A-Z0-9_]*=$/);
  });
});

describe("tipos do banco gerados", () => {
  it("o arquivo existe e avisa que é gerado", () => {
    expect(existsSync("lib/dados/tipos-do-banco.ts")).toBe(true);
    expect(lerArquivo("lib/dados/tipos-do-banco.ts")).toMatch(/Arquivo gerado/);
  });
  it("o arquivo é sempre LF: o .gitattributes fixa e o conteúdo não tem CR", () => {
    expect(lerArquivo(".gitattributes")).toMatch(
      /^lib\/dados\/tipos-do-banco\.ts\s+text\s+eol=lf/m,
    );
    expect(lerArquivo("lib/dados/tipos-do-banco.ts")).not.toContain("\r");
  });
  it("o script grava o arquivo já normalizado para LF (a conferência do CI compara o mesmo texto)", () => {
    const script = lerArquivo("scripts/db-tipos.mjs");
    expect(script).toMatch(/replace\(\/\\r\\n\/g, "\\n"\)/);
    expect(script).toContain("writeFileSync");
  });
  it("o script db:tipos existe no package.json", () => {
    const pacote = JSON.parse(lerArquivo("package.json")) as { scripts: Record<string, string> };
    expect(pacote.scripts["db:tipos"]).toBeTruthy();
  });
});

describe("migrations da fundação", () => {
  const arquivos = readdirSync("supabase/migrations").filter((n) => n.endsWith(".sql"));
  const texto = arquivos.map((n) => lerArquivo(`supabase/migrations/${n}`)).join("\n");

  it("existe a migration do alicerce e a das chaves de pessoa e ativo", () => {
    expect(arquivos.some((n) => n.includes("alicerce_do_banco"))).toBe(true);
    expect(arquivos.some((n) => n.includes("chaves_de_pessoa_e_ativo"))).toBe(true);
  });

  it("toda função criada nos schemas da aplicação tira o acesso público dela", () => {
    const criadas = [
      ...texto.matchAll(
        /create\s+(?:or\s+replace\s+)?function\s+((?:nucleo|config|auditoria)\.\w+)/gi,
      ),
    ].map((m) => (m[1] as string).toLowerCase());
    expect(criadas.length).toBeGreaterThan(0);
    const semRevoke = criadas.filter(
      (nome) =>
        !new RegExp(
          `revoke\\s+(?:all|execute)\\s+on\\s+function\\s+${nome.replace(".", "\\.")}\\b`,
          "i",
        ).test(texto),
    );
    expect(semRevoke).toEqual([]);
  });

  it("toda tabela criada nos schemas da aplicação liga a RLS", () => {
    const criadas = [
      ...texto.matchAll(
        /create\s+table\s+(?:if\s+not\s+exists\s+)?((?:nucleo|config|auditoria)\.\w+)/gi,
      ),
    ].map((m) => (m[1] as string).toLowerCase());
    expect(criadas.length).toBeGreaterThan(0);
    const semRls = criadas.filter(
      (nome) =>
        !new RegExp(
          `alter\\s+table\\s+${nome.replace(".", "\\.")}\\s+enable\\s+row\\s+level\\s+security`,
          "i",
        ).test(texto),
    );
    expect(semRls).toEqual([]);
  });

  it("nenhuma tabela é aberta a anon, em nenhuma migration", () => {
    expect(texto).not.toMatch(
      /grant\s+[^;]*\bon\s+(?:table\s+)?(?:nucleo|config|auditoria)\.[^;]*\bto\s+[^;]*\banon\b/i,
    );
  });

  it("o grant a authenticated nasceu na 3.6 e toda migration que o dá cria as políticas no mesmo arquivo", () => {
    const comGrant = arquivos.filter((n) =>
      /grant\s+[^;]*\bon\s+(?:table\s+|schema\s+)?(?:nucleo|config|auditoria)\b[^;]*\bto\s+authenticated\b/i.test(
        lerArquivo(`supabase/migrations/${n}`),
      ),
    );
    expect(comGrant[0]).toBe("20261103170725_politicas_e_grants.sql");
    const semPolitica = comGrant.filter((n) => {
      const sql = lerArquivo(`supabase/migrations/${n}`);
      return !/create\s+policy\b/i.test(sql) && !soVisaoComRlsDeQuemConsulta(sql);
    });
    expect(semPolitica).toEqual([]);
  });

  // 3.9a: uma visão security_invoker não tem política própria (a RLS é a das tabelas que ela lê).
  it("sem política, só se o grant de tabela for todo de visão security_invoker criada no arquivo", () => {
    const visao =
      "create view nucleo.v with (security_invoker = true) as select 1;\ngrant select on nucleo.v to authenticated;";
    expect(soVisaoComRlsDeQuemConsulta(visao)).toBe(true);
    expect(
      soVisaoComRlsDeQuemConsulta(
        "create view nucleo.v as select 1;\ngrant select on nucleo.v to authenticated;",
      ),
    ).toBe(false);
    expect(
      soVisaoComRlsDeQuemConsulta(`${visao}\ngrant select on nucleo.ativo to authenticated;`),
    ).toBe(false);
  });
});

/** Todo grant de tabela a authenticated no arquivo é de visão security_invoker criada nele. */
function soVisaoComRlsDeQuemConsulta(sql: string): boolean {
  const alvos = [
    ...sql.matchAll(
      /grant\s+[^;]*?\bon\s+(?!function\b|schema\b)(?:table\s+)?([a-z_]+\.[a-z_]+)[^;]*\bto\s+authenticated\b/gi,
    ),
  ].map((m) => m[1]!.toLowerCase());
  if (alvos.length === 0) return false;
  return alvos.every((alvo) =>
    new RegExp(
      `create\\s+view\\s+${alvo.replace(".", "\\.")}\\s+with\\s*\\(\\s*security_invoker\\s*=\\s*true\\s*\\)`,
      "i",
    ).test(sql),
  );
}
