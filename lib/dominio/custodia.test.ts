import { describe, expect, it } from "vitest";
import { SIGLAS, SIGLAS_DE_BAIXA } from "./status";
import {
  podeDisponibilizar,
  podeReceberPedido,
  SIGLAS_QUE_PODEM_DISPONIBILIZAR,
  type PedidoDeTransferencia,
} from "./custodia";

const pedido = (parcial: Partial<PedidoDeTransferencia> = {}): PedidoDeTransferencia => ({
  id: "ped-1",
  placa: "AAA0A00",
  deGestorId: "gestor-1",
  paraGestorId: "gestor-2",
  motivo: "Troca de carteira",
  pendenciasConhecidas: [{ id: "p1", texto: "CRLV vencendo" }],
  situacao: "pendente",
  versao: 1,
  ...parcial,
});

describe("podeDisponibilizar: PÁT, VAz e ETv levam ao Operacional (DOp)", () => {
  it("só essas três situações", () => {
    const sim = SIGLAS.filter((s) => podeDisponibilizar(s));
    expect([...sim].sort()).toEqual(["ETv", "PÁT", "VAz"].sort());
    expect([...SIGLAS_QUE_PODEM_DISPONIBILIZAR].sort()).toEqual(["ETv", "PÁT", "VAz"].sort());
  });
  it("DOp (já no Operacional) e as baixas não", () => {
    expect(podeDisponibilizar("DOp")).toBe(false);
    for (const s of SIGLAS_DE_BAIXA) expect(podeDisponibilizar(s), s).toBe(false);
  });
});

describe("podeReceberPedido: só o gestor de destino recebe um pedido pendente", () => {
  it("o destinatário, com o pedido pendente: pode", () => {
    expect(podeReceberPedido(pedido(), "gestor-2")).toEqual({ ok: true });
  });
  it("outro gestor, ou quem enviou: não, e diz por quê", () => {
    expect(podeReceberPedido(pedido(), "gestor-3")).toEqual({
      ok: false,
      motivo: "nao_e_o_destinatario",
    });
    expect(podeReceberPedido(pedido(), "gestor-1")).toEqual({
      ok: false,
      motivo: "nao_e_o_destinatario",
    });
  });
  it("pedido já concluído ou cancelado: não (alguém já resolveu)", () => {
    expect(podeReceberPedido(pedido({ situacao: "concluido" }), "gestor-2")).toEqual({
      ok: false,
      motivo: "pedido_encerrado",
    });
    expect(podeReceberPedido(pedido({ situacao: "cancelado" }), "gestor-2")).toEqual({
      ok: false,
      motivo: "pedido_encerrado",
    });
  });
});
