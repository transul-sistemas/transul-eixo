import { describe, expect, it } from "vitest";
import { alternarChip, consultaAtiva, escreverConsulta, lerConsulta } from "./consulta";

const parametros = (texto: string) => new URLSearchParams(texto);

describe("lerConsulta (busca e chips ficam na URL)", () => {
  it("sem nada na URL, a consulta está vazia", () => {
    expect(lerConsulta(parametros(""))).toEqual({ busca: "", chips: [] });
  });
  it("lê a busca e os chips", () => {
    expect(lerConsulta(parametros("q=abc&chip=atencao&chip=patio"))).toEqual({
      busca: "abc",
      chips: ["atencao", "patio"],
    });
  });
  it("tira chip repetido e chip vazio", () => {
    expect(lerConsulta(parametros("chip=a&chip=a&chip=")).chips).toEqual(["a"]);
  });
  it("ignora o que não é consulta", () => {
    expect(lerConsulta(parametros("periodo=2026-09&modo=mapa"))).toEqual({ busca: "", chips: [] });
  });
});

describe("escreverConsulta", () => {
  it("escreve busca e chips e mantém os outros parâmetros", () => {
    const novos = escreverConsulta(parametros("periodo=2026-09&modo=mapa"), {
      busca: "abc",
      chips: ["atencao", "patio"],
    });
    expect(novos.get("q")).toBe("abc");
    expect(novos.getAll("chip")).toEqual(["atencao", "patio"]);
    expect(novos.get("periodo")).toBe("2026-09");
    expect(novos.get("modo")).toBe("mapa");
  });
  it("busca vazia ou só com espaço sai da URL", () => {
    expect(escreverConsulta(parametros("q=abc"), { busca: "", chips: [] }).toString()).toBe("");
    expect(escreverConsulta(parametros("q=abc"), { busca: "   ", chips: [] }).has("q")).toBe(false);
  });
  it("tira os espaços das pontas da busca", () => {
    expect(escreverConsulta(parametros(""), { busca: "  abc ", chips: [] }).get("q")).toBe("abc");
  });
  it("troca os chips antigos pelos novos, sem repetir", () => {
    const novos = escreverConsulta(parametros("chip=velho"), { busca: "", chips: ["a", "a", "b"] });
    expect(novos.getAll("chip")).toEqual(["a", "b"]);
  });
  it("ida e volta preserva a consulta", () => {
    const consulta = { busca: "placa nova", chips: ["fora"] };
    expect(lerConsulta(escreverConsulta(parametros(""), consulta))).toEqual(consulta);
  });
  it("não altera os parâmetros recebidos", () => {
    const original = parametros("q=a");
    escreverConsulta(original, { busca: "b", chips: [] });
    expect(original.toString()).toBe("q=a");
  });
});

describe("alternarChip e consultaAtiva", () => {
  it("liga e desliga um chip", () => {
    expect(alternarChip([], "a")).toEqual(["a"]);
    expect(alternarChip(["a", "b"], "a")).toEqual(["b"]);
  });
  it("só há consulta ativa com busca ou chip", () => {
    expect(consultaAtiva({ busca: "", chips: [] })).toBe(false);
    expect(consultaAtiva({ busca: "a", chips: [] })).toBe(true);
    expect(consultaAtiva({ busca: "", chips: ["x"] })).toBe(true);
  });
});
