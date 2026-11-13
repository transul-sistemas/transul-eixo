import { describe, expect, it } from "vitest";
import { esquemaAvancarEmLote, textoDoLote } from "./operacional";

const ID = "6f1c2b3a-1d2e-4f50-8a9b-0c1d2e3f4a5b";
const UMA = [{ ativoId: ID, placa: "ZDM1A23" }];

describe("avançar no pátio em lote", () => {
  it("pede ao menos uma placa e só aceita as ações sem motivo", () => {
    expect(esquemaAvancarEmLote.safeParse({ acao: "aceitar", placas: [] }).success).toBe(false);
    expect(esquemaAvancarEmLote.safeParse({ acao: "devolver", placas: UMA }).success).toBe(false);
    expect(esquemaAvancarEmLote.safeParse({ acao: "liberar", placas: UMA }).success).toBe(true);
  });

  it('diz "X de Y" com o verbo da ação, no singular e no plural', () => {
    expect(textoDoLote("aceitar", 3, 4)).toBe("3 de 4 placas aceitas.");
    expect(textoDoLote("liberar", 1, 1)).toBe("1 de 1 placa liberada.");
    expect(textoDoLote("liberar", 0, 2)).toBe("0 de 2 placas liberadas.");
  });
});
