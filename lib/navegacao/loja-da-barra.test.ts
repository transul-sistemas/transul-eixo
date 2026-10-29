import { describe, expect, it, vi } from "vitest";
import { chaveDoEstado, ESTADO_INICIAL, type EstadoDaBarra } from "./estado-da-barra";
import { criarLoja } from "./loja-da-barra";

function memoria(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    dados,
    getItem: vi.fn((chave: string) => dados.get(chave) ?? null),
    setItem: vi.fn((chave: string, valor: string) => void dados.set(chave, valor)),
  };
}

const gravado: EstadoDaBarra = {
  versao: 1,
  compacta: true,
  gruposAbertos: ["frota"],
  fixados: ["frota.placas"],
};

describe("loja da barra: leitura", () => {
  it("no servidor, e antes de ler, é sempre o estado inicial e não toca na memória", () => {
    const m = memoria({ [chaveDoEstado("ana")]: JSON.stringify(gravado) });
    const loja = criarLoja({ usuario: "ana", armazenamento: m });
    expect(loja.estadoNoServidor()).toEqual(ESTADO_INICIAL);
    expect(m.getItem).not.toHaveBeenCalled();
  });
  it("a primeira leitura no cliente traz o que a pessoa deixou gravado", () => {
    const m = memoria({ [chaveDoEstado("ana")]: JSON.stringify(gravado) });
    const loja = criarLoja({ usuario: "ana", armazenamento: m });
    expect(loja.estadoNoCliente()).toEqual(gravado);
  });
  it("leituras seguidas devolvem o mesmo objeto (o React exige snapshot estável)", () => {
    const m = memoria({ [chaveDoEstado("ana")]: JSON.stringify(gravado) });
    const loja = criarLoja({ usuario: "ana", armazenamento: m });
    expect(loja.estadoNoCliente()).toBe(loja.estadoNoCliente());
    expect(m.getItem).toHaveBeenCalledTimes(1);
  });
  it("descarta o que saiu do catálogo", () => {
    const sujo = {
      ...gravado,
      gruposAbertos: ["frota", "sumiu"],
      fixados: ["frota.placas", "x.y"],
    };
    const m = memoria({ [chaveDoEstado("ana")]: JSON.stringify(sujo) });
    const loja = criarLoja({ usuario: "ana", armazenamento: m });
    expect(loja.estadoNoCliente().gruposAbertos).toEqual(["frota"]);
    expect(loja.estadoNoCliente().fixados).toEqual(["frota.placas"]);
  });
  it("cada usuário lê a sua memória", () => {
    const m = memoria({ [chaveDoEstado("ana")]: JSON.stringify(gravado) });
    expect(criarLoja({ usuario: "bia", armazenamento: m }).estadoNoCliente()).toEqual(
      ESTADO_INICIAL,
    );
  });
  it("sem nada gravado usa o estado inicial dado, com o grupo ativo aberto", () => {
    const inicial: EstadoDaBarra = { ...ESTADO_INICIAL, gruposAbertos: ["pessoas"] };
    const loja = criarLoja({ usuario: "ana", armazenamento: memoria(), inicial });
    expect(loja.estadoNoServidor()).toEqual(inicial);
    expect(loja.estadoNoCliente()).toEqual(inicial);
  });
});

describe("loja da barra: ações", () => {
  it("despachar muda o estado, avisa quem assina e grava", () => {
    const m = memoria();
    const loja = criarLoja({ usuario: "ana", armazenamento: m });
    const ouvinte = vi.fn();
    loja.assinar(ouvinte);
    loja.estadoNoCliente();
    loja.despachar({ tipo: "alternarCompacta" });
    expect(loja.estadoNoCliente().compacta).toBe(true);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(JSON.parse(m.dados.get(chaveDoEstado("ana")) ?? "{}").compacta).toBe(true);
  });
  it("ação que não muda nada não avisa nem grava", () => {
    const m = memoria();
    const loja = criarLoja({ usuario: "ana", armazenamento: m });
    loja.estadoNoCliente();
    loja.despachar({ tipo: "abrirGrupo", id: "frota" });
    const ouvinte = vi.fn();
    loja.assinar(ouvinte);
    m.setItem.mockClear();
    loja.despachar({ tipo: "abrirGrupo", id: "frota" });
    expect(ouvinte).not.toHaveBeenCalled();
    expect(m.setItem).not.toHaveBeenCalled();
  });
  it("quem cancela a assinatura deixa de ser avisado", () => {
    const loja = criarLoja({ usuario: "ana", armazenamento: memoria() });
    const ouvinte = vi.fn();
    const cancelar = loja.assinar(ouvinte);
    cancelar();
    loja.despachar({ tipo: "alternarCompacta" });
    expect(ouvinte).not.toHaveBeenCalled();
  });
  it("despachar antes da primeira leitura não perde o que estava gravado", () => {
    const m = memoria({ [chaveDoEstado("ana")]: JSON.stringify(gravado) });
    const loja = criarLoja({ usuario: "ana", armazenamento: m });
    loja.despachar({ tipo: "alternarGrupo", id: "pessoas" });
    expect(loja.estadoNoCliente().fixados).toEqual(["frota.placas"]);
    expect(loja.estadoNoCliente().gruposAbertos).toEqual(["frota", "pessoas"]);
  });
});

describe("loja da barra: sem memória", () => {
  it("armazenamento nulo funciona e nunca grava (demonstração)", () => {
    const loja = criarLoja({ usuario: "ana", armazenamento: null });
    loja.despachar({ tipo: "alternarFixado", id: "frota.placas" });
    expect(loja.estadoNoCliente().fixados).toEqual(["frota.placas"]);
  });
  it("armazenamento que quebra não derruba a barra", () => {
    const quebrado = {
      getItem: () => {
        throw new Error("indisponível");
      },
      setItem: () => {
        throw new Error("indisponível");
      },
    };
    const loja = criarLoja({ usuario: "ana", armazenamento: quebrado });
    expect(loja.estadoNoCliente()).toEqual(ESTADO_INICIAL);
    expect(() => loja.despachar({ tipo: "alternarCompacta" })).not.toThrow();
    expect(loja.estadoNoCliente().compacta).toBe(true);
  });
});
