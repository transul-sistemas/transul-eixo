import { describe, expect, it } from "vitest";
import { decidirAcesso, moduloDoCaminho, rotaPublica } from "./acesso";

// O que o proxy decide a cada pedido: rota pública passa; sem sessão vai para /entrar (com o caminho
// de volta); sem vínculo vai para "acesso não liberado"; sem permissão de ver o módulo, 404. A
// permissão vem do banco a cada pedido (config.pode), então rebaixar o papel tira o acesso na hora.

const logado = { temUsuario: true, temVinculo: true, podeVerModulo: true };

describe("rotas públicas", () => {
  it("só as telas de entrar, esqueci a senha e a confirmação do e-mail", () => {
    expect(rotaPublica("/entrar")).toBe(true);
    expect(rotaPublica("/esqueci-a-senha")).toBe(true);
    expect(rotaPublica("/auth/confirmar")).toBe(true);
    expect(rotaPublica("/frota/placas")).toBe(false);
    expect(rotaPublica("/nova-senha")).toBe(false);
    expect(rotaPublica("/acesso-nao-liberado")).toBe(false);
    expect(rotaPublica("/entrar-de-novo")).toBe(false);
  });
});

describe("módulo pelo caminho", () => {
  it("o primeiro trecho do caminho, se for um módulo", () => {
    expect(moduloDoCaminho("/frota/placas/ABC1D23")).toBe("frota");
    expect(moduloDoCaminho("/admin")).toBe("admin");
    expect(moduloDoCaminho("/inicio/tarefas")).toBe("inicio");
    expect(moduloDoCaminho("/nova-senha")).toBeNull();
    expect(moduloDoCaminho("/")).toBeNull();
  });
});

describe("decidirAcesso", () => {
  it("rota pública passa, com ou sem sessão; logado em /entrar vai para a tela inicial", () => {
    expect(decidirAcesso("/entrar", "", { temUsuario: false })).toEqual({ tipo: "seguir" });
    expect(decidirAcesso("/auth/confirmar", "?token_hash=x", { temUsuario: false })).toEqual({
      tipo: "seguir",
    });
    expect(decidirAcesso("/entrar", "", logado)).toEqual({
      tipo: "redirecionar",
      para: "/inicio/tarefas",
    });
  });

  it("sem sessão vai para /entrar levando o caminho de volta", () => {
    expect(decidirAcesso("/frota/placas", "?pagina=2", { temUsuario: false })).toEqual({
      tipo: "redirecionar",
      para: "/entrar?proximo=%2Ffrota%2Fplacas%3Fpagina%3D2",
    });
    expect(decidirAcesso("/nova-senha", "", { temUsuario: false })).toEqual({
      tipo: "redirecionar",
      para: "/entrar?proximo=%2Fnova-senha",
    });
  });

  it("sessão vencida por inatividade vai para /entrar com o motivo", () => {
    expect(decidirAcesso("/frota/placas", "", { ...logado, inativo: true })).toEqual({
      tipo: "sair",
      para: "/entrar?motivo=inatividade&proximo=%2Ffrota%2Fplacas",
    });
  });

  it("logado sem vínculo vai para acesso não liberado (e lá fica)", () => {
    const semVinculo = { temUsuario: true, temVinculo: false, podeVerModulo: false };
    expect(decidirAcesso("/frota/placas", "", semVinculo)).toEqual({
      tipo: "redirecionar",
      para: "/acesso-nao-liberado",
    });
    expect(decidirAcesso("/acesso-nao-liberado", "", semVinculo)).toEqual({ tipo: "seguir" });
    expect(decidirAcesso("/nova-senha", "", semVinculo)).toEqual({ tipo: "seguir" });
  });

  it("com vínculo, acesso não liberado volta para a tela inicial", () => {
    expect(decidirAcesso("/acesso-nao-liberado", "", logado)).toEqual({
      tipo: "redirecionar",
      para: "/inicio/tarefas",
    });
  });

  it("sem permissão de ver o módulo, 404 (a mesma página de quem digita um endereço que não existe)", () => {
    expect(decidirAcesso("/pessoas", "", { ...logado, podeVerModulo: false })).toEqual({
      tipo: "nao-encontrada",
    });
  });

  it("com tudo, segue", () => {
    expect(decidirAcesso("/frota/placas", "", logado)).toEqual({ tipo: "seguir" });
  });

  it("o Operacional tem Pessoas só para a Escala (10/11/2026): a lista e a ficha dão 404", () => {
    const operacional = { ...logado, perfil: "Operacional" as const };
    expect(decidirAcesso("/pessoas/escala", "?mes=2026-06", operacional)).toEqual({
      tipo: "seguir",
    });
    expect(decidirAcesso("/pessoas/lista", "", operacional)).toEqual({ tipo: "nao-encontrada" });
    expect(decidirAcesso("/pessoas/lista/abc", "", operacional)).toEqual({
      tipo: "nao-encontrada",
    });
    expect(decidirAcesso("/pessoas/lista", "", { ...logado, perfil: "Diretoria" })).toEqual({
      tipo: "seguir",
    });
  });

  it("tela esqueleto (10/11/2026): só Administrador e Diretoria; os outros perfis recebem 404", () => {
    for (const perfil of ["Gestor de frota", "Operacional"] as const) {
      for (const rota of ["/inicio/tarefas", "/inicio/resumo-do-dia", "/operacional/analise"]) {
        expect(decidirAcesso(rota, "", { ...logado, perfil }), `${perfil} ${rota}`).toEqual({
          tipo: "nao-encontrada",
        });
      }
    }
    for (const perfil of ["Administrador", "Diretoria"] as const) {
      expect(decidirAcesso("/inicio/tarefas", "", { ...logado, perfil })).toEqual({
        tipo: "seguir",
      });
    }
    // O Mapa do sistema está pronto e todos os perfis o abrem.
    expect(
      decidirAcesso("/inicio/mapa-do-sistema", "", { ...logado, perfil: "Operacional" }),
    ).toEqual({ tipo: "seguir" });
  });
});
