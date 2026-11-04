import { describe, expect, it } from "vitest";
import type { ClienteDaSessao } from "./cliente-da-sessao";
import { lerPessoaDaSessao, lerSessao, perfilDoCodigo } from "./sessao";

// A sessão do servidor (fatia 3.8): o usuário pelo getUser (valida no Auth, nunca o cookie cru) e o
// perfil pelo banco (config.perfil_atual), lido a cada pedido.

const cliente = (
  usuario: { id: string; email?: string } | null,
  perfil: string | null,
  erro = false,
): ClienteDaSessao => ({
  auth: { getUser: async () => ({ data: { user: usuario }, error: null }) },
  schema: () => ({
    rpc: async () =>
      erro ? { data: null, error: { message: "falhou" } } : { data: perfil, error: null },
  }),
});

describe("lerSessao", () => {
  it("sem usuário, sem sessão", async () => {
    expect(await lerSessao(cliente(null, null))).toBeNull();
  });
  it("usuário com vínculo: o perfil vem do banco pelo código", async () => {
    expect(await lerSessao(cliente({ id: "u1", email: "a@b.c" }, "gestor_de_frota"))).toEqual({
      usuarioId: "u1",
      email: "a@b.c",
      perfil: "Gestor de frota",
    });
  });
  it("usuário sem vínculo (ou vínculo inativo): perfil nulo", async () => {
    expect(await lerSessao(cliente({ id: "u1" }, null))).toEqual({
      usuarioId: "u1",
      email: null,
      perfil: null,
    });
  });
  it("erro do banco nunca vira perfil", async () => {
    await expect(lerSessao(cliente({ id: "u1" }, "administrador", true))).rejects.toThrow();
  });
});

describe("perfilDoCodigo", () => {
  it("os quatro perfis do banco; código desconhecido é nulo", () => {
    expect(perfilDoCodigo("administrador")).toBe("Administrador");
    expect(perfilDoCodigo("diretoria")).toBe("Diretoria");
    expect(perfilDoCodigo("gestor_de_frota")).toBe("Gestor de frota");
    expect(perfilDoCodigo("operacional")).toBe("Operacional");
    expect(perfilDoCodigo("outro")).toBeNull();
    expect(perfilDoCodigo(null)).toBeNull();
  });
});

// Fatia 3.9a: a pessoa de quem entrou (nome para a barra lateral e o gestor da carteira), pelo banco
// com a chave do próprio usuário: config.usuario_atual e nucleo.pessoa_para_leitura.
describe("lerPessoaDaSessao", () => {
  const clienteDaPessoa = (pessoaId: string | null, nome: string | null) => ({
    schema: (esquema: "config" | "nucleo") =>
      esquema === "config"
        ? { rpc: async () => ({ data: pessoaId, error: null }) }
        : {
            from: () => ({
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: nome ? { nome } : null, error: null }),
                }),
              }),
            }),
          },
  });

  it("a pessoa vinculada, com o nome", async () => {
    expect(await lerPessoaDaSessao(clienteDaPessoa("p1", "Ana Ribeiro") as never)).toEqual({
      pessoaId: "p1",
      nome: "Ana Ribeiro",
    });
  });
  it("sem vínculo, sem pessoa", async () => {
    expect(await lerPessoaDaSessao(clienteDaPessoa(null, null) as never)).toBeNull();
  });
  it("pessoa sem nome legível fica com o texto do vazio", async () => {
    expect(await lerPessoaDaSessao(clienteDaPessoa("p1", null) as never)).toEqual({
      pessoaId: "p1",
      nome: "Sem nome",
    });
  });
});
