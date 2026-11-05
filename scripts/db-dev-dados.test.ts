import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bancoLocal, lerArgumentos } from "./db-dev-dados";

// Os dados de desenvolvimento (fatia 3.9a) só existem no Supabase local: o script recusa outro banco,
// e o gerador nunca entra no seed, numa migration nem na configuração do seed.

describe("bancoLocal: só o banco da própria máquina", () => {
  it.each([
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "postgres://postgres:postgres@localhost:54322/postgres",
  ])("aceita %s", (endereco) => {
    expect(bancoLocal(endereco)).toBe(true);
  });

  it.each([
    "postgresql://postgres.abc:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
    "postgresql://postgres:senha@db.oubrtcgtugeijbrxvblc.supabase.co:5432/postgres",
    "postgresql://postgres@127.0.0.1.exemplo.com:5432/postgres",
    "postgresql://postgres@localhost.exemplo.com/postgres",
    "http://127.0.0.1:54322",
    "não é endereço",
    "",
  ])("recusa %s", (endereco) => {
    expect(bancoLocal(endereco)).toBe(false);
  });
});

describe("lerArgumentos", () => {
  it("200 por padrão, com os gatilhos", () => {
    expect(lerArgumentos([])).toEqual({ quantidade: 200, semGatilhos: false });
  });
  it("a carga de 5.000", () => {
    expect(lerArgumentos(["--quantidade", "5000"])).toEqual({
      quantidade: 5000,
      semGatilhos: false,
    });
  });
  it("a medição da carga em lote sem os gatilhos (reconstrói no fim)", () => {
    expect(lerArgumentos(["--quantidade", "2000", "--sem-gatilhos"])).toEqual({
      quantidade: 2000,
      semGatilhos: true,
    });
  });
  it.each([["0"], ["-1"], ["20001"], ["abc"], ["1.5"]])("recusa a quantidade %s", (q) => {
    expect(() => lerArgumentos(["--quantidade", q])).toThrow(/1 a 20000/);
  });
});

describe("o gerador fica fora da produção", () => {
  it("o seed não chama o gerador nem cria as placas de desenvolvimento", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");
    expect(seed).not.toMatch(/gerar_dados|supabase\/dev|Gestor de frota \(e2e\)|Ana Ribeiro/);
  });
  it("nenhuma migration cita o gerador", () => {
    for (const nome of readdirSync("supabase/migrations")) {
      expect(readFileSync(`supabase/migrations/${nome}`, "utf8"), nome).not.toMatch(
        /gerar_dados|supabase\/dev/,
      );
    }
  });
  it("a configuração do seed carrega só o seed.sql", () => {
    const config = readFileSync("supabase/config.toml", "utf8");
    expect(config).toContain('sql_paths = ["./seed.sql"]');
    expect(config).not.toContain("dev/");
  });
  it("o script só fala com o banco depois de conferir que ele é local", () => {
    const script = readFileSync("scripts/db-dev-dados.ts", "utf8");
    const confere = script.indexOf("if (!bancoLocal(endereco))");
    const conecta = script.indexOf("new pg.Client(");
    expect(confere).toBeGreaterThan(-1);
    expect(conecta).toBeGreaterThan(confere);
  });
});

describe("carga sem os gatilhos (só para medir; a regra fica para decisão)", () => {
  const script = readFileSync("scripts/db-dev-dados.ts", "utf8");
  it("desliga os gatilhos, reconstrói e religa antes do commit, na mesma transação", () => {
    const desliga = script.indexOf("disable trigger t99_leitura_da_placa");
    const reconstroi = script.indexOf("nucleo.reconstruir_leitura_das_placas()");
    const religa = script.indexOf("enable trigger t99_leitura_da_placa");
    const commit = script.indexOf('cliente.query("commit")');
    expect(desliga).toBeGreaterThan(-1);
    expect(reconstroi).toBeGreaterThan(desliga);
    expect(religa).toBeGreaterThan(reconstroi);
    expect(commit).toBeGreaterThan(religa);
  });
});
