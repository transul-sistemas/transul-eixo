import { ESLint } from "eslint";
import stylelint from "stylelint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ overrideConfigFile: "eslint.config.mjs" });

async function lintar(codigo: string, caminho = "app/teste.tsx"): Promise<string[]> {
  const [resultado] = await eslint.lintText(codigo, { filePath: caminho });
  return (resultado?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.message);
}

async function lintarCss(codigo: string, caminho: string): Promise<string[]> {
  const resultado = await stylelint.lint({ code: codigo, codeFilename: caminho });
  return resultado.results.flatMap((r) => r.warnings.map((w) => w.text));
}

describe("ESLint: cor hexadecimal", () => {
  it("barra hex de 6 dígitos em maiúscula", async () => {
    expect(await lintar('const c = "#FF7A3D";')).toHaveLength(1);
  });
  it("barra hex de 3 dígitos", async () => {
    expect(await lintar('const c = "#fff";')).toHaveLength(1);
  });
  it("barra hex em template literal", async () => {
    expect(await lintar("const c = `#3D5AFE`;")).toHaveLength(1);
  });
  it("não barra texto comum com #", async () => {
    expect(await lintar('const t = "Item #12";')).toHaveLength(0);
  });
  it("não barra número de pedido com # (só dígitos)", async () => {
    expect(await lintar('const t = "Pedido #1234";')).toHaveLength(0);
  });
});

describe("ESLint: cor hexadecimal embutida em texto maior", () => {
  it("barra valor arbitrário do Tailwind", async () => {
    expect(await lintar('const c = "bg-[#FF7A3D] p-2";')).toHaveLength(1);
  });
  it("barra hex depois de dois-pontos (CSS em texto)", async () => {
    expect(await lintar('const c = "color:#fff";')).toHaveLength(1);
  });
  it("barra hex depois de palavra e espaço", async () => {
    expect(await lintar('const c = "1px solid #fff";')).toHaveLength(1);
  });
  it("barra hex dentro de função CSS", async () => {
    expect(await lintar('const c = "linear-gradient(#fff, #000)";')).toHaveLength(1);
  });
  it("barra hex embutido em template literal", async () => {
    expect(await lintar("const c = `color: #3D5AFE;`;")).toHaveLength(1);
  });
  it("permite hex embutido em components/formato/", async () => {
    expect(await lintar('const c = "bg-[#FF7A3D]";', "components/formato/cor.ts")).toHaveLength(0);
  });
});

describe("ESLint: formatação de número", () => {
  it("barra toLocaleString", async () => {
    expect(await lintar('n.toLocaleString("pt-BR");')).toHaveLength(1);
  });
  it("barra toLocaleString com encadeamento opcional", async () => {
    expect(await lintar("n?.toLocaleString();")).toHaveLength(1);
  });
  it("barra new Intl.NumberFormat", async () => {
    expect(await lintar('new Intl.NumberFormat("pt-BR");')).toHaveLength(1);
  });
  it("barra Intl.NumberFormat sem new", async () => {
    expect(await lintar('Intl.NumberFormat("pt-BR");')).toHaveLength(1);
  });
});

describe("ESLint: outras formas de formatar à mão", () => {
  it("barra toLocaleDateString e toLocaleTimeString", async () => {
    expect(await lintar("d.toLocaleDateString();")).toHaveLength(1);
    expect(await lintar("d.toLocaleTimeString();")).toHaveLength(1);
  });
  it("barra Intl.DateTimeFormat, com e sem new", async () => {
    expect(await lintar('new Intl.DateTimeFormat("pt-BR");')).toHaveLength(1);
    expect(await lintar('Intl.DateTimeFormat("pt-BR");')).toHaveLength(1);
  });
  it("barra Intl usado por apelido", async () => {
    expect(await lintar("const Formato = Intl.NumberFormat;")).toHaveLength(1);
  });
  it("barra toFixed", async () => {
    expect(await lintar("n.toFixed(2);")).toHaveLength(1);
  });
  it("não barra toLocaleLowerCase nem localeCompare", async () => {
    expect(await lintar("t.toLocaleLowerCase();")).toHaveLength(0);
    expect(await lintar("a.localeCompare(b);")).toHaveLength(0);
  });
  it("permite tudo isso em components/formato/", async () => {
    const caminho = "components/formato/data.ts";
    expect(await lintar("d.toLocaleDateString(); n.toFixed(2);", caminho)).toHaveLength(0);
  });
});

describe("ESLint: exceção só em components/formato/", () => {
  const caminho = "components/formato/moeda.ts";
  it("permite toLocaleString", async () => {
    expect(await lintar('n.toLocaleString("pt-BR");', caminho)).toHaveLength(0);
  });
  it("permite Intl.NumberFormat", async () => {
    expect(await lintar('new Intl.NumberFormat("pt-BR");', caminho)).toHaveLength(0);
  });
  it("permite hex", async () => {
    expect(await lintar('const c = "#FF7A3D";', caminho)).toHaveLength(0);
  });
  it("não vale para components/formato-x/", async () => {
    expect(
      await lintar('n.toLocaleString("pt-BR");', "components/formato-x/moeda.ts"),
    ).toHaveLength(1);
  });
});

describe("Stylelint: cor hexadecimal em CSS", () => {
  const css = ":root { --x: #FF7A3D; }";
  it("barra hex em app/globals.css", async () => {
    expect(await lintarCss(css, "app/globals.css")).toHaveLength(1);
  });
  it("barra hex em qualquer outro CSS", async () => {
    expect(await lintarCss("a { color: #fff; }", "components/x/estilo.css")).toHaveLength(1);
  });
  it("permite hex em app/tokens.css (único arquivo de tokens)", async () => {
    expect(await lintarCss(css, "app/tokens.css")).toHaveLength(0);
  });
  it("não barra cor sem hex", async () => {
    expect(await lintarCss("a { color: oklch(0.5 0.1 200); }", "app/globals.css")).toHaveLength(0);
  });
});
