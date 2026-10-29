import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarraDeConsulta } from "@/components/layout/barra-de-consulta";
import { EsqueletoDaTabela, ErroDeCarregamento, ListaVazia } from "./estados";

describe("<ListaVazia>", () => {
  it("com filtros: diz o que houve e oferece limpar", () => {
    const html = renderToStaticMarkup(
      <ListaVazia
        titulo="Nenhuma placa encontrada"
        descricao="Nenhuma placa combina com a busca e os filtros. Tire um filtro ou limpe tudo."
        hrefLimpar="/frota/placas?periodo=2026-10"
      />,
    );
    expect(html).toContain('data-testid="lista-vazia"');
    expect(html).toContain("Nenhuma placa encontrada");
    expect(html).toMatch(/<a[^>]*href="\/frota\/placas\?periodo=2026-10"[^>]*>Limpar filtros<\/a>/);
  });
  it("sem filtros: só informa, sem botão que não leva a lugar nenhum", () => {
    const html = renderToStaticMarkup(
      <ListaVazia titulo="Ainda não há placas" descricao="Quando houver, elas aparecem aqui." />,
    );
    expect(html).toContain("Ainda não há placas");
    expect(html).not.toContain("Limpar filtros");
  });
});

describe("<ErroDeCarregamento>", () => {
  const html = renderToStaticMarkup(
    <ErroDeCarregamento
      titulo="Não foi possível carregar as placas"
      descricao="A lista não respondeu. Confira a conexão e tente de novo."
      codigo="abc123"
      aoTentar={() => {}}
    />,
  );
  it("é um alerta, diz o que houve e como resolver", () => {
    expect(html).toContain('role="alert"');
    expect(html).toContain("Não foi possível carregar as placas");
    expect(html).toContain("Confira a conexão");
  });
  it("tem o botão Tentar de novo e o código do erro para quem for dar suporte", () => {
    expect(html).toMatch(/<button[^>]*>Tentar de novo<\/button>/);
    expect(html).toContain("abc123");
  });
  it("não pede desculpas", () => {
    expect(html.toLowerCase()).not.toContain("desculp");
    expect(html.toLowerCase()).not.toContain("ops");
  });
});

describe("<EsqueletoDaTabela>", () => {
  it("é um status com nome, para leitor de tela", () => {
    const html = renderToStaticMarkup(<EsqueletoDaTabela rotulo="Carregando placas" linhas={3} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Carregando placas"');
  });
});

describe("chips com contagem zero", () => {
  const chips = [
    { id: "a", nome: "Com itens", contagem: 5 },
    { id: "b", nome: "Sem itens", contagem: 0 },
    { id: "c", nome: "Sem contagem" },
  ];
  const html = renderToStaticMarkup(
    <BarraDeConsulta rotulo="Buscar" chips={chips} parametros={new URLSearchParams("chip=b")} />,
  );
  const chip = (nome: string) =>
    new RegExp(`<button[^>]*>(?:(?!</button>)[\\s\\S])*${nome}[\\s\\S]*?</button>`).exec(
      html,
    )?.[0] ?? "";

  it("o chip zerado e desligado fica apagado, mas continua clicável", () => {
    const htmlSemSelecao = renderToStaticMarkup(
      <BarraDeConsulta rotulo="Buscar" chips={chips} parametros={new URLSearchParams()} />,
    );
    const zerado = new RegExp(
      "<button[^>]*>(?:(?!</button>)[\\s\\S])*Sem itens[\\s\\S]*?</button>",
    ).exec(htmlSemSelecao)?.[0];
    expect(zerado).toContain('data-zerado="true"');
    expect(zerado).not.toContain("disabled");
  });
  it("o chip zerado que está ligado continua normal, para dar para desligar", () => {
    expect(chip("Sem itens")).toContain('aria-pressed="true"');
    expect(chip("Sem itens")).not.toContain('data-zerado="true"');
  });
  it("chip com itens ou sem contagem não é apagado", () => {
    expect(chip("Com itens")).not.toContain("data-zerado");
    expect(chip("Sem contagem")).not.toContain("data-zerado");
  });
});

// O atributo `disabled`, não a palavra: as classes do botão têm "disabled:" (variantes do Tailwind).
const desligado = (trecho: string | undefined) => /\sdisabled(?:=""|[\s>])/.test(trecho ?? "");
const botaoDe = (html: string, texto: string) =>
  new RegExp(`<button[^>]*>(?:(?!</button>)[\\s\\S])*${texto}[\\s\\S]*?</button>`).exec(html)?.[0];

describe("barra de consulta ocupada (carregando)", () => {
  const chips = [{ id: "a", nome: "Primeiro", contagem: 3 }];
  it("desliga os chips e o Limpar filtros enquanto a transição não termina", () => {
    const html = renderToStaticMarkup(
      <BarraDeConsulta
        rotulo="Buscar"
        chips={chips}
        parametros={new URLSearchParams("chip=a")}
        ocupada
      />,
    );
    expect(desligado(botaoDe(html, "Primeiro"))).toBe(true);
    expect(desligado(botaoDe(html, "Limpar filtros"))).toBe(true);
  });
  it("a busca continua aceitando digitação (a última resposta é a que vale)", () => {
    const html = renderToStaticMarkup(
      <BarraDeConsulta rotulo="Buscar" chips={chips} parametros={new URLSearchParams()} ocupada />,
    );
    expect(html).toMatch(/<input[^>]*type="search"/);
    expect(/<input[^>]*disabled/.test(html)).toBe(false);
  });
  it("sem estar ocupada, nada é desligado", () => {
    const html = renderToStaticMarkup(
      <BarraDeConsulta rotulo="Buscar" chips={chips} parametros={new URLSearchParams("chip=a")} />,
    );
    expect(desligado(botaoDe(html, "Primeiro"))).toBe(false);
    expect(desligado(botaoDe(html, "Limpar filtros"))).toBe(false);
  });
});
