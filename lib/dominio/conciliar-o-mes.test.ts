import { describe, expect, it } from "vitest";
import { pendentesDoAcionista, resumoDoAcionista } from "./conciliar-o-mes";

type Linha = {
  crId: string;
  agrupadorId: string;
  situacao: "confere" | "diferenca" | "sem_lancamento" | "justificada";
};

const l = (crId: string, agrupadorId: string, situacao: Linha["situacao"]): Linha => ({
  crId,
  agrupadorId,
  situacao,
});

const LINHAS: Linha[] = [
  l("a", "P", "confere"),
  l("b", "P", "sem_lancamento"),
  l("c", "P", "diferenca"),
  l("d", "P", "justificada"),
  l("e", "Q", "diferenca"),
];

describe("Conciliar o mês", () => {
  it("pendentes = diferença ou sem lançamento, ainda sem justificativa, só do acionista escolhido", () => {
    expect(pendentesDoAcionista(LINHAS, "P").map((x) => x.crId)).toEqual(["b", "c"]);
    expect(pendentesDoAcionista(LINHAS, "Q").map((x) => x.crId)).toEqual(["e"]);
  });

  it("sem acionista escolhido, nada é pendente (a conferência é por acionista)", () => {
    expect(pendentesDoAcionista(LINHAS, null)).toEqual([]);
  });

  it("o resumo do acionista conta linhas, conferem, justificadas e pendentes", () => {
    expect(resumoDoAcionista(LINHAS, "P")).toEqual({
      linhas: 4,
      conferem: 1,
      justificadas: 1,
      pendentes: 2,
    });
  });

  it("acionista sem linha no mês: tudo zero (não há o que conferir)", () => {
    expect(resumoDoAcionista(LINHAS, "Z")).toEqual({
      linhas: 0,
      conferem: 0,
      justificadas: 0,
      pendentes: 0,
    });
  });
});
