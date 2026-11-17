import { describe, expect, it } from "vitest";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import { avancarNoPatioEmLote, lerKpisDoOperacional } from "./operacional-lote";

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

describe("Operacional: KPIs e lote", () => {
  it("o lote manda as placas, a ação e a chave, e devolve X de Y", async () => {
    const resposta = { lote_id: "l", total: 2, avancados: 2, recusados: [], repetido: false };
    const { c, chamadas } = cliente({ data: resposta });
    const r = await avancarNoPatioEmLote(
      c,
      { ativos: ["a", "b"], acao: "aceitar", motivo: null },
      "k",
    );
    expect(r).toEqual({ ok: true, linha: resposta });
    expect(chamadas[0]).toMatchObject({
      funcao: "nucleo.avancar_no_patio_em_lote",
      args: { p_ativos: ["a", "b"], p_acao: "aceitar", p_chave: "k" },
    });
  });

  it("sem permissão nos KPIs, a leitura lança (a tela mostra o erro)", async () => {
    await expect(
      lerKpisDoOperacional(cliente({ error: { message: "sem", code: "42501" } }).c),
    ).rejects.toThrow(/kpis_do_operacional/);
  });
});
