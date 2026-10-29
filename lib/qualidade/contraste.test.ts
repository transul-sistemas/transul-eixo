import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contraste } from "./contraste";

const css = readFileSync("app/tokens.css", "utf-8");

function valor(seletor: string, nome: string): string {
  const inicio = css.indexOf(`${seletor} {`);
  const fim = css.indexOf("}", inicio);
  const achado = css.slice(inicio, fim).match(new RegExp(`${nome}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!achado?.[1]) throw new Error(`${nome} não encontrado em ${seletor}`);
  return achado[1];
}

describe("contraste", () => {
  it("preto sobre branco é 21", () => {
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });
  it("é simétrico", () => {
    expect(contraste("#3355FF", "#FFFFFF")).toBeCloseTo(contraste("#FFFFFF", "#3355FF"), 5);
  });
});

describe.each([":root", ".dark"])("contraste mínimo de 4,5:1 em %s", (seletor) => {
  it("texto sobre o fundo", () => {
    expect(contraste(valor(seletor, "--texto"), valor(seletor, "--fundo"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });
  it("texto sobre a superfície", () => {
    expect(
      contraste(valor(seletor, "--texto"), valor(seletor, "--superficie")),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it("texto suave sobre a superfície", () => {
    expect(
      contraste(valor(seletor, "--texto-suave"), valor(seletor, "--superficie")),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it("texto do botão sobre o azul de ação", () => {
    expect(
      contraste(valor(seletor, "--acao-texto"), valor(seletor, "--acao")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
