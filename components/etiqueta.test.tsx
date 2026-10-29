import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Etiqueta } from "./etiqueta";

describe("<Etiqueta>", () => {
  it("de status marca o tom e mostra o texto", () => {
    const html = renderToStaticMarkup(<Etiqueta status="atencao">Em revisão</Etiqueta>);
    expect(html).toContain('data-tom="status:atencao"');
    expect(html).toContain("Em revisão");
  });
  it("de módulo marca o tom", () => {
    const html = renderToStaticMarkup(<Etiqueta modulo="frota">Frota</Etiqueta>);
    expect(html).toContain('data-tom="modulo:frota"');
  });
  it("usa os tokens suave e forte e o texto na cor do texto", () => {
    const html = renderToStaticMarkup(<Etiqueta status="impedida">Impedida</Etiqueta>);
    expect(html).toContain("var(--status-impedida-suave)");
    expect(html).toContain("var(--status-impedida)");
    expect(html).toContain("text-texto");
  });
  it("o nome completo vai no tooltip (title)", () => {
    const html = renderToStaticMarkup(
      <Etiqueta modulo="admin" titulo="Administração">
        Admin
      </Etiqueta>,
    );
    expect(html).toContain('title="Administração"');
    expect(html).toContain('data-tom="modulo:admin"');
    expect(html).toContain("var(--modulo-cadastros-suave)");
  });
  it("sem título não tem tooltip", () => {
    expect(renderToStaticMarkup(<Etiqueta modulo="frota">Frota</Etiqueta>)).not.toContain("title=");
  });
  it("não tem cor escrita à mão", () => {
    const html = renderToStaticMarkup(<Etiqueta modulo="pessoas">Pessoas</Etiqueta>);
    expect(html).not.toContain("#");
  });
  it("não aceita módulo e status juntos nem nenhum dos dois", () => {
    // @ts-expect-error cor de módulo e cor de status nunca se misturam
    const ambos = Etiqueta({ modulo: "frota", status: "atencao", children: "x" });
    // @ts-expect-error toda etiqueta precisa de um tom
    const nenhum = Etiqueta({ children: "x" });
    expect(ambos).toBeTruthy();
    expect(nenhum).toBeTruthy();
  });
});
