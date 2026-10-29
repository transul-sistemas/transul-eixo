import { describe, expect, it } from "vitest";
import {
  lerPreferencias,
  NOME_DO_COOKIE_DE_PLACAS,
  PREFERENCIAS_PADRAO,
  serializarPreferencias,
  TAMANHOS_DE_PAGINA,
} from "./preferencias-da-tabela";

const COLUNAS = ["placa", "tipo", "modelo", "gestor", "situacao", "alertas"];
const ler = (valor: string | undefined) => lerPreferencias(valor, COLUNAS);

describe("preferências da tabela (cookie validado na leitura)", () => {
  it("o padrão: 25 linhas, densidade compacta, colunas do padrão da tela", () => {
    expect(PREFERENCIAS_PADRAO).toEqual({
      tam: 25,
      densidade: "compacta",
      colunas: null,
      ordemDasColunas: null,
    });
    expect([...TAMANHOS_DE_PAGINA]).toEqual([25, 50, 100]);
    expect(NOME_DO_COOKIE_DE_PLACAS).toBe("eixo-tabela-placas");
  });

  it.each([undefined, "", "não é json", "[]", "123", "null", "true", '"texto"', "{"])(
    "valor ausente ou que não é um objeto (%j) cai no padrão",
    (valor) => {
      expect(ler(valor)).toEqual(PREFERENCIAS_PADRAO);
    },
  );

  it("lê um valor válido", () => {
    const valor = JSON.stringify({
      tam: 50,
      densidade: "confortavel",
      colunas: ["placa", "tipo"],
      ordemDasColunas: ["tipo", "placa"],
    });
    expect(ler(valor)).toEqual({
      tam: 50,
      densidade: "confortavel",
      colunas: ["placa", "tipo"],
      ordemDasColunas: ["tipo", "placa"],
    });
  });

  it.each([7, "x", 9999, 50.5, null, "50", true, [], {}, -25, 0])(
    "tamanho de página fora da lista (%j) volta a 25",
    (tam) => {
      expect(ler(JSON.stringify({ tam })).tam).toBe(25);
    },
  );
  it.each([25, 50, 100])("tamanho %i é aceito", (tam) => {
    expect(ler(JSON.stringify({ tam })).tam).toBe(tam);
  });

  it.each(["enorme", "", null, 1, ["compacta"]])(
    "densidade inválida (%j) volta a compacta",
    (d) => {
      expect(ler(JSON.stringify({ densidade: d })).densidade).toBe("compacta");
    },
  );

  it("um campo inválido não derruba os vizinhos válidos", () => {
    const lida = ler(JSON.stringify({ tam: 7, densidade: "confortavel", colunas: ["placa"] }));
    expect(lida).toEqual({
      tam: 25,
      densidade: "confortavel",
      colunas: ["placa"],
      ordemDasColunas: null,
    });
  });

  it("colunas: tira o que não existe e o que se repete, mantendo a ordem", () => {
    expect(
      ler(JSON.stringify({ colunas: ["tipo", "xxx", "placa", "tipo", 7, null] })).colunas,
    ).toEqual(["tipo", "placa"]);
  });
  it.each([[[]], [["xxx"]], ["texto"], [42], [{}], [null]])(
    "colunas sem nenhuma válida (%j) voltam ao padrão da tela (null)",
    (colunas) => {
      expect(ler(JSON.stringify({ colunas })).colunas).toBeNull();
      expect(ler(JSON.stringify({ ordemDasColunas: colunas })).ordemDasColunas).toBeNull();
    },
  );

  it("texto grande demais é descartado inteiro", () => {
    const enorme = JSON.stringify({ tam: 50, colunas: Array(5000).fill("placa") });
    expect(enorme.length).toBeGreaterThan(2000);
    expect(ler(enorme)).toEqual(PREFERENCIAS_PADRAO);
  });

  it("o limite vale para o texto já decodificado (o servidor recebe o cookie decodificado)", () => {
    const medio = JSON.stringify({ tam: 50, colunas: Array(200).fill("placa") });
    expect(medio.length).toBeGreaterThan(1000);
    expect(ler(medio)).toEqual(PREFERENCIAS_PADRAO);
    expect(ler(encodeURIComponent(medio))).toEqual(PREFERENCIAS_PADRAO);
  });
  it("um valor legítimo, com todas as colunas escolhidas e ordenadas, cabe no limite", () => {
    const todas = ["placa", "tipo", "modelo", "conjunto", "gestor", "situacao", "alertas"];
    const valor = serializarPreferencias({
      tam: 100,
      densidade: "confortavel",
      colunas: todas,
      ordemDasColunas: [...todas].reverse(),
    });
    expect(lerPreferencias(valor, todas).colunas).toEqual(todas);
  });

  it("chave perigosa no JSON não contamina nada", () => {
    const lida = ler('{"__proto__":{"tam":100},"constructor":{"tam":100},"tam":50}');
    expect(lida.tam).toBe(50);
    expect(({} as Record<string, unknown>).tam).toBeUndefined();
    expect(ler('{"__proto__":{"tam":100}}').tam).toBe(25);
  });

  it("ida e volta: o que se grava é o que se lê (cookie codificado)", () => {
    const original = {
      tam: 100 as const,
      densidade: "confortavel" as const,
      colunas: ["placa", "alertas"],
      ordemDasColunas: ["alertas", "placa"],
    };
    const gravado = serializarPreferencias(original);
    expect(gravado).not.toMatch(/[\s;,"]/); // seguro para valor de cookie
    expect(ler(gravado)).toEqual(original);
  });
  it("lê também o valor já decodificado (como o servidor às vezes entrega)", () => {
    expect(ler('{"tam":50}').tam).toBe(50);
    expect(ler(encodeURIComponent('{"tam":50}')).tam).toBe(50);
  });
  it("percent-encoding quebrado não lança erro", () => {
    expect(ler("%E0%A4%A")).toEqual(PREFERENCIAS_PADRAO);
  });
});
