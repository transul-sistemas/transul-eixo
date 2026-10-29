import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssinaturaTranSul } from "./assinatura-transul";

const ARQUIVO = "transul-horizontal-preto.png";

describe("<AssinaturaTranSul>", () => {
  it("é uma imagem com nome acessível, pintada pelo token da marca", () => {
    const html = renderToStaticMarkup(<AssinaturaTranSul />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="TranSul"');
    expect(html).toContain('data-marca="transul"');
    expect(html).toContain("var(--marca-transul)");
  });
  it("a máscara usa o PNG provisório", () => {
    expect(renderToStaticMarkup(<AssinaturaTranSul />)).toContain(`/marca/${ARQUIVO}`);
  });
  it("só o símbolo ocupa menos largura que o logo inteiro", () => {
    const inteiro = renderToStaticMarkup(<AssinaturaTranSul />);
    const simbolo = renderToStaticMarkup(<AssinaturaTranSul apenasSimbolo />);
    expect(simbolo).not.toBe(inteiro);
    expect(simbolo).toContain('data-recorte="simbolo"');
  });
});

function codigoDoProjeto(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return codigoDoProjeto(caminho);
    return /\.(tsx?|css)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

describe("isolamento do logo provisório", () => {
  it("só components/marca/assinatura-transul.tsx cita o arquivo PNG", () => {
    const citam = ["app", "components", "lib"]
      .flatMap(codigoDoProjeto)
      .filter((arquivo) => readFileSync(arquivo, "utf-8").includes(ARQUIVO))
      .map((arquivo) => arquivo.replaceAll("\\", "/"));
    expect(citam).toEqual(["components/marca/assinatura-transul.tsx"]);
  });
});
