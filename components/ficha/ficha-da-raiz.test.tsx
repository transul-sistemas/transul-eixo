import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FichaDaRaiz } from "./ficha-da-raiz";

const html = renderToStaticMarkup(
  <FichaDaRaiz
    cabecalho={
      <header data-teste="cabecalho">
        <h1>AAA0A00</h1>
      </header>
    }
    linhaDoTempo={<div data-teste="linha">faixas</div>}
  >
    <div data-teste="abas">abas</div>
  </FichaDaRaiz>,
);

describe("<FichaDaRaiz>: a casca que toda raiz reaproveita", () => {
  it("monta cabeçalho, linha do tempo e abas, nessa ordem", () => {
    const a = html.indexOf('data-teste="cabecalho"');
    const b = html.indexOf('data-teste="linha"');
    const c = html.indexOf('data-teste="abas"');
    expect(a).toBeGreaterThan(-1);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it("é genérica: nenhum arquivo da casca importa dados de placa nem o componente Placa", () => {
    for (const nome of readdirSync(__dirname)) {
      if (!/\.tsx?$/.test(nome) || /\.test\./.test(nome)) continue;
      const texto = readFileSync(join(__dirname, nome), "utf-8");
      expect(texto, nome).not.toMatch(/@\/lib\/dados\//);
      expect(texto, nome).not.toMatch(/@\/components\/placa"/);
    }
  });

  it("largura total, com a margem lateral padrão das telas", () => {
    expect(html).toMatch(/px-4[^"]*sm:px-8/);
  });
});
