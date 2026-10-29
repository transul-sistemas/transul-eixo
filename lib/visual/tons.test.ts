import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODULOS, STATUS, variavelDoModulo, variavelDoStatus } from "./tons";

const css = readFileSync("app/tokens.css", "utf-8");

describe("tons", () => {
  it("lista os 8 módulos (Administração usa a cor de Cadastros) e os 5 status", () => {
    expect(MODULOS).toHaveLength(8);
    expect(STATUS).toHaveLength(5);
  });
  it.each([...MODULOS])("o módulo %s tem token forte e suave", (modulo) => {
    const forte = variavelDoModulo(modulo);
    expect(css).toContain(`${forte}:`);
    expect(css).toContain(`${forte}-suave:`);
  });
  it.each([...STATUS])("o status %s tem token forte e suave", (status) => {
    const forte = variavelDoStatus(status);
    expect(css).toContain(`${forte}:`);
    expect(css).toContain(`${forte}-suave:`);
  });
  it("nomes das variáveis", () => {
    expect(variavelDoModulo("frota")).toBe("--modulo-frota");
    expect(variavelDoModulo("admin")).toBe("--modulo-cadastros");
    expect(variavelDoStatus("em-atividade")).toBe("--status-em-atividade");
  });
});
