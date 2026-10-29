import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LinkComContexto } from "./link-com-contexto";

describe("<LinkComContexto>", () => {
  it("sem contexto na URL (ou antes de hidratar), é um link comum com o mesmo href", () => {
    const html = renderToStaticMarkup(
      <LinkComContexto href="/frota/placas">Placas</LinkComContexto>,
    );
    expect(html).toContain('href="/frota/placas"');
    expect(html).toContain("Placas");
  });
  it("repassa as propriedades do link, como aria-current e classes", () => {
    const html = renderToStaticMarkup(
      <LinkComContexto href="/frota/placas" aria-current="page" className="ativo">
        Placas
      </LinkComContexto>,
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('class="ativo"');
  });
  it("aceita href com ?modo=", () => {
    const html = renderToStaticMarkup(
      <LinkComContexto href="/frota/acompanhamento?modo=mapa">Mapa</LinkComContexto>,
    );
    expect(html).toContain('href="/frota/acompanhamento?modo=mapa"');
  });
});
