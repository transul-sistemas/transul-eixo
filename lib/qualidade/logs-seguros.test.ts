import { describe, expect, it } from "vitest";
import { listarArquivos, lerTexto } from "./armadilhas";
import { logsInseguros } from "./logs-seguros";

// Lote 2 (10/11/2026): nenhum log (console.*, logger.*) do app, dos scripts e dos workers mostra placa
// nem a mensagem crua do banco (message, details, hint, ou o objeto do erro inteiro). O log leva só o
// código (SQLSTATE) e um texto nosso. Exceção só com `log-seguro: <motivo>` ao lado.

const linhas = (codigo: string) => logsInseguros(codigo).map((a) => a.linha);

describe("logsInseguros (a regra)", () => {
  it("acusa a placa no log, interpolada ou como argumento", () => {
    expect(linhas("console.error(`dadosDoPainel falhou para ${placa}`, codigo);")).toEqual([1]);
    expect(linhas('console.warn("sem dado:", ativo.placa);')).toEqual([1]);
    expect(linhas('logger.info("placa", placaAtual);')).toEqual([1]);
  });

  it("acusa a mensagem crua do banco (message, details, hint)", () => {
    expect(linhas('console.error("falhou:", codigo, erro.message);')).toEqual([1]);
    expect(linhas('console.error("falhou:", error.details, error.hint);')).toEqual([1]);
    expect(linhas("console.error(erro instanceof Error ? erro.message : erro);")).toEqual([1]);
  });

  it("acusa o objeto do erro inteiro (ele leva message, details e hint)", () => {
    expect(linhas('console.error("escrita falhou:", erro);')).toEqual([1]);
    expect(linhas("console.error(String(error));")).toEqual([1]);
    expect(linhas("console.error(`falhou: ${err}`);")).toEqual([1]);
    expect(linhas('console.error("falhou:", r.erro);')).toEqual([1]);
  });

  it("acusa também em várias linhas e conta a linha da chamada", () => {
    const codigo = ["const x = 1;", "console.error(", '  "falhou:",', "  erro,", ");"].join("\n");
    expect(linhas(codigo)).toEqual([2]);
  });

  it("deixa passar o código, o nome do erro, o texto nosso e a palavra placa dentro do texto", () => {
    for (const ok of [
      'console.error("contagem de placas para receber indisponível:", textoDoErro(erro));',
      'console.error("cadastro falhou:", erro instanceof Error ? erro.name : "erro");',
      'console.error("gravação no banco falhou:", codigo);',
      'console.error(`A importação falhou${codigo ? ` (código ${codigo})` : ""}.`);',
      'console.error("falhou:", erro.code, error.name);',
      "console.log(texto);",
    ]) {
      expect(logsInseguros(ok), ok).toEqual([]);
    }
  });

  it("aceita a exceção justificada ao lado (log-seguro)", () => {
    expect(
      linhas("// log-seguro: a mensagem é da nossa guarda\nconsole.error(erro.message);"),
    ).toEqual([]);
    expect(linhas("console.error(erro.message); // log-seguro: texto nosso")).toEqual([]);
  });
});

describe("no repositório de verdade", () => {
  const arquivos = [
    ...["app", "components", "lib", "scripts", "workers"].flatMap((pasta) =>
      listarArquivos(pasta, /\.(ts|tsx|mjs|js)$/),
    ),
    "proxy.ts",
  ].filter((a) => !/\.test\.(ts|tsx)$/.test(a));

  it("há arquivos para varrer", () => {
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it("nenhum log mostra placa nem a mensagem crua do banco", () => {
    const achados = arquivos.flatMap((arquivo) =>
      logsInseguros(lerTexto(arquivo)).map((a) => `${arquivo}:${a.linha} ${a.motivo}`),
    );
    expect(achados).toEqual([]);
  });
});
