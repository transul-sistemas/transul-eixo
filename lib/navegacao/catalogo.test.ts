import { describe, expect, it } from "vitest";
import { MODULOS } from "@/lib/visual/tons";
import { acharFicha, acharTela, CATALOGO, todasAsTelas } from "./catalogo";
import * as perfis from "./perfis";
import { PERFIS, PERFIS_QUE_VEEM_EM_BREVE } from "./perfis";

const ultimoSegmento = (rota: string) => rota.split("/").at(-1);

describe("catálogo: módulos", () => {
  it("tem os 9 módulos, na ordem do menu", () => {
    expect(CATALOGO.map((m) => m.id)).toEqual([
      "inicio",
      "frota",
      "operacional",
      "operacoes",
      "pessoas",
      "parceiros",
      "resultados",
      "cadastros",
      "admin",
    ]);
  });
  it("cada módulo tem nome, ícone, rota de prefixo e cor válida", () => {
    for (const modulo of CATALOGO) {
      expect(modulo.nome, modulo.id).not.toBe("");
      expect(modulo.icone, modulo.id).toMatch(/^Icon[A-Za-z0-9]+$/);
      expect(modulo.rota, modulo.id).toBe(`/${modulo.id}`);
      const validas: readonly string[] = ["acao", ...MODULOS];
      expect(validas, modulo.id).toContain(modulo.cor);
    }
  });
  it("o Início usa o azul de ação e a Administração usa a cor própria que divide com Cadastros", () => {
    expect(CATALOGO.find((m) => m.id === "inicio")?.cor).toBe("acao");
    expect(CATALOGO.find((m) => m.id === "admin")?.cor).toBe("admin");
  });
});

describe("catálogo: telas", () => {
  const telas = todasAsTelas();
  it("tem 35 telas", () => {
    expect(telas).toHaveLength(35);
  });
  it("id e rota são únicos", () => {
    expect(new Set(telas.map((t) => t.id)).size).toBe(telas.length);
    expect(new Set(telas.map((t) => t.rota)).size).toBe(telas.length);
  });
  it("rota começa com /, não termina com / e começa pelo prefixo do módulo", () => {
    for (const modulo of CATALOGO) {
      for (const tela of modulo.telas) {
        expect(tela.rota, tela.id).toMatch(/^\/[a-z0-9\-/]+$/);
        expect(tela.rota.endsWith("/"), tela.id).toBe(false);
        expect(tela.rota.startsWith(`${modulo.rota}/`), tela.id).toBe(true);
      }
    }
  });
  it("o id é o módulo mais o último trecho da rota, e a permissão é a do módulo", () => {
    for (const modulo of CATALOGO) {
      for (const tela of modulo.telas) {
        expect(tela.id).toBe(`${modulo.id}.${ultimoSegmento(tela.rota)}`);
        expect(tela.permissao).toEqual({ modulo: modulo.id, acao: "ver" });
      }
    }
  });
  it("tela com o mesmo nome do módulo usa a rota lista", () => {
    expect(acharTela("/operacoes/lista")?.tela.nome).toBe("Operações");
    expect(acharTela("/pessoas/lista")?.tela.nome).toBe("Pessoas");
    expect(acharTela("/parceiros/lista")?.tela.nome).toBe("Parceiros");
    expect(acharTela("/operacoes/operacoes")).toBeUndefined();
    expect(acharTela("/pessoas/pessoas")).toBeUndefined();
    expect(acharTela("/parceiros/parceiros")).toBeUndefined();
    for (const modulo of CATALOGO) {
      for (const tela of modulo.telas) {
        expect(ultimoSegmento(tela.rota), tela.id).not.toBe(modulo.id);
      }
    }
  });
  it("ícone é nome de componente Tabler; descrição é uma frase sem exclamação", () => {
    for (const tela of telas) {
      expect(tela.icone, tela.id).toMatch(/^Icon[A-Za-z0-9]+$/);
      expect(tela.descricao.trim(), tela.id).not.toBe("");
      expect(tela.descricao, tela.id).not.toContain("!");
      expect(tela.descricao.endsWith("."), tela.id).toBe(true);
    }
  });
  it("tudo está em-breve, menos a Demonstração, o Acompanhamento, as Placas e a Carteira, que estão prontos", () => {
    const prontas = telas.filter((t) => t.estado === "pronto").map((t) => t.id);
    expect(prontas).toEqual([
      "frota.acompanhamento",
      "frota.placas",
      "frota.carteira",
      "admin.demonstracao",
    ]);
    expect(telas.filter((t) => t.estado === "restrito")).toEqual([]);
    expect(acharTela("/inicio/mapa-do-sistema")?.tela.estado).toBe("em-breve");
  });
});

describe("catálogo: celular e tablet", () => {
  const telas = todasAsTelas();
  it("só Pátio, Totem, Carteira, Tarefas e Status diário levam celular", () => {
    const comCelular = telas.filter((t) => t.dispositivos.includes("celular")).map((t) => t.id);
    expect(comCelular.sort()).toEqual(
      [
        "frota.carteira",
        "inicio.tarefas",
        "operacional.patio",
        "operacional.totem",
        "pessoas.status-diario",
      ].sort(),
    );
  });
  it("Acompanhamento e Ordens de carregamento levam só desktop e tablet", () => {
    expect(acharTela("/frota/acompanhamento")?.tela.dispositivos).toEqual(["desktop", "tablet"]);
    expect(acharTela("/operacional/ordens-de-carregamento")?.tela.dispositivos).toEqual([
      "desktop",
      "tablet",
    ]);
  });
  it("o Totem é de tablet e celular", () => {
    expect(acharTela("/operacional/totem")?.tela.dispositivos).toEqual(["tablet", "celular"]);
  });
  it("Pátio e Carteira existem e levam desktop, tablet e celular", () => {
    for (const rota of ["/operacional/patio", "/frota/carteira"]) {
      expect(acharTela(rota)?.tela.dispositivos, rota).toEqual(["desktop", "tablet", "celular"]);
    }
  });
});

