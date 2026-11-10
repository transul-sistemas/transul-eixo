import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CartaoDeKpi } from "./cartao-de-kpi";
import { FaixaDeKpis } from "./faixa-de-kpis";
import { linhasFecham } from "./grade-de-paineis";
import { PainelDeGrafico } from "./painel-de-grafico";

describe("<CartaoDeKpi>: variação contra o período anterior", () => {
  it("subida de receita é neutra; seta e percentual aparecem", () => {
    const html = renderToStaticMarkup(
      <CartaoDeKpi
        rotulo="Receita"
        valor="R$ 1,00"
        variacao={{ pontos: 12.34, contra: "o mês anterior" }}
      />,
    );
    expect(html).toContain('data-variacao="subiu"');
    expect(html).toContain("12,3%");
    expect(html).toContain("o mês anterior");
    expect(html).not.toContain("text-texto-negativo");
  });
  it("custo que sobe é ruim (tom negativo); custo que cai não", () => {
    const sobe = renderToStaticMarkup(
      <CartaoDeKpi rotulo="Custo" valor="x" variacao={{ pontos: 5, bomQuando: "cair" }} />,
    );
    const cai = renderToStaticMarkup(
      <CartaoDeKpi rotulo="Custo" valor="x" variacao={{ pontos: -5, bomQuando: "cair" }} />,
    );
    expect(sobe).toContain("text-texto-negativo");
    expect(cai).not.toContain("text-texto-negativo");
  });
  it("sem base de comparação não inventa número", () => {
    const html = renderToStaticMarkup(
      <CartaoDeKpi rotulo="Receita" valor="x" variacao={{ pontos: null }} />,
    );
    expect(html).toContain("Sem base para comparar");
    expect(html).not.toContain("%");
  });
  it("sem fonte mostra o texto 'Sem dados ainda' e nenhum valor nem variação", () => {
    const html = renderToStaticMarkup(
      <CartaoDeKpi
        rotulo="Receita"
        valor="R$ 0,00"
        semDados="Sem dados ainda: depende da ponte do Sankhya"
        variacao={{ pontos: 3 }}
      />,
    );
    expect(html).toContain("Sem dados ainda: depende da ponte do Sankhya");
    expect(html).not.toContain("R$ 0,00");
    expect(html).not.toContain("data-variacao");
  });
});

describe("<FaixaDeKpis>", () => {
  it("usa o cartão padrão e não desenha nada sem indicadores", () => {
    expect(renderToStaticMarkup(<FaixaDeKpis kpis={[]} />)).toBe("");
    const html = renderToStaticMarkup(
      <FaixaDeKpis kpis={[{ id: "a", rotulo: "Placas", valor: "3" }]} />,
    );
    expect(html).toContain("Placas");
  });
});

describe("<PainelDeGrafico>: estados", () => {
  it("vazio explica a falta de fonte; erro avisa; carregando tem status", () => {
    expect(
      renderToStaticMarkup(
        <PainelDeGrafico titulo="T" estado="vazio" textoVazio="Sem dados ainda: x" />,
      ),
    ).toContain("Sem dados ainda: x");
    expect(renderToStaticMarkup(<PainelDeGrafico titulo="T" estado="erro" />)).toContain(
      'role="alert"',
    );
    expect(renderToStaticMarkup(<PainelDeGrafico titulo="T" estado="carregando" />)).toContain(
      'role="status"',
    );
  });
  it("ok mostra o conteúdo", () => {
    expect(renderToStaticMarkup(<PainelDeGrafico titulo="T">corpo</PainelDeGrafico>)).toContain(
      "corpo",
    );
  });
});

describe("GradeDePaineis: cada linha fecha em 12 colunas", () => {
  it("aceita 8+4, 6+6, 4+4+4 e 12", () => {
    expect(linhasFecham([8, 4])).toBe(true);
    expect(linhasFecham([6, 6, 12])).toBe(true);
    expect(linhasFecham([4, 4, 4])).toBe(true);
    expect(linhasFecham([5, 7])).toBe(true);
  });
  it("recusa o cartão de um terço com o resto vazio", () => {
    expect(linhasFecham([4])).toBe(false);
    expect(linhasFecham([8, 6])).toBe(false);
  });
});
