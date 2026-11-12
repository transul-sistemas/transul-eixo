import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TEXTO_DA_FAIXA_DEMO } from "../../scripts/demo-dados";
import { FaixaDaDemonstracao, TEXTO_DA_FAIXA } from "./faixa-da-demonstracao";

describe("<FaixaDaDemonstracao>", () => {
  it("com a demonstração ligada, mostra a faixa fixa com o aviso", () => {
    const html = renderToStaticMarkup(<FaixaDaDemonstracao ligada />);
    expect(html).toContain(TEXTO_DA_FAIXA);
    expect(html).toContain('data-testid="faixa-da-demonstracao"');
    expect(html).toContain("data-faixa-demo");
    expect(html).toContain("sticky");
    expect(html).toContain('role="note"');
  });
  it("sem a demonstração (banco real), não desenha nada", () => {
    expect(renderToStaticMarkup(<FaixaDaDemonstracao ligada={false} />)).toBe("");
  });
  it("o texto é o combinado: números fictícios misturados com os reais", () => {
    expect(TEXTO_DA_FAIXA).toBe("Banco em demonstração: números fictícios misturados com os reais");
    expect(TEXTO_DA_FAIXA).toBe(TEXTO_DA_FAIXA_DEMO);
  });
  it("some no modo foco, como o topo", () => {
    expect(renderToStaticMarkup(<FaixaDaDemonstracao ligada />)).toContain(
      "group-has-[[data-modo-foco]]/casca:hidden",
    );
  });
});
