import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dadosEmStaging } from "./staging-sem-dados";

// O staging da v1 (schema `staging`) recebe a carga só por script local, nunca por migration: a
// migration vai à nuvem, e dado real nunca entra no repositório. Na migration, só estrutura e funções.

describe("dadosEmStaging (a regra)", () => {
  it("acha insert, copy, \\copy e create table … as select no staging", () => {
    const sql = [
      "insert into staging.viagem (id) values (1);",
      "INSERT INTO Staging.despesa select * from x;",
      "copy staging.folha from '/tmp/folha.csv' csv;",
      "\\copy staging.natureza from 'natureza.csv' csv",
      "create table staging.copia as select * from staging.viagem;",
      'insert into "staging"."operacao" (id) values (2);',
    ].join("\n");
    expect(dadosEmStaging(sql).map((a) => a.linha)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("deixa passar estrutura, políticas, leituras e comentários", () => {
    const sql = [
      "create schema staging;",
      "create table staging.viagem (id uuid primary key);",
      "create index viagem_idx on staging.viagem (id);",
      "select count(*) from staging.viagem;",
      "-- insert into staging.viagem: a carga é por script local",
      "comment on table staging.viagem is 'insert into staging.viagem só por script';",
    ].join("\n");
    expect(dadosEmStaging(sql)).toEqual([]);
  });
});

describe("as migrations não carregam dado no staging", () => {
  const pasta = "supabase/migrations";
  const arquivos = readdirSync(pasta).filter((a) => a.endsWith(".sql"));

  it("há migrations para varrer", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it("nenhuma migration insere, copia ou cria tabela com dados no staging", () => {
    const achados = arquivos.flatMap((arquivo) =>
      dadosEmStaging(readFileSync(`${pasta}/${arquivo}`, "utf-8")).map(
        (a) => `${arquivo}:${a.linha} ${a.trecho}`,
      ),
    );
    expect(achados).toEqual([]);
  });
});
