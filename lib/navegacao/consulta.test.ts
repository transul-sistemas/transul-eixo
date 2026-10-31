import { describe, expect, it } from "vitest";
import {
  alternarChip,
  consultaAtiva,
  contarFiltrosAtivos,
  escreverConsulta,
  lerConsulta,
} from "./consulta";

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

describe("escreverConsulta e a página", () => {
  it("mudar a busca ou os chips volta para a primeira página (tira o parâmetro pagina)", () => {
    const params = new URLSearchParams("q=a&pagina=4&tam=50");
    const novos = escreverConsulta(params, { busca: "ab", chips: [] });
    expect(novos.has("pagina")).toBe(false);
    expect(novos.get("tam")).toBe("50");
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

describe("contarFiltrosAtivos: o 'N filtros ativos' ao lado da busca", () => {
  const extras = ["sigla", "baixadas"];
  it("sem nada, zero", () => {
    expect(contarFiltrosAtivos(parametros(""), extras)).toBe(0);
  });
  it("a busca conta um, e só se tem texto (espaços não contam)", () => {
    expect(contarFiltrosAtivos(parametros("q=abc"), extras)).toBe(1);
    expect(contarFiltrosAtivos(parametros("q=%20%20"), extras)).toBe(0);
    expect(contarFiltrosAtivos(parametros("q="), extras)).toBe(0);
  });
  it("cada chip conta um, sem repetir o mesmo chip", () => {
    expect(contarFiltrosAtivos(parametros("chip=cavalo&chip=em-atividade"), extras)).toBe(2);
    expect(contarFiltrosAtivos(parametros("chip=cavalo&chip=cavalo"), extras)).toBe(1);
    expect(contarFiltrosAtivos(parametros("chip="), extras)).toBe(0);
  });
  it("cada valor dos filtros de 'Mais filtros' conta um (siglas repetidas e baixadas)", () => {
    expect(contarFiltrosAtivos(parametros("sigla=P%C3%81T&sigla=DOp&baixadas=1"), extras)).toBe(3);
  });
  it("parâmetros que não são filtro (página, ordem, período, espiar) nunca contam", () => {
    expect(
      contarFiltrosAtivos(
        parametros("pagina=2&ordem=-gestor&periodo=2026-10&espiar=AAA0A00&tam=50"),
        extras,
      ),
    ).toBe(0);
  });
  it("soma tudo: busca, chips e extras", () => {
    expect(
      contarFiltrosAtivos(
        parametros("q=abc&chip=cavalo&chip=em-atividade&sigla=DOp&baixadas=1"),
        extras,
      ),
    ).toBe(5);
  });
  it("sem a lista de extras, só busca e chips contam", () => {
    expect(contarFiltrosAtivos(parametros("q=a&chip=b&sigla=DOp"), [])).toBe(2);
  });
});
