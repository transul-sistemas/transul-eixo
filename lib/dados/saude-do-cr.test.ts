import { describe, expect, it } from "vitest";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import { encerrarVinculoDeCr, lerProblemaDaSaude, lerResumoDaSaudeDoCr } from "./saude-do-cr";

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

describe("Saúde do CR", () => {
  it("lê o problema paginado no banco", async () => {
    const { c, chamadas } = cliente({ data: { problema: "placa_sem_cr", total: 0, linhas: [] } });
    await lerProblemaDaSaude(c, "placa_sem_cr", 2);
    expect(chamadas[0]).toEqual({
      funcao: "nucleo.problemas_da_saude_do_cr",
      args: { p_problema: "placa_sem_cr", p_pagina: 2, p_tamanho: 20 },
    });
  });

  it("erro de leitura vira exceção", async () => {
    await expect(lerResumoDaSaudeDoCr(cliente({ error: { message: "x" } }).c)).rejects.toThrow(
      /resumo_da_saude_do_cr/,
    );
  });

  it("encerrar o vínculo manda a versão; versão velha vira conflito", async () => {
    const { c, chamadas } = cliente({ data: "v1" });
    expect(
      await encerrarVinculoDeCr(
        c,
        { vinculoId: "v1", em: "2026-11-01", motivo: "engano", versao: 2 },
        "k",
      ),
    ).toEqual({ ok: true, linha: { id: "v1" } });
    expect(chamadas[0]?.args).toMatchObject({ p_versao: 2, p_chave: "k" });
    const r = await encerrarVinculoDeCr(
      cliente({ error: { message: "mudou", code: "40001" } }).c,
      { vinculoId: "v1", em: "2026-11-01", motivo: "x", versao: 1 },
      "k",
    );
    expect(r).toMatchObject({ ok: false, erro: { codigo: "conflito" } });
  });
});
