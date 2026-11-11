import { describe, expect, it } from "vitest";
import { CATALOGO, todasAsTelas } from "./catalogo";
import { lerFiltroDoMapa, montarMapa } from "./mapa-do-sistema";

describe("mapa do sistema", () => {
  it("o Administrador e a Diretoria veem os 9 módulos e todas as telas do catálogo", () => {
    for (const perfil of ["Administrador", "Diretoria"] as const) {
      const mapa = montarMapa(perfil);
      expect(mapa.modulos.map((m) => m.modulo.id)).toEqual(CATALOGO.map((m) => m.id));
      expect(mapa.contagem.todos).toBe(todasAsTelas().length);
      expect(mapa.contagem.pronto + mapa.contagem.esqueleto).toBe(mapa.contagem.todos);
    }
  });
  it("cada perfil vê só as telas que abre; sem ser Administrador ou Diretoria, só as prontas", () => {
    for (const perfil of ["Gestor de frota", "Operacional"] as const) {
      const telas = montarMapa(perfil).modulos.flatMap((m) => m.telas);
      expect(telas.length, perfil).toBeGreaterThan(0);
      for (const t of telas) {
        expect(t.perfisQueVeem, `${perfil} ${t.tela.id}`).toContain(perfil);
        expect(t.tela.estado, `${perfil} ${t.tela.id}`).toBe("pronto");
      }
    }
  });
  it("o perfil que vê é a lista dos perfis que abrem a tela", () => {
    const telas = montarMapa("Administrador").modulos.flatMap((m) => m.telas);
    const placas = telas.find((t) => t.tela.id === "frota.placas");
    expect(placas?.perfisQueVeem).toEqual(["Administrador", "Diretoria", "Gestor de frota"]);
    const tarefas = telas.find((t) => t.tela.id === "inicio.tarefas");
    expect(tarefas?.perfisQueVeem).toHaveLength(4);
    const mapa = telas.find((t) => t.tela.id === "inicio.mapa-do-sistema");
    expect(mapa?.perfisQueVeem).toHaveLength(4);
  });
  it("o filtro por estado deixa só as telas daquele estado, e módulo vazio some", () => {
    const mapa = montarMapa("Administrador", "esqueleto");
    for (const t of mapa.modulos.flatMap((m) => m.telas)) expect(t.tela.estado).toBe("esqueleto");
    expect(mapa.modulos.map((m) => m.modulo.id)).not.toContain("frota");
    expect(mapa.contagem.todos).toBe(todasAsTelas().length);
  });
  it("filtro que não existe vira todos", () => {
    expect(lerFiltroDoMapa("xyz")).toBe("todos");
    expect(lerFiltroDoMapa(undefined)).toBe("todos");
    expect(lerFiltroDoMapa("esqueleto")).toBe("esqueleto");
  });
});
