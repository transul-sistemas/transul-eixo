import { beforeEach, describe, expect, it, vi } from "vitest";

// As ações de acesso (fatia 3.8) com o Supabase simulado: erro único que não revela se o e-mail existe,
// redirecionamento só para caminho interno, a mesma resposta na recuperação e a senha de 12 caracteres.

const simulado = vi.hoisted(() => ({
  entrar: vi.fn(),
  sair: vi.fn(),
  recuperar: vi.fn(),
  usuario: null as { id: string } | null,
  perfil: "administrador" as string | null,
  pode: true,
  atualizar: vi.fn(),
  redirecionado: [] as string[],
  cookies: [] as { nome: string; valor: string }[],
}));

vi.mock("@/lib/supabase/servidor", () => ({
  criarClienteDoServidor: async () => ({
    auth: {
      signInWithPassword: simulado.entrar,
      signOut: simulado.sair,
      resetPasswordForEmail: simulado.recuperar,
      getUser: async () => ({ data: { user: simulado.usuario } }),
      updateUser: simulado.atualizar,
    },
    schema: () => ({
      rpc: async (funcao: string) => ({
        data: funcao === "perfil_atual" ? simulado.perfil : simulado.pode,
        error: null,
      }),
    }),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (para: string) => {
    simulado.redirecionado.push(para);
    throw new Error(`NEXT_REDIRECT ${para}`);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (nome: string, valor: string) => simulado.cookies.push({ nome, valor }),
  }),
  headers: async () => new Headers({ host: "localhost:3100", "x-forwarded-proto": "http" }),
}));

import { definirNovaSenha, entrar, pedirRecuperacao, sair } from "./acoes";

const formulario = (dados: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(dados)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  simulado.redirecionado = [];
  simulado.cookies = [];
  simulado.usuario = null;
  simulado.perfil = "administrador";
  simulado.pode = true;
});

