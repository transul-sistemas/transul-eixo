import { describe, expect, it } from "vitest";
import {
  chaveDoEstado,
  ESTADO_INICIAL,
  gravarEstado,
  lerEstado,
  limparPeloCatalogo,
  reduzir,
  somarContadores,
  type EstadoDaBarra,
} from "./estado-da-barra";

function armazenamentoEmMemoria() {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
  };
}

const quebrado = {
  getItem: () => {
    throw new Error("armazenamento indisponível");
  },
  setItem: () => {
    throw new Error("armazenamento indisponível");
  },
};

describe("estado inicial", () => {
  it("começa expandida, sem grupo aberto e sem fixados", () => {
    expect(ESTADO_INICIAL).toEqual({ versao: 1, compacta: false, gruposAbertos: [], fixados: [] });
  });
});

describe("reduzir", () => {
  it("alterna o modo compacto", () => {
    const compacta = reduzir(ESTADO_INICIAL, { tipo: "alternarCompacta" });
    expect(compacta.compacta).toBe(true);
    expect(reduzir(compacta, { tipo: "alternarCompacta" }).compacta).toBe(false);
  });
  it("abre e fecha um grupo sem mexer nos outros", () => {
    let estado = reduzir(ESTADO_INICIAL, { tipo: "alternarGrupo", id: "frota" });
    estado = reduzir(estado, { tipo: "alternarGrupo", id: "pessoas" });
    expect(estado.gruposAbertos).toEqual(["frota", "pessoas"]);
    estado = reduzir(estado, { tipo: "alternarGrupo", id: "frota" });
    expect(estado.gruposAbertos).toEqual(["pessoas"]);
  });
  it("abrirGrupo é idempotente", () => {
    let estado = reduzir(ESTADO_INICIAL, { tipo: "abrirGrupo", id: "frota" });
    estado = reduzir(estado, { tipo: "abrirGrupo", id: "frota" });
    expect(estado.gruposAbertos).toEqual(["frota"]);
  });
  it("fixa no fim da lista e desfixa", () => {
    let estado = reduzir(ESTADO_INICIAL, { tipo: "alternarFixado", id: "frota.placas" });
    estado = reduzir(estado, { tipo: "alternarFixado", id: "pessoas.escala" });
    expect(estado.fixados).toEqual(["frota.placas", "pessoas.escala"]);
    estado = reduzir(estado, { tipo: "alternarFixado", id: "frota.placas" });
    expect(estado.fixados).toEqual(["pessoas.escala"]);
  });
  it("fixar duas vezes volta ao estado de antes", () => {
    const duas = reduzir(reduzir(ESTADO_INICIAL, { tipo: "alternarFixado", id: "a.b" }), {
      tipo: "alternarFixado",
      id: "a.b",
    });
    expect(duas).toEqual(ESTADO_INICIAL);
  });
  it("substituir troca o estado inteiro", () => {
    const outro: EstadoDaBarra = {
      versao: 1,
      compacta: true,
      gruposAbertos: ["frota"],
      fixados: [],
    };
    expect(reduzir(ESTADO_INICIAL, { tipo: "substituir", estado: outro })).toEqual(outro);
  });
  it("nunca altera o estado recebido", () => {
    const antes = JSON.stringify(ESTADO_INICIAL);
    reduzir(ESTADO_INICIAL, { tipo: "alternarGrupo", id: "frota" });
    reduzir(ESTADO_INICIAL, { tipo: "alternarFixado", id: "frota.placas" });
    expect(JSON.stringify(ESTADO_INICIAL)).toBe(antes);
  });
});

