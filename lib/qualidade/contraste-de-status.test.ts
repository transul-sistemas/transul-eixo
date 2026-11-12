import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TONS_DE_STATUS } from "@/lib/dominio/status";
import { contraste } from "./contraste";

// A5: todo par fundo e texto de status (os tons das siglas) passa de 4,5:1 nos dois temas. A sigla
// vem sempre escrita sobre o fundo do tom, então é o texto do tom que precisa ler bem.

const css = readFileSync("app/tokens.css", "utf-8");

function valor(seletor: string, nome: string): string {
  const inicio = css.indexOf(`${seletor} {`);
  const fim = css.indexOf("\n}", inicio);
  const achado = css.slice(inicio, fim).match(new RegExp(`${nome}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!achado?.[1]) throw new Error(`${nome} não encontrado em ${seletor}`);
  return achado[1];
}

describe.each([":root", ".dark"])("contraste dos tons de status em %s", (seletor) => {
  it.each(TONS_DE_STATUS)("%s: texto sobre o fundo do tom é de 4,5:1 ou mais", (tom) => {
    const razao = contraste(
      valor(seletor, `--status-${tom}-texto`),
      valor(seletor, `--status-${tom}`),
    );
    expect(razao).toBeGreaterThanOrEqual(4.5);
  });

  it("o contorno do verde mais claro (atividade-5) aparece sobre a superfície (3:1)", () => {
    expect(
      contraste(valor(seletor, "--status-em-atividade"), valor(seletor, "--superficie")),
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("os tons de verde são cinco degraus distintos", () => {
  it.each([":root", ".dark"])(
    "em %s, os fundos de atividade-1 a -5 são todos diferentes",
    (seletor) => {
      const fundos = [1, 2, 3, 4, 5].map((n) => valor(seletor, `--status-atividade-${n}`));
      expect(new Set(fundos).size).toBe(5);
    },
  );
});