describe("entrar", () => {
  it("senha errada e e-mail inexistente dão o mesmo erro (nunca revela se o e-mail existe)", async () => {
    simulado.entrar.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const errada = await entrar({}, formulario({ email: "a@b.com", senha: "x" }));
    const invalido = await entrar({}, formulario({ email: "não é e-mail", senha: "x" }));
    expect(errada).toEqual({ erro: "E-mail ou senha incorretos. Confira e tente de novo." });
    expect(invalido).toEqual(errada);
  });

  it("com sucesso, marca a atividade e vai para o caminho interno pedido", async () => {
    simulado.entrar.mockResolvedValue({ error: null });
    await expect(
      entrar(
        {},
        formulario({ email: "a@b.com", senha: "certa", proximo: "/frota/placas?pagina=2" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(simulado.redirecionado).toEqual(["/frota/placas?pagina=2"]);
    expect(simulado.cookies.map((c) => c.nome)).toEqual(["eixo_ultima_atividade"]);
  });

  it("o próximo de fora vira a tela inicial (redirecionamento aberto)", async () => {
    simulado.entrar.mockResolvedValue({ error: null });
    await expect(
      entrar({}, formulario({ email: "a@b.com", senha: "certa", proximo: "//exemplo.com" })),
    ).rejects.toThrow();
    expect(simulado.redirecionado).toEqual(["/inicio/tarefas"]);
  });
});

describe("entrar: o destino passa pelas mesmas regras do proxy (o redirect da ação não passa por ele)", () => {
  it("vínculo inativo (o banco devolve perfil nulo) também vai para acesso não liberado", async () => {
    simulado.entrar.mockResolvedValue({ error: null });
    simulado.perfil = null;
    await expect(entrar({}, formulario({ email: "a@b.com", senha: "certa" }))).rejects.toThrow();
    expect(simulado.redirecionado).toEqual(["/acesso-nao-liberado"]);
  });

  it("sem vínculo vai para acesso não liberado", async () => {
    simulado.entrar.mockResolvedValue({ error: null });
    simulado.perfil = null;
    await expect(
      entrar({}, formulario({ email: "a@b.com", senha: "certa", proximo: "/frota/placas" })),
    ).rejects.toThrow();
    expect(simulado.redirecionado).toEqual(["/acesso-nao-liberado"]);
  });
  it("sem permissão de ver o módulo pedido, vai para a tela inicial", async () => {
    simulado.entrar.mockResolvedValue({ error: null });
    simulado.pode = false;
    await expect(
      entrar({}, formulario({ email: "a@b.com", senha: "certa", proximo: "/pessoas" })),
    ).rejects.toThrow();
    expect(simulado.redirecionado).toEqual(["/inicio/tarefas"]);
  });
});

describe("sair", () => {
  it("encerra a sessão, apaga a marca de atividade e vai para /entrar", async () => {
    await expect(sair()).rejects.toThrow("NEXT_REDIRECT");
    expect(simulado.sair).toHaveBeenCalledWith({ scope: "local" });
    expect(simulado.cookies).toEqual([{ nome: "eixo_ultima_atividade", valor: "" }]);
    expect(simulado.redirecionado).toEqual(["/entrar"]);
  });
});

describe("pedirRecuperacao", () => {
  it("a mesma resposta exista o e-mail ou não, com o link para a confirmação do Eixo", async () => {
    simulado.recuperar.mockResolvedValue({ error: null });
    const r = await pedirRecuperacao({}, formulario({ email: "a@b.com" }));
    expect(r.aviso).toMatch(/Se o e-mail estiver cadastrado/);
    expect(simulado.recuperar).toHaveBeenCalledWith("a@b.com", {
      redirectTo: "http://localhost:3100/auth/confirmar?proximo=/nova-senha",
    });
    simulado.recuperar.mockResolvedValue({ error: { message: "User not found" } });
    expect(await pedirRecuperacao({}, formulario({ email: "x@y.com" }))).toEqual(r);
  });
});

describe("definirNovaSenha", () => {
  it("exige 12 caracteres e a confirmação igual", async () => {
    simulado.usuario = { id: "u1" };
    expect(
      (await definirNovaSenha({}, formulario({ senha: "curta", confirmacao: "curta" }))).erro,
    ).toMatch(/12 caracteres/);
    expect(
      (await definirNovaSenha({}, formulario({ senha: "onze-chars!", confirmacao: "onze-chars!" })))
        .erro,
    ).toMatch(/12 caracteres/);
    expect(
      (
        await definirNovaSenha(
          {},
          formulario({ senha: "senha-longa-123", confirmacao: "outra-senha-123" }),
        )
      ).erro,
    ).toMatch(/confirmação/);
    expect(simulado.atualizar).not.toHaveBeenCalled();
  });
  it("sem a sessão do link, não troca nada", async () => {
    expect(
      (
        await definirNovaSenha(
          {},
          formulario({ senha: "senha-longa-123", confirmacao: "senha-longa-123" }),
        )
      ).erro,
    ).toMatch(/expirou/);
    expect(simulado.atualizar).not.toHaveBeenCalled();
  });
  it("com a sessão, troca e entra no sistema", async () => {
    simulado.usuario = { id: "u1" };
    simulado.atualizar.mockResolvedValue({ error: null });
    await expect(
      definirNovaSenha(
        {},
        formulario({ senha: "senha-longa-123", confirmacao: "senha-longa-123" }),
      ),
    ).rejects.toThrow();
    expect(simulado.atualizar).toHaveBeenCalledWith({ password: "senha-longa-123" });
    expect(simulado.redirecionado).toEqual(["/inicio/tarefas"]);
  });
});

// Aprovação da 3.8 (03/11/2026): o destino depois do login é do perfil, nunca uma rota que dá 404 para
// ele: sem "proximo", com "proximo" de fora, com "/" ou com um módulo que o perfil não vê.
describe("entrar: o destino é a primeira tela do perfil", () => {
  const casos = [
    { codigo: "administrador", destino: "/inicio/tarefas" },
    { codigo: "diretoria", destino: "/inicio/tarefas" },
    { codigo: "gestor_de_frota", destino: "/frota/placas" },
    { codigo: "operacional", destino: "/operacional/patio" },
  ];

  it.each(casos)("$codigo sem próximo vai para $destino", async ({ codigo, destino }) => {
    simulado.entrar.mockResolvedValue({ error: null });
    simulado.perfil = codigo;
    await expect(entrar({}, formulario({ email: "a@b.com", senha: "certa" }))).rejects.toThrow();
    expect(simulado.redirecionado).toEqual([destino]);
  });

  it.each(casos)(
    "$codigo com próximo na raiz (/) vai para $destino",
    async ({ codigo, destino }) => {
      simulado.entrar.mockResolvedValue({ error: null });
      simulado.perfil = codigo;
      await expect(
        entrar({}, formulario({ email: "a@b.com", senha: "certa", proximo: "/" })),
      ).rejects.toThrow();
      expect(simulado.redirecionado).toEqual([destino]);
    },
  );

  it("o gestor com próximo de fora vai para Frota › Placas", async () => {
    simulado.entrar.mockResolvedValue({ error: null });
    simulado.perfil = "gestor_de_frota";
    await expect(
      entrar({}, formulario({ email: "a@b.com", senha: "certa", proximo: "//exemplo.com" })),
    ).rejects.toThrow();
    expect(simulado.redirecionado).toEqual(["/frota/placas"]);
  });

  it("o operacional com próximo de um módulo que não vê vai para Operacional", async () => {
    simulado.entrar.mockResolvedValue({ error: null });
    simulado.perfil = "operacional";
    simulado.pode = false;
    await expect(
      entrar({}, formulario({ email: "a@b.com", senha: "certa", proximo: "/frota/placas" })),
    ).rejects.toThrow();
    expect(simulado.redirecionado).toEqual(["/operacional/patio"]);
  });

  it("o gestor com próximo fora dos módulos (acesso não liberado) vai para Frota › Placas", async () => {
    simulado.entrar.mockResolvedValue({ error: null });
    simulado.perfil = "gestor_de_frota";
    await expect(
      entrar({}, formulario({ email: "a@b.com", senha: "certa", proximo: "/acesso-nao-liberado" })),
    ).rejects.toThrow();
    expect(simulado.redirecionado).toEqual(["/frota/placas"]);
  });

  it("a senha nova do gestor também leva a Frota › Placas", async () => {
    simulado.usuario = { id: "u1" };
    simulado.perfil = "gestor_de_frota";
    simulado.atualizar.mockResolvedValue({ error: null });
    await expect(
      definirNovaSenha(
        {},
        formulario({ senha: "senha-longa-123", confirmacao: "senha-longa-123" }),
      ),
    ).rejects.toThrow();
    expect(simulado.redirecionado).toEqual(["/frota/placas"]);
  });
});
