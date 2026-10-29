import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { todasAsTelas } from "@/lib/navegacao/catalogo";
import { metadataDaTela, TelaEmBreve } from "./tela-em-breve";

describe("<TelaEmBreve>", () => {
  it("mostra o nome, o módulo, a linha do que a tela fará e que entra em breve", () => {
    const html = renderToStaticMarkup(<TelaEmBreve rota="/frota/placas" />);
    expect(html).toContain("<h1");
    expect(html).toContain("Placas");
    expect(html).toContain("Frota");
    expect(html).toContain("Lista todas as placas e abre a ficha de cada uma.");
    expect(html).toContain("Esta tela entra em breve.");
    expect(html).toContain('role="status"');
  });
  it("usa a cor do módulo por variável, como faixa e ícone, e nunca texto colorido", () => {
    const html = renderToStaticMarkup(<TelaEmBreve rota="/frota/placas" />);
    expect(html).toContain("var(--modulo-frota)");
    expect(html).toContain("var(--modulo-frota-suave)");
    expect(html).not.toContain("#");
  });
  it("o Início usa o azul de ação, e a Administração a cor de Cadastros", () => {
    expect(renderToStaticMarkup(<TelaEmBreve rota="/inicio/tarefas" />)).toContain("var(--acao)");
    expect(renderToStaticMarkup(<TelaEmBreve rota="/admin/auditoria" />)).toContain(
      "var(--modulo-cadastros)",
    );
  });
  it("o Acompanhamento lista os quatro modos que vai ter", () => {
    const html = renderToStaticMarkup(<TelaEmBreve rota="/frota/acompanhamento" />);
    expect(html).toContain("Grade, Agora, Censo e Mapa");
  });
  it("tela sem modos não fala de modos", () => {
    expect(renderToStaticMarkup(<TelaEmBreve rota="/frota/placas" />)).not.toContain("Modos");
  });
  it("funciona para todas as telas em breve do catálogo", () => {
    for (const tela of todasAsTelas().filter((t) => t.estado === "em-breve")) {
      const html = renderToStaticMarkup(<TelaEmBreve rota={tela.rota} />);
      expect(html, tela.id).toContain(tela.nome);
      expect(html, tela.id).toContain(tela.descricao);
    }
  });
  it("rota que não está no catálogo vira página não encontrada", () => {
    expect(() => renderToStaticMarkup(<TelaEmBreve rota="/nada" />)).toThrow();
  });
});

describe("metadataDaTela", () => {
  it("põe o nome da tela no título da aba", () => {
    expect(metadataDaTela("/frota/placas").title).toBe("Placas · TranSul Eixo");
    expect(metadataDaTela("/operacoes/lista").title).toBe("Operações · TranSul Eixo");
  });
  it("rota fora do catálogo dá erro, para não publicar página sem nome", () => {
    expect(() => metadataDaTela("/nada")).toThrow(/\/nada/);
  });
});
