import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// O ponto de entrada roda no Node sem compilar (só tirando os tipos). Com CI=1 ele recusa antes de
// qualquer rede: o teste nunca fala com o Sankhya real.

describe("pnpm sankhya:consulta (ponto de entrada no Node)", () => {
  it("roda no Node e, no CI, recusa sem consultar", () => {
    const saida = spawnSync(
      process.execPath,
      ["workers/sankhya/consulta.ts", "consultas/cr-por-pai-e-sinais.sql"],
      {
        env: { ...process.env, CI: "1" },
        encoding: "utf8",
      },
    );
    expect(saida.stderr).not.toContain("ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX");
    expect(saida.stderr).toContain("No CI a ponte não consulta o Sankhya real");
    expect(saida.status).toBe(1);
  });

  it("recusa arquivo fora de consultas/", () => {
    const saida = spawnSync(process.execPath, ["workers/sankhya/consulta.ts", "package.json"], {
      env: { ...process.env, CI: "1" },
      encoding: "utf8",
    });
    expect(saida.stderr).toContain("Só arquivos .sql da pasta consultas/");
    expect(saida.status).toBe(1);
  });
});
