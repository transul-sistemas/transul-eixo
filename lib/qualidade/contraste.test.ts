import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contraste, distancia, misturar } from "./contraste";

const css = readFileSync("app/tokens.css", "utf-8");

function valor(seletor: string, nome: string): string {
  const inicio = css.indexOf(`${seletor} {`);
  const fim = css.indexOf("}", inicio);
  const achado = css.slice(inicio, fim).match(new RegExp(`${nome}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!achado?.[1]) throw new Error(`${nome} não encontrado em ${seletor}`);
  return achado[1];
}

describe("contraste", () => {
  it("preto sobre branco é 21", () => {
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });
  it("é simétrico", () => {
    expect(contraste("#3355FF", "#FFFFFF")).toBeCloseTo(contraste("#FFFFFF", "#3355FF"), 5);
  });
});

describe.each([":root", ".dark"])("contraste mínimo de 4,5:1 em %s", (seletor) => {
  it("texto sobre o fundo", () => {
    expect(contraste(valor(seletor, "--texto"), valor(seletor, "--fundo"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });
  it("texto sobre a superfície", () => {
    expect(
      contraste(valor(seletor, "--texto"), valor(seletor, "--superficie")),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it("texto suave sobre a superfície", () => {
    expect(
      contraste(valor(seletor, "--texto-suave"), valor(seletor, "--superficie")),
    ).toBeGreaterThanOrEqual(4.5);
  });
  it("texto do botão sobre o azul de ação", () => {
    expect(
      contraste(valor(seletor, "--acao-texto"), valor(seletor, "--acao")),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

// Regra de texto: a cor forte serve de bolinha, ícone e faixa. Texto branco sobre cor forte
// (cabeçalho colorido) só onde o contraste passa; nas demais, o cabeçalho usa --texto.
describe("texto branco sobre cor forte (cabeçalho colorido)", () => {
  const passa: Record<string, boolean> = {
    "--modulo-frota": true,
    "--modulo-operacional": false,
    "--modulo-operacoes": false,
    "--modulo-pessoas": false,
    "--modulo-parceiros": false,
    "--modulo-resultados": false,
    "--modulo-cadastros": true,
    "--status-em-atividade": false,
    "--status-atencao": false,
    "--status-impedida": false,
    "--status-patio": false,
    "--status-fora": false,
  };
  it.each(Object.entries(passa))("%s: branco passa em 4,5:1 = %s", (nome, esperado) => {
    expect(contraste("#FFFFFF", valor(":root", nome)) >= 4.5).toBe(esperado);
  });
});

describe("a Frota não se confunde com o azul de ação", () => {
  it("a cor da Frota está longe da cor de ação", () => {
    expect(distancia(valor(":root", "--modulo-frota"), valor(":root", "--acao"))).toBeGreaterThan(
      9,
    );
  });
  it("a cor da Frota está longe da cor de Operações", () => {
    expect(
      distancia(valor(":root", "--modulo-frota"), valor(":root", "--modulo-operacoes")),
    ).toBeGreaterThan(9);
  });
});

describe("cor forte visível sobre a superfície escura (mínimo de 3:1)", () => {
  const fortes = [
    "--acao",
    "--modulo-frota",
    "--modulo-operacional",
    "--modulo-operacoes",
    "--modulo-pessoas",
    "--modulo-parceiros",
    "--modulo-resultados",
    "--modulo-cadastros",
    "--status-em-atividade",
    "--status-atencao",
    "--status-impedida",
    "--status-patio",
    "--status-fora",
  ];
  it.each(fortes)("%s", (nome) => {
    expect(contraste(valor(".dark", nome), valor(".dark", "--superficie"))).toBeGreaterThanOrEqual(
      3,
    );
  });
});

describe("no tema escuro a Frota continua distinta da ação e de Operações", () => {
  it("longe do azul de ação", () => {
    expect(distancia(valor(".dark", "--modulo-frota"), valor(".dark", "--acao"))).toBeGreaterThan(
      7,
    );
  });
  it("longe de Operações", () => {
    expect(
      distancia(valor(".dark", "--modulo-frota"), valor(".dark", "--modulo-operacoes")),
    ).toBeGreaterThan(7);
  });
});

describe("misturar", () => {
  it("mistura meio a meio e respeita os extremos", () => {
    expect(misturar("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(misturar("#3355FF", "#FFFFFF", 1)).toBe("#3355FF");
    expect(misturar("#3355FF", "#FFFFFF", 0)).toBe("#FFFFFF");
  });
});

describe.each([":root", ".dark"])("texto vermelho do valor negativo em %s", (seletor) => {
  const negativo = () => valor(seletor, "--texto-negativo");
  it("tem 4,5:1 sobre o fundo e sobre a superfície", () => {
    expect(contraste(negativo(), valor(seletor, "--fundo"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(negativo(), valor(seletor, "--superficie"))).toBeGreaterThanOrEqual(4.5);
  });
  it("tem 4,5:1 sobre o próprio fundo avermelhado (botão de excluir)", () => {
    const tinta = misturar(negativo(), valor(seletor, "--superficie"), 0.2);
    expect(contraste(negativo(), tinta)).toBeGreaterThanOrEqual(4.5);
  });
});

// A etiqueta usa --texto sobre o fundo suave: 14% da cor forte no claro e 22% no escuro.
describe.each([
  [":root", 0.14],
  [".dark", 0.22],
])("texto da etiqueta sobre os fundos suaves em %s", (seletor, proporcao) => {
  const fortes = [
    "--acao",
    "--modulo-frota",
    "--modulo-operacional",
    "--modulo-operacoes",
    "--modulo-pessoas",
    "--modulo-parceiros",
    "--modulo-resultados",
    "--modulo-cadastros",
    "--status-em-atividade",
    "--status-atencao",
    "--status-impedida",
    "--status-patio",
    "--status-fora",
  ];
  it.each(fortes)("%s", (nome) => {
    const suave = misturar(valor(seletor, nome), valor(seletor, "--superficie"), proporcao);
    expect(contraste(valor(seletor, "--texto"), suave)).toBeGreaterThanOrEqual(4.5);
  });
});
