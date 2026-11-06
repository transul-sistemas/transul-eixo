import { afterEach, describe, expect, it, vi } from "vitest";

// A escolha da fonte (fatia 3.9a): o exemplo só com EIXO_DADOS=exemplo (desenvolvimento rápido e os e2e
// atuais); fora disso, sempre o banco (em produção a variável nunca existe). Desde a 3.9b-1 o modo
// banco também grava, pelas funções atômicas, com o cliente da sessão.

const rpc = vi.hoisted(() =>
  vi.fn(async () => ({ data: null, error: { message: "sem banco no teste" } })),
);
vi.mock("@/lib/supabase/servidor", () => ({
  criarClienteDoServidor: async () => ({ schema: () => ({ rpc }) }),
}));

import { contarParaReceber, fonteDeEscrita, fonteDePlacas, modoDosDados } from "./fonte";

afterEach(() => {
  vi.unstubAllEnvs();
  rpc.mockClear();
});

describe("modoDosDados", () => {
  it("exemplo só com EIXO_DADOS=exemplo", () => {
    vi.stubEnv("EIXO_DADOS", "exemplo");
    expect(modoDosDados()).toBe("exemplo");
  });
  it.each(["", "banco", "Exemplo", "qualquer"])("com %j, banco", (valor) => {
    vi.stubEnv("EIXO_DADOS", valor);
    expect(modoDosDados()).toBe("banco");
  });
});

describe("fonteDePlacas no modo banco", () => {
  it("lê pelo banco, com o cliente da sessão", async () => {
    vi.stubEnv("EIXO_DADOS", "banco");
    const fonte = await fonteDePlacas();
    await expect(fonte.obter("AAA1A11", "2026-11-03", {})).rejects.toThrow(/sem banco no teste/);
    expect(rpc).toHaveBeenCalledWith("detalhe_da_placa", { p_placa: "AAA1A11" });
  });
});

describe("fonteDeEscrita no modo banco", () => {
  it("grava pelo banco (não há mais 'em breve'): o + só cria marca, modelo e CR", async () => {
    vi.stubEnv("EIXO_DADOS", "banco");
    const fonte = await fonteDeEscrita("2026-11-03");
    expect(fonte.criaveis).toEqual(["marca", "modelo", "cr"]);
    await expect(fonte.catalogos()).rejects.toThrow(/sem banco no teste/);
    expect(rpc).toHaveBeenCalledWith("catalogos_dos_assistentes", {});
  });
  it("a contagem do que espera por quem usa vem do banco; se falha, conta zero", async () => {
    vi.stubEnv("EIXO_DADOS", "banco");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await contarParaReceber("2026-11-03")).toBe(0);
    expect(rpc).toHaveBeenCalledWith("contar_para_receber", {});
  });
});
