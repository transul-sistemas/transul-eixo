import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { linhaSemAlertas } from "./db-diagnostico";

// O diagnóstico da lista (fatia 3.9a) mede a linha SEM os alertas para separar o custo de cada peça:
// o texto vem da própria migration (a mesma visão), só sem a junção dos alertas.

const MIGRATION = readFileSync("supabase/migrations/20261104200000_leitura_das_placas.sql", "utf8");

describe("linhaSemAlertas", () => {
  it("é a visão da lista sem os alertas, com o resto igual", () => {
    const sql = linhaSemAlertas(MIGRATION);
    expect(sql).not.toContain("alerta_de_vinculo");
    expect(sql).not.toContain("al.alertas");
    for (const peca of [
      "situacao_com_causa",
      "operacao_em",
      "filial_do_cr_em",
      "gestor_da_carteira",
    ]) {
      expect(sql, peca).toContain(peca);
    }
  });
  it("sem a visão ou sem os alertas no texto, acusa (nunca mede outra coisa calado)", () => {
    expect(() => linhaSemAlertas("select 1")).toThrow(/linha_de_placa/);
    expect(() => linhaSemAlertas(MIGRATION.replace("    al.alertas,\n", ""))).toThrow(/alertas/);
  });
});
