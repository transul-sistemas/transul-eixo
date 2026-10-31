import { describe, expect, it } from "vitest";
import { ACOES } from "@/lib/navegacao/acoes";
import { SIGLAS } from "./status";
import { idsDasAcoesDoMomento } from "./acoes-do-momento";

describe("idsDasAcoesDoMomento: quais ações de ACOES combinam com a situação (regra provisória)", () => {
  it("DOp (disponível no Operacional): receber placa", () => {
    expect(idsDasAcoesDoMomento({ sigla: "DOp" })).toEqual(["operacional.receber-placa"]);
  });
  it("PÁT (no pátio): disponibilizar ao Operacional", () => {
    expect(idsDasAcoesDoMomento({ sigla: "PÁT" })).toEqual(["frota.disponibilizar-ao-operacional"]);
  });
  it("baixada (VND e SUC): nenhuma ação", () => {
    expect(idsDasAcoesDoMomento({ sigla: "VND" })).toEqual([]);
    expect(idsDasAcoesDoMomento({ sigla: "SUC" })).toEqual([]);
  });
  it("todo id devolvido, para qualquer sigla, existe em ACOES", () => {
    const existentes = new Set(ACOES.map((a) => a.id));
    for (const sigla of SIGLAS) {
      for (const id of idsDasAcoesDoMomento({ sigla })) {
        expect(existentes.has(id), `${sigla}: ${id}`).toBe(true);
      }
    }
  });
  it("nunca repete um id e a ordem é estável", () => {
    for (const sigla of SIGLAS) {
      const ids = idsDasAcoesDoMomento({ sigla });
      expect(new Set(ids).size).toBe(ids.length);
      expect(idsDasAcoesDoMomento({ sigla })).toEqual(ids);
    }
  });
  it("só DOp e PÁT têm ação por ora", () => {
    const comAcao = SIGLAS.filter((sigla) => idsDasAcoesDoMomento({ sigla }).length > 0);
    expect([...comAcao].sort()).toEqual(["DOp", "PÁT"].sort());
  });
});
