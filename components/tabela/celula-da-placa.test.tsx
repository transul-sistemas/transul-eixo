import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CelulaDaPlaca } from "./celula-da-placa";

describe("<CelulaDaPlaca>", () => {
  const com = (densidade: "compacta" | "confortavel") =>
    renderToStaticMarkup(
      <CelulaDaPlaca placa="AAA0A00" densidade={densidade} aoAbrir={() => {}} />,
    );

  it("é um botão com o nome Espiar AAA0A00, que avisa que abre um diálogo", () => {
    const html = com("compacta");
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toContain('aria-label="Espiar AAA0A00"');
    expect(html).toContain('aria-haspopup="dialog"');
  });
  it("marca a placa para o foco poder voltar a ela depois de fechar o painel", () => {
    expect(com("compacta")).toContain('data-espiar-placa="AAA0A00"');
  });
  it("mostra a mini placa Mercosul dentro do botão", () => {
    const html = com("compacta");
    expect(html).toContain('aria-label="Placa AAA0A00"');
    expect(html).toContain("AAA0A00");
  });
  it("a mini placa é menor na densidade compacta e média na confortável", () => {
    expect(com("compacta")).toContain("text-xs");
    expect(com("confortavel")).toContain("text-sm");
  });
  it("o botão tem alvo de toque de pelo menos 24 px", () => {
    expect(com("compacta")).toMatch(/<button[^>]*class="[^"]*min-h-6/);
  });
  it("sem a ação de abrir (fora de uma lista), é só a placa, sem botão", () => {
    const html = renderToStaticMarkup(<CelulaDaPlaca placa="AAA0A00" densidade="compacta" />);
    expect(html).not.toContain("<button");
    expect(html).toContain('aria-label="Placa AAA0A00"');
  });
});
