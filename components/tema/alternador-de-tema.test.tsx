import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlternadorDeTema } from "./alternador-de-tema";

describe("<AlternadorDeTema>", () => {
  const html = renderToStaticMarkup(<AlternadorDeTema />);

  it("o nome acessível e o tooltip são sempre Alternar tema", () => {
    expect(html).toContain("Alternar tema");
    expect(html).toContain('title="Alternar tema"');
  });
  it("abaixo de 1536 px (2xl) o texto some da vista e só o ícone aparece, sem perder o nome", () => {
    expect(html).toMatch(/<span[^>]*class="[^"]*max-2xl:sr-only[^"]*"[^>]*>Alternar tema<\/span>/);
    expect(html).toMatch(/<svg[^>]*class="[^"]*2xl:hidden/);
  });
  it("o botão fica quadrado abaixo de 1536 px, para caber no topo do 1366", () => {
    expect(html).toMatch(/<button[^>]*class="[^"]*max-2xl:w-9[^"]*"/);
    expect(html).toMatch(/<button[^>]*class="[^"]*max-2xl:px-0[^"]*"/);
  });
});
