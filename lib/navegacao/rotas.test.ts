import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { todasAsTelas } from "./catalogo";

// A regra "rota ⇔ catálogo": toda rota do catálogo tem página, e nenhuma página existe fora dele.

function paginasDe(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return paginasDe(caminho);
    return nome === "page.tsx" ? [caminho.replaceAll("\\", "/")] : [];
  });
}

/** `app/(sistema)/frota/placas/page.tsx` → `/frota/placas`; `app/page.tsx` → `/`. */
function rotaDe(arquivo: string): string {
  const caminho = arquivo
    .replace(/^app\//, "")
    .replace(/\/?page\.tsx$/, "")
    .split("/")
    .filter((trecho) => !/^\(.+\)$/.test(trecho))
    .join("/");
  return `/${caminho}`;
}

const paginas = paginasDe("app");
const rotasDasPaginas = paginas.map(rotaDe);
const telas = todasAsTelas();

describe("rotas e catálogo", () => {
  it.each(telas.map((t) => [t.rota, t.id] as const))("a rota %s (%s) tem página", (rota) => {
    expect(rotasDasPaginas).toContain(rota);
  });
  it("nenhuma página existe fora do catálogo, exceto a raiz", () => {
    const foraDoCatalogo = rotasDasPaginas.filter(
      (rota) => rota !== "/" && !telas.some((t) => t.rota === rota),
    );
    expect(foraDoCatalogo).toEqual([]);
  });
  it("não há duas páginas para a mesma rota", () => {
    expect(new Set(rotasDasPaginas).size).toBe(rotasDasPaginas.length);
  });
  it("as páginas do sistema ficam em app/(sistema)/", () => {
    const fora = paginas.filter((p) => p !== "app/page.tsx" && !p.startsWith("app/(sistema)/"));
    expect(fora).toEqual([]);
  });
  it("não sobrou pasta de módulo solta em app/", () => {
    const modulos = ["inicio", "frota", "operacional", "operacoes", "pessoas", "parceiros"];
    const restantes = [...modulos, "resultados", "cadastros", "admin"].filter((m) =>
      existsSync(join("app", m)),
    );
    expect(restantes).toEqual([]);
  });
});

describe("páginas das telas em breve", () => {
  it.each(telas.filter((t) => t.estado === "em-breve").map((t) => [t.rota] as const))(
    "%s usa TelaEmBreve e o título do catálogo, com a mesma rota",
    (rota) => {
      const arquivo = `app/(sistema)${rota}/page.tsx`;
      expect(existsSync(arquivo), arquivo).toBe(true);
      const codigo = readFileSync(arquivo, "utf-8");
      expect(codigo).toContain(`metadataDaTela("${rota}")`);
      expect(codigo).toContain(`<TelaEmBreve rota="${rota}" />`);
    },
  );
});

describe("a raiz", () => {
  it("redireciona para Início › Tarefas", () => {
    const codigo = readFileSync("app/page.tsx", "utf-8");
    expect(codigo).toContain('redirect("/inicio/tarefas")');
  });
});
