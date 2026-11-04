import { afterEach, describe, expect, it, vi } from "vitest";

// A escolha da fonte (fatia 3.9a): o exemplo só com EIXO_DADOS=exemplo (desenvolvimento rápido e os e2e
// atuais); fora disso, sempre o banco (em produção a variável nunca existe). No modo banco, as
// gravações ficam "em breve" até a 3.9b.

const rpc = vi.hoisted(() =>
  vi.fn(async () => ({ data: null, error: { message: "sem banco no teste" } })),
);
vi.mock("@/lib/supabase/servidor", () => ({
  criarClienteDoServidor: async () => ({ schema: () => ({ rpc }) }),
}));

import {
  ErroDeGravacaoEmBreve,
  MENSAGEM_GRAVACAO_EM_BREVE,
  fonteDeEscrita,
  fonteDePlacas,
  modoDosDados,
} from "./fonte";

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
  it("as gravações ficam em breve até a 3.9b", async () => {
    vi.stubEnv("EIXO_DADOS", "banco");
    await expect(fonteDeEscrita("2026-11-03")).rejects.toBeInstanceOf(ErroDeGravacaoEmBreve);
    await expect(fonteDeEscrita("2026-11-03")).rejects.toThrow(MENSAGEM_GRAVACAO_EM_BREVE);
  });
});
