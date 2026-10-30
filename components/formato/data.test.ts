import { describe, expect, it } from "vitest";
import { agoraEmSaoPaulo, formatarData, formatarDataEHora, hojeEmSaoPaulo } from "./data";

describe("formatarData", () => {
  it("texto aaaa-mm-dd vira dd/mm/aaaa sem passar por fuso", () => {
    expect(formatarData("2026-01-01")).toBe("01/01/2026");
    expect(formatarData("2026-12-31")).toBe("31/12/2026");
  });
  it("instante UTC vira o dia de São Paulo", () => {
    expect(formatarData(new Date("2026-03-01T01:00:00Z"))).toBe("28/02/2026");
    expect(formatarData("2026-03-01T01:00:00Z")).toBe("28/02/2026");
    expect(formatarData(new Date("2026-03-01T12:00:00Z"))).toBe("01/03/2026");
  });
  it("instante sem fuso vale como a hora de parede: o dia não depende da máquina", () => {
    expect(formatarData("2026-10-29T23:30:00")).toBe("29/10/2026");
    expect(formatarData("2026-10-29T00:00:00.000")).toBe("29/10/2026");
  });
  it("instante com fuso é convertido para São Paulo", () => {
    expect(formatarData("2026-10-29T23:30:00-03:00")).toBe("29/10/2026");
    expect(formatarData("2026-10-30T01:00:00Z")).toBe("29/10/2026");
  });
  it("data que não existe vira travessão", () => {
    expect(formatarData("2026-02-30")).toBe("—");
    expect(formatarData("lixo")).toBe("—");
    expect(formatarData("")).toBe("—");
    expect(formatarData(new Date("invalida"))).toBe("—");
  });
  it("ano bissexto", () => {
    expect(formatarData("2028-02-29")).toBe("29/02/2028");
    expect(formatarData("2027-02-29")).toBe("—");
  });
  it("valor ausente vira travessão", () => {
    expect(formatarData(null)).toBe("—");
    expect(formatarData(undefined)).toBe("—");
  });
});

describe("hojeEmSaoPaulo", () => {
  it("devolve o dia de São Paulo em aaaa-mm-dd", () => {
    expect(hojeEmSaoPaulo(new Date("2026-10-29T15:00:00Z"))).toBe("2026-10-29");
  });
  it("de madrugada em UTC ainda é o dia anterior em São Paulo", () => {
    expect(hojeEmSaoPaulo(new Date("2026-03-01T01:00:00Z"))).toBe("2026-02-28");
    expect(hojeEmSaoPaulo(new Date("2027-01-01T02:30:00Z"))).toBe("2026-12-31");
  });
  it("completa mês e dia com zero", () => {
    expect(hojeEmSaoPaulo(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });
});

describe("formatarDataEHora", () => {
  it("texto sem fuso é hora de parede: dd/mm/aaaa hh:mm do próprio texto", () => {
    expect(formatarDataEHora("2026-10-29T08:05")).toBe("29/10/2026 08:05");
    expect(formatarDataEHora("2026-10-29T23:30:00")).toBe("29/10/2026 23:30");
  });
  it("meia-noite e fim do dia ficam no mesmo dia", () => {
    expect(formatarDataEHora("2026-10-29T00:00")).toBe("29/10/2026 00:00");
    expect(formatarDataEHora("2026-10-29T23:59")).toBe("29/10/2026 23:59");
  });
  it("só o dia mostra só o dia", () => {
    expect(formatarDataEHora("2026-10-29")).toBe("29/10/2026");
  });
  it("instante com fuso vale em São Paulo", () => {
    expect(formatarDataEHora("2026-03-01T01:00:00Z")).toBe("28/02/2026 22:00");
  });
  it("vazio e inválido viram traço", () => {
    expect(formatarDataEHora(null)).toBe("—");
    expect(formatarDataEHora(undefined)).toBe("—");
    expect(formatarDataEHora("")).toBe("—");
    expect(formatarDataEHora("lixo")).toBe("—");
    expect(formatarDataEHora("2026-02-30T10:00")).toBe("—");
  });
});

describe("agoraEmSaoPaulo", () => {
  it("devolve o dia e a hora de São Paulo em aaaa-mm-ddThh:mm", () => {
    expect(agoraEmSaoPaulo(new Date("2026-10-29T15:07:42Z"))).toBe("2026-10-29T12:07");
  });
  it("de madrugada em UTC ainda é o dia anterior, com a hora certa", () => {
    expect(agoraEmSaoPaulo(new Date("2026-03-01T01:00:00Z"))).toBe("2026-02-28T22:00");
    expect(agoraEmSaoPaulo(new Date("2027-01-01T02:30:00Z"))).toBe("2026-12-31T23:30");
  });
  it("meia-noite é 00:00, nunca 24:00", () => {
    expect(agoraEmSaoPaulo(new Date("2026-10-29T03:00:00Z"))).toBe("2026-10-29T00:00");
  });
});
