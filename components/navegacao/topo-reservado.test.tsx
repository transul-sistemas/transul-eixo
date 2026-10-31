import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TopoReservado } from "./topo-do-sistema";

describe("<TopoReservado>: o lugar do topo enquanto ele é calculado", () => {
  const html = renderToStaticMarkup(<TopoReservado />);

  it("é decorativo e não ocupa o leitor de tela", () => {
    expect(html).toContain('aria-hidden="true"');
  });

  it("reserva a altura do topo real em cada faixa de largura (63, 57, 169, 125, 121, 81 e 53 px)", () => {
    for (const classe of [
      "h-[3.9375rem]",
      "min-[384px]:h-[3.5625rem]",
      "min-[1024px]:h-[10.5625rem]",
      "min-[1152px]:h-[7.8125rem]",
      "min-[1304px]:h-[7.5625rem]",
      "min-[1352px]:h-[5.0625rem]",
      "min-[1464px]:h-[3.3125rem]",
    ]) {
      expect(html, classe).toContain(classe);
    }
  });

  it("não volta à altura única de 52 px, que fazia a página pular 29 px no 1366", () => {
    expect(html).not.toContain("h-[3.25rem]");
  });
});