describe("catálogo: modos do Acompanhamento da Frota", () => {
  it("tem Grade, Agora, Censo e Mapa, guardados em ?modo= pelo id", () => {
    const modos = acharTela("/frota/acompanhamento")?.tela.modos;
    expect(modos?.map((m) => m.id)).toEqual(["grade", "agora", "censo", "mapa"]);
    expect(modos?.map((m) => m.nome)).toEqual(["Grade", "Agora", "Censo", "Mapa"]);
  });
  it("nenhuma outra tela tem modos", () => {
    const comModos = todasAsTelas()
      .filter((t) => t.modos !== undefined)
      .map((t) => t.id);
    expect(comModos).toEqual(["frota.acompanhamento"]);
  });
  it("os ids de modo são únicos, em minúscula e sem espaço", () => {
    for (const tela of todasAsTelas()) {
      const ids = tela.modos?.map((m) => m.id) ?? [];
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z]+$/);
    }
  });
});

describe("acharTela", () => {
  it("acha pela rota e devolve o módulo da tela", () => {
    const achada = acharTela("/frota/placas");
    expect(achada?.tela.nome).toBe("Placas");
    expect(achada?.modulo.id).toBe("frota");
  });
  it("ignora o ?modo= e a barra final", () => {
    expect(acharTela("/frota/acompanhamento?modo=mapa")?.tela.id).toBe("frota.acompanhamento");
    expect(acharTela("/frota/placas/")?.tela.id).toBe("frota.placas");
  });
  it("rota que não está no catálogo devolve undefined", () => {
    expect(acharTela("/nada")).toBeUndefined();
    expect(acharTela("")).toBeUndefined();
    expect(acharTela("/")).toBeUndefined();
  });
});

describe("perfis", () => {
  it("são os quatro aprovados", () => {
    expect([...PERFIS]).toEqual(["Administrador", "Diretoria", "Gestor de frota", "Operacional"]);
  });
  it("só Administrador e Diretoria veem telas em breve", () => {
    expect([...PERFIS_QUE_VEEM_EM_BREVE]).toEqual(["Administrador", "Diretoria"]);
  });
  it("não há usuário provisório: a memória da barra e os rascunhos são de quem entrou (3.9a)", () => {
    expect("USUARIO_PROVISORIO" in perfis).toBe(false);
  });
});

describe("telas com ficha e acharFicha (a rota filha /<tela>/<identificador>)", () => {
  it("só as quatro listas que abrem a ficha de cada item levam a marca", () => {
    const comFicha = CATALOGO.flatMap((m) => m.telas.filter((t) => t.ficha)).map((t) => t.rota);
    expect([...comFicha].sort()).toEqual([
      "/frota/placas",
      "/operacoes/lista",
      "/parceiros/lista",
      "/pessoas/lista",
    ]);
  });
  it("acha a ficha pela rota filha e devolve o módulo, a tela e o identificador", () => {
    const achada = acharFicha("/frota/placas/AAA0A00");
    expect(achada?.tela.id).toBe("frota.placas");
    expect(achada?.modulo.id).toBe("frota");
    expect(achada?.identificador).toBe("AAA0A00");
  });
  it("ignora ?aba=, # e a barra final", () => {
    expect(acharFicha("/frota/placas/AAA0A00?aba=mapa")?.identificador).toBe("AAA0A00");
    expect(acharFicha("/frota/placas/AAA0A00#x")?.identificador).toBe("AAA0A00");
    expect(acharFicha("/frota/placas/AAA0A00/")?.identificador).toBe("AAA0A00");
  });
  it("decodifica o identificador, sem lançar com escape quebrado", () => {
    expect(acharFicha("/frota/placas/%41AA0A00")?.identificador).toBe("AAA0A00");
    expect(() => acharFicha("/frota/placas/%E0%A4%A")).not.toThrow();
    expect(acharFicha("/frota/placas/%E0%A4%A")).toBeUndefined();
  });
  it.each([
    ["a própria lista", "/frota/placas"],
    ["tela sem ficha", "/frota/acompanhamento/AAA0A00"],
    ["dois níveis", "/frota/placas/AAA0A00/extra"],
    ["HTML", "/frota/placas/%3Cscript%3E"],
    ["espaço", "/frota/placas/AAA%200A00"],
    ["identificador enorme", `/frota/placas/${"A".repeat(41)}`],
    ["módulo que não existe", "/nada/placas/AAA0A00"],
    ["vazia", ""],
  ])("não é ficha: %s", (_nome, rota) => {
    expect(acharFicha(rota)).toBeUndefined();
  });
  it("acharTela continua sem achar a rota filha (a ficha tem a sua função)", () => {
    expect(acharTela("/frota/placas/AAA0A00")).toBeUndefined();
  });
});
