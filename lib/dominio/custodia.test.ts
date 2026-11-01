import { describe, expect, it } from "vitest";
import { SIGLAS, SIGLAS_DE_BAIXA } from "./status";
import {
  MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA,
  motivoDeNaoDisponibilizar,
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

describe("podeDisponibilizar: PÁT, VAz e ETv levam ao Operacional (DOp), e só cavalo ou caminhão", () => {
  it("para cavalo e para caminhão, só essas três situações", () => {
    for (const tipo of ["cavalo", "caminhao"] as const) {
      const sim = SIGLAS.filter((s) => podeDisponibilizar(s, tipo));
      expect([...sim].sort(), tipo).toEqual(["ETv", "PÁT", "VAz"].sort());
    }
    expect([...SIGLAS_QUE_PODEM_DISPONIBILIZAR].sort()).toEqual(["ETv", "PÁT", "VAz"].sort());
  });
  it("carreta (implemento), apoio e equipamento nunca, em nenhuma situação", () => {
    for (const tipo of ["implemento", "apoio", "equipamento"] as const) {
      for (const sigla of SIGLAS) {
        expect(podeDisponibilizar(sigla, tipo), `${tipo} ${sigla}`).toBe(false);
      }
    }
  });
  it("DOp (já no Operacional) e as baixas não", () => {
    expect(podeDisponibilizar("DOp", "cavalo")).toBe(false);
    for (const s of SIGLAS_DE_BAIXA) expect(podeDisponibilizar(s, "cavalo"), s).toBe(false);
  });
});

describe("motivoDeNaoDisponibilizar: diz por que a placa não vai ao Operacional", () => {
  it("carreta solta em PÁT: a mensagem do tipo", () => {
    expect(motivoDeNaoDisponibilizar({ sigla: "PÁT", tipo: "implemento" })).toBe(
      MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA,
    );
    expect(MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA).toContain(
      "Só cavalo ou caminhão podem ser disponibilizados ao Operacional",
    );
  });
  it("apoio e equipamento também recebem a mensagem do tipo", () => {
    for (const tipo of ["apoio", "equipamento"] as const) {
      expect(motivoDeNaoDisponibilizar({ sigla: "VAz", tipo }), tipo).toBe(
        MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA,
      );
    }
  });
  it("cavalo ou caminhão fora de PÁT, VAz e ETv: a mensagem da situação", () => {
    const motivo = motivoDeNaoDisponibilizar({ sigla: "MAN", tipo: "cavalo" });
    expect(motivo).toMatch(/PÁT, VAz ou ETv/);
    expect(motivo).not.toBe(MENSAGEM_DE_TIPO_QUE_NAO_DISPONIBILIZA);
  });
  it("cavalo ou caminhão em PÁT, VAz ou ETv: sem motivo (pode)", () => {
    expect(motivoDeNaoDisponibilizar({ sigla: "PÁT", tipo: "cavalo" })).toBeNull();
    expect(motivoDeNaoDisponibilizar({ sigla: "ETv", tipo: "caminhao" })).toBeNull();
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
