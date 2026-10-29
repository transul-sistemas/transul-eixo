import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarraDeConsulta } from "./barra-de-consulta";
import { FaixaDeKpis } from "./faixa-de-kpis";
import { PaginaDeLeitura } from "./pagina-de-leitura";

const CHIPS = [
  { id: "em-atividade", nome: "Em atividade", contagem: 812 },
  { id: "atencao", nome: "Atenção", contagem: 41 },
  { id: "fora", nome: "Fora" },
];

describe("<BarraDeConsulta>", () => {
  const render = (parametros = "", props = {}) =>
    renderToStaticMarkup(
      <BarraDeConsulta
        rotulo="Buscar placa"
        chips={CHIPS}
        parametros={new URLSearchParams(parametros)}
        {...props}
      />,
    );

  it("é uma região de busca, com campo de busca nomeado", () => {
    const html = render();
    expect(html).toContain('role="search"');
    expect(html).toContain('type="search"');
    expect(html).toContain('aria-label="Buscar placa"');
  });
  it("mostra os chips com a contagem ao lado, e sem contagem quando não há", () => {
    const html = render();
    expect(html).toMatch(/data-contagem="em-atividade"[^>]*>812</);
    expect(html).toMatch(/data-contagem="atencao"[^>]*>41</);
    expect(html).not.toContain('data-contagem="fora"');
    expect(html).toContain("Fora");
  });
  it("a contagem não usa formatação feita à mão", () => {
    expect(render()).not.toContain("toLocale");
  });
  it("o chip da URL aparece ligado, os outros desligados", () => {
    const html = render("chip=atencao");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
  });
  it("a busca da URL aparece no campo", () => {
    expect(render("q=abc1d23")).toContain('value="abc1d23"');
  });
  it("Limpar filtros só aparece quando há busca ou chip", () => {
    expect(render()).not.toContain("Limpar filtros");
    expect(render("q=a")).toContain("Limpar filtros");
    expect(render("chip=fora")).toContain("Limpar filtros");
  });
  it("Mais filtros e Visões salvas aparecem, desabilitados até a tabela existir", () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*(<[^>]+>)*[^<]*Mais filtros/);
    expect(html).toContain("Visões salvas");
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("não leva cor escrita à mão", () => {
    expect(render("chip=atencao")).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe("<FaixaDeKpis>", () => {
  const kpis = [
    { id: "placas", rotulo: "Placas ativas", valor: "983" },
    {
      id: "custo",
      rotulo: "Custo do mês",
      valor: "R$ 1.284.300,00",
      apoio: "3,1% acima do mês anterior",
    },
  ];
  it("é um grupo de indicadores, cada um com rótulo e valor", () => {
    const html = renderToStaticMarkup(<FaixaDeKpis kpis={kpis} />);
    expect(html).toContain('aria-label="Indicadores"');
    expect(html).toContain("Placas ativas");
    expect(html).toContain("983");
    expect(html).toContain("Custo do mês");
    expect(html).toContain("3,1% acima do mês anterior");
  });
  it("o valor usa algarismos de largura fixa", () => {
    expect(renderToStaticMarkup(<FaixaDeKpis kpis={kpis} />)).toContain("tabular-nums");
  });
  it("sem indicadores não desenha nada", () => {
    expect(renderToStaticMarkup(<FaixaDeKpis kpis={[]} />)).toBe("");
  });
  it("aceita um componente como valor, como a moeda", () => {
    const html = renderToStaticMarkup(
      <FaixaDeKpis kpis={[{ id: "x", rotulo: "Total", valor: <strong>R$ 1,00</strong> }]} />,
    );
    expect(html).toContain("<strong>R$ 1,00</strong>");
  });
});

describe("<PaginaDeLeitura>", () => {
  const completa = renderToStaticMarkup(
    <PaginaDeLeitura
      titulo="Placas"
      descricao="Todas as placas da frota."
      acoes={<button>Receber placa</button>}
      consulta={<p>CONSULTA</p>}
      kpis={<p>INDICADORES</p>}
    >
      <p>CONTEUDO</p>
    </PaginaDeLeitura>,
  );

  it("tem o título como único h1, com a descrição", () => {
    expect(completa.match(/<h1/g)).toHaveLength(1);
    expect(completa).toContain("Placas");
    expect(completa).toContain("Todas as placas da frota.");
  });
  it("segue a ordem do esqueleto de leitura: título e ações, consulta, KPIs, conteúdo", () => {
    const ordem = ["Placas</h1>", "Receber placa", "CONSULTA", "INDICADORES", "CONTEUDO"].map((t) =>
      completa.indexOf(t),
    );
    expect(ordem.every((i) => i >= 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });
  it("as ações ficam num grupo com nome", () => {
    expect(completa).toContain('aria-label="Ações"');
  });
  it("sem ações, consulta ou KPIs, esses espaços não existem", () => {
    const simples = renderToStaticMarkup(
      <PaginaDeLeitura titulo="Só título">
        <p>CONTEUDO</p>
      </PaginaDeLeitura>,
    );
    expect(simples).not.toContain('aria-label="Ações"');
    expect(simples).toContain("CONTEUDO");
    expect(simples).toContain("Só título");
  });
});
