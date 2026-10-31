import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TelaEmBreve } from "@/components/navegacao/tela-em-breve";
import { AbaEmBreve } from "./aba-em-breve";

const html = renderToStaticMarkup(
  <AbaEmBreve
    nome="Documentos"
    descricao="Guarda o CRLV, o seguro e os demais documentos da placa."
    modulo="frota"
  />,
);

describe("<AbaEmBreve>", () => {
  it("diz o que a aba fará e que ela entra em breve, em texto", () => {
    expect(html).toContain("Documentos");
    expect(html).toContain("Guarda o CRLV, o seguro e os demais documentos da placa.");
    expect(html).toContain("Esta aba entra em breve.");
    expect(html).toContain('role="status"');
  });

  it("não usa título de primeiro nível (a ficha já tem o seu) e mantém a ordem de títulos", () => {
    expect(html).not.toMatch(/<h1[ >]/);
    expect(html).toMatch(/<h3[ >]/);
  });

  it("a cor é a do módulo (onde a pessoa está), por variável, sem hex", () => {
    expect(html).toContain("--modulo-frota");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("a tela inteira 'Em breve' continua igual (a parte visual foi extraída)", () => {
  it("segue com o título de primeiro nível, a faixa do módulo e o aviso", () => {
    const tela = renderToStaticMarkup(<TelaEmBreve rota="/frota/abastecimento" />);
    expect(tela).toMatch(/<h1[^>]*>Abastecimento<\/h1>/);
    expect(tela).toContain("Esta tela entra em breve.");
    expect(tela).toContain("--modulo-frota");
  });
});
