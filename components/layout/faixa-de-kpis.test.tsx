import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaixaDeKpis } from "./faixa-de-kpis";

const KPIS = [{ id: "placas", rotulo: "Placas", valor: "3" }];

describe("<FaixaDeKpis>", () => {
  it("a faixa da tela se chama Indicadores", () => {
    expect(renderToStaticMarkup(<FaixaDeKpis kpis={KPIS} />)).toContain('aria-label="Indicadores"');
  });

  it("uma segunda faixa na mesma tela tem nome próprio (o leitor de tela e o e2e não confundem)", () => {
    const html = renderToStaticMarkup(
      <FaixaDeKpis kpis={KPIS} rotulo="Totais dos lançados à mão" />,
    );
    expect(html).toContain('aria-label="Totais dos lançados à mão"');
  });

  it("sem indicadores, não desenha nada", () => {
    expect(renderToStaticMarkup(<FaixaDeKpis kpis={[]} />)).toBe("");
  });

  it("a seção de painel embutida em outra tela não repete o nome da faixa da tela", () => {
    // Nem como trecho: o leitor de tela e o getByRole do e2e acham "Indicadores" dentro de
    // "Indicadores: ..." (a comparação do nome é por trecho).
    const fonte = readFileSync("components/paineis/secao-do-painel.tsx", "utf8");
    const faixa = fonte.slice(fonte.indexOf("<FaixaDeKpis"));
    const rotulo = faixa.slice(0, faixa.indexOf("/>")).match(/rotulo={?`?"?([^`"}]*)/)?.[1] ?? "";
    expect(rotulo).not.toBe("");
    expect(rotulo.toLowerCase()).not.toContain("indicadores");
  });
});
