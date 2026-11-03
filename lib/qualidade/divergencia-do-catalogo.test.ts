import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  divergenciasDoCatalogo,
  lerSiglasDoSeed,
  type LinhaDoCatalogo,
} from "@/lib/qualidade/catalogo-de-status";

const seed = readFileSync("supabase/seed.sql", "utf-8");

function copia(): LinhaDoCatalogo[] {
  return lerSiglasDoSeed(seed).map((l) => ({ ...l, tipos: [...l.tipos] }));
}

function trocando(sigla: string, mudanca: (l: LinhaDoCatalogo) => void): LinhaDoCatalogo[] {
  const linhas = copia();
  const alvo = linhas.find((l) => l.sigla === sigla);
  if (!alvo) throw new Error(`sigla ${sigla} fora do seed`);
  mudanca(alvo);
  return linhas;
}

describe("o espelho da régua (lib/dominio/status.ts) contra o seed.sql", () => {
  it("o seed de hoje não diverge do espelho em nada", () => {
    expect(lerSiglasDoSeed(seed)).toHaveLength(25);
    expect(divergenciasDoCatalogo(copia())).toEqual([]);
  });

  const MUDANCAS: [string, string, (l: LinhaDoCatalogo) => void][] = [
    ["nome", "ETc", (l) => void (l.nome = "Em trânsito")],
    ["chip", "ETc", (l) => void (l.chip = "patio")],
    ["camada", "MAN", (l) => void (l.camada = "atividade")],
    ["aplica_a", "FOg", (l) => void (l.aplicaA = "solo")],
    ["tipos válidos (a mais)", "DOp", (l) => void l.tipos.push("implemento")],
    ["tipos válidos (a menos)", "DOp", (l) => void l.tipos.pop()],
    ["baixada", "VND", (l) => void (l.baixada = false)],
    ["baixada indevida", "VEN", (l) => void (l.baixada = true)],
    ["ordem", "ALU", (l) => void (l.ordem = 99)],
  ];

  it.each(MUDANCAS)("acusa a divergência de %s", (campo, sigla, mudanca) => {
    const achados = divergenciasDoCatalogo(trocando(sigla, mudanca));
    expect(achados.length, campo).toBeGreaterThan(0);
    expect(achados.join("\n"), campo).toContain(sigla);
  });

  it("acusa sigla que falta no seed", () => {
    const achados = divergenciasDoCatalogo(copia().filter((l) => l.sigla !== "SUC"));
    expect(achados.join("\n")).toContain("SUC");
  });

  it("acusa sigla a mais no seed", () => {
    const linhas = copia();
    linhas.push({ ...(linhas[0] as LinhaDoCatalogo), sigla: "XYZ", ordem: 27 });
    expect(divergenciasDoCatalogo(linhas).join("\n")).toContain("XYZ");
  });
});
