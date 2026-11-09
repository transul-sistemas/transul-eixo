import { describe, expect, it } from "vitest";
import { esquemaConfirmarCarteira, esquemaLancarSituacao } from "./acompanhamento";

const ATIVO = "8a5e0000-0000-4000-8000-000000000001";

describe("Lançar a situação do dia", () => {
  it("aceita placa, sigla da régua e dia", () => {
    expect(
      esquemaLancarSituacao.safeParse({
        ativoId: ATIVO,
        placa: "ABC1D23",
        sigla: "PÁT",
        dia: "2026-11-09",
      }).success,
    ).toBe(true);
  });

  it("recusa a baixa, a sigla fora da régua e o dia mal escrito", () => {
    for (const errado of [
      { sigla: "VND" },
      { sigla: "XYZ" },
      { dia: "09/11/2026" },
      { ativoId: "nao-e-uuid" },
    ]) {
      expect(
        esquemaLancarSituacao.safeParse({
          ativoId: ATIVO,
          placa: "ABC1D23",
          sigla: "PÁT",
          dia: "2026-11-09",
          ...errado,
        }).success,
      ).toBe(false);
    }
  });
});

describe("Confirmar carteira", () => {
  const item = { ativoId: ATIVO, placa: "ABC1D23", confere: true, observacao: "" };

  it("aceita o mês e ao menos uma placa", () => {
    expect(esquemaConfirmarCarteira.safeParse({ mes: "2026-11", itens: [item] }).success).toBe(
      true,
    );
    expect(esquemaConfirmarCarteira.safeParse({ mes: "2026-11", itens: [] }).success).toBe(false);
  });

  it("'não confere' exige a observação, no campo da placa", () => {
    const r = esquemaConfirmarCarteira.safeParse({
      mes: "2026-11",
      itens: [{ ...item, confere: false, observacao: "  " }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["itens", 0, "observacao"]);
    expect(
      esquemaConfirmarCarteira.safeParse({
        mes: "2026-11",
        itens: [{ ...item, confere: false, observacao: "Está com outro gestor" }],
      }).success,
    ).toBe(true);
  });
});
