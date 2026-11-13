import { describe, expect, it } from "vitest";
import {
  argumentosDoBanco,
  ASSISTENTES_DOS_PAINEIS,
  ESQUEMAS_DOS_PAINEIS,
  valoresIniciaisDoAssistente,
} from "./paineis";

describe("assistentes das telas de painel", () => {
  it("todo assistente tem esquema, função do banco, efeitos e nome verbo + objeto", () => {
    for (const [id, a] of Object.entries(ASSISTENTES_DOS_PAINEIS)) {
      expect(ESQUEMAS_DOS_PAINEIS[id as keyof typeof ESQUEMAS_DOS_PAINEIS], id).toBeDefined();
      expect(a.funcao, id).toMatch(/^[a-z_]+$/);
      expect(a.efeitos.length, id).toBeGreaterThan(0);
      expect(a.titulo, id).toMatch(/^\p{Lu}\p{L}*r\s+\S/u);
      expect(a.concluido.endsWith("."), id).toBe(true);
    }
  });

  it("os campos de cada passo são os do esquema", () => {
    for (const [id, a] of Object.entries(ASSISTENTES_DOS_PAINEIS)) {
      const valores = valoresIniciaisDoAssistente(
        id as keyof typeof ESQUEMAS_DOS_PAINEIS,
        "2026-11-13",
      );
      const campos = a.passos.flatMap((p) => p.campos.map((c) => c.id));
      expect(Object.keys(valores).sort(), id).toEqual([...campos].sort());
    }
  });

  it("reabrir o mês exige o motivo", () => {
    const r = ESQUEMAS_DOS_PAINEIS["reabrir-mes"].safeParse({ mes: "2026-09", motivo: "curto" });
    expect(r.success).toBe(false);
    expect(
      ESQUEMAS_DOS_PAINEIS["reabrir-mes"].safeParse({
        mes: "2026-09",
        motivo: "Lançamento de frete chegou atrasado do Sankhya.",
      }).success,
    ).toBe(true);
  });

  it("o substituto é outra pessoa e o fim não vem antes do início", () => {
    const e = ESQUEMAS_DOS_PAINEIS["indicar-substituto"];
    const base = { motoristaId: "a", substitutoId: "b", inicio: "2026-11-10", fim: "2026-11-20" };
    expect(e.safeParse(base).success).toBe(true);
    const mesmo = e.safeParse({ ...base, substitutoId: "a" });
    expect(mesmo.success).toBe(false);
    expect(mesmo.error?.issues[0]?.path).toEqual(["substitutoId"]);
    const invertido = e.safeParse({ ...base, fim: "2026-11-09" });
    expect(invertido.error?.issues[0]?.path).toEqual(["fim"]);
    // Um dia só vale (início igual ao fim: intervalo fechado nos dois dias).
    expect(e.safeParse({ ...base, fim: "2026-11-10" }).success).toBe(true);
  });

  it("o pedido de ajuste pede valor maior que zero e justificativa", () => {
    const e = ESQUEMAS_DOS_PAINEIS["pedir-ajuste"];
    const base = {
      mes: "2026-10",
      operacaoId: "op",
      natureza: "custo",
      valorCentavos: 12345,
      justificativa: "Despesa classificada no CR errado.",
    };
    expect(e.safeParse(base).success).toBe(true);
    expect(e.safeParse({ ...base, valorCentavos: 0 }).success).toBe(false);
    expect(e.safeParse({ ...base, natureza: "outra" }).success).toBe(false);
  });

  it("lançar abastecimento normaliza a placa e confere os números", () => {
    const e = ESQUEMAS_DOS_PAINEIS["lancar-abastecimento"];
    const r = e.safeParse({
      placa: "zdm-1a23",
      dia: "2026-11-12",
      litros: 312.5,
      hodometro: 154000,
      valorCentavos: 187500,
    });
    expect(r.success && r.data.placa).toBe("ZDM1A23");
    expect(
      e.safeParse({
        placa: "ZDM1A23",
        dia: "2026-11-12",
        litros: 0,
        hodometro: 1,
        valorCentavos: 1,
      }).success,
    ).toBe(false);
  });

  it("os argumentos do banco levam o dinheiro em reais, o mês no dia 1 e a chave de envio", () => {
    expect(argumentosDoBanco("fechar-mes", { mes: "2026-10" }, "k")).toEqual({
      p_mes: "2026-10-01",
      p_chave: "k",
    });
    const ajuste = argumentosDoBanco(
      "pedir-ajuste",
      {
        mes: "2026-10",
        operacaoId: "op",
        natureza: "custo",
        valorCentavos: 12345,
        justificativa: "x",
      },
      "k",
    );
    expect(ajuste.p_valor).toBe(123.45);
    expect(ajuste.p_chave).toBe("k");
  });
});
