import { describe, expect, it } from "vitest";
import {
  chipsDeMes,
  intervaloDoPeriodo,
  lerPeriodo,
  mesFechadoMaisRecente,
  mesesDoIntervalo,
  periodoAnterior,
  variacaoPercentual,
} from "./periodo";

describe("mesFechadoMaisRecente (corte no dia 10)", () => {
  it("até o dia do corte, o mês passado ainda não fechou: abre dois meses atrás", () => {
    expect(mesFechadoMaisRecente("2026-11-10", 10)).toBe("2026-09");
    expect(mesFechadoMaisRecente("2026-11-01", 10)).toBe("2026-09");
  });
  it("a partir do dia seguinte ao corte, o mês passado está fechado", () => {
    expect(mesFechadoMaisRecente("2026-11-11", 10)).toBe("2026-10");
    expect(mesFechadoMaisRecente("2026-11-30", 10)).toBe("2026-10");
  });
  it("vira o ano nos dois lados do corte", () => {
    expect(mesFechadoMaisRecente("2026-01-10", 10)).toBe("2025-11");
    expect(mesFechadoMaisRecente("2026-01-11", 10)).toBe("2025-12");
  });
  it("o dia do corte é parâmetro", () => {
    expect(mesFechadoMaisRecente("2026-11-05", 4)).toBe("2026-10");
    expect(mesFechadoMaisRecente("2026-11-04", 4)).toBe("2026-09");
  });
  it("não abre em novembro de 2025 só porque os dados param lá", () => {
    expect(mesFechadoMaisRecente("2026-11-10", 10)).not.toBe("2025-11");
  });
});

describe("lerPeriodo", () => {
  const padrao = "2026-09";
  it("sem nada na URL, o mês padrão", () => {
    expect(lerPeriodo(new URLSearchParams(), padrao)).toEqual({ tipo: "mes", mes: "2026-09" });
  });
  it("o mês da URL vale; mês inválido volta ao padrão", () => {
    expect(lerPeriodo(new URLSearchParams("mes=2026-03"), padrao)).toEqual({
      tipo: "mes",
      mes: "2026-03",
    });
    expect(lerPeriodo(new URLSearchParams("mes=2026-13"), padrao)).toEqual({
      tipo: "mes",
      mes: padrao,
    });
  });
  it("o acumulado conhecido vale e vence o mês; o desconhecido é ignorado", () => {
    expect(lerPeriodo(new URLSearchParams("acum=ano&mes=2026-03"), padrao)).toEqual({
      tipo: "acumulado",
      modo: "ano",
    });
    expect(lerPeriodo(new URLSearchParams("acum=12m"), padrao)).toEqual({
      tipo: "acumulado",
      modo: "12m",
    });
    expect(lerPeriodo(new URLSearchParams("acum=xyz"), padrao)).toEqual({
      tipo: "mes",
      mes: padrao,
    });
  });
});

describe("intervaloDoPeriodo [início, fim)", () => {
  it("mês: do dia 1 ao dia 1 do mês seguinte, virando o ano", () => {
    expect(intervaloDoPeriodo({ tipo: "mes", mes: "2026-03" }, "2026-09")).toEqual({
      inicio: "2026-03-01",
      fim: "2026-04-01",
    });
    expect(intervaloDoPeriodo({ tipo: "mes", mes: "2026-12" }, "2026-09")).toEqual({
      inicio: "2026-12-01",
      fim: "2027-01-01",
    });
  });
  it("ano: de janeiro até o mês fechado", () => {
    expect(intervaloDoPeriodo({ tipo: "acumulado", modo: "ano" }, "2026-09")).toEqual({
      inicio: "2026-01-01",
      fim: "2026-10-01",
    });
  });
  it("últimos 12 meses: termina no mês fechado e tem 12 meses", () => {
    const i = intervaloDoPeriodo({ tipo: "acumulado", modo: "12m" }, "2026-09");
    expect(i).toEqual({ inicio: "2025-10-01", fim: "2026-10-01" });
    expect(mesesDoIntervalo(i)).toHaveLength(12);
  });
  it("todos os meses: do primeiro mês com dados até o mês fechado", () => {
    expect(intervaloDoPeriodo({ tipo: "acumulado", modo: "todos" }, "2026-09", "2025-04")).toEqual({
      inicio: "2025-04-01",
      fim: "2026-10-01",
    });
  });
  it("todos os meses sem dado nenhum cai nos últimos 12 meses", () => {
    expect(intervaloDoPeriodo({ tipo: "acumulado", modo: "todos" }, "2026-09", null)).toEqual({
      inicio: "2025-10-01",
      fim: "2026-10-01",
    });
  });
});

describe("periodoAnterior", () => {
  it("mês: o mês anterior, virando o ano", () => {
    expect(periodoAnterior({ inicio: "2026-01-01", fim: "2026-02-01" })).toEqual({
      inicio: "2025-12-01",
      fim: "2026-01-01",
    });
  });
  it("acumulado: a mesma quantidade de meses logo antes", () => {
    expect(periodoAnterior({ inicio: "2026-01-01", fim: "2026-10-01" })).toEqual({
      inicio: "2025-04-01",
      fim: "2026-01-01",
    });
  });
});

describe("variacaoPercentual", () => {
  it("diz quanto subiu ou caiu sobre o período anterior", () => {
    expect(variacaoPercentual(150, 100)).toBe(50);
    expect(variacaoPercentual(75, 100)).toBe(-25);
  });
  it("sem base de comparação (anterior zero ou ausente) não inventa número", () => {
    expect(variacaoPercentual(150, 0)).toBeNull();
    expect(variacaoPercentual(150, null)).toBeNull();
    expect(variacaoPercentual(null, 100)).toBeNull();
  });
  it("com anterior negativo usa o módulo, para a seta apontar o lado certo", () => {
    expect(variacaoPercentual(-50, -100)).toBe(50);
  });
});

describe("chipsDeMes", () => {
  it("doze meses terminando no mês fechado, do mais antigo ao mais recente", () => {
    const c = chipsDeMes("2026-09");
    expect(c).toHaveLength(12);
    expect(c[0]).toBe("2025-10");
    expect(c[11]).toBe("2026-09");
  });
});
