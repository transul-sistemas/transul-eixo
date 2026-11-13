import { describe, expect, it } from "vitest";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import { lerCrsDaPlaca, trocarCr } from "./vinculos-de-cr";

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

const troca = {
  ativoId: "a1",
  crNovoId: "cr9",
  em: "2026-10-12T00:00:00-03:00",
  motivo: "Ordem de serviço",
  origemDaData: "informada" as const,
  versao: 3,
};

describe("Trocar CR", () => {
  it("chama a função atômica com a versão e a chave", async () => {
    const { c, chamadas } = cliente({ data: "t1" });
    expect(await trocarCr(c, troca, "k1")).toEqual({ ok: true, linha: { trocaId: "t1" } });
    expect(chamadas[0]).toEqual({
      funcao: "nucleo.trocar_cr",
      args: {
        p_ativo_id: "a1",
        p_cr_novo_id: "cr9",
        p_em: "2026-10-12T00:00:00-03:00",
        p_motivo: "Ordem de serviço",
        p_origem_da_data: "informada",
        p_versao: 3,
        p_chave: "k1",
      },
    });
  });

  it("versão velha vira conflito e regra vira entrada inválida", async () => {
    const a = await trocarCr(cliente({ error: { message: "mudou", code: "40001" } }).c, troca, "k");
    expect(a).toMatchObject({ ok: false, erro: { codigo: "conflito" } });
    const b = await trocarCr(
      cliente({ error: { message: "Escolha o vigente antes", code: "23514" } }).c,
      troca,
      "k",
    );
    expect(b).toMatchObject({ ok: false, erro: { codigo: "entrada_invalida" } });
  });

  it("a leitura dos CRs da placa pede o histórico e não cala erro", async () => {
    const { c, chamadas } = cliente({ data: [] });
    expect(await lerCrsDaPlaca(c, "a1", true)).toEqual([]);
    expect(chamadas[0]?.args).toEqual({ p_ativo_id: "a1", p_incluir_historico: true });
    await expect(
      lerCrsDaPlaca(cliente({ error: { message: "x" } }).c, "a1", false),
    ).rejects.toThrow(/crs_da_placa/);
  });
});
