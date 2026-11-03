import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TIPOS_DE_ATIVO } from "@/lib/dados/placas-tipos";
import {
  ASSINATURA_DA_VALIDADE,
  assinaturaDaValidade,
  siglaValidaNoContexto,
  situacaoDoAtivo,
} from "@/lib/dominio/situacao";
import { SIGLAS } from "@/lib/dominio/status";

describe("validade da sigla no contexto (espelho de nucleo.sigla_valida)", () => {
  it("o tipo tem de estar nos tipos válidos", () => {
    expect(siglaValidaNoContexto("SMo", "implemento", false)).toBe(false);
    expect(siglaValidaNoContexto("SMo", "apoio", false)).toBe(false);
    expect(siglaValidaNoContexto("VAz", "implemento", false)).toBe(false);
    expect(siglaValidaNoContexto("PÁT", "implemento", false)).toBe(true);
  });

  it("solo só fora de conjunto, conjunto só dentro, ambos sempre", () => {
    expect(siglaValidaNoContexto("ACe", "cavalo", false)).toBe(false);
    expect(siglaValidaNoContexto("ACe", "cavalo", true)).toBe(true);
    expect(siglaValidaNoContexto("MAN", "cavalo", true)).toBe(false);
    expect(siglaValidaNoContexto("MAN", "cavalo", false)).toBe(true);
    expect(siglaValidaNoContexto("SDo", "cavalo", true)).toBe(true);
    expect(siglaValidaNoContexto("SDo", "cavalo", false)).toBe(true);
  });

  it("o caminhão (que nunca tem composição) depende só dos tipos", () => {
    expect(siglaValidaNoContexto("ACe", "caminhao", false)).toBe(true);
    expect(siglaValidaNoContexto("MAc", "caminhao", false)).toBe(false);
  });

  it("a assinatura da validade é a mesma do banco (o pgTAP 40 confere a mesma constante)", () => {
    const md5 = createHash("md5").update(assinaturaDaValidade(), "utf8").digest("hex");
    expect(md5).toBe(ASSINATURA_DA_VALIDADE);
    expect(ASSINATURA_DA_VALIDADE).toBe("6f838f3c16c75615ab050c9493d0efc9");
    const combinacoes = assinaturaDaValidade().split(",");
    expect(combinacoes).toHaveLength(126);
    expect(SIGLAS.length * TIPOS_DE_ATIVO.length * 2).toBeGreaterThan(combinacoes.length);
  });
});

describe("situação do ativo (espelho de nucleo.situacao_em)", () => {
  it("vale a camada de maior prioridade com estado", () => {
    expect(situacaoDoAtivo({ proprios: { atividade: "PÁT" } })).toBe("PÁT");
    expect(situacaoDoAtivo({ proprios: { atividade: "DOp", "sem-motorista": "SMo" } })).toBe("SMo");
    expect(
      situacaoDoAtivo({ proprios: { atividade: "DOp", "sem-motorista": "SMo", impedida: "MAN" } }),
    ).toBe("MAN");
    expect(situacaoDoAtivo({ proprios: { impedida: "MAN", "fora-da-frota": "VEN" } })).toBe("VEN");
    expect(situacaoDoAtivo({ proprios: { "fora-da-frota": "VEN", baixada: "VND" } })).toBe("VND");
  });

  it("sem estado em nenhuma camada, pendente (nunca presumido)", () => {
    expect(situacaoDoAtivo({ proprios: {} })).toBe("pendente");
  });

  it("o implemento engatado herda só a atividade do cavalo", () => {
    const cavalo = { atividade: "ETc", "sem-motorista": "FEr" } as const;
    expect(
      situacaoDoAtivo({ proprios: { atividade: "PÁT" }, cavalo, outrosMembros: [cavalo] }),
    ).toBe("ETc");
  });

  it("um membro impedido deixa o conjunto inteiro impedido", () => {
    const cavalo = { atividade: "ETc" } as const;
    const implementoEmManutencao = { impedida: "MAc" } as const;
    // o cavalo vê o impedimento do implemento
    expect(situacaoDoAtivo({ proprios: cavalo, outrosMembros: [implementoEmManutencao] })).toBe(
      "MAc",
    );
    // o outro implemento também
    expect(
      situacaoDoAtivo({ proprios: {}, cavalo, outrosMembros: [cavalo, implementoEmManutencao] }),
    ).toBe("MAc");
    // cavalo impedido deixa o implemento impedido
    expect(
      situacaoDoAtivo({
        proprios: {},
        cavalo: { atividade: "ETc", impedida: "MAc" },
        outrosMembros: [{ atividade: "ETc", impedida: "MAc" }],
      }),
    ).toBe("MAc");
    for (const sigla of ["SDo", "DOC", "MAN"] as const) {
      expect(
        situacaoDoAtivo({ proprios: cavalo, outrosMembros: [{ impedida: sigla }] }),
        sigla,
      ).toBe(sigla);
    }
  });

  it("o impedimento próprio vale antes do herdado", () => {
    expect(
      situacaoDoAtivo({ proprios: { impedida: "SDo" }, outrosMembros: [{ impedida: "MAc" }] }),
    ).toBe("SDo");
  });
});
