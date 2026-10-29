import { describe, expect, it } from "vitest";
import { formatarData } from "./data";

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
