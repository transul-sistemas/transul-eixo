import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParametroDoCorte } from "./parametro-do-corte";

describe("<ParametroDoCorte>", () => {
  it("travado: mostra o aviso com o dia do parâmetro e desabilita o campo", () => {
    const html = renderToStaticMarkup(<ParametroDoCorte dia={10} travado />);
    expect(html).toContain("Corte do dia 10 já aplicado na origem (v1)");
    expect(html).toContain("disabled");
    expect(html).toContain("<svg");
  });
  it("o número do dia vem do parâmetro, não de um 10 fixo", () => {
    const html = renderToStaticMarkup(<ParametroDoCorte dia={12} travado />);
    expect(html).toContain("Corte do dia 12 já aplicado");
    expect(html).not.toContain("Corte do dia 10");
  });
  it("sem a trava, o campo fica livre e o aviso some", () => {
    const html = renderToStaticMarkup(<ParametroDoCorte dia={10} travado={false} />);
    expect(html).not.toContain("já aplicado na origem");
    expect(html).not.toContain("disabled");
  });
});
