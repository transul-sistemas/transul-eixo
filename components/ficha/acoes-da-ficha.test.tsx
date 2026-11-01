import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AcoesDaFicha } from "./acoes-da-ficha";

const acoes = [
  { id: "frota.receber-placa", nome: "Receber placa" },
  { id: "frota.disponibilizar-ao-operacional", nome: "Disponibilizar ao Operacional" },
];
const com = (lista = acoes) =>
  renderToStaticMarkup(<AcoesDaFicha acoes={lista} aoAbrir={() => {}} />);

describe("<AcoesDaFicha>: as ações do momento abrem o assistente", () => {
  it("sem ações não desenha nada", () => {
    expect(com([])).toBe("");
  });

  it("cada ação é um botão com o nome do catálogo", () => {
    const html = com();
    expect(html).toContain("Receber placa");
    expect(html).toContain("Disponibilizar ao Operacional");
    expect([...html.matchAll(/<button/g)]).toHaveLength(2);
  });

  it("os botões estão ligados: nada de aria-disabled, disabled nem a mensagem antiga", () => {
    const html = com();
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toMatch(/<button[^>]*\sdisabled(=|\s|>)/);
    expect(html).not.toContain("chega com os assistentes");
    expect(html).not.toContain("opacity-60");
    expect(html).not.toContain("cursor-not-allowed");
    expect(html).toMatch(/<button[^>]*type="button"/);
  });

  it("cada botão avisa que abre um painel (aria-haspopup=dialog)", () => {
    const html = com();
    expect([...html.matchAll(/aria-haspopup="dialog"/g)]).toHaveLength(2);
  });

  it("o grupo tem nome e os botões têm alvo de pelo menos 32 px (44 px no celular)", () => {
    const html = com();
    expect(html).toMatch(/role="group"[^>]*aria-label="Ações do momento"/);
    expect(html).toMatch(/<button[^>]*class="[^"]*min-h-8/);
    expect(html).toMatch(/<button[^>]*class="[^"]*max-sm:min-h-11/);
  });

  it("não vira link nem formulário: o clique abre o assistente pela tela", () => {
    const html = com();
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<form");
  });
});
