import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { argumentosDoTrocar, backupMaisRecente } from "./demo-trocar";

describe("argumentosDoTrocar", () => {
  it("exige real ou demo", () => {
    expect(() => argumentosDoTrocar([])).toThrow(/real ou demo/);
    expect(() => argumentosDoTrocar(["--", "outro"])).toThrow(/Uso:/);
  });
  it("sem --sim é só simulação", () => {
    expect(argumentosDoTrocar(["--", "real"])).toEqual({
      alvo: "real",
      confirmado: false,
      pasta: "C:/Backups/eixo",
    });
    expect(argumentosDoTrocar(["demo", "--sim", "--pasta", "X:/b"])).toEqual({
      alvo: "demo",
      confirmado: true,
      pasta: "X:/b",
    });
  });
});

describe("backupMaisRecente", () => {
  it("escolhe o mais novo pelo nome e ignora o que não é backup local", () => {
    const pasta = mkdtempSync(join(tmpdir(), "eixo-demo-"));
    try {
      expect(backupMaisRecente(join(pasta, "nada"))).toBeNull();
      expect(backupMaisRecente(pasta)).toBeNull();
      for (const n of [
        "eixo-local-2026-11-10T10-00-00.dump.enc",
        "eixo-local-2026-11-10T12-30-00.dump.enc",
        "eixo-nuvem-2026-11-11T09-00-00.dump.enc",
        "anotacao.txt",
      ])
        writeFileSync(join(pasta, n), "x");
      expect(backupMaisRecente(pasta)).toBe(join(pasta, "eixo-local-2026-11-10T12-30-00.dump.enc"));
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });
});
