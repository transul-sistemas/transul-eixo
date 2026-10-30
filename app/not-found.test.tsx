import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NaoEncontrada from "./not-found";

describe("página não encontrada do sistema", () => {
  it("fala português, diz o que aconteceu e leva de volta ao sistema", () => {
    const html = renderToStaticMarkup(<NaoEncontrada />);
    expect(html).toContain("Página não encontrada");
    expect(html).toMatch(/<a[^>]*href="\/"/);
    expect(html).not.toContain("could not be found");
  });
});
