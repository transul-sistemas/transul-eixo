import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ASSINATURA_DO_TIPO_DO_CR, assinaturaDoTipoDoCr, tipoDoCr } from "@/lib/dominio/cr";

describe("tipo do CR pelos sinais do Sankhya (espelho de nucleo.tipo_do_cr)", () => {
  it("AD_FROTA N ou vazio: serviço, com ou sem VEICULO (o vazio é serviço, nunca pendente)", () => {
    expect(tipoDoCr(false, null)).toBe("servico");
    expect(tipoDoCr(false, false)).toBe("servico");
    expect(tipoDoCr(false, true)).toBe("servico");
    expect(tipoDoCr(null, null)).toBe("servico");
    expect(tipoDoCr(null, false)).toBe("servico");
    expect(tipoDoCr(null, true)).toBe("servico");
  });

  it("AD_FROTA S: frota de placa com VEICULO S; frota sem placa com VEICULO diferente de S", () => {
    expect(tipoDoCr(true, true)).toBe("frota_de_placa");
    expect(tipoDoCr(true, false)).toBe("frota_sem_placa");
    expect(tipoDoCr(true, null)).toBe("frota_sem_placa");
  });

  it("a assinatura é a mesma constante que o pgTAP (60 e 65) confere no banco", () => {
    const md5 = createHash("md5").update(assinaturaDoTipoDoCr(), "utf8").digest("hex");
    expect(md5).toBe(ASSINATURA_DO_TIPO_DO_CR);
    expect(ASSINATURA_DO_TIPO_DO_CR).toBe("cc0ddd63a7f39933c402d3bbfcc6baa2");
  });
});
