import { describe, expect, it } from "vitest";
import {
  CATALOGOS_EDITAVEIS,
  esquemaArquivarItem,
  esquemaEditarItem,
  esquemaIncluirItem,
  esquemaMudarAcesso,
} from "./cadastro";

const ID = "11111111-1111-4111-8111-111111111111";

describe("esquemas dos catálogos", () => {
  it("inclui com nome aparado e catálogo conhecido", () => {
    const r = esquemaIncluirItem.parse({ catalogo: "marca", nome: "  Volvo  " });
    expect(r.nome).toBe("Volvo");
  });
  it("recusa nome vazio, curto demais ou catálogo que não se edita aqui", () => {
    expect(esquemaIncluirItem.safeParse({ catalogo: "marca", nome: "   " }).success).toBe(false);
    expect(esquemaIncluirItem.safeParse({ catalogo: "marca", nome: "a" }).success).toBe(false);
    expect(esquemaIncluirItem.safeParse({ catalogo: "cr", nome: "CR 1" }).success).toBe(false);
    expect(CATALOGOS_EDITAVEIS).not.toContain("cr");
  });
  it("edita só com id e versão", () => {
    expect(
      esquemaEditarItem.safeParse({ catalogo: "filial", nome: "Matriz", id: ID }).success,
    ).toBe(false);
    expect(
      esquemaEditarItem.safeParse({ catalogo: "filial", nome: "Matriz", id: ID, versao: 2 })
        .success,
    ).toBe(true);
  });
  it("arquivar exige motivo com pelo menos 5 caracteres", () => {
    const base = { catalogo: "carroceria", id: ID, versao: 1 };
    expect(esquemaArquivarItem.safeParse({ ...base, motivo: "ok" }).success).toBe(false);
    expect(esquemaArquivarItem.safeParse({ ...base, motivo: "Duplicada de Sider" }).success).toBe(
      true,
    );
  });
  it("mudar acesso: perfil conhecido, situação booleana e versão", () => {
    const base = { pessoaId: ID, versao: 3, ativo: true };
    expect(esquemaMudarAcesso.safeParse({ ...base, perfil: "diretoria" }).success).toBe(true);
    expect(esquemaMudarAcesso.safeParse({ ...base, perfil: "" }).success).toBe(false);
    expect(esquemaMudarAcesso.safeParse({ ...base, perfil: "diretoria", versao: 0 }).success).toBe(
      false,
    );
  });
});
