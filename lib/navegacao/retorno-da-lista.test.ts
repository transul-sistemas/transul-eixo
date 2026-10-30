import { describe, expect, it } from "vitest";
import {
  armarRetorno,
  desarmarRetorno,
  voltaArmada,
  destinoDoRetorno,
  espiarRetorno,
  guardarRetorno,
  JANELA_DO_ARMADO_MS,
  lerRetorno,
  type Retorno,
  urlDeVolta,
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
const CHAVE = "eixo-retorno-da-lista";

describe("retorno da lista: o ponto guardado ao sair para a ficha", () => {
  it("o que se guarda se lê na mesma URL, com a rolagem e a placa", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(lerRetorno(a, URL_DA_LISTA)).toEqual(retorno());
  });

  it("ler não gasta o registro: Voltar, Avançar e Voltar de novo restauram as duas vezes", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(lerRetorno(a, URL_DA_LISTA)).not.toBeNull();
    expect(lerRetorno(a, URL_DA_LISTA)).not.toBeNull();
    expect(a.dados.size).toBe(1);
  });

  it("não tem prazo: o ponto vale enquanto a sessão da aba durar (quem decide é a volta armada)", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno({ guardadoEm: AGORA - 24 * 60 * 60 * 1000 }));
    expect(lerRetorno(a, URL_DA_LISTA)).not.toBeNull();
  });

  it("sem registro devolve nulo", () => {
    expect(lerRetorno(armazenamentoFalso(), URL_DA_LISTA)).toBeNull();
  });

  it("não vale para outra URL (outra página, outro filtro), e o registro fica para a URL certa", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(lerRetorno(a, "/frota/placas?pagina=3&ordem=-gestor&chip=em-atividade")).toBeNull();
    expect(a.dados.size).toBe(1);
    expect(lerRetorno(a, URL_DA_LISTA)).not.toBeNull();
  });

  it("a URL é comparada inteira, não só o caminho", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(lerRetorno(a, "/frota/placas")).toBeNull();
  });

  it("registro estragado nunca quebra: texto que não é JSON, JSON de outro formato, campos errados", () => {
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
      JSON.stringify({ ...retorno(), url: "//outro-site.com/frota/placas" }),
      JSON.stringify({ ...retorno(), guardadoEm: "ontem" }),
    ];
    for (const texto of estragados) {
      const a = armazenamentoFalso({ [CHAVE]: texto });
      expect(lerRetorno(a, URL_DA_LISTA), texto).toBeNull();
      expect(espiarRetorno(a), texto).toBeNull();
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
    expect(lerRetorno(quebrado, URL_DA_LISTA)).toBeNull();
    expect(espiarRetorno(quebrado)).toBeNull();
    expect(() => armarRetorno(quebrado, AGORA)).not.toThrow();
    expect(voltaArmada(quebrado, AGORA)).toBe(false);
  });

  it("guardar de novo substitui o registro anterior", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno({ placa: "AAA0A04" }));
    guardarRetorno(a, retorno({ placa: "AAA0A10" }));
    expect(lerRetorno(a, URL_DA_LISTA)?.placa).toBe("AAA0A10");
  });

  it("a rolagem fracionada (zoom, tela de alta densidade) é aceita", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno({ rolagemTopo: 150.5, rolagemEsquerda: 0 }));
    expect(lerRetorno(a, URL_DA_LISTA)).toMatchObject({ rolagemTopo: 150.5, rolagemEsquerda: 0 });
  });
});

describe("espiarRetorno: olhar o registro (o Voltar à lista da ficha)", () => {
  it("devolve o registro, qualquer que seja a URL, e o deixa onde está", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    expect(espiarRetorno(a)).toEqual(retorno());
    expect(a.dados.size).toBe(1);
  });
  it("sem registro, nulo", () => {
    expect(espiarRetorno(armazenamentoFalso())).toBeNull();
  });
});

