import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { conferirConsulta } from "./guarda.ts";

// As consultas versionadas em consultas/ passam pela guarda e não trazem descrição de CR nem placa na saída.

const PASTA = "consultas";
const arquivos = readdirSync(PASTA).filter((n) => n.endsWith(".sql"));
const ler = (nome: string) => readFileSync(`${PASTA}/${nome}`, "utf8");

describe("consultas versionadas", () => {
  it("existem as quatro consultas da S0 e as duas de cadastro da carga inicial (3.9c)", () => {
    expect([...arquivos].sort()).toEqual([
      "cr-por-pai-e-sinais.sql",
      "cr-repetidos-por-descricao.sql",
      "crs-cadastro.sql",
      "veiculos-ativos-cadastro.sql",
      "veiculos-ativos-sem-dado.sql",
      "veiculos-modelo-eixos-carroceria.sql",
    ]);
  });

  it.each(["crs-cadastro.sql", "veiculos-ativos-cadastro.sql"])(
    "%s passa pela guarda no modo linhas (sem proprietário, motorista nem responsável)",
    (nome) => {
      expect(() => conferirConsulta(ler(nome), { modo: "linhas" })).not.toThrow();
    },
  );

  it.each(arquivos)("%s passa pela guarda no modo resumo", (nome) => {
    expect(() => conferirConsulta(ler(nome), { modo: "resumo" })).not.toThrow();
  });

  it("os CRs saem só em contagem: a descrição nunca é coluna de saída", () => {
    for (const nome of ["cr-por-pai-e-sinais.sql", "cr-repetidos-por-descricao.sql"]) {
      const sql = ler(nome);
      const saidaFinal = sql.slice(sql.lastIndexOf("SELECT"));
      expect(saidaFinal, nome).not.toMatch(/DESCRCENCUS/);
    }
  });

  it("os veículos ativos são filtrados por ATIVO = 'S', sem filtro de data nem de empresa", () => {
    for (const nome of ["veiculos-ativos-sem-dado.sql", "veiculos-modelo-eixos-carroceria.sql"]) {
      const sql = ler(nome);
      expect(sql, nome).toMatch(/V\.ATIVO = 'S'/);
      expect(sql, nome).not.toMatch(/CODEMP|(?<![A-Z_])D[TH][A-Z]*\s*[<>=]/);
    }
  });
});
