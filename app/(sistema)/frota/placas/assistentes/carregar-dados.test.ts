import { beforeEach, describe, expect, it, vi } from "vitest";

// Os dados dos assistentes para a tela (fatia 3.9a): com a chave dos rascunhos da sessão; no modo
// banco, "em breve" (os botões aparecem desabilitados com o aviso); outro erro some sem derrubar a tela.

const mocks = vi.hoisted(() => ({ fonte: "exemplo" as "exemplo" | "em-breve" | "quebra" }));

vi.mock("@/lib/seguranca/sessao-do-servidor", () => ({
  exigirSessao: async () => ({ usuarioId: "u-123", email: null, perfil: "Administrador" }),
}));
vi.mock("@/lib/dados/fonte", async (original) => {
  const real = await original<typeof import("@/lib/dados/fonte")>();
  return {
    ...real,
    fonteDeEscrita: async () => {
      if (mocks.fonte === "em-breve") throw new real.ErroDeGravacaoEmBreve();
      if (mocks.fonte === "quebra") throw new Error("quebrou");
      return {
        catalogos: async () => ({}),
        placaParaAssistente: async () => null,
        pedidoPendenteDa: async () => null,
        candidatosDoConjunto: async () => [],
        pedidosPendentes: async () => [],
        placasQuePodemSerDisponibilizadas: async () => [],
      };
    },
  };
});

import { carregarDadosDosAssistentes } from "./carregar-dados";

const pedido = { assistente: null, placa: null, hoje: "2026-11-03" };

beforeEach(() => {
  mocks.fonte = "exemplo";
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("carregarDadosDosAssistentes", () => {
  it("leva o usuário da sessão para a chave dos rascunhos", async () => {
    const dados = await carregarDadosDosAssistentes(pedido);
    expect(dados).not.toBeNull();
    expect(dados !== "em-breve" && dados?.usuario).toBe("u-123");
  });
  it("no modo banco, em breve", async () => {
    mocks.fonte = "em-breve";
    expect(await carregarDadosDosAssistentes(pedido)).toBe("em-breve");
  });
  it("outro erro: sem assistentes, a tela segue de pé", async () => {
    mocks.fonte = "quebra";
    expect(await carregarDadosDosAssistentes(pedido)).toBeNull();
  });
});
