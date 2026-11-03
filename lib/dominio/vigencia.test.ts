import { describe, expect, it } from "vitest";
import {
  buracosEntre,
  consecutivas,
  semBuraco,
  sobrepoe,
  vigenteEm,
  type Vigencia,
} from "@/lib/dominio/vigencia";

// Vigência é sempre [início, fim): o início conta, o fim não. Fim nulo = em aberto.
const v = (inicio: string, fim: string | null): Vigencia => ({ inicio, fim });
const T0 = "2026-01-10T00:00:00-03:00";
const T1 = "2026-02-10T00:00:00-03:00";
const T2 = "2026-03-10T00:00:00-03:00";
const T3 = "2026-04-10T00:00:00-03:00";

describe("sobrepoe: limites [início, fim)", () => {
  it("intervalos que se cruzam sobrepõem", () => {
    expect(sobrepoe(v(T0, T2), v(T1, T3))).toBe(true);
    expect(sobrepoe(v(T1, T3), v(T0, T2))).toBe(true);
  });
  it("um dentro do outro sobrepõe", () => {
    expect(sobrepoe(v(T0, T3), v(T1, T2))).toBe(true);
  });
  it("o fim de um igual ao início do outro NÃO sobrepõe (o fim não conta)", () => {
    expect(sobrepoe(v(T0, T1), v(T1, T2))).toBe(false);
    expect(sobrepoe(v(T1, T2), v(T0, T1))).toBe(false);
  });
  it("separados por um intervalo não sobrepõem", () => {
    expect(sobrepoe(v(T0, T1), v(T2, T3))).toBe(false);
  });
  it("duas vigências em aberto sempre sobrepõem", () => {
    expect(sobrepoe(v(T0, null), v(T2, null))).toBe(true);
  });
  it("uma em aberto sobrepõe qualquer uma que termine depois do seu início", () => {
    expect(sobrepoe(v(T1, null), v(T0, T2))).toBe(true);
    expect(sobrepoe(v(T1, null), v(T0, T1))).toBe(false);
  });
  it("o instante é comparado, não o texto (fusos diferentes)", () => {
    expect(sobrepoe(v("2026-01-10T03:00:00Z", "2026-02-10T03:00:00Z"), v(T1, T2))).toBe(false);
  });
});

describe("consecutivas: o fim de uma é o início da outra", () => {
  it("fim igual a início é consecutiva", () => {
    expect(consecutivas(v(T0, T1), v(T1, T2))).toBe(true);
  });
  it("com buraco ou sobreposição, não", () => {
    expect(consecutivas(v(T0, T1), v(T2, T3))).toBe(false);
    expect(consecutivas(v(T0, T2), v(T1, T3))).toBe(false);
  });
  it("a primeira em aberto não tem sucessora", () => {
    expect(consecutivas(v(T0, null), v(T1, T2))).toBe(false);
  });
});

describe("vigenteEm: [início, fim)", () => {
  const lista = [v(T0, T1), v(T1, T2), v(T2, null)];
  it("no início vale; no fim já é a próxima", () => {
    expect(vigenteEm(lista, T0)).toEqual(v(T0, T1));
    expect(vigenteEm(lista, T1)).toEqual(v(T1, T2));
    expect(vigenteEm(lista, T2)).toEqual(v(T2, null));
  });
  it("antes da primeira não há vigente", () => {
    expect(vigenteEm(lista, "2026-01-09T23:59:59-03:00")).toBeNull();
  });
  it("a aberta vale para sempre depois do início", () => {
    expect(vigenteEm(lista, "2030-01-01T00:00:00-03:00")).toEqual(v(T2, null));
  });
  it("lista vazia não tem vigente", () => {
    expect(vigenteEm([], T0)).toBeNull();
  });
});

describe("buracosEntre: os intervalos sem vigência entre vigências", () => {
  it("consecutivas não têm buraco", () => {
    expect(buracosEntre([v(T0, T1), v(T1, T2)])).toEqual([]);
  });
  it("devolve o intervalo entre o fim de uma e o início da seguinte, em qualquer ordem", () => {
    expect(buracosEntre([v(T2, T3), v(T0, T1)])).toEqual([{ inicio: T1, fim: T2 }]);
  });
  it("uma só vigência, aberta ou fechada, não tem buraco entre vigências", () => {
    expect(buracosEntre([v(T0, T1)])).toEqual([]);
    expect(buracosEntre([v(T0, null)])).toEqual([]);
  });
});

describe("semBuraco: a regra de posse e de gestor da carteira", () => {
  it("consecutivas e a última em aberto passa", () => {
    expect(semBuraco([v(T0, T1), v(T1, null)])).toBe(true);
  });
  it("buraco no meio não passa", () => {
    expect(semBuraco([v(T0, T1), v(T2, null)])).toBe(false);
  });
  it("a última fechada sem baixa não passa (placa sem dono)", () => {
    expect(semBuraco([v(T0, T1)])).toBe(false);
  });
  it("a última fechada passa só se fecha junto da baixa", () => {
    expect(semBuraco([v(T0, T1)], { baixaEm: T1 })).toBe(true);
    expect(semBuraco([v(T0, T1)], { baixaEm: T2 })).toBe(false);
  });
  it("sem nenhuma vigência não passa (todo ativo tem posse e gestor)", () => {
    expect(semBuraco([])).toBe(false);
  });
  it("sobreposição não passa", () => {
    expect(semBuraco([v(T0, T2), v(T1, null)])).toBe(false);
  });
});
