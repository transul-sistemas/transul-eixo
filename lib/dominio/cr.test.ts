import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ASSINATURA_DO_TIPO_DO_CR,
  ASSINATURA_DO_TIPO_PELA_UNIDADE,
  assinaturaDoTipoDoCr,
  assinaturaDoTipoPelaUnidade,
  tipoDoCr,
  tipoDoCrPelaUnidade,
} from "@/lib/dominio/cr";

describe("tipo do CR pelos sinais do Sankhya (espelho de nucleo.tipo_do_cr)", () => {
  it("AD_FROTA N ou vazio: serviço, com ou sem VEICULO (o vazio é serviço, nunca pendente)", () => {
    expect(tipoDoCr(false, null)).toBe("servico");
    expect(tipoDoCr(false, false)).toBe("servico");
    expect(tipoDoCr(false, true)).toBe("servico");
    expect(tipoDoCr(null, null)).toBe("servico");
    expect(tipoDoCr(null, false)).toBe("servico");
    expect(tipoDoCr(null, true)).toBe("servico");
  });

  it("AD_FROTA S: frota de ativo (placa ou equipamento) com VEICULO S; frota sem placa com VEICULO diferente de S", () => {
    expect(tipoDoCr(true, true)).toBe("frota_de_ativo");
    expect(tipoDoCr(true, false)).toBe("frota_sem_placa");
    expect(tipoDoCr(true, null)).toBe("frota_sem_placa");
  });

  it("a assinatura é a mesma constante que o pgTAP (60 e 65) confere no banco", () => {
    const md5 = createHash("md5").update(assinaturaDoTipoDoCr(), "utf8").digest("hex");
    expect(md5).toBe(ASSINATURA_DO_TIPO_DO_CR);
    expect(ASSINATURA_DO_TIPO_DO_CR).toBe("a8823458d9dc448f92e48d710b52f760");
  });
});

describe("tipo do CR pela unidade gerencial (espelho de nucleo.tipo_do_cr_pela_unidade, 3.9c)", () => {
  it("frota: frota de ativo, salvo VEICULO N (frota sem placa); sem o sinal, frota de ativo", () => {
    expect(tipoDoCrPelaUnidade("frota", true)).toBe("frota_de_ativo");
    expect(tipoDoCrPelaUnidade("frota", null)).toBe("frota_de_ativo");
    expect(tipoDoCrPelaUnidade("frota", false)).toBe("frota_sem_placa");
  });

  it("as demais unidades dão o próprio tipo, com qualquer VEICULO", () => {
    for (const v of [null, false, true]) {
      expect(tipoDoCrPelaUnidade("acionista", v)).toBe("acionista");
      expect(tipoDoCrPelaUnidade("servico", v)).toBe("servico");
      expect(tipoDoCrPelaUnidade("participacoes", v)).toBe("participacoes");
      expect(tipoDoCrPelaUnidade("transulog", v)).toBe("transulog");
    }
  });

  it("a assinatura é a mesma constante que o pgTAP (67) confere no banco", () => {
    const md5 = createHash("md5").update(assinaturaDoTipoPelaUnidade(), "utf8").digest("hex");
    expect(md5).toBe(ASSINATURA_DO_TIPO_PELA_UNIDADE);
    expect(ASSINATURA_DO_TIPO_PELA_UNIDADE).toBe("d01179725d9db49ddb5bb56cdcb9ce37");
  });
});
