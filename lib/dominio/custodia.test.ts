import { describe, expect, it } from "vitest";
import { SIGLAS, SIGLAS_DE_BAIXA } from "./status";
import {
  etapaDoRecebimento,
  MENSAGEM_DE_SIGLA_QUE_NAO_ENTREGA,
  MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA,
  motivoDeNaoEntregar,
  podeCancelarPedido,
  podeConcluirRecebimento,
  podeDevolverPedido,
  podeDisponibilizarPlaca,
  podeEntregar,
  podeReceberPedido,
  SIGLAS_QUE_PODEM_ENTREGAR,
  type PedidoDeTransferencia,
} from "./custodia";

const pedido = (parcial: Partial<PedidoDeTransferencia> = {}): PedidoDeTransferencia => ({
  id: "ped-1",
  placa: "AAA0A00",
  deGestorId: "gestor-1",
  deGestor: "Gestor 1",
  paraGestorId: "gestor-2",
  paraGestor: "Gestor 2",
  motivo: "Troca de carteira",
  pendenciasConhecidas: [{ id: "p1", texto: "CRLV vencendo" }],
  situacao: "pendente",
  versao: 1,
  ...parcial,
});

describe("podeEntregar: PÁT e ETv levam ao Operacional (DOp), e só cavalo ou caminhão", () => {
  it("para cavalo e para caminhão, só essas duas situações", () => {
    for (const tipo of ["cavalo", "caminhao"] as const) {
      const sim = SIGLAS.filter((s) => podeEntregar(s, tipo));
      expect([...sim].sort(), tipo).toEqual(["ETv", "PÁT"].sort());
    }
    expect([...SIGLAS_QUE_PODEM_ENTREGAR].sort()).toEqual(["ETv", "PÁT"].sort());
  });
  it("carreta (implemento), apoio e equipamento nunca, em nenhuma situação", () => {
    for (const tipo of ["implemento", "apoio", "equipamento"] as const) {
      for (const sigla of SIGLAS) {
        expect(podeEntregar(sigla, tipo), `${tipo} ${sigla}`).toBe(false);
      }
    }
  });
  it("DOp (já no Operacional) e as baixas não", () => {
    expect(podeEntregar("DOp", "cavalo")).toBe(false);
    for (const s of SIGLAS_DE_BAIXA) expect(podeEntregar(s, "cavalo"), s).toBe(false);
  });
});

describe("motivoDeNaoEntregar: diz por que a placa não vai ao Operacional (o mesmo texto do banco)", () => {
  it("carreta solta em PÁT: a mensagem do tipo, igual à de nucleo.entregar_ao_operacional", () => {
    expect(motivoDeNaoEntregar({ sigla: "PÁT", tipo: "implemento" })).toBe(
      MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA,
    );
    expect(MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA).toBe(
      "Só cavalo ou caminhão podem ser entregues ao Operacional.",
    );
  });
  it("apoio e equipamento também recebem a mensagem do tipo", () => {
    for (const tipo of ["apoio", "equipamento"] as const) {
      expect(motivoDeNaoEntregar({ sigla: "ETv", tipo }), tipo).toBe(
        MENSAGEM_DE_TIPO_QUE_NAO_ENTREGA,
      );
    }
  });
  it("cavalo ou caminhão fora de PÁT e ETv: a mensagem da situação, igual à do banco", () => {
    expect(motivoDeNaoEntregar({ sigla: "MAN", tipo: "cavalo" })).toBe(
      MENSAGEM_DE_SIGLA_QUE_NAO_ENTREGA,
    );
    expect(MENSAGEM_DE_SIGLA_QUE_NAO_ENTREGA).toBe(
      "Só dá para entregar ao Operacional a placa em PÁT ou ETv.",
    );
  });
  it("cavalo ou caminhão em PÁT ou ETv: sem motivo (pode)", () => {
    expect(motivoDeNaoEntregar({ sigla: "PÁT", tipo: "cavalo" })).toBeNull();
    expect(motivoDeNaoEntregar({ sigla: "ETv", tipo: "caminhao" })).toBeNull();
  });
});

