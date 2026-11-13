import { describe, expect, it } from "vitest";
import { ehExcecaoDaDemonstracao, paginar } from "./excecoes-da-demonstracao";

// O filtro "Demo" da fila de exceções: só o que a carga de demonstração marcou (docs/demonstracao.md):
// placa ZDM, CR DEMO-n, pessoa "Demo ..." ou lançamento DEMO-.

const base = { placa: null, cr: null, pessoaNome: null, descricao: "" };

describe("ehExcecaoDaDemonstracao", () => {
  it("placa ZDM, CR DEMO-n, pessoa Demo e lançamento DEMO- são da demonstração", () => {
    expect(ehExcecaoDaDemonstracao({ ...base, placa: "ZDM0A00" })).toBe(true);
    expect(ehExcecaoDaDemonstracao({ ...base, cr: "DEMO-12" })).toBe(true);
    expect(ehExcecaoDaDemonstracao({ ...base, pessoaNome: "Demo Ana" })).toBe(true);
    expect(ehExcecaoDaDemonstracao({ ...base, descricao: "origem DEMO-DATA-FORA-DE-FAIXA" })).toBe(
      true,
    );
  });
  it("o resto é real", () => {
    expect(ehExcecaoDaDemonstracao({ ...base, placa: "ZDA1B23" })).toBe(false);
    expect(ehExcecaoDaDemonstracao({ ...base, cr: "1001" })).toBe(false);
    expect(ehExcecaoDaDemonstracao({ ...base, pessoaNome: "Demóstenes" })).toBe(false);
  });
});

describe("paginar", () => {
  it("devolve a página pedida e o total, com a última página parcial", () => {
    const itens = Array.from({ length: 7 }, (_, i) => i);
    expect(paginar(itens, 2, 3)).toEqual({ linhas: [3, 4, 5], total: 7, pagina: 2 });
    expect(paginar(itens, 3, 3)).toEqual({ linhas: [6], total: 7, pagina: 3 });
  });
  it("página além do fim volta à última que existe", () => {
    expect(paginar([1, 2], 9, 50)).toEqual({ linhas: [1, 2], total: 2, pagina: 1 });
  });
});
