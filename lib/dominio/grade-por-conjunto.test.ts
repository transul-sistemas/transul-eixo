import { describe, expect, it } from "vitest";
import {
  diasDoMes,
  engatadoNoDia,
  instanteDoDia,
  medidaDoDia,
  linhasQueCabem,
  rotuloDoSelo,
  situacaoDoConjuntoNoDia,
  tamanhoEfetivoDaPagina,
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

describe("situacaoDoConjuntoNoDia: a do cavalo, salvo implemento engatado impedido", () => {
  const impedido = (placa: string, sigla = "MAc") => ({ placa, sigla, grupo: "impedida" as const });
  const livre = (placa: string, sigla = "ETc") => ({
    placa,
    sigla,
    grupo: "em-atividade" as const,
  });

  it("sem implemento impedido, vale a situação do cavalo e não há causa", () => {
    expect(
      situacaoDoConjuntoNoDia({
        cavalo: livre("AAA1A11"),
        implementosEngatados: [livre("BBB1B11")],
      }),
    ).toEqual({ sigla: "ETc", causa: null });
  });
  it("implemento engatado impedido deixa o conjunto impedido, com a causa", () => {
    expect(
      situacaoDoConjuntoNoDia({
        cavalo: livre("AAA1A11"),
        implementosEngatados: [livre("BBB1B11"), impedido("BBB1B12", "SDo")],
      }),
    ).toEqual({ sigla: "SDo", causa: { placa: "BBB1B12", sigla: "SDo" } });
  });
  it("cavalo impedido por si mesmo: a causa é o próprio cavalo (nulo)", () => {
    expect(
      situacaoDoConjuntoNoDia({
        cavalo: impedido("AAA1A11", "MAN"),
        implementosEngatados: [impedido("BBB1B11")],
      }),
    ).toEqual({ sigla: "MAN", causa: null });
  });
  it("com dois implementos impedidos, vale o primeiro engatado (posição mais baixa)", () => {
    expect(
      situacaoDoConjuntoNoDia({
        cavalo: livre("AAA1A11"),
        implementosEngatados: [impedido("BBB1B11", "MAc"), impedido("BBB1B12", "DOC")],
      }).causa,
    ).toEqual({ placa: "BBB1B11", sigla: "MAc" });
  });
  it("implemento fora do conjunto naquele dia não conta (só os engatados entram na lista)", () => {
    expect(situacaoDoConjuntoNoDia({ cavalo: livre("AAA1A11"), implementosEngatados: [] })).toEqual(
      { sigla: "ETc", causa: null },
    );
  });
  it("cavalo sem situação no dia: o conjunto fica sem situação", () => {
    expect(
      situacaoDoConjuntoNoDia({
        cavalo: { placa: "AAA1A11", sigla: null, grupo: null },
        implementosEngatados: [],
      }),
    ).toEqual({ sigla: null, causa: null });
  });
});

describe("linhasQueCabem: a grade cabe na janela, a página nunca rola na vertical", () => {
  it("quanto mais alta a janela, mais linhas; nunca menos de 3 nem mais de 100", () => {
    expect(linhasQueCabem(768, "compacta")).toBeLessThan(linhasQueCabem(1080, "compacta"));
    expect(linhasQueCabem(100, "compacta")).toBe(3);
    expect(linhasQueCabem(100000, "compacta")).toBe(100);
  });
  it("o confortável gasta mais altura por linha: cabem menos linhas", () => {
    expect(linhasQueCabem(900, "confortavel")).toBeLessThan(linhasQueCabem(900, "compacta"));
  });
  it("a conta é exata nos limites: uma linha a mais só quando sobra a altura inteira dela", () => {
    const n = linhasQueCabem(900, "compacta");
    // 900 px dão n linhas; tirar um pixel não pode dar mais linhas, e achar a altura mínima de n+1 dá n+1.
    expect(linhasQueCabem(899, "compacta")).toBeLessThanOrEqual(n);
    let altura = 900;
    while (linhasQueCabem(altura, "compacta") === n) altura += 1;
    expect(linhasQueCabem(altura, "compacta")).toBe(n + 1);
    expect(linhasQueCabem(altura - 1, "compacta")).toBe(n);
  });
  it("altura inválida ou ausente usa a janela padrão (768)", () => {
    expect(linhasQueCabem(Number.NaN, "compacta")).toBe(linhasQueCabem(768, "compacta"));
    expect(linhasQueCabem(0, "compacta")).toBe(linhasQueCabem(768, "compacta"));
  });
});

describe("tamanhoEfetivoDaPagina: Auto é o padrão; 20, 50 e 100 valem como estão", () => {
  it("auto calcula pela altura da janela", () => {
    expect(tamanhoEfetivoDaPagina("auto", 900, "compacta")).toBe(linhasQueCabem(900, "compacta"));
  });
  it("20, 50 e 100 não dependem da altura", () => {
    expect(tamanhoEfetivoDaPagina(20, 900, "compacta")).toBe(20);
    expect(tamanhoEfetivoDaPagina(100, 500, "confortavel")).toBe(100);
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
