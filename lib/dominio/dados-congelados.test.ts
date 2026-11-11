import { describe, expect, it } from "vitest";
import { mesIncompleto, ehMesIncompleto } from "./dados-congelados";

describe("mesIncompleto", () => {
  it("o mês da data limite é incompleto quando ela não é o último dia", () => {
    expect(mesIncompleto("2026-10-28")).toBe("2026-10");
    expect(mesIncompleto("2026-10-30")).toBe("2026-10");
    expect(mesIncompleto("2026-11-01")).toBe("2026-11");
  });
  it("no último dia do mês não há mês incompleto (inclusive fevereiro e bissexto)", () => {
    expect(mesIncompleto("2026-10-31")).toBeNull();
    expect(mesIncompleto("2026-09-30")).toBeNull();
    expect(mesIncompleto("2026-02-28")).toBeNull();
    expect(mesIncompleto("2028-02-28")).toBe("2028-02");
    expect(mesIncompleto("2028-02-29")).toBeNull();
  });
  it("sem data limite ou data inválida, nada a rotular", () => {
    expect(mesIncompleto(null)).toBeNull();
    expect(mesIncompleto("")).toBeNull();
    expect(mesIncompleto("2026-13-01")).toBeNull();
    expect(mesIncompleto("texto")).toBeNull();
  });
});

describe("ehMesIncompleto", () => {
  it("só o mês da data limite é incompleto", () => {
    expect(ehMesIncompleto("2026-10", "2026-10-28")).toBe(true);
    expect(ehMesIncompleto("2026-09", "2026-10-28")).toBe(false);
    expect(ehMesIncompleto("2026-10", "2026-10-31")).toBe(false);
    expect(ehMesIncompleto("2026-10", null)).toBe(false);
  });
});
