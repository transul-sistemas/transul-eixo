import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AbasDoDetalhe, SemDadosAinda } from "./abas-do-detalhe";

// A barra lateral do Acompanhamento (A3, protótipos 4 e 7): só leitura, com abas. A primeira aba abre
// selecionada; cada aba é um painel ligado ao seu botão (aria-controls / aria-labelledby).

const ABAS = [
  { id: "visao", rotulo: "Visão geral", conteudo: <p>conjunto</p> },
  {
    id: "financeiro",
    rotulo: "Financeiro",
    conteudo: <SemDadosAinda fonte="da ponte do Sankhya" />,
  },
  { id: "motorista", rotulo: "Motorista", conteudo: <p>motorista</p> },
];

describe("<AbasDoDetalhe>", () => {
  const html = renderToStaticMarkup(<AbasDoDetalhe rotulo="Detalhe de AAA1A11" abas={ABAS} />);

  it("é uma lista de abas nomeada, com um botão por aba", () => {
    expect(html).toMatch(/role="tablist"[^>]*aria-label="Detalhe de AAA1A11"/);
    expect([...html.matchAll(/role="tab"/g)]).toHaveLength(3);
  });

  it("a primeira aba abre selecionada e só o painel dela aparece", () => {
    expect([...html.matchAll(/aria-selected="true"/g)]).toHaveLength(1);
    expect(html).toMatch(/aria-selected="true"[^>]*>Visão geral/);
    expect(html).toContain("conjunto");
    expect(html).not.toContain("motorista</p>");
  });

  it("o painel aponta para a aba que o nomeia", () => {
    expect(html).toMatch(/role="tabpanel"[^>]*aria-labelledby="[^"]*visao/);
  });
});

describe("<SemDadosAinda>", () => {
  it("diz de que fonte depende e nunca mostra R$ 0,00", () => {
    const h = renderToStaticMarkup(
      <SemDadosAinda fonte="da ponte do Sankhya (receita e despesa)" />,
    );
    expect(h).toContain("Sem dados ainda: depende da ponte do Sankhya (receita e despesa)");
    expect(h).not.toContain("R$");
  });
});
