import { describe, expect, it } from "vitest";

const BARRA = String.fromCharCode(92);
const NULO = `${BARRA}N`;
const FIM = `${BARRA}.`;

import { ContadorDoBackup, rotuloDoConteudo } from "./backup-conteudo.ts";

const SQL = [
  "COPY nucleo.placa_do_ativo (id, ativo_id, placa, inicio, excluido_em) FROM stdin;",
  `1\ta\tAAA1A11\t2020-01-01\t${NULO}`,
  `2\tb\tBBB2B22\t2020-01-01\t${NULO}`,
  `3\tc\tZDM0A00\t2020-01-01\t${NULO}`,
  "4\td\tZDM0A01\t2020-01-01\t2026-01-01",
  "5\te\tCCC3C33\t2020-01-01\t2026-01-01",
  FIM,
  "COPY config.parametro (chave, valor, descricao) FROM stdin;",
  "banco_em_demonstracao\ttrue\tx",
  "outro\t1\ty",
  FIM,
  "COPY supabase_migrations.schema_migrations (version, name) FROM stdin;",
  "20261116110000\ta",
  "20261116130000\tb",
  FIM,
  "COPY nucleo.cr (id) FROM stdin;",
  "x",
  FIM,
];

function contar(linhas: string[]) {
  const c = new ContadorDoBackup();
  for (const l of linhas) c.linha(l);
  return c.resultado();
}

describe("contagem do conteúdo de um backup", () => {
  it("separa placas reais e Demo (só as não excluídas) e conta o resto", () => {
    expect(contar(SQL)).toEqual({
      placasReais: 2,
      placasDemo: 1,
      bancoEmDemonstracao: true,
      migrations: 2,
      ultimaMigration: "20261116130000",
    });
  });

  it("backup sem o parâmetro e sem demo", () => {
    const r = contar(SQL.filter((l) => !l.startsWith("banco_em") && !l.startsWith("3\t")));
    expect(r.bancoEmDemonstracao).toBe(false);
    expect(r.placasDemo).toBe(0);
  });

  it("o rótulo diz o que o backup guarda", () => {
    expect(rotuloDoConteudo(contar(SQL))).toMatch(/com demo/i);
    expect(rotuloDoConteudo({ ...contar(SQL), placasDemo: 0, bancoEmDemonstracao: false })).toMatch(
      /sem demo/i,
    );
  });

  it("nunca guarda o conteúdo das linhas: o resultado só tem números, lógico e texto de versão", () => {
    const texto = JSON.stringify(contar(SQL));
    expect(texto).not.toContain("AAA1A11");
    expect(texto).not.toContain("ZDM0A00");
  });
});
