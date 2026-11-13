import { describe, expect, it } from "vitest";
import { aprovarBaixa, lerPedidosDeBaixa, pedirBaixa } from "./baixa";
import type { ClienteDeEscrita } from "./escrita-do-banco";

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

describe("baixa com quatro olhos", () => {
  it("pedir manda motivo, data, justificativa, documento e chave (sem comprador nem valor)", async () => {
    const { c, chamadas } = cliente({ data: "p1" });
    const r = await pedirBaixa(
      c,
      { ativoId: "a1", motivo: "venda", em: "2026-11-01", justificativa: "Venda", documento: null },
      "k1",
    );
    expect(r).toEqual({ ok: true, linha: { pedidoId: "p1" } });
    expect(Object.keys(chamadas[0]?.args as object).sort()).toEqual(
      ["p_ativo_id", "p_chave", "p_documento", "p_em", "p_justificativa", "p_motivo"].sort(),
    );
  });

  it("quem pede não aprova: o 42501 vira sem permissão", async () => {
    const r = await aprovarBaixa(
      cliente({ error: { message: "Quem pede a baixa não a decide", code: "42501" } }).c,
      "p1",
      1,
      "k",
    );
    expect(r).toMatchObject({ ok: false, erro: { codigo: "sem_permissao" } });
  });

  it("a lista de pedidos não cala erro", async () => {
    await expect(
      lerPedidosDeBaixa(cliente({ error: { message: "x" } }).c, "pedida"),
    ).rejects.toThrow(/pedidos_de_baixa/);
  });
});
