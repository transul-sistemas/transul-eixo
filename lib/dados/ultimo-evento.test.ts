import { describe, expect, it, vi } from "vitest";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import { lancarSituacaoNaHora, lerUltimoEvento } from "./ultimo-evento";

const A = "11111111-1111-4111-8111-111111111111";

function clienteDeLeitura(linhas: unknown[]) {
  const chamadas: string[] = [];
  const cadeia = {
    select: (c: string) => (chamadas.push(`select ${c}`), cadeia),
    eq: (c: string, v: string) => (chamadas.push(`eq ${c}=${v}`), cadeia),
    is: (c: string) => (chamadas.push(`is ${c}`), cadeia),
    order: (c: string, o: { ascending: boolean }) => (
      chamadas.push(`order ${c} ${o.ascending ? "asc" : "desc"}`),
      cadeia
    ),
    limit: async (n: number) => (
      chamadas.push(`limit ${String(n)}`),
      { data: linhas, error: null }
    ),
  };
  const cliente = { schema: () => ({ from: () => cadeia }) } as unknown as ClienteDeEscrita;
  return { cliente, chamadas };
}

describe("lerUltimoEvento", () => {
  it("o mais recente não excluído da placa, com desempate pelo id", async () => {
    const { cliente, chamadas } = clienteDeLeitura([
      { id: "e1", sigla: "ETc", camada: "atividade", em: "2026-11-13T08:00:00-03:00" },
    ]);
    expect((await lerUltimoEvento(cliente, A))?.id).toBe("e1");
    expect(chamadas).toEqual([
      "select id, sigla, camada, em",
      `eq ativo_id=${A}`,
      "is excluido_em",
      "order em desc",
      "order id desc",
      "limit 1",
    ]);
  });
  it("sem evento: nulo", async () => {
    expect(await lerUltimoEvento(clienteDeLeitura([]).cliente, A)).toBeNull();
  });
});

describe("lancarSituacaoNaHora", () => {
  it("passa o ativo, a sigla e o instante", async () => {
    const rpc = vi.fn(async () => ({ data: "ev-1", error: null }));
    const cliente = { schema: () => ({ rpc }) } as unknown as ClienteDeEscrita;
    const r = await lancarSituacaoNaHora(cliente, { ativoId: A, sigla: "PÁT", em: "x" });
    expect(r).toEqual({ ok: true, linha: { eventoId: "ev-1" } });
    expect(rpc).toHaveBeenCalledWith("lancar_situacao_na_hora", {
      p_ativo_id: A,
      p_sigla: "PÁT",
      p_em: "x",
    });
  });
});
