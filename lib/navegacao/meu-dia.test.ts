import { describe, expect, it } from "vitest";
import { decidirAcesso } from "@/lib/seguranca/acesso";
import { acharTela, todasAsTelas } from "./catalogo";
import { montarGrupos } from "./busca-rapida";
import { montarMapa } from "./mapa-do-sistema";
import { PERFIS, TELAS_SO_DO_ADMINISTRADOR } from "./perfis";
import { modulosVisiveis, podeAbrir, rotaInicialDoModulo } from "./visibilidade";

// Meu dia atrás de um indicador de teste: só o Administrador o vê (menu, Ctrl+K, mapa) e o abre (rota).
// Critério (d) do inventário: rota, entrada no menu e no Ctrl+K, permissão.

const ROTA = "/inicio/meu-dia";
const tela = () => {
  const achada = acharTela(ROTA);
  if (!achada) throw new Error("O Meu dia saiu do catálogo");
  return achada.tela;
};
const contexto = { fixados: [], recentes: [] };

describe("Meu dia (indicador de teste só para o Administrador)", () => {
  it("está no catálogo, no módulo Início, com o selo Teste", () => {
    expect(tela().id).toBe("inicio.meu-dia");
    expect(tela().selo).toBe("Teste");
    expect(TELAS_SO_DO_ADMINISTRADOR).toContain("inicio.meu-dia");
  });

  it("só o Administrador abre; os outros três perfis não", () => {
    for (const perfil of PERFIS) {
      expect(podeAbrir(perfil, tela()), perfil).toBe(perfil === "Administrador");
    }
  });

  it("só o Administrador vê no menu", () => {
    for (const perfil of PERFIS) {
      const ids = modulosVisiveis(perfil).flatMap((m) => m.telas.map((t) => t.id));
      expect(ids.includes("inicio.meu-dia"), perfil).toBe(perfil === "Administrador");
    }
  });

  it("só o Administrador acha no Ctrl+K", () => {
    for (const perfil of PERFIS) {
      const itens = montarGrupos("meu dia", perfil, contexto).flatMap((g) => g.itens);
      expect(
        itens.some((i) => i.id === "inicio.meu-dia"),
        perfil,
      ).toBe(perfil === "Administrador");
    }
  });

  it("a rota responde como não encontrada para os demais e segue para o Administrador", () => {
    for (const perfil of PERFIS) {
      const decisao = decidirAcesso(ROTA, "", {
        temUsuario: true,
        temVinculo: true,
        perfil,
        podeVerModulo: true,
      });
      expect(decisao.tipo, perfil).toBe(perfil === "Administrador" ? "seguir" : "nao-encontrada");
    }
  });

  it("não aparece no mapa do sistema de quem não a abre", () => {
    for (const perfil of PERFIS) {
      const ids = montarMapa(perfil).modulos.flatMap((m) => m.telas.map((t) => t.tela.id));
      expect(ids.includes("inicio.meu-dia"), perfil).toBe(perfil === "Administrador");
    }
  });

  it("não vira a primeira tela do Início de ninguém: Tarefas continua na frente", () => {
    for (const perfil of PERFIS) {
      expect(rotaInicialDoModulo(perfil, "inicio")).toBe("/inicio/tarefas");
    }
  });

  it("toda tela só do Administrador existe no catálogo", () => {
    const ids = todasAsTelas().map((t) => t.id);
    for (const id of TELAS_SO_DO_ADMINISTRADOR) expect(ids).toContain(id);
  });
});
