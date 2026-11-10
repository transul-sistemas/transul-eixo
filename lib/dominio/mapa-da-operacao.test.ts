import { describe, expect, it } from "vitest";
import { arvoreDaOperacao, textoDoEvento } from "./mapa-da-operacao";

describe("textoDoEvento", () => {
  it("diz o que aconteceu com o objeto, sem nome de pessoa", () => {
    expect(textoDoEvento({ tipo: "placa_entrou", objeto: "AAA0A00", detalhe: null })).toBe(
      "A placa AAA0A00 entrou na operação",
    );
    expect(textoDoEvento({ tipo: "placa_saiu", objeto: "AAA0A00", detalhe: null })).toBe(
      "A placa AAA0A00 saiu da operação",
    );
    expect(textoDoEvento({ tipo: "cr_montado", objeto: "K1", detalhe: "Frota norte" })).toBe(
      "O CR K1 (Frota norte) foi montado na operação",
    );
    expect(textoDoEvento({ tipo: "cr_desmontado", objeto: "K1", detalhe: null })).toBe(
      "O CR K1 saiu da operação",
    );
    expect(textoDoEvento({ tipo: "pessoa_vinculada", objeto: "Motorista", detalhe: null })).toBe(
      "Uma pessoa foi vinculada como Motorista",
    );
    expect(textoDoEvento({ tipo: "pessoa_desvinculada", objeto: "Motorista", detalhe: null })).toBe(
      "Uma pessoa deixou a função Motorista",
    );
  });
});

const BASE = {
  operacao: "Operação Porto",
  crs: [
    {
      codigo: "K1",
      nome: "Frota A",
      frota: true,
      placas: ["AAA0A00", "BBB1B11"],
      totalDePlacas: 2,
    },
    { codigo: "S1", nome: "Serviço A", frota: false, placas: [], totalDePlacas: 0 },
  ],
  placasSemCr: 1,
  pessoas: [{ nomeDaFuncao: "Motorista", pessoas: 2, nomes: null as string[] | null }],
};

describe("arvoreDaOperacao: Operação > Frota e Serviço > CRs > placas e pessoas", () => {
  it("monta os ramos com os dados reais", () => {
    const a = arvoreDaOperacao(BASE);
    expect(a.nome).toBe("Operação Porto");
    expect(a.filhos?.map((f) => f.nome)).toEqual(["Frota (1 CR)", "Serviço (1 CR)", "Pessoas (2)"]);
    const frota = a.filhos?.[0];
    expect(frota?.filhos?.[0]?.nome).toBe("K1 · Frota A (2 placas)");
    expect(frota?.filhos?.[0]?.filhos?.map((p) => p.nome)).toEqual(["AAA0A00", "BBB1B11"]);
  });
  it("placas sem CR e pessoas sem nome ficam escritas, sem inventar", () => {
    const a = arvoreDaOperacao(BASE);
    expect(a.filhos?.[0]?.filhos?.some((f) => f.nome === "1 placa sem CR")).toBe(true);
    expect(a.filhos?.[2]?.filhos?.map((f) => f.nome)).toEqual(["Motorista (2)"]);
    expect(a.filhos?.[2]?.filhos?.[0]?.filhos).toBeUndefined();
  });
  it("quem vê Pessoas recebe os nomes na função", () => {
    const a = arvoreDaOperacao({
      ...BASE,
      pessoas: [{ nomeDaFuncao: "Motorista", pessoas: 2, nomes: ["Ana", "Bia"] }],
    });
    expect(a.filhos?.[2]?.filhos?.[0]?.filhos?.map((f) => f.nome)).toEqual(["Ana", "Bia"]);
  });
  it("mais placas do que o banco entregou viram um nó de resumo", () => {
    const a = arvoreDaOperacao({
      ...BASE,
      crs: [{ codigo: "K1", nome: null, frota: true, placas: ["AAA0A00"], totalDePlacas: 5 }],
      placasSemCr: 0,
    });
    const placas = a.filhos?.[0]?.filhos?.[0]?.filhos;
    expect(placas?.at(-1)).toMatchObject({ nome: "+ 4 placas", resumo: true });
  });
  it("sem frota, sem serviço e sem pessoas, só a raiz", () => {
    expect(
      arvoreDaOperacao({ operacao: "X", crs: [], placasSemCr: 0, pessoas: [] }).filhos,
    ).toBeUndefined();
  });
});
