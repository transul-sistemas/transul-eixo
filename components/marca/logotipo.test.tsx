import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logotipo } from "./logotipo";

describe("<Logotipo>", () => {
  it("tem a placa com EIXO, o texto TranSul Eixo e a assinatura para TranSul", () => {
    const html = renderToStaticMarkup(<Logotipo />);
    expect(html).toContain("EIXO");
    expect(html).toContain("TranSul Eixo");
    expect(html).toContain("para");
    expect(html).toContain('aria-label="TranSul"');
  });
  it("sem assinatura não mostra o para TranSul", () => {
    const html = renderToStaticMarkup(<Logotipo comAssinatura={false} />);
    expect(html).toContain("TranSul Eixo");
    expect(html).not.toContain("para");
  });
  it("recolhido mostra só a placa com o símbolo, mantendo o nome acessível", () => {
    const html = renderToStaticMarkup(<Logotipo recolhido />);
    expect(html).toContain("EIXO");
    expect(html).not.toContain(">TranSul Eixo<");
    expect(html).toContain('aria-label="TranSul Eixo"');
    expect(html).not.toContain("para");
    expect(html).toContain('data-recorte="simbolo"');
  });
  it("não leva cor escrita à mão", () => {
    expect(renderToStaticMarkup(<Logotipo />)).not.toContain("#");
  });
});
