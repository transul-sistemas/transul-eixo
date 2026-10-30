import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { vizinhas } from "@/lib/navegacao/espiar";
import { NavegacaoDoPainel } from "./navegacao-do-painel";

const PLACAS = ["AAA0A00", "AAA0A04", "AAA0A10", "AAA0A14"];
const com = (atual: string, anuncio = "") =>
  renderToStaticMarkup(
    <NavegacaoDoPainel vizinhas={vizinhas(PLACAS, atual)} anuncio={anuncio} aoIr={() => {}} />,
  );
const botao = (html: string, nome: string) =>
  new RegExp(`<button[^>]*aria-label="${nome}"[^>]*>`).exec(html)?.[0] ?? "";

describe("<NavegacaoDoPainel>", () => {
  it("tem os botões 'Placa anterior' e 'Próxima placa' e a posição '2 de 4'", () => {
    const html = com("AAA0A04");
    expect(botao(html, "Placa anterior")).not.toBe("");
    expect(botao(html, "Próxima placa")).not.toBe("");
    expect(html).toContain("2 de 4");
  });

  it("no meio da página os dois estão ligados", () => {
    const html = com("AAA0A04");
    expect(botao(html, "Placa anterior")).not.toContain("aria-disabled");
    expect(botao(html, "Próxima placa")).not.toContain("aria-disabled");
  });

  it("na primeira não há anterior; na última não há próxima (não atravessa páginas)", () => {
    expect(botao(com("AAA0A00"), "Placa anterior")).toContain('aria-disabled="true"');
    expect(botao(com("AAA0A00"), "Próxima placa")).not.toContain("aria-disabled");
    expect(botao(com("AAA0A14"), "Próxima placa")).toContain('aria-disabled="true"');
    expect(botao(com("AAA0A14"), "Placa anterior")).not.toContain("aria-disabled");
  });

  it("placa fora da página: os dois desligados e o texto diz por quê", () => {
    const html = com("ZZZ9Z99");
    expect(botao(html, "Placa anterior")).toContain('aria-disabled="true"');
    expect(botao(html, "Próxima placa")).toContain('aria-disabled="true"');
    expect(html).toContain("Fora desta página");
  });

  it("desligado é aria-disabled, nunca disabled (o foco não pode sair do botão)", () => {
    const html = com("AAA0A00");
    expect(html).not.toMatch(/<button[^>]*\sdisabled(=|\s|>)/);
  });

  it("os botões são type=button e têm alvo de pelo menos 24 px", () => {
    const html = com("AAA0A04");
    expect(botao(html, "Placa anterior")).toContain('type="button"');
    expect(botao(html, "Próxima placa")).toMatch(/class="[^"]*min-h-(?:6|8|10)/);
  });

  it("a região de aviso para o leitor de tela existe sempre, só para leitor, e leva o anúncio", () => {
    const vazio = com("AAA0A04");
    expect(vazio).toMatch(
      /role="status"[^>]*class="[^"]*sr-only|class="[^"]*sr-only[^"]*"[^>]*role="status"/,
    );
    expect(com("AAA0A04", "Placa AAA0A04, 2 de 4")).toContain("Placa AAA0A04, 2 de 4");
  });
});
