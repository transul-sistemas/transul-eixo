import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONFIGURACOES_DE_CONJUNTO,
  configuracaoDoConjunto,
  MENSAGENS_DA_COMPOSICAO,
  motivoDeComposicaoInvalida,
  type UnidadeDoConjunto,
} from "@/lib/dominio/composicao";
import { blocoDoSeed } from "@/lib/qualidade/catalogo-de-status";

const semi = (
  posicao: number,
  eixos: number | null,
  carroceria = "Graneleira",
): UnidadeDoConjunto => ({
  posicao,
  funcao: "semirreboque",
  eixos,
  carroceria,
});
const dolly = (posicao: number): UnidadeDoConjunto => ({
  posicao,
  funcao: "dolly",
  eixos: 2,
  carroceria: null,
});

describe("estrutura do conjunto (regra da equipe, 03/11/2026)", () => {
  it("aceita bitrem, bitrezão, rodotrem e simples de 2 ou 3 eixos", () => {
    expect(motivoDeComposicaoInvalida([semi(1, 2), semi(2, 2)])).toBeNull();
    expect(motivoDeComposicaoInvalida([semi(1, 3), semi(2, 3)])).toBeNull();
    expect(motivoDeComposicaoInvalida([semi(1, 2), dolly(2), semi(3, 2)])).toBeNull();
    expect(motivoDeComposicaoInvalida([semi(1, 2)])).toBeNull();
    expect(motivoDeComposicaoInvalida([semi(1, 3)])).toBeNull();
  });

  it("recusa semirreboques de eixos diferentes entre si", () => {
    expect(motivoDeComposicaoInvalida([semi(1, 2), semi(2, 3)])).toBe(
      MENSAGENS_DA_COMPOSICAO.eixosDiferentes,
    );
  });

  it("recusa rodo com semirreboques de 3 eixos", () => {
    expect(motivoDeComposicaoInvalida([semi(1, 3), dolly(2), semi(3, 3)])).toBe(
      MENSAGENS_DA_COMPOSICAO.semConfiguracao,
    );
  });

  it("o dolly só entra entre dois semirreboques", () => {
    expect(motivoDeComposicaoInvalida([dolly(1)])).toBe(MENSAGENS_DA_COMPOSICAO.dollyForaDoRodo);
    expect(motivoDeComposicaoInvalida([semi(1, 2), dolly(2)])).toBe(
      MENSAGENS_DA_COMPOSICAO.dollyForaDoRodo,
    );
    expect(motivoDeComposicaoInvalida([semi(1, 2), semi(2, 2), dolly(3)])).toBe(
      MENSAGENS_DA_COMPOSICAO.dollyForaDoRodo,
    );
    expect(motivoDeComposicaoInvalida([dolly(1), semi(2, 2), semi(3, 2)])).toBe(
      MENSAGENS_DA_COMPOSICAO.dollyForaDoRodo,
    );
  });

  it("a ordem é a da posição, não a da lista", () => {
    expect(motivoDeComposicaoInvalida([semi(3, 2), dolly(2), semi(1, 2)])).toBeNull();
  });

  it("recusa três semirreboques sem dolly e mais de três unidades", () => {
    expect(motivoDeComposicaoInvalida([semi(1, 2), semi(2, 2), semi(3, 2)])).toBe(
      MENSAGENS_DA_COMPOSICAO.tresSemirreboques,
    );
    expect(motivoDeComposicaoInvalida([semi(1, 2), dolly(2), semi(3, 2), semi(4, 2)])).toBe(
      MENSAGENS_DA_COMPOSICAO.maisDeTres,
    );
  });

  it("recusa conjunto misto de carrocerias (o dolly não tem carroceria e não conta)", () => {
    expect(motivoDeComposicaoInvalida([semi(1, 2), semi(2, 2, "Sider")])).toBe(
      MENSAGENS_DA_COMPOSICAO.misto,
    );
  });

  it("semirreboque sem eixos informados não trava a composição", () => {
    expect(motivoDeComposicaoInvalida([semi(1, null), semi(2, 2)])).toBeNull();
  });
});

describe("configuracaoDoConjunto: a configuração pela estrutura, nunca pelo total de eixos", () => {
  it("reconhece as quatro", () => {
    expect(configuracaoDoConjunto([semi(1, 3)])).toBe("simples");
    expect(configuracaoDoConjunto([semi(1, 2), semi(2, 2)])).toBe("bi");
    expect(configuracaoDoConjunto([semi(1, 3), semi(2, 3)])).toBe("bitrezao");
    expect(configuracaoDoConjunto([semi(1, 2), dolly(2), semi(3, 2)])).toBe("rodo");
  });

  it("sem os eixos de algum semirreboque fica pendente; sem implemento não há conjunto", () => {
    expect(configuracaoDoConjunto([semi(1, null), semi(2, 2)])).toBe("pendente");
    expect(configuracaoDoConjunto([])).toBeNull();
  });
});

describe("o espelho das configurações é o mesmo do seed", () => {
  it("unidades, dolly, eixos dos semirreboques e eixos do dolly batem com supabase/seed.sql", () => {
    const bloco = blocoDoSeed(
      readFileSync("supabase/seed.sql", "utf-8"),
      "config.configuracao_de_conjunto",
    );
    const doSeed = [
      ...bloco.matchAll(
        /\('(\w+)',\s*'[^']+',\s*(\d+),\s*(true|false),\s*'\{([\d,]+)\}',\s*(null|\d+)\)/g,
      ),
    ].map((m) => ({
      codigo: m[1],
      unidades: Number(m[2]),
      comDolly: m[3] === "true",
      eixosDosSemirreboques: m[4]!.split(",").map(Number),
      eixosDoDolly: m[5] === "null" ? null : Number(m[5]),
    }));
    expect(doSeed).toEqual(CONFIGURACOES_DE_CONJUNTO);
  });
});

describe("as mensagens do domínio são as mesmas do banco", () => {
  it("cada mensagem aparece na migration da composição", () => {
    const migration = readFileSync(
      "supabase/migrations/20261103130413_composicao_e_conjunto.sql",
      "utf-8",
    );
    for (const mensagem of Object.values(MENSAGENS_DA_COMPOSICAO)) {
      expect(migration, mensagem).toContain(mensagem);
    }
  });
});
