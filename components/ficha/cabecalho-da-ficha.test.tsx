import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CabecalhoDaFicha } from "./cabecalho-da-ficha";

const com = (extra: Partial<Parameters<typeof CabecalhoDaFicha>[0]> = {}) =>
  renderToStaticMarkup(
    <CabecalhoDaFicha
      voltar={<span>Voltar à lista</span>}
      titulo="AAA0A00"
      subtitulo="FH 540, cavalo, ano 2020"
      situacao={<span data-teste="situacao">DOp Disponível no Operacional</span>}
      {...extra}
    />,
  );

describe("<CabecalhoDaFicha>", () => {
  it("tem um único título de primeiro nível, com a identidade", () => {
    const html = com();
    expect([...html.matchAll(/<h1[ >]/g)]).toHaveLength(1);
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toContain("AAA0A00");
  });

  it("traz o subtítulo, a situação e o encaixe de voltar, nessa ordem de leitura", () => {
    const html = com();
    expect(html).toContain("FH 540, cavalo, ano 2020");
    expect(html).toContain('data-teste="situacao"');
    expect(html.indexOf("Voltar à lista")).toBeLessThan(html.indexOf("<h1"));
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf('data-teste="situacao"'));
  });

  it("o aviso (placa baixada) só aparece quando há, em texto, não só na cor", () => {
    expect(com()).not.toContain("data-aviso");
    const html = com({ aviso: "Placa baixada: vendida em 12/09/2026" });
    expect(html).toContain("data-aviso");
    expect(html).toContain("Placa baixada: vendida em 12/09/2026");
  });

  it("as ações ficam num grupo nomeado, só quando há", () => {
    expect(com()).not.toContain('aria-label="Ações"');
    const html = com({ acoes: <button type="button">Receber placa</button> });
    expect(html).toMatch(/role="group"[^>]*aria-label="Ações"|aria-label="Ações"[^>]*role="group"/);
    expect(html).toContain("Receber placa");
  });

  it("a região é um cabeçalho de página (banner da ficha), sem papel de landmark duplicado", () => {
    expect(com()).toMatch(/<header[ >]/);
  });
});
