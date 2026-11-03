import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ASSINATURA_DO_TIPO_DO_CR, assinaturaDoTipoDoCr, tipoDoCr } from "@/lib/dominio/cr";

describe("tipo do CR pelos sinais do Sankhya (espelho de nucleo.tipo_do_cr)", () => {
  it("AD_FROTA desligado: serviço, com ou sem VEICULO", () => {
    expect(tipoDoCr(false, null)).toBe("servico");
    expect(tipoDoCr(false, false)).toBe("servico");
    expect(tipoDoCr(false, true)).toBe("servico");
  });

  it("AD_FROTA ligado: frota de placa com VEICULO ligado, frota sem placa com VEICULO desligado", () => {
    expect(tipoDoCr(true, true)).toBe("frota_de_placa");
    expect(tipoDoCr(true, false)).toBe("frota_sem_placa");
  });

  it("sem o sinal que decide, o tipo fica pendente (nulo), nunca presumido", () => {
    expect(tipoDoCr(null, null)).toBeNull();
    expect(tipoDoCr(null, true)).toBeNull();
    expect(tipoDoCr(true, null)).toBeNull();
  });

  it("a assinatura é a mesma constante que o pgTAP 60 confere no banco", () => {
    const md5 = createHash("md5").update(assinaturaDoTipoDoCr(), "utf8").digest("hex");
    expect(md5).toBe(ASSINATURA_DO_TIPO_DO_CR);
    expect(ASSINATURA_DO_TIPO_DO_CR).toBe("ddb7e0d7b60a5dc8e514fe0deab03297");
  });
});
