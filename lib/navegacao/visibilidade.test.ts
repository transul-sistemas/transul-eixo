import { describe, expect, it } from "vitest";
import { acharTela, CATALOGO, type ModuloDoCatalogo, type Tela } from "./catalogo";
import { PERFIS } from "./perfis";
import { modulosVisiveis, podeAbrir, rotaInicialDoModulo } from "./visibilidade";

function tela(id: string, estado: Tela["estado"], modulo: Tela["permissao"]["modulo"]): Tela {
  return {
    id: `${modulo}.${id}`,
    nome: id,
    icone: "IconPalette",
    rota: `/${modulo}/${id}`,
    permissao: { modulo, acao: "ver" },
    estado,
    descricao: "Faz algo.",
    dispositivos: ["desktop"],
  };
}

function modulo(id: ModuloDoCatalogo["id"], telas: Tela[]): ModuloDoCatalogo {
  return { id, nome: id, icone: "IconPalette", rota: `/${id}`, cor: "acao", telas };
}

// Catálogo de teste: um módulo de cada tipo de situação.
const FIXTURE: readonly ModuloDoCatalogo[] = [
  modulo("inicio", [tela("pronta", "pronto", "inicio")]),
  modulo("frota", [
    tela("pronta", "pronto", "frota"),
    tela("breve", "em-breve", "frota"),
    tela("restrita", "restrito", "frota"),
  ]),
  modulo("operacional", [tela("breve", "em-breve", "operacional")]),
  modulo("admin", [tela("pronta", "pronto", "admin")]),
];

describe("podeAbrir", () => {
  const pronta = tela("pronta", "pronto", "frota");
  const breve = tela("breve", "em-breve", "frota");
  const restrita = tela("restrita", "restrito", "frota");
  const deOutroModulo = tela("pronta", "pronto", "admin");

  it("tela pronta abre para quem tem o módulo", () => {
    expect(podeAbrir("Gestor de frota", pronta)).toBe(true);
    expect(podeAbrir("Administrador", pronta)).toBe(true);
  });
  it("tela pronta de módulo que o perfil não tem não abre", () => {
    expect(podeAbrir("Gestor de frota", deOutroModulo)).toBe(false);
    expect(podeAbrir("Operacional", pronta)).toBe(false);
    expect(podeAbrir("Diretoria", deOutroModulo)).toBe(true);
  });
  it("tela em breve só abre para Administrador e Diretoria", () => {
    expect(podeAbrir("Administrador", breve)).toBe(true);
    expect(podeAbrir("Diretoria", breve)).toBe(true);
    expect(podeAbrir("Gestor de frota", breve)).toBe(false);
    expect(podeAbrir("Operacional", breve)).toBe(false);
  });
  it("tela restrita nunca abre", () => {
    for (const perfil of PERFIS) expect(podeAbrir(perfil, restrita)).toBe(false);
  });
});

describe("modulosVisiveis (catálogo de teste)", () => {
  it("Administrador e Diretoria veem todos os módulos e todas as telas", () => {
    for (const perfil of ["Administrador", "Diretoria"] as const) {
      const visiveis = modulosVisiveis(perfil, FIXTURE);
      expect(visiveis.map((m) => m.id)).toEqual(["inicio", "frota", "operacional", "admin"]);
      expect(visiveis.find((m) => m.id === "frota")?.telas).toHaveLength(3);
    }
  });
  it("Gestor de frota vê só Início e Frota, sem telas em breve, e a restrita aparece", () => {
    const visiveis = modulosVisiveis("Gestor de frota", FIXTURE);
    expect(visiveis.map((m) => m.id)).toEqual(["inicio", "frota"]);
    expect(visiveis[1]?.telas.map((t) => t.id)).toEqual(["frota.pronta", "frota.restrita"]);
  });
  it("módulo sem nenhuma tela visível some da barra", () => {
    const ids = modulosVisiveis("Operacional", FIXTURE).map((m) => m.id);
    expect(ids).toEqual(["inicio"]);
    expect(ids).not.toContain("operacional");
  });
  it("preserva a ordem do catálogo", () => {
    const invertido = [...FIXTURE].reverse();
    expect(modulosVisiveis("Administrador", invertido).map((m) => m.id)).toEqual([
      "admin",
      "operacional",
      "frota",
      "inicio",
    ]);
  });
  it("não altera o catálogo recebido", () => {
    const antes = JSON.stringify(FIXTURE);
    modulosVisiveis("Gestor de frota", FIXTURE);
    expect(JSON.stringify(FIXTURE)).toBe(antes);
  });
});

