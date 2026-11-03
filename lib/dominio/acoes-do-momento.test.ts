import { describe, expect, it } from "vitest";
import { ACOES } from "@/lib/navegacao/acoes";
import { SIGLAS, SIGLAS_DE_BAIXA } from "./status";
import { idsDasAcoesDoMomento } from "./acoes-do-momento";

const DISPONIBILIZAR = "frota.disponibilizar-ao-operacional";
const RECEBER = "frota.receber-placa";

describe("idsDasAcoesDoMomento: quais ações de ACOES combinam com a placa (regra provisória)", () => {
  it("carreta (implemento) em PÁT ou ETv não tem o botão Disponibilizar ao Operacional", () => {
    for (const sigla of ["PÁT", "ETv"] as const) {
      expect(idsDasAcoesDoMomento({ sigla, tipo: "implemento" }), sigla).not.toContain(
        DISPONIBILIZAR,
      );
    }
  });

  it("apoio e equipamento também não; cavalo e caminhão têm", () => {
    for (const tipo of ["apoio", "equipamento"] as const) {
      expect(idsDasAcoesDoMomento({ sigla: "PÁT", tipo }), tipo).not.toContain(DISPONIBILIZAR);
    }
    for (const tipo of ["cavalo", "caminhao"] as const) {
      expect(idsDasAcoesDoMomento({ sigla: "PÁT", tipo }), tipo).toContain(DISPONIBILIZAR);
    }
  });

  it("a carreta com pedido pendente ainda recebe a ação Receber placa", () => {
    expect(
      idsDasAcoesDoMomento({ sigla: "PÁT", tipo: "implemento", pedidoPendente: true }),
    ).toEqual([RECEBER]);
  });

  it("Disponibilizar ao Operacional só em PÁT e ETv", () => {
    const comDisponibilizar = SIGLAS.filter((sigla) =>
      idsDasAcoesDoMomento({ sigla, tipo: "cavalo" }).includes(DISPONIBILIZAR),
    );
    expect([...comDisponibilizar].sort()).toEqual(["ETv", "PÁT"].sort());
  });

  it("DOp (já disponível no Operacional) não tem ação: DOp para ACe é do módulo Operacional", () => {
    expect(idsDasAcoesDoMomento({ sigla: "DOp", tipo: "cavalo" })).toEqual([]);
    expect(idsDasAcoesDoMomento({ sigla: "DOp", tipo: "cavalo", pedidoPendente: false })).toEqual(
      [],
    );
  });

  it("sem pedido de transferência pendente, Receber placa nunca aparece, em nenhuma situação", () => {
    for (const sigla of SIGLAS) {
      expect(idsDasAcoesDoMomento({ sigla, tipo: "cavalo" }), sigla).not.toContain(RECEBER);
      expect(
        idsDasAcoesDoMomento({ sigla, tipo: "cavalo", pedidoPendente: false }),
        sigla,
      ).not.toContain(RECEBER);
    }
  });

  it("com pedido pendente, Receber placa aparece em qualquer situação que não seja baixa, qualquer que seja ela", () => {
    for (const sigla of SIGLAS.filter((s) => !SIGLAS_DE_BAIXA.includes(s))) {
      expect(
        idsDasAcoesDoMomento({ sigla, tipo: "cavalo", pedidoPendente: true }),
        sigla,
      ).toContain(RECEBER);
    }
  });

  it("PÁT com pedido pendente: as duas ações, Receber primeiro (a pendência vem antes)", () => {
    expect(idsDasAcoesDoMomento({ sigla: "PÁT", tipo: "cavalo", pedidoPendente: true })).toEqual([
      RECEBER,
      DISPONIBILIZAR,
    ]);
  });

  it("baixada (VND e SUC): nenhuma ação, nem com pedido pendente", () => {
    for (const sigla of SIGLAS_DE_BAIXA) {
      expect(idsDasAcoesDoMomento({ sigla, tipo: "cavalo" }), sigla).toEqual([]);
      expect(idsDasAcoesDoMomento({ sigla, tipo: "cavalo", pedidoPendente: true }), sigla).toEqual(
        [],
      );
    }
  });

  it("todo id devolvido, para qualquer sigla, com ou sem pedido, existe em ACOES", () => {
    const existentes = new Set(ACOES.map((a) => a.id));
    for (const sigla of SIGLAS) {
      for (const pedidoPendente of [false, true]) {
        for (const id of idsDasAcoesDoMomento({ sigla, tipo: "cavalo", pedidoPendente })) {
          expect(existentes.has(id), `${sigla}: ${id}`).toBe(true);
        }
      }
    }
  });

  it("nunca repete um id e a ordem é estável", () => {
    for (const sigla of SIGLAS) {
      for (const pedidoPendente of [false, true]) {
        const ids = idsDasAcoesDoMomento({ sigla, tipo: "cavalo", pedidoPendente });
        expect(new Set(ids).size).toBe(ids.length);
        expect(idsDasAcoesDoMomento({ sigla, tipo: "cavalo", pedidoPendente })).toEqual(ids);
      }
    }
  });
});
