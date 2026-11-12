import { describe, expect, it } from "vitest";
import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import type { PlacaGravada } from "./escrita-tipos";
import { lerPedidosDoMeuDia } from "./meu-dia";

function pedido(id: string, situacao: PedidoDeTransferencia["situacao"] = "pendente") {
  return {
    id,
    placa: `ZDM${id}`,
    deGestorId: "g1",
    deGestor: "Gestor Um",
    paraGestorId: "g2",
    paraGestor: "Gestor Dois",
    motivo: "troca",
    pendenciasConhecidas: [],
    situacao,
    versao: 1,
  } satisfies PedidoDeTransferencia;
}

const placa = (extra: Partial<PlacaGravada>) => extra as PlacaGravada;

describe("lerPedidosDoMeuDia", () => {
  it("junta cada pedido aberto ao CR vigente de hoje e à operação da placa", async () => {
    const fonte = {
      pedidosParaReceber: async () => [pedido("1"), pedido("2", "em_conferencia")],
      placaParaAssistente: async (p: string) =>
        p === "ZDM1"
          ? placa({
              operacao: "Operação A",
              crs: [
                { codigo: "CR010", nome: "Antigo", inicio: "2026-01-01", fim: "2026-06-01" },
                { codigo: "CR011", nome: "Atual", inicio: "2026-06-01", fim: null },
              ],
            })
          : placa({ operacao: null, crs: [] }),
    };
    const r = await lerPedidosDoMeuDia(fonte, "g2", "2026-11-12");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      crs: [{ codigo: "CR011", nome: "Atual" }],
      operacao: "Operação A",
    });
    // sem CR vigente: lista vazia, nunca um CR inventado
    expect(r[1]).toMatchObject({ crs: [], operacao: null });
  });

  it("placa que a leitura não alcança fica com CR desconhecido (nulo), não vazio", async () => {
    const fonte = {
      pedidosParaReceber: async () => [pedido("1")],
      placaParaAssistente: async () => null,
    };
    const r = await lerPedidosDoMeuDia(fonte, "g2", "2026-11-12");
    expect(r[0]).toMatchObject({ crs: null, operacao: null });
  });

  it("uma leitura que falha numa placa não derruba a lista: aquela placa fica sem CR conhecido", async () => {
    const fonte = {
      pedidosParaReceber: async () => [pedido("1"), pedido("2")],
      placaParaAssistente: async (p: string) => {
        if (p === "ZDM1") throw new Error("falhou");
        return placa({ operacao: "B", crs: [] });
      },
    };
    const r = await lerPedidosDoMeuDia(fonte, "g2", "2026-11-12");
    expect(r[0]?.crs).toBeNull();
    expect(r[1]?.crs).toEqual([]);
  });

  it("sem pedidos devolve lista vazia", async () => {
    const fonte = {
      pedidosParaReceber: async () => [],
      placaParaAssistente: async () => null,
    };
    expect(await lerPedidosDoMeuDia(fonte, "g2", "2026-11-12")).toEqual([]);
  });
});
