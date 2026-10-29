import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const EXCECAO = "app/icon.svg";

function svgsDe(pasta: string): string[] {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return svgsDe(caminho);
    return nome.endsWith(".svg") ? [caminho.replaceAll("\\", "/")] : [];
  });
}

describe("cor literal em SVG", () => {
  it("o ícone da aba existe", () => {
    expect(existsSync(EXCECAO)).toBe(true);
  });
  it("só app/icon.svg pode ter hexadecimal", () => {
    const comHex = ["app", "components", "lib", "public", "e2e"]
      .flatMap(svgsDe)
      .filter((arquivo) => arquivo !== EXCECAO)
      .filter((arquivo) => /#[0-9a-fA-F]{3,8}\b/.test(readFileSync(arquivo, "utf-8")));
    expect(comHex).toEqual([]);
  });
});
