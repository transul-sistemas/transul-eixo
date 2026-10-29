import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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

describe("chips em grupos com rótulo", () => {
  const chips = [
    { id: "a", nome: "Primeiro", contagem: 1, grupo: "Situação" },
    { id: "b", nome: "Segundo", contagem: 2, grupo: "Situação" },
    { id: "c", nome: "Terceiro", contagem: 3, grupo: "Tipo" },
  ];
  const html = renderToStaticMarkup(
    <BarraDeConsulta rotulo="Buscar" chips={chips} parametros={new URLSearchParams()} />,
  );

  it("cada grupo é um grupo nomeado, com o rótulo visível", () => {
    expect(html).toMatch(/role="group"[^>]*aria-label="Situação"/);
    expect(html).toMatch(/role="group"[^>]*aria-label="Tipo"/);
    expect(html).toMatch(/<span[^>]*>Situação<\/span>/);
    expect(html).toMatch(/<span[^>]*>Tipo<\/span>/);
  });
  it("os chips ficam dentro do grupo certo", () => {
    const iSituacao = html.indexOf('aria-label="Situação"');
    const iTipo = html.indexOf('aria-label="Tipo"');
    expect(iSituacao).toBeLessThan(html.indexOf("Primeiro"));
    expect(html.indexOf("Segundo")).toBeLessThan(iTipo);
    expect(iTipo).toBeLessThan(html.indexOf("Terceiro"));
  });
  it("o grupo não quebra por dentro (a quebra é entre os grupos), e o conjunto quebra", () => {
    const grupo =
      /<div[^>]*aria-label="Situação"[^>]*class="([^"]*)"|<div[^>]*class="([^"]*)"[^>]*aria-label="Situação"/.exec(
        html,
      );
    const classes = grupo?.[1] ?? grupo?.[2] ?? "";
    expect(classes).toContain("sm:flex-nowrap");
    expect(html).toMatch(/aria-label="Filtros rápidos"[^>]*class="[^"]*flex-wrap/);
  });
  it("sem grupos (como na demonstração) não aparece rótulo nenhum", () => {
    const semGrupo = renderToStaticMarkup(
      <BarraDeConsulta
        rotulo="Buscar"
        chips={[{ id: "a", nome: "Primeiro", contagem: 1 }]}
        parametros={new URLSearchParams()}
      />,
    );
    expect(semGrupo).not.toMatch(/aria-label="Situação"|aria-label="Tipo"/);
    expect(semGrupo).toContain("Primeiro");
  });
});

describe("barra de consulta: a busca e as ações na mesma linha, os chips embaixo", () => {
  const chips = [
    { id: "a", nome: "Primeiro", contagem: 1, grupo: "Situação" },
    { id: "c", nome: "Terceiro", contagem: 3, grupo: "Tipo" },
  ];
  const html = renderToStaticMarkup(
    <BarraDeConsulta rotulo="Buscar" chips={chips} parametros={new URLSearchParams()} />,
  );
  it("na ordem do HTML (que é a da tela): busca, Mais filtros, Visões salvas, e só então os chips", () => {
    const busca = html.indexOf('type="search"');
    const mais = html.indexOf("Mais filtros");
    const visoes = html.indexOf("Visões salvas");
    const filtros = html.indexOf('aria-label="Filtros rápidos"');
    expect(busca).toBeGreaterThan(-1);
    expect(busca).toBeLessThan(mais);
    expect(mais).toBeLessThan(visoes);
    expect(visoes).toBeLessThan(filtros);
  });
  it("os chips ocupam a linha toda, abaixo da busca", () => {
    expect(html).toMatch(/aria-label="Filtros rápidos"[^>]*class="[^"]*w-full/);
  });
  it("as ações ficam à direita da linha da busca", () => {
    expect(html).toMatch(/<div class="[^"]*ml-auto[^"]*">(?:(?!<\/div>)[\s\S])*Mais filtros/);
  });
});

