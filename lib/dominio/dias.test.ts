import { describe, expect, it } from "vitest";
import { diasEntre, somarDias } from "./dias";

describe("diasEntre", () => {
  it("conta dias inteiros, com sinal", () => {
    expect(diasEntre("2026-10-01", "2026-10-30")).toBe(29);
    expect(diasEntre("2026-10-30", "2026-10-01")).toBe(-29);
    expect(diasEntre("2026-10-30T23:59", "2026-10-30")).toBe(0);
  });
});

describe("somarDias", () => {
  it("soma e subtrai dias de uma data aaaa-mm-dd", () => {
    expect(somarDias("2026-10-30", 1)).toBe("2026-10-31");
    expect(somarDias("2026-10-30", -30)).toBe("2026-09-30");
    expect(somarDias("2026-10-30", 0)).toBe("2026-10-30");
  });
  it("vira o mês e o ano", () => {
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2027-01-01", -1)).toBe("2026-12-31");
  });
  it("conhece o ano bissexto", () => {
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(somarDias("2027-02-28", 1)).toBe("2027-03-01");
  });
  it("só a parte da data conta: ignora a hora", () => {
    expect(somarDias("2026-10-30T23:59", 1)).toBe("2026-10-31");
  });
  it("não passa por fuso: sempre o mesmo dia, em qualquer máquina", () => {
    expect(somarDias("2026-03-08", 1)).toBe("2026-03-09");
    expect(somarDias("2026-11-01", -1)).toBe("2026-10-31");
  });
});
