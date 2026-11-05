import { describe, expect, it } from "vitest";
import { acharTela } from "@/lib/navegacao/catalogo";
import { PERFIS } from "@/lib/navegacao/perfis";
import { temOModulo } from "@/lib/navegacao/visibilidade";
import { decidirAcesso, moduloDoCaminho, rotaPublica } from "./acesso";
import { PERMISSOES_DOS_PERFIS } from "./permissoes";
import { destinoInicial } from "./redirecionamento";

// O destino depois do login é do perfil (aprovação da 3.8, 04/11/2026): o primeiro módulo que o perfil
// pode ver, nunca uma rota que dá 404 para ele, sem laço de redirecionamento.

describe("destinoInicial: a primeira tela de cada perfil", () => {
  it("Administrador e Diretoria: Início; Gestor de frota: Frota › Placas; Operacional: Operacional", () => {
    expect(destinoInicial("Administrador")).toBe("/inicio/tarefas");
    expect(destinoInicial("Diretoria")).toBe("/inicio/tarefas");
    expect(destinoInicial("Gestor de frota")).toBe("/frota/placas");
    expect(destinoInicial("Operacional")).toBe("/operacional/patio");
  });

  it.each(PERFIS)("%s: uma tela do catálogo, de um módulo que o perfil pode ver", (perfil) => {
    const destino = destinoInicial(perfil);
    expect(acharTela(destino), destino).toBeDefined();
    const modulo = moduloDoCaminho(destino);
    expect(modulo).not.toBeNull();
    expect(temOModulo(perfil, modulo!)).toBe(true);
    expect(PERMISSOES_DOS_PERFIS[perfil].some((p) => p.modulo === modulo && p.acao === "ver")).toBe(
      true,
    );
  });

  it.each(PERFIS)(
    "%s: o destino não volta ao login nem redireciona de novo (sem laço)",
    (perfil) => {
      const destino = destinoInicial(perfil);
      expect(rotaPublica(destino)).toBe(false);
      expect(destino).not.toBe("/");
      expect(destino).not.toBe("/acesso-nao-liberado");
      // Tela, não a página do módulo (/frota, /operacional), que redireciona de novo ou dá 404.
      expect(destino.split("/").filter(Boolean)).toHaveLength(2);
      expect(
        decidirAcesso(destino, "", {
          temUsuario: true,
          temVinculo: true,
          perfil,
          podeVerModulo: true,
        }),
      ).toEqual({ tipo: "seguir" });
    },
  );
});

describe("decidirAcesso: os redirecionamentos de quem já entrou vão ao destino do perfil", () => {
  const logado = (perfil: (typeof PERFIS)[number]) => ({
    temUsuario: true,
    temVinculo: true,
    perfil,
    podeVerModulo: true,
  });

  it.each(PERFIS)("%s em /entrar vai para a sua primeira tela", (perfil) => {
    expect(decidirAcesso("/entrar", "", logado(perfil))).toEqual({
      tipo: "redirecionar",
      para: destinoInicial(perfil),
    });
  });

  it.each(PERFIS)("%s na raiz (/) vai para a sua primeira tela", (perfil) => {
    expect(decidirAcesso("/", "", logado(perfil))).toEqual({
      tipo: "redirecionar",
      para: destinoInicial(perfil),
    });
  });

  it.each(PERFIS)(
    "%s com vínculo em acesso não liberado vai para a sua primeira tela",
    (perfil) => {
      expect(decidirAcesso("/acesso-nao-liberado", "", logado(perfil))).toEqual({
        tipo: "redirecionar",
        para: destinoInicial(perfil),
      });
    },
  );

  it("sem sessão, a raiz vai para /entrar sem próximo (o destino sai do perfil)", () => {
    expect(decidirAcesso("/", "", { temUsuario: false })).toEqual({
      tipo: "redirecionar",
      para: "/entrar",
    });
  });

  it("sem vínculo, a raiz vai para acesso não liberado", () => {
    expect(decidirAcesso("/", "", { temUsuario: true, temVinculo: false })).toEqual({
      tipo: "redirecionar",
      para: "/acesso-nao-liberado",
    });
  });
});

describe("decidirAcesso: logado sem vínculo em /entrar", () => {
  it("vai para acesso não liberado (não fica no formulário nem cai numa tela de módulo)", () => {
    expect(decidirAcesso("/entrar", "", { temUsuario: true, temVinculo: false })).toEqual({
      tipo: "redirecionar",
      para: "/acesso-nao-liberado",
    });
  });
});
