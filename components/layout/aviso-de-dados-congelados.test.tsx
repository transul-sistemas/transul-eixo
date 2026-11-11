import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvisoDeDadosCongelados } from "./aviso-de-dados-congelados";

describe("<AvisoDeDadosCongelados>", () => {
  it("mostra 'dados até' com a data no formato dd/mm/aaaa", () => {
    const html = renderToStaticMarkup(<AvisoDeDadosCongelados dadosAte="2026-10-28" />);
    expect(html).toContain("dados até 28/10/2026");
  });
  it("rotula o mês incompleto com texto e ícone, nunca só cor", () => {
    const html = renderToStaticMarkup(<AvisoDeDadosCongelados dadosAte="2026-10-28" />);
    expect(html).toContain("aviso-de-mes-incompleto");
    expect(html).toContain("10/2026 é um mês incompleto");
    expect(html).toContain("<svg");
  });
  it("com o último dia do mês, o mês está completo e não leva rótulo", () => {
    const html = renderToStaticMarkup(<AvisoDeDadosCongelados dadosAte="2026-10-31" />);
    expect(html).toContain("dados até 31/10/2026");
    expect(html).not.toContain("incompleto");
  });
  it("sem data limite não mostra nada", () => {
    expect(renderToStaticMarkup(<AvisoDeDadosCongelados dadosAte={null} />)).toBe("");
  });
  it("não formata data à mão: nada de toLocaleString, Intl ou split de data no componente", () => {
    const fonte = readFileSync("components/layout/aviso-de-dados-congelados.tsx", "utf-8");
    expect(fonte).not.toMatch(/toLocale|Intl\.|\.split\(["']-["']\)/);
  });
});
