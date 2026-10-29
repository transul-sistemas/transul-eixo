import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Placa } from "./placa";

describe("<Placa>", () => {
  it("normaliza o texto e avisa o leitor de tela", () => {
    const html = renderToStaticMarkup(<Placa placa=" abc-1d23 " />);
    expect(html).toContain("ABC1D23");
    expect(html).toContain('aria-label="Placa ABC1D23"');
    expect(html).toContain('role="img"');
  });
  it("usa a fonte das placas", () => {
    expect(renderToStaticMarkup(<Placa placa="ABC1D23" />)).toContain("font-placa");
  });
  it("placa vazia mostra travessão e diz que não há placa", () => {
    const html = renderToStaticMarkup(<Placa placa="" />);
    expect(html).toContain("—");
    expect(html).toContain('aria-label="Sem placa"');
  });
  it("tem três tamanhos", () => {
    const [p, m, g] = (["p", "m", "g"] as const).map((t) =>
      renderToStaticMarkup(<Placa placa="ABC1D23" tamanho={t} />),
    );
    expect(new Set([p, m, g]).size).toBe(3);
  });
  it("não leva cor escrita à mão nem a assinatura da TranSul", () => {
    const html = renderToStaticMarkup(<Placa placa="ABC1D23" />);
    expect(html).not.toContain("#");
    expect(html).not.toContain("data-marca");
  });
});
