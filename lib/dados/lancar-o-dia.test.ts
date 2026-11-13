import { describe, expect, it } from "vitest";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import { corrigirUltimoEvento, lancarODiaEmLote, lerSituacoesProgramadas } from "./lancar-o-dia";

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

describe("Lançar o dia", () => {
  it("o lote devolve X de Y e os recusados com o motivo", async () => {
    const resposta = {
      lote_id: "l1",
      total: 2,
      lancados: 0,
      recusados: [{ ativo_id: "a2", motivo: "sem permissão", codigo: "42501" }],
      repetido: false,
    };
    const { c, chamadas } = cliente({ data: resposta });
    const r = await lancarODiaEmLote(
      c,
      { ativos: ["a1", "a2"], sigla: "PÁT", dia: "2026-11-12", hora: "08:00" },
      "k",
    );
    expect(r).toEqual({ ok: true, linha: resposta });
    expect(chamadas[0]?.args).toMatchObject({
      p_ativos: ["a1", "a2"],
      p_hora: "08:00",
      p_chave: "k",
    });
  });

  it("dia futuro no lote vira entrada inválida", async () => {
    const r = await lancarODiaEmLote(
      cliente({ error: { message: "Lance um dia até hoje", code: "22023" } }).c,
      { ativos: ["a1"], sigla: "PÁT", dia: "2026-12-01", hora: "08:00" },
      "k",
    );
    expect(r).toMatchObject({ ok: false, erro: { codigo: "entrada_invalida" } });
  });

  it("corrigir manda o motivo e a sigla certa; a leitura das programadas não cala erro", async () => {
    const { c, chamadas } = cliente({ data: "e1" });
    await corrigirUltimoEvento(c, { eventoId: "e1", motivo: "engano", novaSigla: "DOp" }, "k");
    expect(chamadas[0]).toMatchObject({
      funcao: "nucleo.corrigir_ultimo_evento",
      args: { p_nova_sigla: "DOp" },
    });
    await expect(
      lerSituacoesProgramadas(cliente({ error: { message: "x" } }).c, "2026-11-01", "2026-11-30"),
    ).rejects.toThrow(/situacoes_programadas/);
  });
});