describe("a volta armada: só Voltar, Avançar e os links de voltar restauram; visita nova começa no topo", () => {
  it("sem armar, não há volta (visita nova pelo menu ou por link direto)", () => {
    expect(voltaArmada(armazenamentoFalso(), AGORA)).toBe(false);
  });

  it("armada, vale para todas as rodadas da mesma volta (o Next reativa os efeitos da lista escondida)", () => {
    const a = armazenamentoFalso();
    armarRetorno(a, AGORA);
    expect(voltaArmada(a, AGORA + 100)).toBe(true);
    expect(voltaArmada(a, AGORA + 300)).toBe(true);
  });

  it("a marca é curta: a volta chega em instantes; passada a janela, uma visita nova não restaura", () => {
    const a = armazenamentoFalso();
    armarRetorno(a, AGORA);
    expect(voltaArmada(a, AGORA + JANELA_DO_ARMADO_MS + 1)).toBe(false);
  });

  it("no limite da janela ainda vale", () => {
    const a = armazenamentoFalso();
    armarRetorno(a, AGORA);
    expect(voltaArmada(a, AGORA + JANELA_DO_ARMADO_MS)).toBe(true);
  });

  it("a janela é de poucos segundos, bem menos do que levaria uma visita nova", () => {
    expect(JANELA_DO_ARMADO_MS).toBeLessThanOrEqual(3_000);
  });

  it("relógio que andou para trás não vale", () => {
    const a = armazenamentoFalso();
    armarRetorno(a, AGORA + 60_000);
    expect(voltaArmada(a, AGORA)).toBe(false);
  });

  it("marca estragada nunca vale", () => {
    for (const texto of ["", "abc", "null", "-5", "NaN", "{}"]) {
      const a = armazenamentoFalso({ "eixo-retorno-armado": texto });
      expect(voltaArmada(a, AGORA), texto).toBe(false);
    }
  });

  it("desarmar apaga a marca (o restaurador desarma ao agir, e um recarregar logo depois não restaura)", () => {
    const a = armazenamentoFalso();
    armarRetorno(a, AGORA);
    expect(voltaArmada(a, AGORA + 10)).toBe(true);
    desarmarRetorno(a);
    expect(voltaArmada(a, AGORA + 20)).toBe(false);
    expect(a.dados.size).toBe(0);
  });

  it("desarmar sem marca, ou com armazenamento que lança, não faz nada", () => {
    expect(() => desarmarRetorno(armazenamentoFalso())).not.toThrow();
    expect(() =>
      desarmarRetorno({
        removeItem: () => {
          throw new Error("bloqueado");
        },
      }),
    ).not.toThrow();
  });

  it("armar não mexe no ponto guardado", () => {
    const a = armazenamentoFalso();
    guardarRetorno(a, retorno());
    armarRetorno(a, AGORA);
    expect(lerRetorno(a, URL_DA_LISTA)).not.toBeNull();
  });
});

describe("destinoDoRetorno: para onde o foco volta", () => {
  const placas = ["AAA0A00", "AAA0A01", "AAA0A04"];
  it("a linha de onde a pessoa saiu, se ela ainda está na página", () => {
    expect(destinoDoRetorno(retorno({ placa: "AAA0A01" }), placas)).toEqual({
      tipo: "linha",
      placa: "AAA0A01",
    });
  });
  it("se a placa saiu da página (filtro, ordem ou página mudou), a caixa da tabela", () => {
    expect(destinoDoRetorno(retorno({ placa: "ZZZ9Z99" }), placas)).toEqual({ tipo: "tabela" });
    expect(destinoDoRetorno(retorno({ placa: "AAA0A00" }), [])).toEqual({ tipo: "tabela" });
  });
});

describe("urlDeVolta: o Voltar à lista leva ao ponto guardado, só a partir da ficha daquela lista", () => {
  it("de uma ficha da lista, volta à URL guardada (página, ordem e filtros)", () => {
    expect(urlDeVolta("/frota/placas/AAA0A04", "/frota/placas", retorno())).toBe(URL_DA_LISTA);
  });
  it("sem registro, ou fora de uma ficha daquela lista, não muda nada", () => {
    expect(urlDeVolta("/frota/placas/AAA0A04", "/frota/placas", null)).toBeNull();
    expect(urlDeVolta("/pessoas/lista", "/frota/placas", retorno())).toBeNull();
    expect(urlDeVolta("/frota/placas", "/frota/placas", retorno())).toBeNull();
    expect(urlDeVolta("/frota/placas-outra/AAA0A04", "/frota/placas", retorno())).toBeNull();
  });
  it("o registro de outra lista não vale (o caminho da URL guardada tem de ser o da lista)", () => {
    expect(
      urlDeVolta(
        "/frota/placas/AAA0A04",
        "/frota/placas",
        retorno({ url: "/pessoas/lista?pagina=2" }),
      ),
    ).toBeNull();
  });
  it("ignora a barra final do caminho atual", () => {
    expect(urlDeVolta("/frota/placas/AAA0A04/", "/frota/placas", retorno())).toBe(URL_DA_LISTA);
  });
});
