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
    tela("estrutura", "esqueleto", "frota"),
    tela("restrita", "restrito", "frota"),
  ]),
  modulo("operacional", [tela("breve", "em-breve", "operacional")]),
  modulo("admin", [tela("pronta", "pronto", "admin")]),
];

describe("tela esqueleto (estrutura sem dados)", () => {
  const estrutura = tela("estrutura", "esqueleto", "frota");
  it("só Administrador e Diretoria abrem", () => {
    expect(podeAbrir("Administrador", estrutura)).toBe(true);
    expect(podeAbrir("Diretoria", estrutura)).toBe(true);
    expect(podeAbrir("Gestor de frota", estrutura)).toBe(false);
    expect(podeAbrir("Operacional", estrutura)).toBe(false);
  });
  it("não aparece no menu de quem não a abre", () => {
    const nomes = (perfil: (typeof PERFIS)[number]) =>
      modulosVisiveis(perfil, FIXTURE)
        .flatMap((m) => m.telas)
        .map((t) => t.id);
    expect(nomes("Administrador")).toContain("frota.estrutura");
    expect(nomes("Gestor de frota")).not.toContain("frota.estrutura");
    expect(nomes("Operacional")).not.toContain("frota.estrutura");
  });
  it("no catálogo real, nenhum perfil sem acompanhamento da obra vê tela esqueleto", () => {
    for (const perfil of ["Gestor de frota", "Operacional"] as const) {
      const vistas = modulosVisiveis(perfil).flatMap((m) => m.telas);
      expect(
        vistas.filter((t) => t.estado === "esqueleto"),
        perfil,
      ).toEqual([]);
    }
  });
});

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
      expect(visiveis.find((m) => m.id === "frota")?.telas).toHaveLength(4);
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
  it("Administrador e Diretoria veem os 9 módulos; o Administrador, as 38 telas; a Diretoria, 37 (sem o Meu dia, em teste)", () => {
    for (const perfil of ["Administrador", "Diretoria"] as const) {
      const visiveis = modulosVisiveis(perfil);
      expect(visiveis).toHaveLength(9);
      expect(visiveis.flatMap((m) => m.telas)).toHaveLength(perfil === "Administrador" ? 38 : 37);
    }
  });
  it("com as cinco telas da Frota prontas, o Gestor de frota vê as cinco; o Operacional vê Pátio, Totem, Ordens de carregamento e a Escala", () => {
    expect(modulosVisiveis("Gestor de frota").map((m) => [m.id, m.telas.map((t) => t.id)])).toEqual(
      [
        ["inicio", ["inicio.tarefas", "inicio.mapa-do-sistema"]],
        [
          "frota",
          [
            "frota.acompanhamento",
            "frota.placas",
            "frota.abastecimento",
            "frota.carteira",
            "frota.excecoes",
            "frota.analise",
          ],
        ],
      ],
    );
    expect(modulosVisiveis("Operacional").map((m) => [m.id, m.telas.map((t) => t.id)])).toEqual([
      ["inicio", ["inicio.tarefas", "inicio.mapa-do-sistema"]],
      [
        "operacional",
        ["operacional.patio", "operacional.totem", "operacional.ordens-de-carregamento"],
      ],
      ["pessoas", ["pessoas.escala"]],
    ]);
  });
  it("Pessoas para o Operacional (10/11/2026): só a Escala (da filial dele); a lista e a ficha, não", () => {
    const escala = acharTela("/pessoas/escala")?.tela;
    const lista = acharTela("/pessoas/lista")?.tela;
    expect(escala && lista).toBeDefined();
    if (!escala || !lista) return;
    expect(podeAbrir("Operacional", escala)).toBe(true);
    expect(podeAbrir("Operacional", lista)).toBe(false);
    for (const perfil of ["Administrador", "Diretoria"] as const) {
      expect(podeAbrir(perfil, escala)).toBe(true);
      expect(podeAbrir(perfil, lista)).toBe(true);
    }
    expect(podeAbrir("Gestor de frota", escala)).toBe(false);
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
  it("no catálogo real, cada perfil só é levado ao módulo que vê", () => {
    for (const m of CATALOGO) {
      const doOperacional =
        m.id === "inicio"
          ? "/inicio/tarefas"
          : m.id === "operacional"
            ? "/operacional/patio"
            : m.id === "pessoas"
              ? "/pessoas/escala"
              : undefined;
      expect(rotaInicialDoModulo("Operacional", m.id), m.id).toBe(doOperacional);
      const esperado =
        m.id === "frota"
          ? "/frota/acompanhamento"
          : m.id === "inicio"
            ? "/inicio/tarefas"
            : undefined;
      expect(rotaInicialDoModulo("Gestor de frota", m.id), m.id).toBe(esperado);
    }
  });
});
