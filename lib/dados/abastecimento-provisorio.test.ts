import { describe, expect, it } from "vitest";
import {
  conferirAbastecimentoProvisorio,
  lancarAbastecimentoProvisorio,
  lerAbastecimentoDoMesV2,
} from "./abastecimento-provisorio";
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

describe("Abastecimento provisório", () => {
  it("lança com a chave e devolve o id", async () => {
    const { c, chamadas } = cliente({ data: "a1" });
    const r = await lancarAbastecimentoProvisorio(
      c,
      {
        ativoId: "x",
        dia: "2026-11-12",
        litros: 150.5,
        valor: 900.3,
        km: null,
        combustivel: null,
        posto: null,
      },
      "k",
    );
    expect(r).toEqual({ ok: true, linha: { id: "a1" } });
    expect(chamadas[0]).toMatchObject({
      funcao: "nucleo.lancar_abastecimento_provisorio",
      args: { p_litros: 150.5, p_chave: "k" },
    });
  });

  it("conferir com versão velha é conflito; a leitura v2 não cala erro", async () => {
    const r = await conferirAbastecimentoProvisorio(
      cliente({ error: { message: "mudou", code: "40001" } }).c,
      { id: "a1", versao: 1, decisao: "conferido", origemId: "S1", motivo: null },
      "k",
    );
    expect(r.ok).toBe(false);
    await expect(
      lerAbastecimentoDoMesV2(cliente({ error: { message: "x" } }).c, {
        mes: null,
        busca: null,
        ordem: "placa",
        pagina: 1,
        tam: 50,
      }),
    ).rejects.toThrow(/abastecimento_do_mes_v2/);
  });
});
