import { describe, expect, it } from "vitest";
import { formatarData, hojeEmSaoPaulo } from "./data";

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
