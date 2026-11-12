import { describe, expect, it } from "vitest";
import {
  diasDoMes,
  engatadoNoDia,
  instanteDoDia,
  medidaDoDia,
  rotuloDoSelo,
  siglaDoImplementoNoDia,
} from "@/lib/dominio/grade-por-conjunto";

// As regras puras da grade por conjunto, espelho do que o banco calcula (nucleo.dias_do_implemento,
// nucleo.situacao_no_dia): a célula de um dia vale pelo fim do dia, a vigência é [início, fim), e o
// implemento engatado herda a sigla do cavalo. O banco continua sendo a fonte; isto cobre os limites.

describe("diasDoMes: as colunas seguem os dias do mês", () => {
  it("tem de 28 a 31 colunas conforme o mês, inclusive em ano bissexto", () => {
    expect(diasDoMes("2026-02", "2026-11-12")).toHaveLength(28);
    expect(diasDoMes("2028-02", "2028-11-12")).toHaveLength(29);
    expect(diasDoMes("2026-04", "2026-11-12")).toHaveLength(30);
    expect(diasDoMes("2026-01", "2026-11-12")).toHaveLength(31);
  });
  it("traz o dia da semana (letra minúscula) e marca o fim de semana", () => {
    const dias = diasDoMes("2026-11", "2026-11-12");
    expect(dias[0]).toMatchObject({
      dia: "2026-11-01",
      numero: "01",
      diaDaSemana: "dom",
      fimDeSemana: true,
    });
    expect(dias[1]).toMatchObject({ dia: "2026-11-02", diaDaSemana: "seg", fimDeSemana: false });
    expect(dias[6]).toMatchObject({ dia: "2026-11-07", diaDaSemana: "sáb", fimDeSemana: true });
  });
  it("marca hoje e o que ainda não chegou", () => {
    const dias = diasDoMes("2026-11", "2026-11-12");
    expect(dias.filter((d) => d.hoje).map((d) => d.dia)).toEqual(["2026-11-12"]);
    expect(dias[10]?.futuro).toBe(false);
    expect(dias[12]?.futuro).toBe(true);
  });
  it("num mês passado nenhum dia é hoje nem futuro", () => {
    const dias = diasDoMes("2026-01", "2026-11-12");
    expect(dias.some((d) => d.hoje || d.futuro)).toBe(false);
  });
});

describe("engatadoNoDia: o dia vale pelo fim do dia, vigência [início, fim)", () => {
  const agora = "2026-11-12T12:00:00-03:00";
  const engate = { inicio: "2026-01-10T09:00:00-03:00", fim: "2026-01-20T15:00:00-03:00" };
  it("engatar de manhã põe o implemento no conjunto naquele dia", () => {
    expect(engatadoNoDia([engate], "2026-01-09", agora)).toBe(false);
    expect(engatadoNoDia([engate], "2026-01-10", agora)).toBe(true);
  });
  it("desatrelar à tarde tira o implemento naquele mesmo dia", () => {
    expect(engatadoNoDia([engate], "2026-01-19", agora)).toBe(true);
    expect(engatadoNoDia([engate], "2026-01-20", agora)).toBe(false);
  });
  it("limites exatos à meia-noite: o início conta e o fim não", () => {
    const meiaNoite = { inicio: "2026-01-11T00:00:00-03:00", fim: "2026-01-20T00:00:00-03:00" };
    expect(engatadoNoDia([meiaNoite], "2026-01-10", agora)).toBe(false);
    expect(engatadoNoDia([meiaNoite], "2026-01-11", agora)).toBe(true);
    expect(engatadoNoDia([meiaNoite], "2026-01-19", agora)).toBe(true);
    expect(engatadoNoDia([meiaNoite], "2026-01-20", agora)).toBe(false);
  });
  it("vigência em aberto vale até hoje", () => {
    expect(
      engatadoNoDia([{ inicio: "2026-11-01T08:00:00-03:00", fim: null }], "2026-11-12", agora),
    ).toBe(true);
  });
  it("hoje vale pelo agora: engate marcado para depois ainda não conta", () => {
    expect(
      engatadoNoDia([{ inicio: "2026-11-12T18:00:00-03:00", fim: null }], "2026-11-12", agora),
    ).toBe(false);
  });
  it("sem vigência, fora do conjunto", () => {
    expect(engatadoNoDia([], "2026-01-10", agora)).toBe(false);
  });
});

describe("instanteDoDia", () => {
  it("é o último instante do dia em São Paulo, ou agora se o dia é hoje", () => {
    expect(instanteDoDia("2026-01-10", "2026-11-12T12:00:00-03:00")).toBe(
      Date.parse("2026-01-10T23:59:59.999-03:00"),
    );
    expect(instanteDoDia("2026-11-12", "2026-11-12T12:00:00-03:00")).toBe(
      Date.parse("2026-11-12T12:00:00-03:00"),
    );
  });
});

describe("siglaDoImplementoNoDia: o implemento engatado herda a sigla do cavalo", () => {
  it("engatado: a sigla do cavalo", () => {
    expect(siglaDoImplementoNoDia({ engatado: true, siglaDoCavalo: "ETc" })).toBe("ETc");
  });
  it("engatado com o cavalo impedido: o conjunto inteiro mostra a sigla impedida", () => {
    expect(siglaDoImplementoNoDia({ engatado: true, siglaDoCavalo: "MAc" })).toBe("MAc");
  });
  it("fora do conjunto, sem sigla", () => {
    expect(siglaDoImplementoNoDia({ engatado: false, siglaDoCavalo: "ETc" })).toBeNull();
  });
  it("cavalo sem situação no dia: o implemento também fica sem", () => {
    expect(siglaDoImplementoNoDia({ engatado: true, siglaDoCavalo: null })).toBeNull();
  });
});

describe("rotuloDoSelo: o selo de lançamentos por célula, com texto e não só ponto", () => {
  it("sem lançamento, sem selo", () => {
    expect(rotuloDoSelo({ eventos: 0, manual: false, tardia: false })).toBeNull();
  });
  it("conta no singular e no plural", () => {
    expect(rotuloDoSelo({ eventos: 1, manual: false, tardia: false })).toBe("1 lançamento");
    expect(rotuloDoSelo({ eventos: 3, manual: false, tardia: false })).toBe("3 lançamentos");
  });
  it("diz quando algum foi manual ou correção tardia", () => {
    expect(rotuloDoSelo({ eventos: 2, manual: true, tardia: false })).toBe(
      "2 lançamentos, com lançamento manual",
    );
    expect(rotuloDoSelo({ eventos: 1, manual: false, tardia: true })).toBe(
      "1 lançamento, com correção tardia",
    );
    expect(rotuloDoSelo({ eventos: 2, manual: true, tardia: true })).toBe(
      "2 lançamentos, com lançamento manual e correção tardia",
    );
  });
});

describe("medidaDoDia: X de Y conjuntos com lançamento hoje", () => {
  it("devolve X e Y como vieram do banco (nada é somado no navegador)", () => {
    expect(medidaDoDia(9, 14)).toEqual({ tipo: "medida", x: 9, y: 14, completa: false });
  });
  it("todos lançaram: completa", () => {
    expect(medidaDoDia(14, 14)).toEqual({ tipo: "medida", x: 14, y: 14, completa: true });
  });
  it("sem conjuntos ativos no dia, a medida é vazia (nunca 0 de 0)", () => {
    expect(medidaDoDia(0, 0)).toEqual({ tipo: "vazia" });
  });
});
