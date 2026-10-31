import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contraste, distancia, misturar } from "./contraste";

// Os chips selecionados dos dois grupos de filtro da lista, nos dois temas: o texto precisa passar de
// 4,5:1 sobre o fundo da seleção e o contorno e a barra lateral de 3:1 sobre a superfície.

const css = readFileSync("app/tokens.css", "utf-8");

function valor(seletor: string, nome: string): string {
  const inicio = css.indexOf(`${seletor} {`);
  const fim = css.indexOf("}", inicio);
  const corpo = css.slice(inicio, fim);
  const achado = new RegExp(`${nome}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(corpo);
  if (!achado?.[1]) throw new Error(`${nome} não encontrado em ${seletor}`);
  return achado[1];
}

/** O `--acao-suave` é um `color-mix` da ação com a superfície: a proporção está no próprio token. */
function acaoSuave(seletor: string): string {
  const inicio = css.indexOf(`${seletor} {`);
  const corpo = css.slice(inicio, css.indexOf("}", inicio));
  const achado =
    /--acao-suave\s*:\s*color-mix\(in srgb,\s*var\(--acao\)\s*(\d+)%,\s*var\(--superficie\)\)/.exec(
      corpo,
    );
  if (!achado?.[1])
    throw new Error(`--acao-suave de ${seletor} não é um color-mix da ação com a superfície`);
  return misturar(
    valor(seletor, "--acao"),
    valor(seletor, "--superficie"),
    Number(achado[1]) / 100,
  );
}

describe.each([":root", ".dark"])("chips selecionados dos filtros rápidos em %s", (tema) => {
  it("Situação: o texto passa de 4,5:1 sobre o fundo azul claro da seleção", () => {
    expect(contraste(valor(tema, "--texto"), acaoSuave(tema))).toBeGreaterThanOrEqual(4.5);
  });
  it("Situação: a borda azul passa de 3:1 sobre a superfície (contorno de componente)", () => {
    expect(contraste(valor(tema, "--acao"), valor(tema, "--superficie"))).toBeGreaterThanOrEqual(3);
  });
  it("Situação: o fundo da seleção se distingue da superfície", () => {
    expect(distancia(acaoSuave(tema), valor(tema, "--superficie"))).toBeGreaterThan(3);
  });
  it("Tipo: o texto invertido passa de 4,5:1 sobre o fundo escuro da seleção", () => {
    // `bg-foreground text-background`: o fundo da seleção é a cor do texto do tema, e o texto, a do fundo.
    expect(contraste(valor(tema, "--fundo"), valor(tema, "--texto"))).toBeGreaterThanOrEqual(4.5);
  });
  it("Tipo: o fundo da seleção se distingue da superfície do chip sem seleção", () => {
    expect(distancia(valor(tema, "--texto"), valor(tema, "--superficie"))).toBeGreaterThan(30);
  });
  it("as duas seleções são bem diferentes entre si (não se confundem à vista rápida)", () => {
    expect(distancia(acaoSuave(tema), valor(tema, "--texto"))).toBeGreaterThan(20);
  });
  it("as duas barras laterais (ação e texto) passam de 3:1 sobre a superfície", () => {
    expect(contraste(valor(tema, "--acao"), valor(tema, "--superficie"))).toBeGreaterThanOrEqual(3);
    expect(contraste(valor(tema, "--texto"), valor(tema, "--superficie"))).toBeGreaterThanOrEqual(
      3,
    );
  });
  it("a bolinha de cada status é decorativa e se distingue da superfície (o nome está sempre escrito no chip)", () => {
    // O âmbar de "Atenção" é o mais claro (2,2:1 sobre o branco): por isso a bolinha nunca é a única
    // informação. O chip traz o nome por extenso, como a Etiqueta de status já faz.
    for (const status of ["em-atividade", "atencao", "impedida", "patio", "fora"]) {
      expect(
        contraste(valor(tema, `--status-${status}`), valor(tema, "--superficie")),
        status,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});
