import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CAMPOS_CORRIGIVEIS,
  CHAVES_SEM_CORRECAO,
  aceitaCorrecaoLocal,
  anosValidos,
  camposPendentes,
  valorDoAtivoPor,
} from "@/lib/dominio/campos-do-ativo";

// O catálogo `config.campo_corrigivel` nasce na migração da 3.7; o espelho tem de bater com ele.
function catalogoDaMigracao(): {
  campo: string;
  origem: string;
  pendenteEm: string[];
  pendenteCom: string | null;
}[] {
  const pasta = "supabase/migrations";
  const arquivo = readdirSync(pasta).find((n) =>
    readFileSync(`${pasta}/${n}`, "utf-8").includes("insert into config.campo_corrigivel"),
  );
  expect(arquivo).toBeTruthy();
  const texto = readFileSync(`${pasta}/${arquivo}`, "utf-8");
  const bloco = /insert into config\.campo_corrigivel[^;]*;/.exec(texto)?.[0] ?? "";
  return [
    ...bloco.matchAll(
      /\('(\w+)', '(\w+)', '[^']*', array\[([^\]]*)\]::nucleo\.tipo_de_ativo\[\], (?:null|'(\w+)')/g,
    ),
  ].map((m) => ({
    campo: m[1] as string,
    origem: m[2] as string,
    pendenteEm: [...(m[3] as string).matchAll(/'(\w+)'/g)].map((t) => t[1] as string),
    pendenteCom: m[4] ?? null,
  }));
}

describe("campos do ativo com origem (espelho de config.campo_corrigivel)", () => {
  it("os campos corrigíveis, a coluna de origem e onde ficam pendentes batem com a migração", () => {
    const banco = catalogoDaMigracao();
    expect(banco).toHaveLength(11);
    expect(
      CAMPOS_CORRIGIVEIS.map((c) => ({
        campo: c.campo,
        origem: c.colunaDaOrigem,
        pendenteEm: [...c.pendenteEm],
        pendenteCom: c.pendenteCom,
      })),
    ).toEqual(banco);
  });

  it("chave nunca aceita correção local", () => {
    for (const chave of CHAVES_SEM_CORRECAO) expect(aceitaCorrecaoLocal(chave)).toBe(false);
    expect(CHAVES_SEM_CORRECAO).toEqual(
      expect.arrayContaining(["placa", "renavam", "cpf", "cnpj", "numero_de_serie", "chassi"]),
    );
    expect(aceitaCorrecaoLocal("eixos")).toBe(true);
    expect(aceitaCorrecaoLocal("tipo")).toBe(false);
  });

  it("faltando dado, o campo fica pendente, conforme o tipo (nunca presumido)", () => {
    expect(camposPendentes("implemento", { eixos: null, tara_kg: 7000, pbt_kg: null })).toEqual(
      expect.arrayContaining(["eixos", "pbt_kg"]),
    );
    expect(camposPendentes("implemento", { eixos: 3 })).not.toContain("eixos");
    expect(camposPendentes("implemento", {})).not.toContain("cmt_kg");
    expect(camposPendentes("cavalo", {})).toContain("cmt_kg");
    expect(camposPendentes("cavalo", {})).toContain("valor_fipe");
    expect(camposPendentes("cavalo", {})).not.toContain("valor_manual");
    expect(camposPendentes("apoio", {})).toContain("valor_manual");
    expect(camposPendentes("caminhao", {})).toContain("carroceria_id");
    expect(camposPendentes("implemento", {})).not.toContain("carroceria_id");
  });

  it("o código FIPE fica pendente quando há valor FIPE sem código", () => {
    expect(camposPendentes("cavalo", { valor_fipe: 450000 })).toContain("codigo_fipe");
    expect(camposPendentes("cavalo", {})).not.toContain("codigo_fipe");
    expect(
      camposPendentes("cavalo", { valor_fipe: 450000, codigo_fipe: "004278-1" }),
    ).not.toContain("codigo_fipe");
    expect(aceitaCorrecaoLocal("codigo_fipe")).toBe(true);
  });

  it("cavalo e caminhão usam o valor FIPE; os demais, o valor manual com fonte e data", () => {
    expect(valorDoAtivoPor("cavalo")).toBe("fipe");
    expect(valorDoAtivoPor("caminhao")).toBe("fipe");
    expect(valorDoAtivoPor("implemento")).toBe("manual");
    expect(valorDoAtivoPor("equipamento")).toBe("manual");
    expect(valorDoAtivoPor("apoio")).toBe("manual");
  });

  it("o ano do modelo é o de fabricação ou o seguinte", () => {
    expect(anosValidos(2022, 2022)).toBe(true);
    expect(anosValidos(2022, 2023)).toBe(true);
    expect(anosValidos(2022, 2021)).toBe(false);
    expect(anosValidos(2022, 2024)).toBe(false);
    expect(anosValidos(null, 2024)).toBe(true);
  });
});
