import { beforeEach, describe, expect, it, vi } from "vitest";

// Os dados dos assistentes para a tela: com a chave dos rascunhos da sessão e o gestor de quem usa;
// um erro some sem derrubar a tela (sem os botões). Desde a 3.9b-1 não há mais "em breve".

const mocks = vi.hoisted(() => ({
  fonte: "ok" as "ok" | "quebra",
  gestor: "pessoa-1" as string | null,
}));

vi.mock("@/lib/seguranca/sessao-do-servidor", () => ({
  exigirSessao: async () => ({ usuarioId: "u-123", email: null, perfil: "Administrador" }),
}));
vi.mock("@/lib/seguranca/gestor-atual", () => ({
  gestorAtual: async () => {
    if (mocks.gestor === null) throw new Error("sem pessoa");
    return mocks.gestor;
  },
}));
vi.mock("@/lib/dados/fonte", async (original) => {
  const real = await original<typeof import("@/lib/dados/fonte")>();
  return {
    ...real,
    fonteDeEscrita: async () => {
      if (mocks.fonte === "quebra") throw new Error("quebrou");
      return {
        criaveis: [],
        catalogos: async () => ({}),
        placaParaAssistente: async () => null,
        pedidoAbertoDa: async () => null,
        pedidosParaReceber: async () => [],
        placasQuePodemSerEntregues: async () => [],
      };
    },
  };
});

import { carregarDadosDosAssistentes } from "./carregar-dados";

const pedido = { assistente: null, placa: null, hoje: "2026-11-03" };

beforeEach(() => {
  mocks.fonte = "ok";
  mocks.gestor = "pessoa-1";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("carregarDadosDosAssistentes", () => {
  it("leva o usuário da sessão para a chave dos rascunhos e o gestor de quem usa", async () => {
    const dados = await carregarDadosDosAssistentes(pedido);
    expect(dados?.usuario).toBe("u-123");
    expect(dados?.gestorId).toBe("pessoa-1");
  });
  it("sem pessoa ligada ao login, segue sem gestor (não recebe nem conclui)", async () => {
    mocks.gestor = null;
    const dados = await carregarDadosDosAssistentes(pedido);
    expect(dados?.gestorId).toBeNull();
  });
  it("outro erro: sem assistentes, a tela segue de pé", async () => {
    mocks.fonte = "quebra";
    expect(await carregarDadosDosAssistentes(pedido)).toBeNull();
  });
});
