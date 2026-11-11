import { describe, expect, it, vi } from "vitest";
import {
  esquemaDiaDoCorte,
  gravarDiaDoCorte,
  lerDiaDoCorte,
  MENSAGEM_DO_CORTE_TRAVADO,
  type ClienteDoCorte,
} from "./parametro-do-corte";

function cliente(opcoes: { dia?: string; temDtneg: boolean; erroDaGravacao?: string }) {
  const atualizar = vi.fn(
    async (valores: unknown) => (
      void valores,
      {
        data: opcoes.erroDaGravacao ? null : { chave: "dia_do_corte_da_competencia", valor: "15" },
        error: opcoes.erroDaGravacao ? { message: opcoes.erroDaGravacao } : null,
      }
    ),
  );
  const c: ClienteDoCorte = {
    schema: (nome) =>
      nome === "nucleo"
        ? ({
            rpc: async () => ({ data: opcoes.temDtneg, error: null }),
          } as never)
        : ({
            from: () => ({
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { valor: opcoes.dia ?? "10" }, error: null }),
                }),
              }),
              update: (v: unknown) => ({
                eq: () => ({ select: () => ({ maybeSingle: () => atualizar(v) }) }),
              }),
            }),
          } as never),
  };
  return { c, atualizar };
}

describe("esquemaDiaDoCorte", () => {
  it("aceita dias de 1 a 28 e recusa o resto", () => {
    expect(esquemaDiaDoCorte.safeParse({ dia: 10 }).success).toBe(true);
    expect(esquemaDiaDoCorte.safeParse({ dia: 28 }).success).toBe(true);
    for (const ruim of [0, 29, 1.5, "dez", null]) {
      expect(esquemaDiaDoCorte.safeParse({ dia: ruim }).success).toBe(false);
    }
  });
});

describe("lerDiaDoCorte", () => {
  it("devolve o dia do parâmetro (não um 10 escrito à mão) e a trava", async () => {
    const { c } = cliente({ dia: "12", temDtneg: false });
    expect(await lerDiaDoCorte(c)).toEqual({ dia: 12, travado: true });
  });
  it("com a coluna DTNEG no staging a trava cai sozinha", async () => {
    const { c } = cliente({ dia: "10", temDtneg: true });
    expect(await lerDiaDoCorte(c)).toEqual({ dia: 10, travado: false });
  });
});

describe("gravarDiaDoCorte", () => {
  it("recusa no servidor enquanto o staging não tem a DTNEG, sem tentar gravar", async () => {
    const { c, atualizar } = cliente({ temDtneg: false });
    const r = await gravarDiaDoCorte(c, { dia: 15 });
    expect(r).toEqual({
      ok: false,
      erro: expect.objectContaining({ mensagem: MENSAGEM_DO_CORTE_TRAVADO }),
    });
    expect(atualizar).not.toHaveBeenCalled();
  });
  it("com a DTNEG, grava e devolve a linha", async () => {
    const { c, atualizar } = cliente({ temDtneg: true });
    const r = await gravarDiaDoCorte(c, { dia: 15 });
    expect(r.ok).toBe(true);
    expect(atualizar).toHaveBeenCalledWith({ valor: "15" });
  });
  it("se o banco recusar (a trava dele), devolve o erro com a mensagem do banco", async () => {
    const { c } = cliente({
      temDtneg: true,
      erroDaGravacao: "O dia do corte não pode ser mudado agora",
    });
    const r = await gravarDiaDoCorte(c, { dia: 15 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.mensagem).toContain("não pode ser mudado");
  });
});

describe("a mensagem da trava", () => {
  it("diz o que aconteceu e como resolver, sem pedir desculpas", () => {
    expect(MENSAGEM_DO_CORTE_TRAVADO).toMatch(/já aplicado na origem/);
    expect(MENSAGEM_DO_CORTE_TRAVADO).toMatch(/ponte do Sankhya/);
    expect(MENSAGEM_DO_CORTE_TRAVADO).not.toMatch(/desculp/i);
  });
});
