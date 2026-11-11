import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// importacao/ é local (05/11/2026): nada dali vai para o Git, só os arquivos de apoio (.gitkeep e
// README.md). O teste pergunta ao próprio Git (check-ignore --no-index: a regra, mesmo para arquivo
// rastreado ou que não existe) e não abre nenhum arquivo da pasta.

const ignorado = (caminho: string) =>
  spawnSync("git", ["check-ignore", "--no-index", "-q", caminho], { encoding: "utf8" }).status ===
  0;

describe("importacao/ fica fora do Git", () => {
  it.each([
    "importacao/auditoria-cr.csv",
    "importacao/planilha.xls",
    "importacao/planilha.xlsx",
    "importacao/extrato.json",
    "importacao/notas.txt",
    "importacao/nfe.xml",
    "importacao/subpasta/qualquer",
    "importacao/dados/titulos.csv",
    "importacao/resultados/saida.csv",
  ])("%s é ignorado", (caminho) => {
    expect(ignorado(caminho)).toBe(true);
  });

  it.each(["importacao/.gitkeep", "importacao/README.md"])("%s fica no Git", (caminho) => {
    expect(ignorado(caminho)).toBe(false);
  });
});
