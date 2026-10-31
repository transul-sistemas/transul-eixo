import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AcoesDaFicha } from "./acoes-da-ficha";

const acoes = [
  { id: "operacional.receber-placa", nome: "Receber placa" },
  { id: "frota.disponibilizar-ao-operacional", nome: "Disponibilizar ao Operacional" },
];
const com = (lista = acoes) => renderToStaticMarkup(<AcoesDaFicha acoes={lista} />);

describe("<AcoesDaFicha>: ações do momento, desligadas até os assistentes (2D)", () => {
  it("sem ações não desenha nada", () => {
    expect(com([])).toBe("");
  });

  it("cada ação é um botão com o nome do catálogo", () => {
    const html = com();
    expect(html).toContain("Receber placa");
    expect(html).toContain("Disponibilizar ao Operacional");
    expect([...html.matchAll(/<button/g)]).toHaveLength(2);
  });

  it("está desligada com aria-disabled (o foco continua nela), nunca disabled", () => {
    const html = com();
    expect([...html.matchAll(/aria-disabled="true"/g)]).toHaveLength(2);
    expect(html).not.toMatch(/<button[^>]*\sdisabled(=|\s|>)/);
    expect(html).toMatch(/<button[^>]*type="button"/);
  });

  it("a mensagem 'chega com os assistentes (2D)' fica visível e ligada a cada botão", () => {
    const html = com();
    expect([...html.matchAll(/chega com os assistentes \(2D\)/g)].length).toBeGreaterThanOrEqual(1);
    expect(html).toMatch(/aria-describedby="[^"]+"/);
    const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]);
    for (const id of ids) expect(html).toContain(`id="${id}"`);
  });

  it("o grupo tem nome e os botões têm alvo de pelo menos 24 px", () => {
    const html = com();
    expect(html).toMatch(/role="group"[^>]*aria-label="Ações do momento"/);
    expect(html).toMatch(/<button[^>]*class="[^"]*min-h-(?:6|8|9|10)/);
  });

  it("não executa nada ao clicar: nenhum botão leva link nem formulário", () => {
    const html = com();
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<form");
  });
});
