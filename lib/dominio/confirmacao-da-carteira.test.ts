import { describe, expect, it } from "vitest";
import {
  itensParaGravar,
  ordemDeAtencao,
  progressoDaCarteira,
  type RespostaDaPlaca,
} from "./confirmacao-da-carteira";

// Confirmar a carteira em 3 passos: "Está comigo", "Não é minha" ou "Corrigir" por placa. As três viram
// o par (confere, observação) que nucleo.confirmar_carteira já entende; a observação diz qual foi.

const r = (placa: string, resposta: RespostaDaPlaca["resposta"], nota = ""): RespostaDaPlaca => ({
  ativoId: `id-${placa}`,
  placa,
  resposta,
  nota,
});

describe("itensParaGravar", () => {
  it("Está comigo confere, sem observação", () => {
    expect(itensParaGravar([r("AAA1A11", "comigo", "ignorada")])).toEqual([
      { ativoId: "id-AAA1A11", placa: "AAA1A11", confere: true, observacao: "" },
    ]);
  });
  it("Não é minha e Corrigir não conferem e levam o rótulo na observação", () => {
    const [a, b] = itensParaGravar([
      r("AAA1A11", "nao-e-minha", "foi para outra filial"),
      r("BBB2B22", "corrigir", " RENAVAM errado "),
    ]);
    expect(a).toEqual({
      ativoId: "id-AAA1A11",
      placa: "AAA1A11",
      confere: false,
      observacao: "Não é minha: foi para outra filial",
    });
    expect(b?.observacao).toBe("Corrigir: RENAVAM errado");
  });
  it("sem nota, a observação fica vazia para o esquema pedir o texto", () => {
    expect(itensParaGravar([r("AAA1A11", "corrigir", "  ")])[0]?.observacao).toBe("");
  });
});

describe("progressoDaCarteira", () => {
  it("conta as que estão comigo sobre o total (12 de 14)", () => {
    const lista = [
      ...Array.from({ length: 12 }, (_, i) => r(`P${String(i)}`, "comigo")),
      r("X", "nao-e-minha"),
      r("Y", "corrigir"),
    ];
    expect(progressoDaCarteira(lista)).toEqual({ confirmadas: 12, total: 14, aResolver: 2 });
  });
  it("lista vazia: zero de zero", () => {
    expect(progressoDaCarteira([])).toEqual({ confirmadas: 0, total: 0, aResolver: 0 });
  });
});

describe("ordemDeAtencao", () => {
  it("as que pedem atenção vêm primeiro, mantendo a ordem entre iguais", () => {
    const lista = [r("A", "comigo"), r("B", "corrigir"), r("C", "comigo"), r("D", "nao-e-minha")];
    expect(ordemDeAtencao(lista).map((x) => x.placa)).toEqual(["B", "D", "A", "C"]);
  });
});
