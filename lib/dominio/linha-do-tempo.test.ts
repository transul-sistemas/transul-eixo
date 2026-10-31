import { describe, expect, it } from "vitest";
import { type EventoDeStatus, segmentosDaLinhaDoTempo } from "./linha-do-tempo";

const AGORA = "2026-10-30T12:00";
const JANELA = { de: "2026-10-01T00:00", ate: AGORA };
const MIN_DA_JANELA = 29 * 1440 + 12 * 60; // 1 a 30 de outubro, ao meio-dia

const ev = (sigla: EventoDeStatus["sigla"], em: string): EventoDeStatus => ({ sigla, em });
const soma = (s: { minutos: number }[]) => s.reduce((t, x) => t + x.minutos, 0);

describe("segmentosDaLinhaDoTempo: faixas [início, fim) pela régua", () => {
  it("um evento só: uma faixa do evento até agora, com o grupo da sigla", () => {
    const s = segmentosDaLinhaDoTempo([ev("DOp", "2026-10-10T08:00")], JANELA, AGORA);
    const comRegistro = s.filter((x) => x.sigla !== null);
    expect(comRegistro).toEqual([
      {
        sigla: "DOp",
        grupo: "em-atividade",
        de: "2026-10-10T08:00",
        ate: AGORA,
        minutos: 20 * 1440 + 4 * 60,
      },
    ]);
  });

  it("antes do primeiro evento da janela, a faixa é 'sem registro' (sigla e grupo nulos)", () => {
    const s = segmentosDaLinhaDoTempo([ev("DOp", "2026-10-10T08:00")], JANELA, AGORA);
    expect(s[0]).toMatchObject({
      sigla: null,
      grupo: null,
      de: "2026-10-01T00:00",
      ate: "2026-10-10T08:00",
    });
  });

  it("evento anterior à janela vale no começo dela (corta no início, sem 'sem registro')", () => {
    const s = segmentosDaLinhaDoTempo(
      [ev("PÁT", "2026-09-20T09:00"), ev("DOp", "2026-10-10T08:00")],
      JANELA,
      AGORA,
    );
    expect(s[0]).toMatchObject({ sigla: "PÁT", grupo: "patio", de: "2026-10-01T00:00" });
    expect(s[0]?.ate).toBe("2026-10-10T08:00");
    expect(s.some((x) => x.sigla === null)).toBe(false);
  });

  it("as faixas são contíguas: o fim de uma é o começo da próxima, sem buraco nem sobreposição", () => {
    const s = segmentosDaLinhaDoTempo(
      [ev("PÁT", "2026-10-03T07:30"), ev("DOp", "2026-10-12T10:00"), ev("ACe", "2026-10-12T15:45")],
      JANELA,
      AGORA,
    );
    for (let i = 1; i < s.length; i++) expect(s[i]?.de).toBe(s[i - 1]?.ate);
    expect(s[0]?.de).toBe(JANELA.de);
    expect(s.at(-1)?.ate).toBe(AGORA);
  });

  it("a soma dos minutos é a janela inteira, em qualquer caso", () => {
    const casos: EventoDeStatus[][] = [
      [],
      [ev("DOp", "2026-10-10T08:00")],
      [ev("PÁT", "2026-09-20T09:00")],
      [ev("PÁT", "2026-10-03T07:30"), ev("DOp", "2026-10-12T10:00"), ev("ACe", "2026-10-12T15:45")],
      [ev("DOp", "2026-10-10T08:00"), ev("ACe", "2026-10-10T08:00")],
    ];
    for (const eventos of casos) {
      expect(soma(segmentosDaLinhaDoTempo(eventos, JANELA, AGORA))).toBe(MIN_DA_JANELA);
    }
  });

  it("vários eventos no mesmo dia, com hora, viram faixas de horas", () => {
    const s = segmentosDaLinhaDoTempo(
      [ev("DOp", "2026-10-12T06:00"), ev("ACe", "2026-10-12T09:30"), ev("CAr", "2026-10-12T14:00")],
      JANELA,
      AGORA,
    );
    const doDia = s.filter((x) => x.de.startsWith("2026-10-12"));
    expect(doDia.map((x) => [x.sigla, x.minutos])).toEqual([
      ["DOp", 210],
      ["ACe", 270],
      ["CAr", 18 * 1440 - 2 * 60], // do dia 12 às 14:00 até o dia 30 ao meio-dia
    ]);
  });

  it("dois eventos no mesmo minuto: o último vale e o primeiro some, sem faixa de zero minuto", () => {
    const s = segmentosDaLinhaDoTempo(
      [ev("DOp", "2026-10-10T08:00"), ev("ACe", "2026-10-10T08:00")],
      JANELA,
      AGORA,
    );
    expect(s.map((x) => x.sigla)).toEqual([null, "ACe"]);
    expect(s.every((x) => x.minutos > 0)).toBe(true);
  });

  it("eventos fora de ordem na entrada são ordenados pelo horário", () => {
    const s = segmentosDaLinhaDoTempo(
      [ev("ACe", "2026-10-12T15:45"), ev("PÁT", "2026-10-03T07:30")],
      JANELA,
      AGORA,
    );
    expect(s.filter((x) => x.sigla !== null).map((x) => x.sigla)).toEqual(["PÁT", "ACe"]);
  });

  it("evento depois de agora (no futuro) é ignorado", () => {
    const s = segmentosDaLinhaDoTempo(
      [ev("DOp", "2026-10-10T08:00"), ev("ACe", "2026-10-31T09:00")],
      JANELA,
      AGORA,
    );
    expect(s.map((x) => x.sigla)).toEqual([null, "DOp"]);
    expect(s.at(-1)?.ate).toBe(AGORA);
  });

  it("evento exatamente em agora não abre faixa de zero minuto", () => {
    const s = segmentosDaLinhaDoTempo(
      [ev("DOp", "2026-10-10T08:00"), ev("ACe", AGORA)],
      JANELA,
      AGORA,
    );
    expect(s.map((x) => x.sigla)).toEqual([null, "DOp"]);
  });

  it("sigla repetida em seguida junta numa faixa só", () => {
    const s = segmentosDaLinhaDoTempo(
      [ev("DOp", "2026-10-10T08:00"), ev("DOp", "2026-10-15T08:00")],
      JANELA,
      AGORA,
    );
    expect(s.map((x) => x.sigla)).toEqual([null, "DOp"]);
  });

  it("sem nenhum evento: uma faixa 'sem registro' que cobre a janela, nunca lista vazia", () => {
    const s = segmentosDaLinhaDoTempo([], JANELA, AGORA);
    expect(s).toEqual([
      { sigla: null, grupo: null, de: JANELA.de, ate: AGORA, minutos: MIN_DA_JANELA },
    ]);
  });

  it("limites [início, fim): um evento exatamente no começo da janela já vale desde o começo", () => {
    const s = segmentosDaLinhaDoTempo([ev("DOp", "2026-10-01T00:00")], JANELA, AGORA);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ sigla: "DOp", de: "2026-10-01T00:00", minutos: MIN_DA_JANELA });
  });

  it("virada de dia e de mês: 23:59 e 00:00 contam como dois minutos seguidos", () => {
    const janela = { de: "2026-10-31T23:00", ate: "2026-11-01T01:00" };
    const s = segmentosDaLinhaDoTempo(
      [ev("DOp", "2026-10-31T23:59"), ev("ACe", "2026-11-01T00:00")],
      janela,
      "2026-11-01T01:00",
    );
    expect(s.map((x) => [x.sigla, x.minutos])).toEqual([
      [null, 59],
      ["DOp", 1],
      ["ACe", 60],
    ]);
  });

  it("a janela termina em agora mesmo se pedir além", () => {
    const s = segmentosDaLinhaDoTempo(
      [ev("DOp", "2026-10-10T08:00")],
      { de: JANELA.de, ate: "2026-12-31T00:00" },
      AGORA,
    );
    expect(s.at(-1)?.ate).toBe(AGORA);
  });

  it("janela vazia ou invertida não tem faixa", () => {
    expect(
      segmentosDaLinhaDoTempo([ev("DOp", "2026-10-10T08:00")], { de: AGORA, ate: AGORA }, AGORA),
    ).toEqual([]);
    expect(
      segmentosDaLinhaDoTempo(
        [ev("DOp", "2026-10-10T08:00")],
        { de: AGORA, ate: JANELA.de },
        AGORA,
      ),
    ).toEqual([]);
  });

  it("não altera a lista de eventos recebida", () => {
    const eventos = [ev("ACe", "2026-10-12T15:45"), ev("PÁT", "2026-10-03T07:30")];
    const copia = JSON.parse(JSON.stringify(eventos));
    segmentosDaLinhaDoTempo(eventos, JANELA, AGORA);
    expect(eventos).toEqual(copia);
  });
});
