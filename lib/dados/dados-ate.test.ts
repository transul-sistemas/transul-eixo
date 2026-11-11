import { describe, expect, it, vi } from "vitest";
import { lerDadosAte, lerDadosAteDaFonte } from "./dados-ate";

function cliente(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  return { c: async () => ({ schema: () => ({ rpc }) }), rpc };
}

describe("lerDadosAte", () => {
  it("chama a função do banco e devolve aaaa-mm-dd", async () => {
    const { c, rpc } = cliente("2026-10-28");
    expect(await lerDadosAte(c)).toBe("2026-10-28");
    expect(rpc).toHaveBeenCalledWith("dados_do_staging_ate", {});
  });
  it("sem dados ou sem permissão volta nulo", async () => {
    expect(await lerDadosAte(cliente(null).c)).toBeNull();
  });
  it("erro do banco ou do cliente não derruba a tela", async () => {
    expect(await lerDadosAte(cliente(null, { message: "falhou" }).c)).toBeNull();
    expect(
      await lerDadosAte(async () => {
        throw new Error("sem sessão");
      }),
    ).toBeNull();
  });
});

describe("lerDadosAteDaFonte", () => {
  it("cada fonte chama a função do banco dela", async () => {
    for (const [fonte, funcao] of [
      ["resultado", "dados_do_staging_ate"],
      ["abastecimento", "abastecimento_ate"],
      ["folha", "folha_ate"],
    ] as const) {
      const { c, rpc } = cliente("2026-10-28");
      expect(await lerDadosAteDaFonte(fonte, c)).toBe("2026-10-28");
      expect(rpc).toHaveBeenCalledWith(funcao, {});
    }
  });
  it("a folha, que é mensal, devolve o primeiro dia do mês, sem inventar dia", async () => {
    expect(await lerDadosAteDaFonte("folha", cliente("2026-03-01").c)).toBe("2026-03-01");
  });
});
