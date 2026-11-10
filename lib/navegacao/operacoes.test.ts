import { describe, expect, it } from "vitest";
import { enderecoDoPeriodo } from "./operacoes";

describe("enderecoDoPeriodo (seletor de período da ficha)", () => {
  const rota = "/operacoes/lista/abc";
  it("um mês: mes= na URL, tira o acumulado e mantém a aba", () => {
    const novo = enderecoDoPeriodo(rota, new URLSearchParams("aba=placas&acum=ano"), {
      tipo: "mes",
      mes: "2026-03",
    });
    expect(novo).toBe("/operacoes/lista/abc?aba=placas&mes=2026-03");
  });
  it("acumulado: acum= na URL, tira o mês", () => {
    const novo = enderecoDoPeriodo(rota, new URLSearchParams("mes=2026-03&aba=resumo"), {
      tipo: "acumulado",
      modo: "12m",
    });
    expect(novo).toBe("/operacoes/lista/abc?aba=resumo&acum=12m");
  });
  it("sempre volta à página 1 da lista", () => {
    expect(
      enderecoDoPeriodo(rota, new URLSearchParams("pagina=3"), { tipo: "mes", mes: "2026-01" }),
    ).toBe("/operacoes/lista/abc?mes=2026-01");
  });
});
