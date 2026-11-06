import { describe, expect, it } from "vitest";
import { ACOES } from "@/lib/navegacao/acoes";
import { SIGLAS, SIGLAS_DE_BAIXA } from "./status";
import { idsDasAcoesDoMomento } from "./acoes-do-momento";

const ENTREGAR = "frota.entregar-ao-operacional";
const DISPONIBILIZAR = "frota.disponibilizar-placa";
const RECEBER = "frota.receber-placa";
const CONCLUIR = "frota.concluir-recebimento";

describe("idsDasAcoesDoMomento: quais ações de ACOES combinam com a placa", () => {
  it("carreta (implemento) em PÁT ou ETv não tem o botão Entregar ao Operacional", () => {
    for (const sigla of ["PÁT", "ETv"] as const) {
      expect(idsDasAcoesDoMomento({ sigla, tipo: "implemento" }), sigla).not.toContain(ENTREGAR);
    }
  });

  it("apoio e equipamento também não; cavalo e caminhão têm", () => {
    for (const tipo of ["apoio", "equipamento"] as const) {
      expect(idsDasAcoesDoMomento({ sigla: "PÁT", tipo }), tipo).not.toContain(ENTREGAR);
    }
    for (const tipo of ["cavalo", "caminhao"] as const) {
      expect(idsDasAcoesDoMomento({ sigla: "PÁT", tipo }), tipo).toContain(ENTREGAR);
    }
  });

  it("Entregar ao Operacional só em PÁT e ETv", () => {
    const com = SIGLAS.filter((sigla) =>
      idsDasAcoesDoMomento({ sigla, tipo: "cavalo" }).includes(ENTREGAR),
    );
    expect([...com].sort()).toEqual(["ETv", "PÁT"].sort());
  });

  it("Disponibilizar placa vale para qualquer tipo fora da baixa, sem pedido aberto", () => {
    for (const tipo of ["cavalo", "implemento", "apoio", "equipamento", "caminhao"] as const) {
      expect(idsDasAcoesDoMomento({ sigla: "MAN", tipo }), tipo).toContain(DISPONIBILIZAR);
    }
    expect(
      idsDasAcoesDoMomento({ sigla: "PÁT", tipo: "cavalo", pedidoAberto: true }),
    ).not.toContain(DISPONIBILIZAR);
  });

  it("Receber placa só na etapa receber; Concluir recebimento só na etapa concluir", () => {
    expect(
      idsDasAcoesDoMomento({
        sigla: "PÁT",
        tipo: "implemento",
        etapa: "receber",
        pedidoAberto: true,
      }),
    ).toEqual([RECEBER]);
    expect(
      idsDasAcoesDoMomento({ sigla: "MAN", tipo: "cavalo", etapa: "concluir", pedidoAberto: true }),
    ).toEqual([CONCLUIR]);
    for (const sigla of SIGLAS) {
      const ids = idsDasAcoesDoMomento({ sigla, tipo: "cavalo" });
      expect(ids, sigla).not.toContain(RECEBER);
      expect(ids, sigla).not.toContain(CONCLUIR);
    }
  });

  it("PÁT com pedido para receber: Receber primeiro, depois Entregar (a pendência vem antes)", () => {
    expect(
      idsDasAcoesDoMomento({ sigla: "PÁT", tipo: "cavalo", etapa: "receber", pedidoAberto: true }),
    ).toEqual([RECEBER, ENTREGAR]);
    expect(idsDasAcoesDoMomento({ sigla: "PÁT", tipo: "cavalo" })).toEqual([
      ENTREGAR,
      DISPONIBILIZAR,
    ]);
  });

  it("baixada (VND e SUC): nenhuma ação, nem com pedido", () => {
    for (const sigla of SIGLAS_DE_BAIXA) {
      expect(idsDasAcoesDoMomento({ sigla, tipo: "cavalo" }), sigla).toEqual([]);
      expect(
        idsDasAcoesDoMomento({ sigla, tipo: "cavalo", etapa: "receber", pedidoAberto: true }),
        sigla,
      ).toEqual([]);
    }
  });

  it("todo id devolvido existe em ACOES, nunca repete e a ordem é estável", () => {
    const existentes = new Set(ACOES.map((a) => a.id));
    for (const sigla of SIGLAS) {
      for (const etapa of [null, "receber", "concluir"] as const) {
        const ids = idsDasAcoesDoMomento({ sigla, tipo: "cavalo", etapa, pedidoAberto: !!etapa });
        for (const id of ids) expect(existentes.has(id), `${sigla}: ${id}`).toBe(true);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });
});
