import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listarArquivos, lerTexto } from "./armadilhas";

// A5: nenhuma cor de status escrita à mão fora dos tokens. Cor de status (verde, âmbar, vermelho, cinza,
// azul do pátio) só chega à tela por `var(--status-*)`; os valores vivem em `app/tokens.css`.

const css = readFileSync("app/tokens.css", "utf-8");
const tokensDeclarados = new Set([...css.matchAll(/(--status-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const FONTES = /\.(ts|tsx)$/;
const DE_TESTE = /\.test\.(ts|tsx)$/;

function fontesDe(...pastas: string[]): string[] {
  return pastas.flatMap((p) => listarArquivos(p, FONTES)).filter((a) => !DE_TESTE.test(a));
}

// Os arquivos em que cor de status aparece: a régua, a legenda e a grade do Acompanhamento.
const ONDE_HA_COR_DE_STATUS = [
  ...fontesDe("components/legenda", "app/(sistema)/frota/acompanhamento"),
  "lib/dominio/status.ts",
  "lib/dominio/legenda.ts",
];

describe("cor de status só por token", () => {
  it("há arquivos para conferir", () => {
    expect(ONDE_HA_COR_DE_STATUS.length).toBeGreaterThan(5);
  });

  it.each(ONDE_HA_COR_DE_STATUS)("%s não escreve cor hexadecimal, rgb nem hsl", (arquivo) => {
    const codigo = lerTexto(arquivo)
      // o comentário pode citar um valor; o que vale é o código
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    expect(codigo).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(codigo).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch)\(/);
  });

  it("todo `--status-*` citado no código existe em app/tokens.css", () => {
    const faltando: string[] = [];
    for (const arquivo of fontesDe("app", "components", "lib")) {
      const texto = lerTexto(arquivo);
      for (const [, nome] of texto.matchAll(/var\((--status-[a-z0-9-]+)/g)) {
        if (nome && !tokensDeclarados.has(nome)) faltando.push(`${arquivo}: ${nome}`);
      }
    }
    expect(faltando).toEqual([]);
  });

  it("o teste enxerga o que deveria: o token do verde mais escuro existe", () => {
    expect(tokensDeclarados.has("--status-atividade-1")).toBe(true);
    expect(tokensDeclarados.has("--status-atividade-1-texto")).toBe(true);
  });
});