describe("barra de consulta: sem avisos do React (chaves, props)", () => {
  const renderizar = (chips: { id: string; nome: string; contagem?: number; grupo?: string }[]) => {
    const erros = vi.spyOn(console, "error").mockImplementation(() => {});
    renderToStaticMarkup(
      <BarraDeConsulta rotulo="Buscar" chips={chips} parametros={new URLSearchParams()} />,
    );
    const chamadas = erros.mock.calls.map((c) => String(c[0]));
    erros.mockRestore();
    return chamadas;
  };
  it("com grupos, cada chip tem a sua chave", () => {
    expect(
      renderizar([
        { id: "a", nome: "A", contagem: 1, grupo: "Situação" },
        { id: "b", nome: "B", contagem: 1, grupo: "Situação" },
        { id: "c", nome: "C", contagem: 1, grupo: "Tipo" },
      ]),
    ).toEqual([]);
  });
  it("sem grupos, também", () => {
    expect(
      renderizar([
        { id: "a", nome: "A" },
        { id: "b", nome: "B" },
      ]),
    ).toEqual([]);
  });
});

describe("barra de consulta: Mais filtros, filtros extras e dica dos chips", () => {
  const chips = [{ id: "a", nome: "Primeiro", contagem: 1, dica: "Primeiro: A Alfa, B Beta." }];

  it("com o painel no lugar, ele aparece e some o botão desligado", () => {
    const html = renderToStaticMarkup(
      <BarraDeConsulta
        rotulo="Buscar"
        chips={chips}
        parametros={new URLSearchParams()}
        maisFiltros={<span data-teste="painel">Painel de filtros</span>}
      />,
    );
    expect(html).toContain('data-teste="painel"');
    expect(html).not.toMatch(/<button[^>]*>Mais filtros<\/button>/);
  });
  it("sem o painel (como na demonstração), o botão continua desligado", () => {
    const html = renderToStaticMarkup(
      <BarraDeConsulta rotulo="Buscar" chips={chips} parametros={new URLSearchParams()} />,
    );
    expect(html).toMatch(/<button[^>]*>Mais filtros<\/button>/);
  });
  it("Visões salvas segue desligado, com a dica da próxima entrega", () => {
    const html = renderToStaticMarkup(
      <BarraDeConsulta
        rotulo="Buscar"
        chips={chips}
        parametros={new URLSearchParams()}
        maisFiltros={<span>Painel</span>}
      />,
    );
    expect(html).toMatch(
      /<button[^>]*title="Entra na próxima entrega"[^>]*>Visões salvas<\/button>/,
    );
  });
  it("filtro extra na URL conta como consulta ativa: Limpar filtros aparece", () => {
    const comExtra = renderToStaticMarkup(
      <BarraDeConsulta
        rotulo="Buscar"
        chips={chips}
        parametros={new URLSearchParams("sigla=PÁT")}
        filtrosExtras={["sigla", "baixadas"]}
      />,
    );
    expect(comExtra).toContain("Limpar filtros");
    const semExtra = renderToStaticMarkup(
      <BarraDeConsulta
        rotulo="Buscar"
        chips={chips}
        parametros={new URLSearchParams()}
        filtrosExtras={["sigla", "baixadas"]}
      />,
    );
    expect(semExtra).not.toContain("Limpar filtros");
  });
  it("sem declarar os extras, um parâmetro alheio não vira filtro", () => {
    const html = renderToStaticMarkup(
      <BarraDeConsulta
        rotulo="Buscar"
        chips={chips}
        parametros={new URLSearchParams("sigla=PÁT")}
      />,
    );
    expect(html).not.toContain("Limpar filtros");
  });
  it("a dica do chip vira tooltip", () => {
    const html = renderToStaticMarkup(
      <BarraDeConsulta rotulo="Buscar" chips={chips} parametros={new URLSearchParams()} />,
    );
    expect(html).toMatch(/<button[^>]*title="Primeiro: A Alfa, B Beta\."/);
  });
});
