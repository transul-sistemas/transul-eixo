import { describe, expect, it } from "vitest";
import {
  lerAlturaDaJanela,
  montarCookieDaAltura,
  NOME_DO_COOKIE_DA_ALTURA_DA_JANELA,
  lerDensidadeLembrada,
  montarCookieDaDensidade,
  NOME_DO_COOKIE_DA_DENSIDADE_DA_GRADE,
  lerTamanhoLembrado,
  lerPreferencias,
  montarCookie,
  NOME_DO_COOKIE_DE_PLACAS,
  PREFERENCIAS_PADRAO,
  serializarPreferencias,
  TAMANHOS_DE_PAGINA,
} from "./preferencias-da-tabela";

const COLUNAS = ["placa", "tipo", "modelo", "gestor", "situacao", "alertas"];
const ler = (valor: string | undefined) => lerPreferencias(valor, COLUNAS);

describe("preferências da tabela (cookie validado na leitura)", () => {
  it("o padrão: 20 linhas, densidade compacta, colunas do padrão da tela", () => {
    expect(PREFERENCIAS_PADRAO).toEqual({
      tam: 20,
      densidade: "compacta",
      colunas: null,
      ordemDasColunas: null,
    });
    expect([...TAMANHOS_DE_PAGINA]).toEqual([20, 50, 100]);
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

  it.each([7, "x", 9999, 50.5, null, "50", true, [], {}, -20, 0])(
    "tamanho de página fora da lista (%j) volta a 20",
    (tam) => {
      expect(ler(JSON.stringify({ tam })).tam).toBe(20);
    },
  );
  it.each([20, 50, 100])("tamanho %i é aceito", (tam) => {
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
      tam: 20,
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
    expect(ler('{"__proto__":{"tam":100}}').tam).toBe(20);
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

describe("montarCookie", () => {
  const prefs = { ...PREFERENCIAS_PADRAO, tam: 50 as const };
  it("grava em toda a aplicação, por um ano, com SameSite=Lax", () => {
    const cookie = montarCookie(prefs, "eixo-tabela-placas", "http:");
    expect(cookie).toContain("eixo-tabela-placas=");
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("max-age=31536000");
    expect(cookie).toContain("SameSite=Lax");
  });
  it("em http (desenvolvimento) não leva Secure; em https leva", () => {
    expect(montarCookie(prefs, "x", "http:")).not.toContain("Secure");
    expect(montarCookie(prefs, "x", "https:")).toContain("; Secure");
  });
  it("o valor gravado é o que a leitura entende", () => {
    const valor = montarCookie(prefs, "x", "https:").split(";")[0]!.slice("x=".length);
    expect(lerPreferencias(valor, []).tam).toBe(50);
  });
});

describe("tamanho de página lembrado (cookie único das listas)", () => {
  it("aceita 20, 50 e 100; o resto volta ao padrão da tela", () => {
    expect(lerTamanhoLembrado("50", 20)).toBe(50);
    expect(lerTamanhoLembrado("100", 20)).toBe(100);
    expect(lerTamanhoLembrado("20", 50)).toBe(20);
    for (const ruim of [undefined, "", "25", "7", "9999", "x", "50.5", "-20"]) {
      expect(lerTamanhoLembrado(ruim, 20)).toBe(20);
    }
  });
});

describe("densidade da grade lembrada (cookie próprio, por pessoa)", () => {
  it("aceita compacta e confortável; o resto volta à compacta", () => {
    expect(lerDensidadeLembrada("confortavel")).toBe("confortavel");
    expect(lerDensidadeLembrada("compacta")).toBe("compacta");
    for (const ruim of [undefined, "", "grande", "COMPACTA", "{}", "confortável"]) {
      expect(lerDensidadeLembrada(ruim)).toBe("compacta");
    }
  });
  it("o cookie vale por um ano em toda a aplicação, e o valor gravado é o que a leitura entende", () => {
    const cookie = montarCookieDaDensidade("confortavel", "http:");
    expect(cookie.startsWith(`${NOME_DO_COOKIE_DA_DENSIDADE_DA_GRADE}=confortavel;`)).toBe(true);
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("max-age=31536000");
    expect(cookie).not.toContain("Secure");
    expect(montarCookieDaDensidade("compacta", "https:")).toContain("; Secure");
    expect(lerDensidadeLembrada(cookie.split(";")[0]!.split("=")[1])).toBe("confortavel");
  });
});

describe("altura da janela lembrada (cookie para o servidor contar as linhas do modo Auto)", () => {
  it("aceita um inteiro plausível; o resto volta à janela padrão (768)", () => {
    expect(lerAlturaDaJanela("900")).toBe(900);
    expect(lerAlturaDaJanela("1080")).toBe(1080);
    for (const ruim of [undefined, "", "abc", "12.5", "-700", "0", "200", "99999", "1e3"]) {
      expect(lerAlturaDaJanela(ruim)).toBe(768);
    }
  });
  it("o cookie vale por um ano em toda a aplicação e a leitura entende o que foi gravado", () => {
    const cookie = montarCookieDaAltura(937, "http:");
    expect(cookie.startsWith(`${NOME_DO_COOKIE_DA_ALTURA_DA_JANELA}=937;`)).toBe(true);
    expect(cookie).toContain("path=/");
    expect(cookie).toContain("max-age=31536000");
    expect(cookie).not.toContain("Secure");
    expect(montarCookieDaAltura(937, "https:")).toContain("; Secure");
    expect(lerAlturaDaJanela(cookie.split(";")[0]!.split("=")[1])).toBe(937);
  });
  it("arredonda para baixo a altura quebrada do navegador", () => {
    expect(montarCookieDaAltura(937.6, "http:")).toContain("=937;");
  });
});
