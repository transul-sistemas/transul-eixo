import { describe, expect, it, vi } from "vitest";
import { CHAVE_DA_FAIXA_DEMO } from "../../scripts/demo-dados";
import { CHAVE_DA_FAIXA, bancoEmDemonstracao } from "./faixa-da-demonstracao";

// A faixa "banco em demonstração" liga pelo parâmetro que só a carga de demonstração grava. Sem o
// parâmetro (o banco real restaurado não o tem), a faixa some.

function cliente(resposta: { data: { valor: string } | null; error?: { message: string } | null }) {
  const eq = vi.fn(() => ({
    maybeSingle: async () => ({ data: resposta.data, error: resposta.error ?? null }),
  }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const schema = vi.fn(() => ({ from }));
  return { c: async () => ({ schema }), schema, from, select, eq };
}

describe("bancoEmDemonstracao", () => {
  it("usa a mesma chave que a carga de demonstração grava", () => {
    expect(CHAVE_DA_FAIXA).toBe(CHAVE_DA_FAIXA_DEMO);
  });
  it("com o parâmetro ligado, a faixa aparece", async () => {
    const { c, schema, from, select, eq } = cliente({ data: { valor: "sim" } });
    expect(await bancoEmDemonstracao(c)).toBe(true);
    expect(schema).toHaveBeenCalledWith("config");
    expect(from).toHaveBeenCalledWith("parametro");
    expect(select).toHaveBeenCalledWith("valor");
    expect(eq).toHaveBeenCalledWith("chave", CHAVE_DA_FAIXA);
  });
  it("sem o parâmetro (banco real), a faixa some", async () => {
    expect(await bancoEmDemonstracao(cliente({ data: null }).c)).toBe(false);
  });
  it("parâmetro com outro valor desliga a faixa", async () => {
    expect(await bancoEmDemonstracao(cliente({ data: { valor: "nao" } }).c)).toBe(false);
  });
  it("erro de leitura ou de sessão não derruba a tela: a faixa só some", async () => {
    expect(await bancoEmDemonstracao(cliente({ data: null, error: { message: "x" } }).c)).toBe(
      false,
    );
    expect(
      await bancoEmDemonstracao(async () => {
        throw new Error("sem sessão");
      }),
    ).toBe(false);
  });
});
