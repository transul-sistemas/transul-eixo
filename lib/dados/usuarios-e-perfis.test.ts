import { describe, expect, it, vi } from "vitest";
import type { ClienteDeCadastros, ConsultaEncadeavel } from "./catalogos-cadastro";
import { listarUsuarios, lerMatriz, matrizDoPerfil, mudarAcesso } from "./usuarios-e-perfis";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

function simulado(tabelas: Record<string, unknown[]>, update?: { data: unknown; error?: unknown }) {
  const consulta = (linhas: unknown[]): ConsultaEncadeavel => {
    const c: ConsultaEncadeavel = {
      is: () => c,
      ilike: () => c,
      in: () => c,
      order: () => c,
      range: () => c,
      then: (aoResolver, aoRejeitar) =>
        Promise.resolve({ data: linhas, error: null } as never).then(aoResolver, aoRejeitar),
    };
    return c;
  };
  const gravado: Record<string, unknown>[] = [];
  const eqs: string[] = [];
  const cliente = {
    schema: () => ({
      from: (tabela: string) => ({
        select: () => consulta(tabelas[tabela] ?? []),
        insert: () => {
          throw new Error("não insere");
        },
        update: (valores: Record<string, unknown>) => {
          gravado.push(valores);
          return {
            eq: (c1: string, v1: string | number) => (
              eqs.push(`${c1}=${v1}`),
              {
                eq: (c2: string, v2: string | number) => (
                  eqs.push(`${c2}=${v2}`),
                  {
                    select: () => ({
                      maybeSingle: async () => ({
                        error: null,
                        data: { pessoa_id: U1, perfil: "diretoria", ativo: true, versao: 4 },
                        ...update,
                      }),
                    }),
                  }
                ),
              }
            ),
          };
        },
      }),
    }),
  } as unknown as ClienteDeCadastros;
  return { cliente, gravado, eqs };
}

const catalogo = {
  perfil: [
    { codigo: "administrador", nome: "Administrador" },
    { codigo: "gestor_de_frota", nome: "Gestor de frota" },
  ],
  modulo: [
    { codigo: "frota", nome: "Frota" },
    { codigo: "admin", nome: "Administração" },
  ],
  acao: [
    { codigo: "ver", nome: "Ver" },
    { codigo: "editar", nome: "Editar" },
  ],
  escopo: [
    { codigo: "tudo", nome: "Tudo" },
    { codigo: "minha_carteira", nome: "Minha carteira" },
  ],
  permissao_do_perfil: [
    { perfil: "administrador", modulo: "frota", acao: "ver", escopo: "tudo" },
    { perfil: "administrador", modulo: "admin", acao: "ver", escopo: "tudo" },
    { perfil: "gestor_de_frota", modulo: "frota", acao: "ver", escopo: "minha_carteira" },
    { perfil: "gestor_de_frota", modulo: "frota", acao: "editar", escopo: "minha_carteira" },
  ],
};

describe("matriz de permissões", () => {
  it("monta módulo por ação com o nome do escopo, e traço (nulo) onde o perfil não pode", async () => {
    const s = simulado(catalogo);
    const dados = await lerMatriz(s.cliente);
    expect(dados.perfis.map((p) => p.nome)).toEqual(["Administrador", "Gestor de frota"]);
    const m = matrizDoPerfil(dados, "gestor_de_frota");
    expect(m.acoes.map((a) => a.nome)).toEqual(["Ver", "Editar"]);
    expect(m.linhas).toEqual([
      { modulo: "Frota", celulas: { ver: "Minha carteira", editar: "Minha carteira" } },
      { modulo: "Administração", celulas: { ver: null, editar: null } },
    ]);
  });

  it("perfil desconhecido cai no primeiro", async () => {
    const dados = await lerMatriz(simulado(catalogo).cliente);
    expect(matrizDoPerfil(dados, "inexistente").perfil.codigo).toBe("administrador");
  });
});

describe("lista de usuários", () => {
  it("junta nome, perfil, escopo do perfil, filiais e operações", async () => {
    const s = simulado({
      ...catalogo,
      usuario: [
        {
          pessoa_id: U1,
          perfil: "gestor_de_frota",
          ativo: true,
          versao: 2,
          criado_em: "2026-11-01T10:00:00-03:00",
        },
        {
          pessoa_id: U2,
          perfil: "administrador",
          ativo: false,
          versao: 1,
          criado_em: "2026-11-02T10:00:00-03:00",
        },
      ],
      pessoa_para_leitura: [
        { id: U1, nome: "Ana Gestora" },
        { id: U2, nome: "Bruno Admin" },
      ],
      usuario_filial: [{ usuario_id: U1, filial_id: "f1" }],
      usuario_operacao: [],
      filial: [{ id: "f1", nome: "Matriz" }],
      operacao: [],
    });
    const r = await listarUsuarios(s.cliente, "");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({
      pessoaId: U1,
      nome: "Ana Gestora",
      perfil: "gestor_de_frota",
      perfilNome: "Gestor de frota",
      ativo: true,
      versao: 2,
      escopos: ["Minha carteira"],
      filiais: ["Matriz"],
      operacoes: [],
    });
    expect(r[1]).toMatchObject({ ativo: false, escopos: ["Tudo"] });
  });

  it("filtra pelo nome, sem acento nem caixa", async () => {
    const s = simulado({
      ...catalogo,
      usuario: [
        { pessoa_id: U1, perfil: "administrador", ativo: true, versao: 1, criado_em: "2026-11-01" },
        { pessoa_id: U2, perfil: "administrador", ativo: true, versao: 1, criado_em: "2026-11-02" },
      ],
      pessoa_para_leitura: [
        { id: U1, nome: "José Álvaro" },
        { id: U2, nome: "Maria" },
      ],
    });
    const r = await listarUsuarios(s.cliente, "jose alvaro");
    expect(r.map((u) => u.pessoaId)).toEqual([U1]);
  });
});

describe("mudar acesso", () => {
  const entrada = { pessoaId: U1, perfil: "diretoria", ativo: true, versao: 3 };

  it("grava perfil e situação conferindo a versão", async () => {
    const s = simulado({});
    const r = await mudarAcesso(s.cliente, entrada, U2);
    expect(r).toMatchObject({ ok: true });
    expect(s.gravado).toEqual([{ perfil: "diretoria", ativo: true }]);
    expect(s.eqs).toEqual([`pessoa_id=${U1}`, "versao=3"]);
  });

  it("ninguém muda o próprio acesso, e nada é gravado", async () => {
    const s = simulado({});
    const gravar = vi.spyOn(s.gravado, "push");
    const r = await mudarAcesso(s.cliente, entrada, U1);
    expect(r).toMatchObject({ ok: false, erro: { codigo: "entrada_invalida" } });
    expect(gravar).not.toHaveBeenCalled();
  });

  it("versão velha é conflito", async () => {
    const s = simulado({}, { data: null });
    const r = await mudarAcesso(s.cliente, entrada, U2);
    expect(r).toMatchObject({ ok: false, erro: { codigo: "conflito" } });
  });

  it("o banco recusando vira sem_permissao", async () => {
    const s = simulado({}, { data: null, error: { message: "negado", code: "42501" } });
    const r = await mudarAcesso(s.cliente, entrada, U2);
    expect(r).toMatchObject({ ok: false, erro: { codigo: "sem_permissao" } });
  });
});
