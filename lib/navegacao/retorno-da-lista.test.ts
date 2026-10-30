import { describe, expect, it } from "vitest";
import {
  guardarRetorno,
  lerRetorno,
  type Retorno,
  VALIDADE_DO_RETORNO_MS,
} from "./retorno-da-lista";

function armazenamentoFalso(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    dados,
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    removeItem: (k: string) => void dados.delete(k),
  };
}

const AGORA = 1_800_000_000_000;
const URL_DA_LISTA = "/frota/placas?pagina=2&ordem=-gestor&chip=em-atividade";
const retorno = (parcial: Partial<Retorno> = {}): Retorno => ({
  url: URL_DA_LISTA,
  placa: "AAA0A04",
  rolagemTopo: 150,
  rolagemEsquerda: 220,
  guardadoEm: AGORA,
  ...parcial,
});

describe("retorno da lista: voltar da ficha devolve ao mesmo ponto", () => {
  it("o que se guarda se lê na mesma URL, com a rolagem e a placa", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(lerRetorno(a, URL_DA_LISTA, AGORA + 5_000)).toEqual(retorno());
  });

  it("é de uma leitura só: depois de lido, some", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(lerRetorno(a, URL_DA_LISTA, AGORA)).not.toBeNull();
    expect(lerRetorno(a, URL_DA_LISTA, AGORA)).toBeNull();
    expect(a.dados.size).toBe(0);
  });

  it("sem registro devolve nulo", () => {
    expect(lerRetorno(armazenamentoFalso(), URL_DA_LISTA, AGORA)).toBeNull();
  });

  it("não vale para outra URL (outra página, outro filtro) e o registro é descartado", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(
      lerRetorno(a, "/frota/placas?pagina=3&ordem=-gestor&chip=em-atividade", AGORA),
    ).toBeNull();
    expect(a.dados.size).toBe(0);
  });

  it("a URL é comparada inteira, não só o caminho", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(lerRetorno(a, "/frota/placas", AGORA)).toBeNull();
  });

  it("expira: passada a validade não restaura", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(lerRetorno(a, URL_DA_LISTA, AGORA + VALIDADE_DO_RETORNO_MS + 1)).toBeNull();
    expect(a.dados.size).toBe(0);
  });

  it("limite da validade: exatamente no prazo ainda vale", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(lerRetorno(a, URL_DA_LISTA, AGORA + VALIDADE_DO_RETORNO_MS)).not.toBeNull();
  });

  it("relógio que andou para trás (guardado no futuro) não vale", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno({ guardadoEm: AGORA + 60_000 }));
    expect(lerRetorno(a, URL_DA_LISTA, AGORA)).toBeNull();
  });

  it("registro estragado nunca quebra: texto que não é JSON, JSON de outro formato, campos errados", () => {
    const chave = Object.keys(
      (() => {
        const a = armazenamentoFalso();
        guardarRetorno(a, retorno());
        return Object.fromEntries(a.dados);
      })(),
    )[0] as string;
    const estragados = [
      "isto não é json",
      "null",
      "[]",
      "42",
      JSON.stringify({}),
      JSON.stringify({ ...retorno(), placa: "aaa-0a04" }),
      JSON.stringify({ ...retorno(), placa: "<script>" }),
      JSON.stringify({ ...retorno(), rolagemTopo: "150" }),
      JSON.stringify({ ...retorno(), rolagemTopo: -1 }),
      JSON.stringify({ ...retorno(), rolagemEsquerda: null }),
      JSON.stringify({ ...retorno(), url: 42 }),
      JSON.stringify({ ...retorno(), url: "https://outro-site.com/frota/placas" }),
      JSON.stringify({ ...retorno(), guardadoEm: "ontem" }),
    ];
    for (const texto of estragados) {
      const a = armazenamentoFalso({ [chave]: texto });
      expect(lerRetorno(a, URL_DA_LISTA, AGORA), texto).toBeNull();
    }
  });

  it("armazenamento que lança (modo privado, cota cheia) não derruba nada", () => {
    const quebrado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("cheio");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(() => guardarRetorno(quebrado, retorno())).not.toThrow();
    expect(lerRetorno(quebrado, URL_DA_LISTA, AGORA)).toBeNull();
  });

  it("guardar de novo substitui o registro anterior", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno({ placa: "AAA0A04" }));
    guardarRetorno(a, retorno({ placa: "AAA0A10" }));
    expect(lerRetorno(a, URL_DA_LISTA, AGORA)?.placa).toBe("AAA0A10");
  });

  it("a rolagem fracionada (zoom, tela de alta densidade) é aceita", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno({ rolagemTopo: 150.5, rolagemEsquerda: 0 }));
    expect(lerRetorno(a, URL_DA_LISTA, AGORA)).toMatchObject({
      rolagemTopo: 150.5,
      rolagemEsquerda: 0,
    });
  });
});