describe("podeDisponibilizarPlaca: enviar a outro gestor de frota", () => {
  it("qualquer tipo, em qualquer situação fora da baixa, sem pedido aberto", () => {
    expect(podeDisponibilizarPlaca({ sigla: "PÁT", pedidoAberto: false })).toBe(true);
    expect(podeDisponibilizarPlaca({ sigla: "MAN", pedidoAberto: false })).toBe(true);
  });
  it("placa baixada, ou já com pedido aberto, não", () => {
    for (const s of SIGLAS_DE_BAIXA) {
      expect(podeDisponibilizarPlaca({ sigla: s, pedidoAberto: false }), s).toBe(false);
    }
    expect(podeDisponibilizarPlaca({ sigla: "PÁT", pedidoAberto: true })).toBe(false);
  });
});

describe("podeReceberPedido: só o gestor de destino registra a chegada de um pedido pendente", () => {
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
  it("pedido já recebido, concluído ou cancelado: não (alguém já agiu)", () => {
    for (const situacao of ["em_conferencia", "concluido", "cancelado", "devolvido"] as const) {
      expect(podeReceberPedido(pedido({ situacao }), "gestor-2"), situacao).toEqual({
        ok: false,
        motivo: "pedido_encerrado",
      });
    }
  });
});

describe("podeConcluirRecebimento: a segunda etapa, depois de receber", () => {
  it("o destinatário, com o pedido em conferência: pode", () => {
    expect(podeConcluirRecebimento(pedido({ situacao: "em_conferencia" }), "gestor-2")).toEqual({
      ok: true,
    });
  });
  it("pedido ainda pendente: receba antes", () => {
    expect(podeConcluirRecebimento(pedido(), "gestor-2")).toEqual({
      ok: false,
      motivo: "pedido_nao_recebido",
    });
  });
  it("outro gestor não conclui; pedido encerrado também não", () => {
    expect(podeConcluirRecebimento(pedido({ situacao: "em_conferencia" }), "gestor-3")).toEqual({
      ok: false,
      motivo: "nao_e_o_destinatario",
    });
    expect(podeConcluirRecebimento(pedido({ situacao: "concluido" }), "gestor-2")).toEqual({
      ok: false,
      motivo: "pedido_encerrado",
    });
  });
});

describe("etapaDoRecebimento: qual das duas etapas o pedido espera", () => {
  it("pendente: receber; em conferência: concluir; encerrado: nenhuma", () => {
    expect(etapaDoRecebimento(pedido())).toBe("receber");
    expect(etapaDoRecebimento(pedido({ situacao: "em_conferencia" }))).toBe("concluir");
    expect(etapaDoRecebimento(pedido({ situacao: "concluido" }))).toBeNull();
    expect(etapaDoRecebimento(null)).toBeNull();
  });
});

describe("podeCancelarPedido: a origem desiste enquanto o destino não recebeu", () => {
  it("a origem, com o pedido pendente: pode", () => {
    expect(podeCancelarPedido(pedido(), "gestor-1")).toEqual({ ok: true });
  });
  it("o destino e um terceiro não cancelam", () => {
    expect(podeCancelarPedido(pedido(), "gestor-2")).toEqual({
      ok: false,
      motivo: "nao_e_a_origem",
    });
    expect(podeCancelarPedido(pedido(), "gestor-3")).toEqual({
      ok: false,
      motivo: "nao_e_a_origem",
    });
  });
  it("depois que o destino recebeu, ou encerrado, não se cancela", () => {
    for (const situacao of ["em_conferencia", "concluido", "devolvido", "cancelado"] as const) {
      expect(podeCancelarPedido(pedido({ situacao }), "gestor-1"), situacao).toEqual({
        ok: false,
        motivo: "pedido_ja_recebido",
      });
    }
  });
});

describe("podeDevolverPedido: o destino recusa o pedido em conferência", () => {
  it("o destino, com o pedido em conferência: pode", () => {
    expect(podeDevolverPedido(pedido({ situacao: "em_conferencia" }), "gestor-2")).toEqual({
      ok: true,
    });
  });
  it("pendente: receba antes de devolver", () => {
    expect(podeDevolverPedido(pedido(), "gestor-2")).toEqual({
      ok: false,
      motivo: "pedido_nao_recebido",
    });
  });
  it("a origem e um terceiro não devolvem; encerrado também não", () => {
    for (const gestor of ["gestor-1", "gestor-3"]) {
      expect(podeDevolverPedido(pedido({ situacao: "em_conferencia" }), gestor), gestor).toEqual({
        ok: false,
        motivo: "nao_e_o_destinatario",
      });
    }
    expect(podeDevolverPedido(pedido({ situacao: "concluido" }), "gestor-2")).toEqual({
      ok: false,
      motivo: "pedido_encerrado",
    });
  });
});
