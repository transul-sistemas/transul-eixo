import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CLASSE_DO_BOTAO_MAIS_FILTROS, MaisFiltrosReservado } from "./mais-filtros";

describe("<MaisFiltrosReservado> (o lugar do botão enquanto a lista carrega)", () => {
  const html = renderToStaticMarkup(<MaisFiltrosReservado />);

  it("é o mesmo botão em tamanho: as mesmas classes do botão de verdade, com o ícone", () => {
    const atributo = /class="([^"]*)"/.exec(html)?.[1] ?? "";
    // o HTML escapa aspas e sinais nas classes do Tailwind (por exemplo, &#x27; e &gt;)
    const classes = atributo
      .replaceAll("&#x27;", "'")
      .replaceAll("&gt;", ">")
      .replaceAll("&lt;", "<")
      .replaceAll("&amp;", "&");
    expect(classes).toBe(CLASSE_DO_BOTAO_MAIS_FILTROS);
    expect(html).toMatch(/<svg/);
    expect(html).toContain("Mais filtros");
  });
  it("não aceita clique e avisa que está ocupado, para o leitor de tela", () => {
    expect(html).toMatch(/\sdisabled(?:=""|[\s>])/);
    expect(html).toContain('aria-busy="true"');
  });
  it("reserva a largura do texto (109 px): o botão não anda enquanto o HTML chega em pedaços", () => {
    expect(CLASSE_DO_BOTAO_MAIS_FILTROS).toContain("min-w-[6.8125rem]");
  });
  it("não repete a dica antiga de que o botão ainda não existe", () => {
    expect(html).not.toContain("Entra com a tabela");
  });
});
