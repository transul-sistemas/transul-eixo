import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { filtrarLegenda, montarLegenda } from "@/lib/dominio/legenda";
import { SIGLAS } from "@/lib/dominio/status";
import { FaixaDeLegenda, BotaoDaLegenda, ROTA_DA_LEGENDA } from "./faixa-de-legenda";
import { GruposDaLegenda, LegendaDaRegua, SemResultadoNaLegenda } from "./legenda-da-regua";
import { SiglaDoStatus } from "./sigla-do-status";
import { TonsDeVerde } from "./tons-de-verde";

vi.mock("next/link", () => ({
  default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

describe("<SiglaDoStatus>", () => {
  it("escreve a sigla e leva sigla e nome no aria-label (a cor só reforça)", () => {
    const html = renderToStaticMarkup(<SiglaDoStatus sigla="ACe" />);
    expect(html).toContain(">ACe</button>");
    expect(html).toContain('aria-label="ACe: Aguardando carregamento"');
  });
  it("começa sem balão e é um botão que o toque e o teclado alcançam", () => {
    const html = renderToStaticMarkup(<SiglaDoStatus sigla="FOg" />);
    expect(html).not.toContain('role="tooltip"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-expanded="false"');
  });
  it("usa só os tokens do tom, sem cor escrita à mão", () => {
    const html = renderToStaticMarkup(<SiglaDoStatus sigla="ETc" />);
    expect(html).toContain("var(--status-atividade-1)");
    expect(html).toContain("var(--status-atividade-1-texto)");
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
  it("o verde mais claro leva o contorno, para não sumir no fundo", () => {
    expect(renderToStaticMarkup(<SiglaDoStatus sigla="DOp" />)).toContain("inset 0 0 0 1.5px");
  });
  it.each(SIGLAS)("%s se escreve e tem nome", (sigla) => {
    const html = renderToStaticMarkup(<SiglaDoStatus sigla={sigla} />);
    expect(html).toContain(`>${sigla}</button>`);
  });
});

describe("a legenda na tela", () => {
  const legenda = montarLegenda();

  it("mostra as 25 siglas, cada uma com nome e significado", () => {
    const html = renderToStaticMarkup(<GruposDaLegenda grupos={legenda} />);
    for (const sigla of SIGLAS) expect(html).toContain(`data-sigla-da-legenda="${sigla}"`);
    expect(html).toContain("Em trânsito carregado");
    expect(html).toContain("viajando com carga");
  });

  it("a busca estreita a lista: 'folga' deixa só a Folga", () => {
    const html = renderToStaticMarkup(<GruposDaLegenda grupos={filtrarLegenda(legenda, "folga")} />);
    expect(html).toContain('data-sigla-da-legenda="FOg"');
    expect(html).not.toContain('data-sigla-da-legenda="ETc"');
  });

  it("a busca inicial (da URL) já filtra a primeira pintura", () => {
    const html = renderToStaticMarkup(<LegendaDaRegua legenda={legenda} buscaInicial="ferias" />);
    expect(html).toContain('data-sigla-da-legenda="FEr"');
    expect(html).not.toContain('data-sigla-da-legenda="ETc"');
    expect(html).toContain("1 de 25 siglas");
    // com busca, os tons de verde saem da frente
    expect(html).not.toContain("data-tons-de-verde");
  });

  it("sem resultado, diz o que fazer e oferece limpar a busca", () => {
    const html = renderToStaticMarkup(<LegendaDaRegua legenda={legenda} buscaInicial="xyz" />);
    expect(html).toContain("Nenhuma sigla ou palavra encontrada com “xyz”");
    expect(html).toContain("Limpar a busca");
  });

  it("o estado vazio tem o botão de limpar", () => {
    const html = renderToStaticMarkup(<SemResultadoNaLegenda busca="abc" aoLimpar={() => {}} />);
    expect(html).toContain("Limpar a busca");
  });

  it("traz a busca, o botão de imprimir e o aviso de que a legenda é gerada", () => {
    const html = renderToStaticMarkup(<LegendaDaRegua legenda={legenda} />);
    expect(html).toContain("Buscar sigla ou palavra");
    expect(html).toContain("Imprimir ou salvar em PDF");
    expect(html).toContain("gerada da régua de status");
    expect(html).toContain("25 siglas");
    expect(html).toContain("data-tons-de-verde");
  });

  it("a barra de busca some na impressão", () => {
    expect(renderToStaticMarkup(<LegendaDaRegua legenda={legenda} />)).toContain("print:hidden");
  });

  it("não escreve cor à mão", () => {
    const html = renderToStaticMarkup(<LegendaDaRegua legenda={legenda} />);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe("tons de verde e faixa rápida", () => {
  it("os cinco verdes aparecem escritos com as siglas", () => {
    const html = renderToStaticMarkup(<TonsDeVerde />);
    expect(html).toContain("Tons de verde");
    expect(html).toContain("quanto mais escuro, mais perto de gerar receita");
    for (const n of [1, 2, 3, 4, 5]) expect(html).toContain(`data-tom-de-verde="atividade-${n}"`);
    expect(html).toContain("ACe ADe CAn");
  });

  it("a faixa rápida leva à legenda completa e escreve o nome de cada grupo", () => {
    const html = renderToStaticMarkup(<FaixaDeLegenda />);
    expect(html).toContain(`href="${ROTA_DA_LEGENDA}"`);
    for (const nome of ["Atenção", "Impedida", "Pátio", "Fora"]) expect(html).toContain(nome);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("o botão Legenda aponta para a tela da legenda", () => {
    const html = renderToStaticMarkup(<BotaoDaLegenda />);
    expect(html).toContain('href="/frota/acompanhamento/legenda"');
    expect(html).toContain("Legenda");
  });
});
