import { describe, expect, it } from "vitest";
import type { PedidoDeTransferencia } from "@/lib/dominio/custodia";
import type { PlacaGravada } from "./escrita-tipos";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import { lerPedidosAbertosDoMeuDia, lerPedidosDoMeuDia, registrarPlacaSemCr } from "./meu-dia";

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

function clienteQueResponde(resposta: {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}) {
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

describe("lerPedidosAbertosDoMeuDia", () => {
  const linha = {
    id: "1",
    placa: "ZDM1A02",
    de_gestor_id: "g1",
    de_gestor: "Gestor Um",
    para_gestor_id: "g2",
    para_gestor: "Gestor Dois",
    motivo: "troca",
    situacao: "pendente",
    versao: 1,
    pendencias: [],
    enviada_em: "2026-11-04T15:30:00Z",
    prazo_dias: 5,
  };

  it("traz a data de envio e o prazo, pela função de leitura", async () => {
    const { c, chamadas } = clienteQueResponde({ data: [linha] });
    const r = await lerPedidosAbertosDoMeuDia(c, false);
    expect(chamadas).toEqual([{ funcao: "nucleo.pedidos_do_meu_dia", args: { p_todos: false } }]);
    expect(r[0]).toMatchObject({ enviadaEm: "2026-11-04T15:30:00Z", prazoDias: 5 });
    expect(r[0]?.pedido.placa).toBe("ZDM1A02");
  });

  it("o modo leitura do Administrador pede todos", async () => {
    const { c, chamadas } = clienteQueResponde({ data: [] });
    await lerPedidosAbertosDoMeuDia(c, true);
    expect(chamadas[0]?.args).toEqual({ p_todos: true });
  });

  it("erro de leitura vira exceção, nunca lista vazia calada", async () => {
    const { c } = clienteQueResponde({ error: { message: "falhou" } });
    await expect(lerPedidosAbertosDoMeuDia(c, false)).rejects.toThrow(/pedidos_do_meu_dia/);
  });

  it("a linha do Meu dia leva o envio junto ao CR", async () => {
    const fonte = {
      pedidosParaReceber: async () => [],
      placaParaAssistente: async () => placa({ operacao: "Operação A", crs: [] }),
    };
    const { c } = clienteQueResponde({ data: [linha] });
    const r = await lerPedidosDoMeuDia(fonte, "g2", "2026-11-12", () =>
      lerPedidosAbertosDoMeuDia(c, false),
    );
    expect(r[0]).toMatchObject({ enviadaEm: "2026-11-04T15:30:00Z", prazoDias: 5, crs: [] });
  });
});

describe("registrarPlacaSemCr", () => {
  it("chama a função atômica com o pedido e a chave de envio", async () => {
    const { c, chamadas } = clienteQueResponde({});
    const r = await registrarPlacaSemCr(c, "ped-1", "chave-1");
    expect(r).toEqual({ ok: true, linha: { pedidoId: "ped-1" } });
    expect(chamadas).toEqual([
      {
        funcao: "nucleo.registrar_placa_aceita_sem_cr",
        args: { p_transferencia_id: "ped-1", p_chave: "chave-1" },
      },
    ]);
  });

  it("sem permissão e regra do banco viram erro tipado", async () => {
    const a = await registrarPlacaSemCr(
      clienteQueResponde({
        error: { message: "Só o gestor de destino registra a placa aceita.", code: "42501" },
      }).c,
      "p",
      "k",
    );
    expect(a).toMatchObject({ ok: false, erro: { codigo: "sem_permissao" } });
    const b = await registrarPlacaSemCr(
      clienteQueResponde({
        error: { message: "Aceite a placa antes de registrar a falta do CR.", code: "23514" },
      }).c,
      "p",
      "k",
    );
    expect(b).toMatchObject({ ok: false, erro: { codigo: "entrada_invalida" } });
  });
});
