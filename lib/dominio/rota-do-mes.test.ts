import { describe, expect, it } from "vitest";
import { mudancasDeCidade, type PontoDaRota, trechosDaRota } from "./rota-do-mes";

const p = (dia: string, cidade: string | null, semSinal = false): PontoDaRota => ({
  dia,
  cidade,
  uf: cidade ? "SP" : null,
  semSinal,
});

describe("rota do mês", () => {
  const pontos = [
    p("2026-11-03", "Cidade Demo 2"),
    p("2026-11-01", "Cidade Demo 1"),
    p("2026-11-02", "Cidade Demo 1"),
    p("2026-11-04", null, true),
    p("2026-11-05", "Cidade Demo 2"),
  ];

  it("agrupa os dias seguidos no mesmo lugar, na ordem dos dias", () => {
    expect(trechosDaRota(pontos)).toEqual([
      {
        de: "2026-11-01",
        ate: "2026-11-02",
        dias: 2,
        cidade: "Cidade Demo 1",
        uf: "SP",
        semSinal: false,
      },
      {
        de: "2026-11-03",
        ate: "2026-11-03",
        dias: 1,
        cidade: "Cidade Demo 2",
        uf: "SP",
        semSinal: false,
      },
      { de: "2026-11-04", ate: "2026-11-04", dias: 1, cidade: null, uf: null, semSinal: true },
      {
        de: "2026-11-05",
        ate: "2026-11-05",
        dias: 1,
        cidade: "Cidade Demo 2",
        uf: "SP",
        semSinal: false,
      },
    ]);
  });

  it("conta as mudanças de cidade; Sem sinal não é mudança", () => {
    expect(mudancasDeCidade(pontos)).toBe(1);
    expect(mudancasDeCidade([])).toBe(0);
  });

  it("dia sem resposta no meio quebra o trecho (01 e 03 na mesma cidade são dois trechos)", () => {
    const comBuraco = [p("2026-11-01", "Cidade Demo 1"), p("2026-11-03", "Cidade Demo 1")];
    expect(trechosDaRota(comBuraco)).toEqual([
      {
        de: "2026-11-01",
        ate: "2026-11-01",
        dias: 1,
        cidade: "Cidade Demo 1",
        uf: "SP",
        semSinal: false,
      },
      {
        de: "2026-11-03",
        ate: "2026-11-03",
        dias: 1,
        cidade: "Cidade Demo 1",
        uf: "SP",
        semSinal: false,
      },
    ]);
  });

  it("vira o mês sem quebrar dias seguidos (31/10 e 01/11)", () => {
    const virada = [p("2026-10-31", "Cidade Demo 1"), p("2026-11-01", "Cidade Demo 1")];
    expect(trechosDaRota(virada)).toHaveLength(1);
  });

  it("sem resposta, nenhum trecho (nada é inventado)", () => {
    expect(trechosDaRota([])).toEqual([]);
  });
});
