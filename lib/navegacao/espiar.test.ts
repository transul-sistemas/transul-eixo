import { describe, expect, it } from "vitest";
import { comEspiar, lerEspiar, PARAMETRO_DE_ESPIAR, vizinhas } from "./espiar";

const ler = (consulta: string) => lerEspiar(new URLSearchParams(consulta));

describe("lerEspiar: só a placa já normalizada", () => {
  it("o parâmetro se chama espiar", () => {
    expect(PARAMETRO_DE_ESPIAR).toBe("espiar");
  });
  it.each(["AAA0A00", "ABC1234", "BRA2E19", "AAA0C17"])("aceita %s", (placa) => {
    expect(ler(`espiar=${placa}`)).toBe(placa);
  });
  it.each([
    ["minúscula", "aaa0a00"],
    ["com hífen", "AAA-0A00"],
    ["hífen e minúscula", "aaa-0a00"],
    ["com espaços", "%20AAA0A00%20"],
    ["curta", "AAA0A0"],
    ["longa", "AAA0A000"],
    ["só letras", "AAAAAAA"],
    ["só números", "1234567"],
    ["vazia", ""],
    ["HTML", "%3Cscript%3E"],
    ["byte nulo", "%00"],
    ["espaço no meio", "AAA%200A00"],
    ["acento", "AÁA0A00"],
    ["muito longa", "A".repeat(500)],
    ["letra no lugar do algarismo", "AAAAA00"],
  ])("ignora, sem erro: %s", (_nome, valor) => {
    expect(ler(`espiar=${valor}`)).toBeNull();
  });
  it("sem o parâmetro devolve nulo", () => {
    expect(ler("")).toBeNull();
    expect(ler("q=AAA0A00&chip=patio")).toBeNull();
  });
  it("repetido: vale o primeiro valor, e se o primeiro é inválido, ignora (sem pular para o segundo)", () => {
    expect(ler("espiar=AAA0A00&espiar=BBB1B11")).toBe("AAA0A00");
    expect(ler("espiar=lixo&espiar=BBB1B11")).toBeNull();
  });
  it("a placa só é lida do parâmetro espiar, não de outros", () => {
    expect(ler("q=AAA0A00")).toBeNull();
  });
});

describe("comEspiar: põe ou tira o parâmetro e não mexe em mais nada", () => {
  const tudo =
    "q=abc&chip=patio&chip=cavalo&sigla=P%C3%81T&baixadas=1&ordem=-gestor&pagina=2&tam=50&foco=1&periodo=2026-10&filial=todas&modo=agora";

  it("põe a placa", () => {
    const novos = comEspiar(new URLSearchParams(tudo), "AAA0A00");
    expect(novos.get("espiar")).toBe("AAA0A00");
  });
  it("preserva todos os outros parâmetros, com os valores repetidos e na mesma ordem", () => {
    const antes = new URLSearchParams(tudo);
    const sem = (p: URLSearchParams) =>
      [...p.entries()].filter(([chave]) => chave !== "espiar").map(([c, v]) => `${c}=${v}`);
    expect(sem(comEspiar(antes, "AAA0A00"))).toEqual(sem(antes));
    expect(comEspiar(antes, "AAA0A00").getAll("chip")).toEqual(["patio", "cavalo"]);
  });
  it("trocar de placa substitui, sem acumular", () => {
    const novos = comEspiar(new URLSearchParams("espiar=AAA0A00&pagina=2"), "BBB1B11");
    expect(novos.getAll("espiar")).toEqual(["BBB1B11"]);
    expect(novos.get("pagina")).toBe("2");
  });
  it("nulo tira só o espiar", () => {
    const novos = comEspiar(new URLSearchParams(`espiar=AAA0A00&${tudo}`), null);
    expect(novos.has("espiar")).toBe(false);
    expect(novos.toString()).toBe(new URLSearchParams(tudo).toString());
  });
  it("nunca grava uma placa fora do formato: vira o mesmo que nulo", () => {
    const novos = comEspiar(new URLSearchParams("espiar=AAA0A00&pagina=2"), "aaa-0a00");
    expect(novos.has("espiar")).toBe(false);
    expect(novos.get("pagina")).toBe("2");
  });
  it("não altera os parâmetros recebidos", () => {
    const original = new URLSearchParams("pagina=2");
    comEspiar(original, "AAA0A00");
    expect(original.toString()).toBe("pagina=2");
  });
  it("ida e volta: o que se escreve se lê", () => {
    expect(lerEspiar(comEspiar(new URLSearchParams(tudo), "AAA0A00"))).toBe("AAA0A00");
  });
});

describe("vizinhas: andar pelas linhas da página atual", () => {
  const placas = ["AAA0A00", "AAA0A04", "AAA0A10", "AAA0A14"];

  it("no meio: anterior, próxima e a posição (base 1)", () => {
    expect(vizinhas(placas, "AAA0A04")).toEqual({
      anterior: "AAA0A00",
      proxima: "AAA0A10",
      posicao: 2,
      total: 4,
    });
  });
  it("na primeira, não há anterior", () => {
    expect(vizinhas(placas, "AAA0A00")).toEqual({
      anterior: null,
      proxima: "AAA0A04",
      posicao: 1,
      total: 4,
    });
  });
  it("na última, não há próxima", () => {
    expect(vizinhas(placas, "AAA0A14")).toEqual({
      anterior: "AAA0A10",
      proxima: null,
      posicao: 4,
      total: 4,
    });
  });
  it("placa que não está na página: sem vizinhas e sem posição, mas com o total", () => {
    expect(vizinhas(placas, "ZZZ9Z99")).toEqual({
      anterior: null,
      proxima: null,
      posicao: null,
      total: 4,
    });
  });
  it("lista vazia", () => {
    expect(vizinhas([], "AAA0A00")).toEqual({
      anterior: null,
      proxima: null,
      posicao: null,
      total: 0,
    });
  });
  it("lista de uma placa só", () => {
    expect(vizinhas(["AAA0A00"], "AAA0A00")).toEqual({
      anterior: null,
      proxima: null,
      posicao: 1,
      total: 1,
    });
  });
  it("não altera a lista recebida", () => {
    const copia = [...placas];
    vizinhas(placas, "AAA0A04");
    expect(placas).toEqual(copia);
  });
});
