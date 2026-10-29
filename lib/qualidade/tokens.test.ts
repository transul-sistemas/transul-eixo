import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/tokens.css", "utf-8");

function bloco(seletor: string): Record<string, string> {
  const inicio = css.indexOf(`${seletor} {`);
  if (inicio < 0) return {};
  const fim = css.indexOf("}", inicio);
  const corpo = css.slice(css.indexOf("{", inicio) + 1, fim);
  const pares: Record<string, string> = {};
  for (const [, nome, valor] of corpo.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (nome && valor) pares[nome] = valor.trim();
  }
  return pares;
}

const claro = bloco(":root");
const escuro = bloco(".dark");

const modulos = [
  "frota",
  "operacional",
  "operacoes",
  "pessoas",
  "parceiros",
  "resultados",
  "cadastros",
];
const status = ["em-atividade", "atencao", "impedida", "patio", "fora"];

const nomes = [
  "--fundo",
  "--superficie",
  "--texto",
  "--texto-suave",
  "--linha",
  "--acao",
  "--acao-texto",
  "--marca-transul",
  "--placa-fundo",
  "--placa-texto",
  ...modulos.flatMap((m) => [`--modulo-${m}`, `--modulo-${m}-suave`]),
  ...status.flatMap((s) => [`--status-${s}`, `--status-${s}-suave`]),
];

describe("tokens do Eixo", () => {
  it("define 34 tokens por tema", () => {
    expect(nomes).toHaveLength(34);
  });
  it.each(nomes)("%s existe no tema claro e no escuro", (nome) => {
    expect(claro[nome], `${nome} no :root`).toBeTruthy();
    expect(escuro[nome], `${nome} no .dark`).toBeTruthy();
  });
});

describe("valores do tema claro (CLAUDE.md; Frota em índigo desde 29/10)", () => {
  const esperados: Record<string, string> = {
    "--modulo-frota": "#4338CA",
    "--modulo-operacional": "#FF7A3D",
    "--modulo-operacoes": "#7C5CFF",
    "--modulo-pessoas": "#E8508A",
    "--modulo-parceiros": "#13A8A4",
    "--modulo-resultados": "#1FA971",
    "--modulo-cadastros": "#64748B",
    "--status-em-atividade": "#22A06B",
    "--status-atencao": "#E8A317",
    "--status-impedida": "#E5484D",
    "--status-patio": "#2E9BEA",
    "--status-fora": "#8A94A6",
    "--fundo": "#F6F7FB",
    "--superficie": "#FFFFFF",
    "--texto": "#0F1729",
    "--linha": "#ECEEF4",
    "--acao": "#3355FF",
    "--marca-transul": "#151F6D",
    "--placa-fundo": "#FFFFFF",
    "--placa-texto": "#0F1729",
  };
  it.each(Object.entries(esperados))("%s = %s", (nome, valor) => {
    expect(claro[nome]?.toUpperCase()).toBe(valor);
  });
});

describe("a placa de veículo é clara nos dois temas", () => {
  it.each(["--placa-fundo", "--placa-texto"])("%s é igual no claro e no escuro", (nome) => {
    expect(escuro[nome]?.toUpperCase()).toBe(claro[nome]?.toUpperCase());
  });
});

describe("mesma intensidade nos dois temas", () => {
  const fortes = [...modulos.map((m) => `--modulo-${m}`), ...status.map((s) => `--status-${s}`)];
  it.each(fortes)("%s tem a mesma cor forte no claro e no escuro", (nome) => {
    expect(escuro[nome]?.toUpperCase()).toBe(claro[nome]?.toUpperCase());
  });
});
