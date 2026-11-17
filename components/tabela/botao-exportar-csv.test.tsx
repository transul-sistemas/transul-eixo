import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BotaoExportarCsv } from "./botao-exportar-csv";

describe("<BotaoExportarCsv>", () => {
  const html = renderToStaticMarkup(<BotaoExportarCsv href="/exportar/frota.placas" />);

  it("baixa o CSV pelo endereço da lista", () => {
    expect(html).toContain('href="/exportar/frota.placas"');
    expect(html).toContain("download");
  });

  it("no celular é só o ícone, do tamanho de um botão (cabe na linha do título e nada pula)", () => {
    expect(html).toMatch(/<span class="[^"]*max-sm:sr-only[^"]*">Exportar CSV<\/span>/);
    expect(html).toMatch(/class="[^"]*max-sm:w-9[^"]*"/);
  });
});
