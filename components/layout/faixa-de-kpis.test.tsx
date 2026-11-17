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
      <FaixaDeKpis kpis={KPIS} rotulo="Indicadores dos lançados à mão" />,
    );
    expect(html).toContain('aria-label="Indicadores dos lançados à mão"');
  });

  it("sem indicadores, não desenha nada", () => {
    expect(renderToStaticMarkup(<FaixaDeKpis kpis={[]} />)).toBe("");
  });

  it("a seção de painel embutida em outra tela não repete o nome da faixa da tela", () => {
    const fonte = readFileSync("components/paineis/secao-do-painel.tsx", "utf8");
    const faixa = fonte.slice(fonte.indexOf("<FaixaDeKpis"));
    expect(faixa.slice(0, faixa.indexOf("/>"))).toMatch(/rotulo=/);
  });
});
