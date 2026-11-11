import { describe, expect, it } from "vitest";
import { acharTela, type ModuloDoCatalogo, type Tela } from "./catalogo";
import { buscarTelas, normalizar } from "./busca";

describe("normalizar", () => {
  it("tira acento, maiúscula e espaço sobrando", () => {
    expect(normalizar("  Operações  ")).toBe("operacoes");
    expect(normalizar("DIÁRIAS   e Premiação")).toBe("diarias e premiacao");
  });
});

describe("buscarTelas: nomes", () => {
  it("acha sem acento e sem diferença de maiúscula", () => {
    const resultado = buscarTelas("operacoes", "Administrador");
    expect(resultado[0]?.tela.nome).toBe("Operações");
    expect(resultado[0]?.rota).toBe("/operacoes/lista");
    expect(buscarTelas("OPERAÇÕES", "Administrador")[0]?.tela.id).toBe("operacoes.lista");
  });
  it("termo vazio ou só com espaço não lista nada", () => {
    expect(buscarTelas("", "Administrador")).toEqual([]);
    expect(buscarTelas("   ", "Administrador")).toEqual([]);
  });
  it("sem resultado devolve lista vazia", () => {
    expect(buscarTelas("zzzz", "Administrador")).toEqual([]);
  });
  it("começo de nome vem antes de meio de nome", () => {
    const ids = buscarTelas("pessoas", "Administrador").map((r) => r.tela.id);
    expect(ids[0]).toBe("pessoas.lista");
    expect(ids).toContain("pessoas.escala");
  });
  it("Análise aparece nos quatro módulos que têm", () => {
    const ids = buscarTelas("ANALISE", "Administrador").map((r) => r.tela.id);
    expect(ids.sort()).toEqual(
      ["frota.analise", "operacional.analise", "operacoes.analise", "pessoas.analise"].sort(),
    );
  });
  it("os resultados trazem um rótulo com módulo e tela", () => {
    const placas = buscarTelas("placas", "Administrador")[0];
    expect(placas?.rotulo).toBe("Frota › Placas");
    expect(placas?.rota).toBe("/frota/placas");
  });
});

describe("buscarTelas: modos do Acompanhamento da Frota (Ctrl+K)", () => {
  const modos = [
    { id: "grade", nome: "Grade" },
    { id: "agora", nome: "Agora" },
    { id: "censo", nome: "Censo" },
    { id: "mapa", nome: "Mapa" },
  ];

  it.each(modos)("acha o modo $nome pelo nome e leva para ?modo=$id", ({ id, nome }) => {
    const resultado = buscarTelas(nome.toLowerCase(), "Administrador").find(
      (r) => r.modo?.id === id,
    );
    expect(resultado, `modo ${nome}`).toBeDefined();
    expect(resultado?.tela.id).toBe("frota.acompanhamento");
    expect(resultado?.rota).toBe(`/frota/acompanhamento?modo=${id}`);
    expect(resultado?.rotulo).toBe(`Frota › Acompanhamento › ${nome}`);
  });
  it("acha com acento e maiúscula trocados", () => {
    expect(buscarTelas("MAPA", "Administrador").some((r) => r.modo?.id === "mapa")).toBe(true);
  });
  it("o modo Mapa aparece junto da tela Mapa do sistema, sem confundir as rotas", () => {
    const resultado = buscarTelas("mapa", "Administrador");
    expect(resultado.map((r) => r.rota).sort()).toEqual([
      "/frota/acompanhamento?modo=mapa",
      "/inicio/mapa-do-sistema",
    ]);
  });
  it("digitar tela e modo juntos leva direto ao modo", () => {
    const resultado = buscarTelas("acompanhamento mapa", "Administrador");
    expect(resultado[0]?.rota).toBe("/frota/acompanhamento?modo=mapa");
    expect(resultado).toHaveLength(1);
  });
  it("buscar Acompanhamento acha a tela e também os quatro modos", () => {
    const rotas = buscarTelas("acompanhamento", "Administrador").map((r) => r.rota);
    expect(rotas[0]).toBe("/frota/acompanhamento");
    expect(rotas).toEqual(
      expect.arrayContaining([
        "/frota/acompanhamento?modo=grade",
        "/frota/acompanhamento?modo=agora",
        "/frota/acompanhamento?modo=censo",
        "/frota/acompanhamento?modo=mapa",
      ]),
    );
  });
  it("cada rota achada com ?modo= abre uma tela do catálogo", () => {
    for (const { rota } of buscarTelas("acompanhamento", "Administrador")) {
      expect(acharTela(rota), rota).toBeDefined();
    }
  });
});

describe("buscarTelas: perfil", () => {
  it("quem não pode abrir a tela não a encontra", () => {
    expect(buscarTelas("totem", "Gestor de frota")).toEqual([]);
    expect(buscarTelas("mapa", "Operacional").map((i) => i.rotulo)).toEqual([
      "Início › Mapa do sistema",
    ]);
    expect(buscarTelas("placas", "Operacional")).toEqual([]);
    expect(buscarTelas("comparativo", "Gestor de frota")).toEqual([]);
    expect(buscarTelas("placas", "Gestor de frota").map((i) => i.rotulo)).toEqual([
      "Frota › Placas",
    ]);
  });

  function tela(id: string, estado: Tela["estado"]): Tela {
    return {
      id: `frota.${id}`,
      nome: id,
      icone: "IconPalette",
      rota: `/frota/${id}`,
      permissao: { modulo: "frota", acao: "ver" },
      estado,
      descricao: "Faz algo.",
      dispositivos: ["desktop"],
    };
  }
  const fixture: readonly ModuloDoCatalogo[] = [
    {
      id: "frota",
      nome: "Frota",
      icone: "IconTruck",
      rota: "/frota",
      cor: "frota",
      telas: [tela("aberta", "pronto"), tela("breve", "em-breve"), tela("trancada", "restrito")],
    },
  ];
  it("Gestor de frota acha a tela pronta, mas não a em breve nem a restrita", () => {
    expect(buscarTelas("a", "Gestor de frota", fixture).map((r) => r.tela.id)).toEqual([
      "frota.aberta",
    ]);
  });
  it("Administrador acha a tela em breve, e a restrita continua fora", () => {
    const ids = buscarTelas("a", "Administrador", fixture).map((r) => r.tela.id);
    expect(ids).toEqual(expect.arrayContaining(["frota.aberta", "frota.breve"]));
    expect(ids).not.toContain("frota.trancada");
  });
});
