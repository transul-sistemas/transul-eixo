import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Regra de Alexandre (11/11/2026): o wizard abre em popup central; a barra lateral é só para detalhe.
// O "+" abre um popup central menor e empilhado (variante `empilhado`). A variante `lateral` sumiu.

function fontes(pasta: string): string[] {
  return readdirSync(pasta).flatMap((n) => {
    const caminho = join(pasta, n);
    if (statSync(caminho).isDirectory()) return n === "node_modules" ? [] : fontes(caminho);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [caminho] : [];
  });
}

const RAIZ = process.cwd();
const TODAS = [...fontes(join(RAIZ, "app")), ...fontes(join(RAIZ, "components"))];

describe("assistente em popup central (sem variante lateral)", () => {
  it('nenhum assistente usa variante="lateral"', () => {
    const comLateral = TODAS.filter((f) =>
      /variante=["{]["']?lateral/.test(readFileSync(f, "utf8")),
    );
    expect(comLateral.map((f) => relative(RAIZ, f))).toEqual([]);
  });

  it("o motor só conhece as variantes modal e empilhado", () => {
    const motor = readFileSync(join(RAIZ, "components/wizard/assistente.tsx"), "utf8");
    expect(motor).toMatch(/variante\?: "modal" \| "empilhado"/);
    expect(motor).not.toMatch(/"lateral"/);
  });

  it('o mini-cadastro do "+" usa o popup empilhado, sem rascunho próprio', () => {
    const mini = readFileSync(
      join(RAIZ, "app/(sistema)/frota/placas/assistentes/mini-cadastro-de-catalogo.tsx"),
      "utf8",
    );
    expect(mini).toMatch(/variante="empilhado"/);
    expect(mini).toMatch(/rascunho=\{false\}/);
  });
});
