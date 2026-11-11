import { beforeEach, describe, expect, it, vi } from "vitest";

const sessao = vi.hoisted(() => ({ perfil: "Administrador" as string | null }));
vi.mock("@/lib/supabase/servidor", () => ({ criarClienteDoServidor: async () => ({}) }));
vi.mock("@/lib/seguranca/sessao", () => ({ lerSessao: async () => ({ perfil: sessao.perfil }) }));

import { detalheDoErroDeLeitura } from "./detalhe-do-erro";
import { falhaDeLeitura, lerDigest } from "./leitura";

describe("detalheDoErroDeLeitura: função e código só para Administrador e Diretoria", () => {
  let id = "";
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    id =
      lerDigest(falhaDeLeitura("excecoes_abertas", { code: "PGRST202", message: "x" }).digest)
        ?.id ?? "";
  });
  it.each(["Administrador", "Diretoria"])("%s recebe a função e o código", async (perfil) => {
    sessao.perfil = perfil;
    expect(await detalheDoErroDeLeitura({ id })).toEqual({
      funcao: "excecoes_abertas",
      codigo: "PGRST202",
    });
  });
  it.each(["Gestor de frota", "Operacional", null])("%s não recebe nada", async (perfil) => {
    sessao.perfil = perfil;
    expect(await detalheDoErroDeLeitura({ id })).toBeNull();
  });
  it("entrada inválida: nulo", async () => {
    sessao.perfil = "Administrador";
    expect(await detalheDoErroDeLeitura({ id: "../x" })).toBeNull();
    expect(await detalheDoErroDeLeitura(undefined)).toBeNull();
  });
});
