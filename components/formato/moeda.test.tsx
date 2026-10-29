import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Moeda } from "./moeda";

describe("<Moeda>", () => {
  it("mostra o valor formatado, com algarismos de largura fixa e à direita", () => {
    const html = renderToStaticMarkup(<Moeda valor={128430000} />);
    expect(html).toContain("R$ 1.284.300,00");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("text-right");
  });
  it("negativo é marcado e fica em vermelho", () => {
    const html = renderToStaticMarkup(<Moeda valor={-1234} />);
    expect(html).toContain("data-negativo");
    expect(html).toContain("text-destructive");
  });
  it("zero e menos zero não são negativos", () => {
    expect(renderToStaticMarkup(<Moeda valor={0} />)).not.toContain("data-negativo");
    expect(renderToStaticMarkup(<Moeda valor={-0} />)).not.toContain("data-negativo");
  });
  it("valor ausente mostra travessão sem marca de negativo", () => {
    const html = renderToStaticMarkup(<Moeda valor={null} />);
    expect(html).toContain("—");
    expect(html).not.toContain("data-negativo");
  });
});
