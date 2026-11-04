import { describe, expect, it } from "vitest";
import { LIMITE_DE_INATIVIDADE_MS, expirouPorInatividade, lerUltimaAtividade } from "./inatividade";

// Sair por inatividade de 8 horas. O plano Free do Supabase não tem o limite de inatividade da sessão
// (só do Pro em diante; docs "User sessions"), então o Eixo confere no proxy, a cada pedido.

const HORA = 60 * 60 * 1000;

describe("inatividade", () => {
  it("o limite é de 8 horas", () => {
    expect(LIMITE_DE_INATIVIDADE_MS).toBe(8 * HORA);
  });

  it("expira só depois de 8 horas sem pedido ([início, fim): 8 h exatas já expiram)", () => {
    const ultima = 1_000_000_000_000;
    expect(expirouPorInatividade(ultima, ultima + 8 * HORA - 1)).toBe(false);
    expect(expirouPorInatividade(ultima, ultima + 8 * HORA)).toBe(true);
  });

  it("sem marca de atividade, não expira (a marca nasce no primeiro pedido)", () => {
    expect(expirouPorInatividade(null, 5)).toBe(false);
  });

  it("marca ilegível ou do futuro conta como expirada (ninguém estica a sessão mexendo no cookie)", () => {
    expect(lerUltimaAtividade("abc")).toBe(Number.NaN);
    expect(expirouPorInatividade(Number.NaN, 5)).toBe(true);
    expect(expirouPorInatividade(10 * HORA, 1 * HORA)).toBe(true);
  });

  it("lê a marca do cookie", () => {
    expect(lerUltimaAtividade(undefined)).toBeNull();
    expect(lerUltimaAtividade("1700000000000")).toBe(1_700_000_000_000);
  });
});