describe("modulosVisiveis (catálogo real)", () => {
  it("Administrador e Diretoria veem os 9 módulos e as 35 telas", () => {
    for (const perfil of ["Administrador", "Diretoria"] as const) {
      const visiveis = modulosVisiveis(perfil);
      expect(visiveis).toHaveLength(9);
      expect(visiveis.flatMap((m) => m.telas)).toHaveLength(35);
    }
  });
  it("com só as Placas prontas, o Gestor de frota vê Frota › Placas e o Operacional não vê nada", () => {
    expect(modulosVisiveis("Gestor de frota").map((m) => [m.id, m.telas.map((t) => t.id)])).toEqual(
      [["frota", ["frota.placas"]]],
    );
    expect(modulosVisiveis("Operacional")).toEqual([]);
  });
  it("a Demonstração, pronta, só abre para quem tem o módulo de Administração", () => {
    const demonstracao = acharTela("/admin/demonstracao")?.tela;
    expect(demonstracao).toBeDefined();
    if (!demonstracao) return;
    expect(podeAbrir("Administrador", demonstracao)).toBe(true);
    expect(podeAbrir("Gestor de frota", demonstracao)).toBe(false);
    expect(podeAbrir("Operacional", demonstracao)).toBe(false);
  });
  it("o catálogo real continua com 9 módulos", () => {
    expect(CATALOGO).toHaveLength(9);
  });
});

describe("rotaInicialDoModulo (para onde /frota, /pessoas etc. redirecionam)", () => {
  it("é a primeira tela que o perfil pode abrir, no catálogo de teste", () => {
    expect(rotaInicialDoModulo("Administrador", "frota", FIXTURE)).toBe("/frota/pronta");
    expect(rotaInicialDoModulo("Gestor de frota", "frota", FIXTURE)).toBe("/frota/pronta");
    expect(rotaInicialDoModulo("Gestor de frota", "inicio", FIXTURE)).toBe("/inicio/pronta");
  });
  it("pula telas que o perfil não pode abrir", () => {
    const catalogo: readonly ModuloDoCatalogo[] = [
      modulo("frota", [
        tela("trancada", "restrito", "frota"),
        tela("breve", "em-breve", "frota"),
        tela("pronta", "pronto", "frota"),
      ]),
    ];
    expect(rotaInicialDoModulo("Gestor de frota", "frota", catalogo)).toBe("/frota/pronta");
    expect(rotaInicialDoModulo("Administrador", "frota", catalogo)).toBe("/frota/breve");
  });
  it("sem tela aberta para o perfil não há para onde ir", () => {
    expect(rotaInicialDoModulo("Operacional", "operacional", FIXTURE)).toBeUndefined();
    expect(rotaInicialDoModulo("Operacional", "frota", FIXTURE)).toBeUndefined();
  });
  it("módulo que não existe no catálogo não tem rota", () => {
    expect(rotaInicialDoModulo("Administrador", "resultados", FIXTURE)).toBeUndefined();
  });
  it("no catálogo real, o Administrador vai para a primeira tela de cada módulo", () => {
    for (const m of CATALOGO) {
      expect(rotaInicialDoModulo("Administrador", m.id), m.id).toBe(m.telas[0]?.rota);
    }
    expect(rotaInicialDoModulo("Administrador", "frota")).toBe("/frota/acompanhamento");
    expect(rotaInicialDoModulo("Administrador", "inicio")).toBe("/inicio/tarefas");
  });
  it("no catálogo real, quem não vê nada não é levado a lugar nenhum", () => {
    for (const m of CATALOGO) {
      expect(rotaInicialDoModulo("Operacional", m.id), m.id).toBeUndefined();
      const esperado = m.id === "frota" ? "/frota/placas" : undefined;
      expect(rotaInicialDoModulo("Gestor de frota", m.id), m.id).toBe(esperado);
    }
  });
});