describe("memória por usuário", () => {
  const estado: EstadoDaBarra = {
    versao: 1,
    compacta: true,
    gruposAbertos: ["frota"],
    fixados: ["frota.placas"],
  };

  it("grava e lê de volta o mesmo estado", () => {
    const armazenamento = armazenamentoEmMemoria();
    gravarEstado("ana", estado, armazenamento);
    expect(lerEstado("ana", armazenamento)).toEqual(estado);
  });
  it("cada usuário tem a sua memória", () => {
    const armazenamento = armazenamentoEmMemoria();
    gravarEstado("ana", estado, armazenamento);
    expect(lerEstado("bia", armazenamento)).toEqual(ESTADO_INICIAL);
    expect(chaveDoEstado("ana")).not.toBe(chaveDoEstado("bia"));
    expect(chaveDoEstado("ana")).toBe("eixo:barra:ana");
  });
  it("sem nada gravado devolve o estado inicial", () => {
    expect(lerEstado("ana", armazenamentoEmMemoria())).toEqual(ESTADO_INICIAL);
  });
  it("armazenamento que lança erro não derruba a barra", () => {
    expect(lerEstado("ana", quebrado)).toEqual(ESTADO_INICIAL);
    expect(() => gravarEstado("ana", estado, quebrado)).not.toThrow();
  });
  it.each([
    ["JSON inválido", "{"],
    ["texto solto", "abc"],
    ["versão diferente", JSON.stringify({ ...estado, versao: 2 })],
    ["tipo errado em compacta", JSON.stringify({ ...estado, compacta: "sim" })],
    ["lista que não é lista", JSON.stringify({ ...estado, fixados: "frota.placas" })],
    ["valor nulo", "null"],
    ["lista no lugar do objeto", "[]"],
  ])("conteúdo corrompido (%s) volta ao estado inicial", (_nome, texto) => {
    const armazenamento = armazenamentoEmMemoria();
    armazenamento.dados.set(chaveDoEstado("ana"), texto);
    expect(lerEstado("ana", armazenamento)).toEqual(ESTADO_INICIAL);
  });
  it("itens que não são texto saem das listas", () => {
    const armazenamento = armazenamentoEmMemoria();
    armazenamento.dados.set(
      chaveDoEstado("ana"),
      JSON.stringify({
        ...estado,
        gruposAbertos: ["frota", 3, null],
        fixados: [{}, "frota.placas"],
      }),
    );
    const lido = lerEstado("ana", armazenamento);
    expect(lido.gruposAbertos).toEqual(["frota"]);
    expect(lido.fixados).toEqual(["frota.placas"]);
  });
});

describe("limparPeloCatalogo", () => {
  it("descarta grupo e fixado que não existem mais no catálogo", () => {
    const sujo: EstadoDaBarra = {
      versao: 1,
      compacta: true,
      gruposAbertos: ["frota", "sumiu"],
      fixados: ["frota.placas", "frota.inexistente", "sumiu.tela"],
    };
    const limpo = limparPeloCatalogo(sujo);
    expect(limpo.gruposAbertos).toEqual(["frota"]);
    expect(limpo.fixados).toEqual(["frota.placas"]);
    expect(limpo.compacta).toBe(true);
  });
  it("tira repetidos", () => {
    const repetido: EstadoDaBarra = {
      versao: 1,
      compacta: false,
      gruposAbertos: ["frota", "frota"],
      fixados: ["frota.placas", "frota.placas"],
    };
    const limpo = limparPeloCatalogo(repetido);
    expect(limpo.gruposAbertos).toEqual(["frota"]);
    expect(limpo.fixados).toEqual(["frota.placas"]);
  });
  it("não mexe no que está certo", () => {
    expect(limparPeloCatalogo(ESTADO_INICIAL)).toEqual(ESTADO_INICIAL);
  });
});

describe("somarContadores (o contador da tela sobe para o módulo)", () => {
  it("soma por módulo e ignora tela que não existe", () => {
    expect(
      somarContadores({ "frota.placas": 3, "frota.carteira": 2, "pessoas.escala": 1, "x.y": 9 }),
    ).toEqual({ frota: 5, pessoas: 1 });
  });
  it("ignora valor negativo, não inteiro ou que não é número", () => {
    expect(
      somarContadores({
        "frota.placas": -1,
        "frota.carteira": Number.NaN,
        "frota.analise": 2.5,
        "pessoas.escala": 4,
      }),
    ).toEqual({ pessoas: 4 });
  });
  it("módulo sem contador não aparece, nem como zero", () => {
    expect(somarContadores({})).toEqual({});
    expect(somarContadores({ "frota.placas": 0 })).toEqual({});
  });
});
