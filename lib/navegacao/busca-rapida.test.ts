import { describe, expect, it, vi } from "vitest";
import type { Perfil } from "./perfis";
import {
  achatar,
  chaveDeRecentes,
  gravarRecentes,
  lerRecentes,
  montarGrupos,
  mover,
  registrarRecente,
} from "./busca-rapida";

const SEM_CONTEXTO = { fixados: [], recentes: [] };
const rotulos = (termo: string, perfil: Perfil = "Administrador") =>
  achatar(montarGrupos(termo, perfil, SEM_CONTEXTO)).map((i) => i.rotulo);

function memoria(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    dados,
    getItem: vi.fn((chave: string) => dados.get(chave) ?? null),
    setItem: vi.fn((chave: string, valor: string) => void dados.set(chave, valor)),
  };
}

describe("montarGrupos: com termo", () => {
  it("acha uma tela pelo nome, com o caminho Módulo › Tela e a rota", () => {
    const [grupo] = montarGrupos("carteira", "Administrador", SEM_CONTEXTO);
    expect(grupo?.id).toBe("telas");
    expect(grupo?.titulo).toBe("Telas");
    expect(grupo?.itens[0]).toMatchObject({
      tipo: "tela",
      rotulo: "Frota › Carteira",
      rota: "/frota/carteira",
      emBreve: true,
      disponivel: true,
    });
  });
  it("acha os quatro modos do Acompanhamento da Frota, cada um com o seu ?modo=", () => {
    for (const [nome, id] of [
      ["grade", "grade"],
      ["agora", "agora"],
      ["censo", "censo"],
      ["mapa", "mapa"],
    ] as const) {
      const item = achatar(montarGrupos(nome, "Administrador", SEM_CONTEXTO)).find(
        (i) => i.tipo === "modo",
      );
      expect(item, `modo ${nome}`).toBeDefined();
      expect(item?.rota).toBe(`/frota/acompanhamento?modo=${id}`);
      expect(item?.rotulo).toBe(
        `Frota › Acompanhamento › ${nome[0]?.toUpperCase()}${nome.slice(1)}`,
      );
    }
  });
  it("mapa acha o modo e a tela Mapa do sistema, cada um com a sua rota", () => {
    expect(rotulos("mapa")).toEqual(["Início › Mapa do sistema", "Frota › Acompanhamento › Mapa"]);
  });
  it("tela e modo digitados juntos levam direto ao modo", () => {
    expect(rotulos("acompanhamento censo")).toEqual(["Frota › Acompanhamento › Censo"]);
  });
  it("sem acento e sem maiúscula", () => {
    expect(rotulos("OPERACOES")[0]).toBe("Operações › Operações");
  });
  it("acha ações, em outro grupo e depois das telas", () => {
    const grupos = montarGrupos("placa", "Administrador", SEM_CONTEXTO);
    expect(grupos.map((g) => g.id)).toEqual(["telas", "acoes"]);
    const acao = grupos[1]?.itens[0];
    expect(acao).toMatchObject({
      tipo: "acao",
      rotulo: "Operacional › Receber placa",
      emBreve: true,
      disponivel: false,
    });
    expect(acao?.rota).toBeUndefined();
  });
  it("só ação, quando nenhuma tela combina: o grupo de telas não aparece vazio", () => {
    const grupos = montarGrupos("disponibilizar", "Administrador", SEM_CONTEXTO);
    expect(grupos.map((g) => g.id)).toEqual(["acoes"]);
  });
  it("sem resultado, nenhum grupo", () => {
    expect(montarGrupos("zzzz", "Administrador", SEM_CONTEXTO)).toEqual([]);
  });
  it("perfil que não abre a tela não a encontra", () => {
    expect(rotulos("carteira", "Gestor de frota")).toEqual([]);
    expect(rotulos("receber placa", "Operacional")).toEqual([]);
  });
  it("os ids dos itens são únicos", () => {
    const ids = achatar(montarGrupos("a", "Administrador", SEM_CONTEXTO)).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("montarGrupos: sem termo (fixados e recentes)", () => {
  it("sem fixados nem recentes, não há grupo", () => {
    expect(montarGrupos("", "Administrador", SEM_CONTEXTO)).toEqual([]);
    expect(montarGrupos("   ", "Administrador", SEM_CONTEXTO)).toEqual([]);
  });
  it("mostra os fixados e, depois, os recentes que não estão fixados", () => {
    const grupos = montarGrupos("", "Administrador", {
      fixados: ["frota.placas"],
      recentes: ["frota.carteira", "frota.placas"],
    });
    expect(grupos.map((g) => g.id)).toEqual(["fixados", "recentes"]);
    expect(grupos[0]?.itens.map((i) => i.rotulo)).toEqual(["Frota › Placas"]);
    expect(grupos[1]?.itens.map((i) => i.rotulo)).toEqual(["Frota › Carteira"]);
  });
  it("ignora o que não existe mais no catálogo e o que o perfil não abre", () => {
    const contexto = { fixados: ["frota.sumiu"], recentes: ["frota.placas", "x.y"] };
    expect(achatar(montarGrupos("", "Administrador", contexto)).map((i) => i.rotulo)).toEqual([
      "Frota › Placas",
    ]);
    expect(montarGrupos("", "Gestor de frota", contexto)).toEqual([]);
  });
});

describe("achatar e mover (a lista que o teclado percorre)", () => {
  it("achatar junta os itens dos grupos, na ordem", () => {
    const grupos = montarGrupos("placa", "Administrador", SEM_CONTEXTO);
    expect(achatar(grupos)).toEqual(grupos.flatMap((g) => g.itens));
  });
  it("mover anda e dá a volta nas pontas", () => {
    expect(mover(0, 3, 1)).toBe(1);
    expect(mover(2, 3, 1)).toBe(0);
    expect(mover(0, 3, -1)).toBe(2);
    expect(mover(1, 3, -1)).toBe(0);
  });
  it("sem itens, não há opção ativa", () => {
    expect(mover(0, 0, 1)).toBe(-1);
    expect(mover(-1, 0, -1)).toBe(-1);
  });
  it("sem opção ativa, a primeira seta escolhe a primeira ou a última", () => {
    expect(mover(-1, 3, 1)).toBe(0);
    expect(mover(-1, 3, -1)).toBe(2);
  });
});

describe("recentes", () => {
  it("a tela visitada vai para o começo, sem repetir", () => {
    expect(registrarRecente(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(registrarRecente([], "a")).toEqual(["a"]);
  });
  it("guarda no máximo 5", () => {
    const seis = registrarRecente(["1", "2", "3", "4", "5"], "6");
    expect(seis).toEqual(["6", "1", "2", "3", "4"]);
  });
  it("não altera a lista recebida", () => {
    const original = ["a", "b"];
    registrarRecente(original, "c");
    expect(original).toEqual(["a", "b"]);
  });
  it("grava e lê de volta, por usuário", () => {
    const m = memoria();
    gravarRecentes("ana", ["frota.placas", "frota.carteira"], m);
    expect(lerRecentes("ana", m)).toEqual(["frota.placas", "frota.carteira"]);
    expect(lerRecentes("bia", m)).toEqual([]);
    expect(chaveDeRecentes("ana")).toBe("eixo:recentes:ana");
  });
  it.each([
    ["JSON inválido", "{"],
    ["não é lista", '{"a":1}'],
    ["vazio", ""],
  ])("memória corrompida (%s) vira lista vazia", (_nome, texto) => {
    const m = memoria({ [chaveDeRecentes("ana")]: texto });
    expect(lerRecentes("ana", m)).toEqual([]);
  });
  it("itens que não são texto saem da lista", () => {
    const m = memoria({ [chaveDeRecentes("ana")]: JSON.stringify(["a", 3, null, "b"]) });
    expect(lerRecentes("ana", m)).toEqual(["a", "b"]);
  });
  it("armazenamento que lança erro não derruba nada", () => {
    const quebrado = {
      getItem: () => {
        throw new Error("indisponível");
      },
      setItem: () => {
        throw new Error("indisponível");
      },
    };
    expect(lerRecentes("ana", quebrado)).toEqual([]);
    expect(() => gravarRecentes("ana", ["a"], quebrado)).not.toThrow();
  });
});
