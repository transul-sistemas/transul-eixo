import { describe, expect, it } from "vitest";
import {
  anexarContexto,
  escreverContexto,
  lerContexto,
  OPCOES_PROVISORIAS,
  periodoDe,
  periodoValido,
  type OpcoesDoContexto,
} from "./contexto";

const HOJE = "2026-10-29";
const parametros = (texto: string) => new URLSearchParams(texto);

describe("periodoDe", () => {
  it("é o mês da data", () => {
    expect(periodoDe("2026-10-29")).toBe("2026-10");
    expect(periodoDe("2027-01-01")).toBe("2027-01");
  });
});

describe("periodoValido", () => {
  it.each(["2026-01", "2026-09", "2026-12", "2000-06"])("%s é válido", (periodo) => {
    expect(periodoValido(periodo)).toBe(true);
  });
  it.each([
    "2026-13",
    "2026-00",
    "2026-9",
    "26-09",
    "2026/09",
    "2026-09-01",
    "",
    "abc",
    " 2026-09",
  ])("%j não é válido", (periodo) => {
    expect(periodoValido(periodo)).toBe(false);
  });
});

describe("lerContexto", () => {
  it("sem nada na URL, usa o mês de hoje e os padrões", () => {
    expect(lerContexto(parametros(""), HOJE)).toEqual({
      periodo: "2026-10",
      filial: "todas",
      operacao: "todas",
      regime: "gerencial",
    });
  });
  it("lê o período da URL", () => {
    expect(lerContexto(parametros("periodo=2026-09"), HOJE).periodo).toBe("2026-09");
  });
  it("período inválido volta ao mês de hoje", () => {
    expect(lerContexto(parametros("periodo=2026-13"), HOJE).periodo).toBe("2026-10");
    expect(lerContexto(parametros("periodo=lixo"), HOJE).periodo).toBe("2026-10");
    expect(lerContexto(parametros("periodo="), HOJE).periodo).toBe("2026-10");
  });
  it("regime que não existe volta a Gerencial", () => {
    expect(lerContexto(parametros("regime=xyz"), HOJE).regime).toBe("gerencial");
    expect(lerContexto(parametros("regime=gerencial"), HOJE).regime).toBe("gerencial");
  });
  it("filial e operação que não existem voltam a Todas", () => {
    expect(lerContexto(parametros("filial=999&operacao=nada"), HOJE)).toMatchObject({
      filial: "todas",
      operacao: "todas",
    });
  });
  it("com as opções reais, aceita o que existe e recusa o resto", () => {
    const opcoes: OpcoesDoContexto = {
      ...OPCOES_PROVISORIAS,
      filiais: [
        { id: "todas", nome: "Todas as filiais" },
        { id: "matriz", nome: "Matriz" },
      ],
    };
    expect(lerContexto(parametros("filial=matriz"), HOJE, opcoes).filial).toBe("matriz");
    expect(lerContexto(parametros("filial=outra"), HOJE, opcoes).filial).toBe("todas");
  });
  it("ignora o que não é contexto", () => {
    expect(lerContexto(parametros("modo=mapa&q=abc"), HOJE).periodo).toBe("2026-10");
  });
  it("com o parâmetro repetido, vale o primeiro", () => {
    expect(lerContexto(parametros("periodo=2026-08&periodo=2026-09"), HOJE).periodo).toBe(
      "2026-08",
    );
  });
});

describe("escreverContexto", () => {
  const padrao = lerContexto(parametros(""), HOJE);

  it("com tudo no padrão, não escreve nada", () => {
    expect(escreverContexto(parametros(""), padrao, HOJE).toString()).toBe("");
  });
  it("escreve só o que difere do padrão", () => {
    const resultado = escreverContexto(parametros(""), { ...padrao, periodo: "2026-09" }, HOJE);
    expect(resultado.toString()).toBe("periodo=2026-09");
  });
  it("voltar ao padrão tira o parâmetro da URL", () => {
    const resultado = escreverContexto(parametros("periodo=2026-09"), padrao, HOJE);
    expect(resultado.toString()).toBe("");
  });
  it("não mexe nos parâmetros que não são contexto", () => {
    const resultado = escreverContexto(
      parametros("modo=mapa&q=abc"),
      { ...padrao, periodo: "2026-09" },
      HOJE,
    );
    expect(resultado.get("modo")).toBe("mapa");
    expect(resultado.get("q")).toBe("abc");
    expect(resultado.get("periodo")).toBe("2026-09");
  });
  it("não altera os parâmetros recebidos", () => {
    const original = parametros("periodo=2026-08");
    escreverContexto(original, { ...padrao, periodo: "2026-09" }, HOJE);
    expect(original.toString()).toBe("periodo=2026-08");
  });
  it("ida e volta preserva um contexto válido", () => {
    const contexto = { ...padrao, periodo: "2025-12" };
    expect(lerContexto(escreverContexto(parametros(""), contexto, HOJE), HOJE)).toEqual(contexto);
  });
  it("o padrão do período acompanha o mês de hoje", () => {
    const resultado = escreverContexto(
      parametros(""),
      { ...padrao, periodo: "2026-10" },
      "2026-11-02",
    );
    expect(resultado.get("periodo")).toBe("2026-10");
  });
});

describe("anexarContexto (o contexto acompanha a pessoa de uma tela para outra)", () => {
  it("leva o contexto da URL para o link", () => {
    expect(anexarContexto("/frota/placas", parametros("periodo=2026-09"))).toBe(
      "/frota/placas?periodo=2026-09",
    );
  });
  it("leva só os parâmetros de contexto, não filtros da tela", () => {
    expect(
      anexarContexto("/frota/placas", parametros("periodo=2026-09&q=abc&modo=mapa&chip=x")),
    ).toBe("/frota/placas?periodo=2026-09");
  });
  it("sem contexto na URL, o link fica como está", () => {
    expect(anexarContexto("/frota/placas", parametros(""))).toBe("/frota/placas");
    expect(anexarContexto("/frota/placas", parametros("q=abc"))).toBe("/frota/placas");
  });
  it("junta com o que o link já tem, como o modo, sem repetir", () => {
    expect(anexarContexto("/frota/acompanhamento?modo=mapa", parametros("periodo=2026-09"))).toBe(
      "/frota/acompanhamento?modo=mapa&periodo=2026-09",
    );
  });
  it("não sobrescreve o contexto que o próprio link já define", () => {
    expect(anexarContexto("/frota/placas?periodo=2026-01", parametros("periodo=2026-09"))).toBe(
      "/frota/placas?periodo=2026-01",
    );
  });
  it("leva os quatro itens do contexto", () => {
    const resultado = anexarContexto(
      "/x",
      parametros("periodo=2026-09&filial=matriz&operacao=a&regime=gerencial"),
    );
    expect(new URLSearchParams(resultado.split("?")[1]).size).toBe(4);
  });
});
