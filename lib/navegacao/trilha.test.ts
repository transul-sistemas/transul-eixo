import { describe, expect, it } from "vitest";
import { migalhas } from "./trilha";

describe("migalhas (a trilha: Módulo › Tela › Modo)", () => {
  it("Módulo e Tela, com o módulo levando à primeira tela que o perfil abre", () => {
    expect(migalhas("/frota/placas", "Administrador")).toEqual([
      { texto: "Frota", href: "/frota/acompanhamento" },
      { texto: "Placas", atual: true },
    ]);
  });
  it("o modo vira a última migalha, e a tela passa a ser um link", () => {
    expect(migalhas("/frota/acompanhamento", "Administrador", "mapa")).toEqual([
      { texto: "Frota", href: "/frota/acompanhamento" },
      { texto: "Acompanhamento", href: "/frota/acompanhamento" },
      { texto: "Mapa", atual: true },
    ]);
  });
  it("os quatro modos do Acompanhamento aparecem pelo nome", () => {
    const nomes = ["grade", "agora", "censo", "mapa"].map(
      (modo) => migalhas("/frota/acompanhamento", "Administrador", modo).at(-1)?.texto,
    );
    expect(nomes).toEqual(["Grade", "Agora", "Censo", "Mapa"]);
  });
  it("modo que não existe, ou numa tela sem modos, é ignorado", () => {
    expect(migalhas("/frota/acompanhamento", "Administrador", "xyz")).toHaveLength(2);
    expect(migalhas("/frota/placas", "Administrador", "mapa")).toEqual([
      { texto: "Frota", href: "/frota/acompanhamento" },
      { texto: "Placas", atual: true },
    ]);
    expect(migalhas("/frota/acompanhamento", "Administrador", null)).toHaveLength(2);
    expect(migalhas("/frota/acompanhamento", "Administrador", "")).toHaveLength(2);
  });
  it("aceita a rota com ?modo= e barra final", () => {
    expect(migalhas("/frota/acompanhamento?modo=mapa", "Administrador")).toHaveLength(2);
    expect(migalhas("/frota/placas/", "Administrador").at(-1)?.texto).toBe("Placas");
  });
  it("tela com o mesmo nome do módulo repete o nome, sem confundir os links", () => {
    expect(migalhas("/operacoes/lista", "Administrador")).toEqual([
      { texto: "Operações", href: "/operacoes/lista" },
      { texto: "Operações", atual: true },
    ]);
  });
  it("rota fora do catálogo não tem trilha", () => {
    expect(migalhas("/nada", "Administrador")).toEqual([]);
    expect(migalhas("/", "Administrador")).toEqual([]);
  });
  it("perfil que não abre nada no módulo vê o nome dele, sem link", () => {
    const [modulo] = migalhas("/pessoas/escala", "Gestor de frota");
    expect(modulo).toEqual({ texto: "Pessoas" });
  });
  it("a última migalha é sempre a página atual", () => {
    for (const rota of ["/inicio/tarefas", "/pessoas/escala", "/admin/auditoria"]) {
      expect(migalhas(rota, "Administrador").at(-1)?.atual, rota).toBe(true);
    }
  });
});

describe("migalhas da ficha: Módulo › Tela › Identificador", () => {
  it("a trilha da ficha da placa termina na placa, e 'Placas' volta à lista", () => {
    expect(migalhas("/frota/placas/AAA0A00", "Administrador")).toEqual([
      { texto: "Frota", href: "/frota/acompanhamento" },
      { texto: "Placas", href: "/frota/placas" },
      { texto: "AAA0A00", atual: true },
    ]);
  });
  it("ignora ?aba=, a barra final e decodifica o identificador", () => {
    expect(migalhas("/frota/placas/AAA0A00?aba=mapa", "Administrador").at(-1)?.texto).toBe(
      "AAA0A00",
    );
    expect(migalhas("/frota/placas/AAA0A00/", "Administrador")).toHaveLength(3);
    expect(migalhas("/frota/placas/%41AA0A00", "Administrador").at(-1)?.texto).toBe("AAA0A00");
  });
  it("o módulo continua levando à primeira tela que o perfil abre", () => {
    // O Gestor de frota não vê telas em breve: a primeira que ele abre é o Acompanhamento.
    expect(migalhas("/frota/placas/AAA0A00", "Gestor de frota")[0]).toEqual({
      texto: "Frota",
      href: "/frota/acompanhamento",
    });
  });
  it("rota filha inválida ou de tela sem ficha não tem trilha", () => {
    expect(migalhas("/frota/placas/%3Cscript%3E", "Administrador")).toEqual([]);
    expect(migalhas("/frota/acompanhamento/AAA0A00", "Administrador")).toEqual([]);
    expect(migalhas("/frota/placas/AAA0A00/extra", "Administrador")).toEqual([]);
  });
});
