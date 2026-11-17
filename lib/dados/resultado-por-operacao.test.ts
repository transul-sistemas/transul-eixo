import { describe, expect, it } from "vitest";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import { lerResultadoPorOperacao, lerVariacaoDasOperacoes } from "./resultado-por-operacao";

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

describe("Resultado e variação por operação", () => {
  it("manda o mês e devolve o que o banco calculou", async () => {
    const { c, chamadas } = cliente({ data: { ve_resultado: false, mes: "2026-10-01" } });
    expect(await lerResultadoPorOperacao(c, "2026-10-01")).toEqual({
      ve_resultado: false,
      mes: "2026-10-01",
    });
    expect(chamadas[0]).toMatchObject({
      funcao: "nucleo.resultado_por_operacao",
      args: { p_mes: "2026-10-01" },
    });
  });

  it("não cala erro", async () => {
    await expect(
      lerVariacaoDasOperacoes(cliente({ error: { message: "x" } }).c, null),
    ).rejects.toThrow(/variacao_das_operacoes/);
  });
});
