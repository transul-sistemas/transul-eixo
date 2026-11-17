import { describe, expect, it } from "vitest";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import {
  indicarSubstituto,
  lancarStatusDoMotorista,
  lerFeriasSemSubstituto,
  lerLinhaDoMotorista,
} from "./motorista";

function cliente(resposta: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const chamadas: { funcao: string; args: unknown }[] = [];
  const c = {
    schema: (esquema: string) => ({
      rpc: async (funcao: string, args?: unknown) => {
        chamadas.push({ funcao: `${esquema}.${funcao}`, args });
        return { data: resposta.data ?? null, error: resposta.error ?? null };
      },
    }),
  } as unknown as ClienteDeEscrita;
  return { c, chamadas };
}

describe("Motorista do conjunto (A6)", () => {
  it("lançar o dia manda o código, a versão vista e o motivo", async () => {
    const { c, chamadas } = cliente({ data: "s1" });
    const r = await lancarStatusDoMotorista(
      c,
      { pessoaId: "p1", dia: "2026-11-12", codigo: "TBE", versao: 1, motivo: "Ficou em casa" },
      "k",
    );
    expect(r).toEqual({ ok: true, linha: { id: "s1" } });
    expect(chamadas[0]).toMatchObject({
      funcao: "nucleo.lancar_status_do_motorista",
      args: { p_codigo: "TBE", p_versao: 1, p_motivo: "Ficou em casa", p_chave: "k" },
    });
  });

  it("versão velha vira conflito; sobreposição vira entrada recusada", async () => {
    const conflito = await lancarStatusDoMotorista(
      cliente({ error: { message: "mudou", code: "40001" } }).c,
      { pessoaId: "p1", dia: "2026-11-12", codigo: "FOL", versao: null, motivo: null },
      "k",
    );
    expect(conflito.ok).toBe(false);
    const sobreposta = await indicarSubstituto(
      cliente({ error: { message: "conflicting key value", code: "23P01" } }).c,
      {
        titularId: "t",
        substitutoId: "s",
        inicio: "2026-11-20",
        fim: "2026-11-30",
        motivo: "Férias",
      },
      "k",
    );
    expect(sobreposta.ok).toBe(false);
  });

  it("as leituras não calam erro e devolvem lista vazia sem dados", async () => {
    expect(
      await lerLinhaDoMotorista(cliente({ data: null }).c, "2026-11-01", "2026-11-30"),
    ).toEqual([]);
    expect(await lerFeriasSemSubstituto(cliente({ data: null }).c)).toEqual([]);
    await expect(
      lerLinhaDoMotorista(cliente({ error: { message: "x" } }).c, "2026-11-01", "2026-11-30"),
    ).rejects.toThrow(/linha_do_motorista/);
  });
});
