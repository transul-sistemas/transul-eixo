import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A versão reduzida que o next/font/google baixa pode vir sem algarismos tabulares (tnum), e a
// moeda precisa de algarismos de largura fixa. Por isso as fontes completas ficam no repositório.
const PASTA = "app/fonts";
const ARQUIVOS = [
  "barlow-400.woff2",
  "barlow-500.woff2",
  "barlow-600.woff2",
  "barlow-700.woff2",
  "barlow-semi-condensed-500.woff2",
  "barlow-semi-condensed-600.woff2",
  "barlow-semi-condensed-700.woff2",
];

describe("fontes hospedadas no repositório", () => {
  it.each(ARQUIVOS)("%s existe e é a fonte completa (não a versão reduzida)", (arquivo) => {
    const caminho = `${PASTA}/${arquivo}`;
    expect(existsSync(caminho), `${caminho} não existe`).toBe(true);
    // Os arquivos completos têm cerca de 22 KB; os reduzidos, 5 a 10 KB.
    expect(statSync(caminho).size).toBeGreaterThan(15_000);
  });
  it("a licença OFL acompanha as fontes", () => {
    expect(existsSync(`${PASTA}/OFL.txt`)).toBe(true);
    expect(readFileSync(`${PASTA}/OFL.txt`, "utf-8")).toContain("SIL OPEN FONT LICENSE");
  });
  it("o layout usa next/font/local e não baixa fonte do Google no build", () => {
    const layout = readFileSync("app/layout.tsx", "utf-8");
    expect(layout).toContain("next/font/local");
    expect(layout).not.toMatch(/from\s+"next\/font\/google"/);
  });
});
