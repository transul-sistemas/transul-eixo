import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CelulaDaPlaca } from "./celula-da-placa";

describe("<CelulaDaPlaca>: a placa leva à ficha e o olho espia", () => {
  const com = (densidade: "compacta" | "confortavel") =>
    renderToStaticMarkup(
      <CelulaDaPlaca
        placa="AAA0A00"
        densidade={densidade}
        aoAbrir={() => {}}
        hrefDaFicha="/frota/placas/AAA0A00"
        aoIrParaAFicha={() => {}}
      />,
    );

  it("a mini placa é um link para a ficha, com nome e marca para o foco voltar a ele", () => {
    const html = com("compacta");
    expect(html).toMatch(/<a[^>]*href="\/frota\/placas\/AAA0A00"/);
    expect(html).toContain('aria-label="Abrir ficha de AAA0A00"');
    expect(html).toContain('data-ficha-placa="AAA0A00"');
    expect(html).toContain('aria-label="Placa AAA0A00"');
  });

  it("o botão Espiar continua, ao lado, com o nome Espiar AAA0A00 e a marca do painel", () => {
    const html = com("compacta");
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toContain('aria-label="Espiar AAA0A00"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('data-espiar-placa="AAA0A00"');
  });

  it("o link vem antes do botão na ordem do teclado, e o botão tem o ícone, não a mini placa", () => {
    const html = com("compacta");
    expect(html.indexOf("<a ")).toBeLessThan(html.indexOf("<button"));
    const botao = /<button[\s\S]*?<\/button>/.exec(html)?.[0] ?? "";
    expect(botao).not.toContain('role="img"');
    expect(botao).toContain("<svg");
  });

  it("a mini placa é menor na densidade compacta e média na confortável", () => {
    expect(com("compacta")).toContain("text-xs");
    expect(com("confortavel")).toContain("text-sm");
  });

  it("o link da mini placa tem largura fixa por densidade, para os olhos de espiar alinharem", () => {
    expect(com("compacta")).toMatch(/<a[^>]*class="[^"]*w-20/);
    expect(com("confortavel")).toMatch(/<a[^>]*class="[^"]*w-24/);
    expect(com("compacta")).not.toMatch(/<a[^>]*class="[^"]*min-w-/);
  });

  it("o link e o botão têm alvo de pelo menos 24 px", () => {
    const html = com("compacta");
    expect(html).toMatch(/<a[^>]*class="[^"]*min-h-6/);
    expect(html).toMatch(/<button[^>]*class="[^"]*size-6/);
  });

  it("sem os dois (fora de uma lista), é só a mini placa, sem link e sem botão", () => {
    const html = renderToStaticMarkup(<CelulaDaPlaca placa="AAA0A00" densidade="compacta" />);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a ");
    expect(html).toContain('aria-label="Placa AAA0A00"');
  });

  it("só com a ficha (sem painel), mostra o link e não o botão", () => {
    const html = renderToStaticMarkup(
      <CelulaDaPlaca placa="AAA0A00" densidade="compacta" hrefDaFicha="/frota/placas/AAA0A00" />,
    );
    expect(html).toContain("<a ");
    expect(html).not.toContain("<button");
  });
});
