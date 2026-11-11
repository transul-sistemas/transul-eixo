import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarMigration, nomeValido, proximoTimestamp } from "./nova-migration";

let pasta = "";
beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "eixo-migrations-"));
  writeFileSync(join(pasta, "20261115100000_primeira_ficticia.sql"), "");
  writeFileSync(join(pasta, "20261101001606_antiga_ficticia.sql"), "");
});
afterEach(() => rmSync(pasta, { recursive: true, force: true }));

describe("proximoTimestamp", () => {
  it("é a maior da pasta mais uma hora, nunca a data de hoje", () => {
    expect(proximoTimestamp(["20261115100000_a.sql", "20261101001606_b.sql"])).toBe(
      "20261115110000",
    );
  });
  it("vira o dia e o mês na virada", () => {
    expect(proximoTimestamp(["20261130233000_a.sql"])).toBe("20261201003000");
  });
  it("ignora o que não é migration e recusa pasta vazia", () => {
    expect(proximoTimestamp(["README.md", "20261115100000_a.sql"])).toBe("20261115110000");
    expect(() => proximoTimestamp([])).toThrow("vazia");
  });
});

describe("criarMigration", () => {
  it("cria o arquivo sempre depois da última, mesmo em sequência", () => {
    criarMigration(pasta, "segunda_ficticia");
    criarMigration(pasta, "terceira_ficticia");
    const nomes = readdirSync(pasta).sort();
    expect(nomes.at(-2)).toBe("20261115110000_segunda_ficticia.sql");
    expect(nomes.at(-1)).toBe("20261115120000_terceira_ficticia.sql");
  });
  it("recusa nome fora de snake_case e não cria nada", () => {
    for (const ruim of [
      "",
      "Com Espaço",
      "MaiusculaInicial",
      "com-hifen",
      "_comeca",
      "termina_",
      "dois__sublinhados",
    ]) {
      expect(nomeValido(ruim)).toBe(false);
      expect(() => criarMigration(pasta, ruim)).toThrow("Nome inválido");
    }
    expect(readdirSync(pasta)).toHaveLength(2);
  });
});
