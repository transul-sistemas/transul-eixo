import { describe, expect, it } from "vitest";
import { type ClienteDosParceiros, lerParceirosDoMes } from "./parceiros";
import { lerParceiros } from "@/lib/navegacao/parceiros";

// Dados fictícios. O banco filtra, pagina e soma; aqui só se confere a chamada e a conversão.
function clienteCom(data: unknown) {
  const chamadas: { funcao: string; argumentos?: Record<string, unknown> }[] = [];
  const cliente: ClienteDosParceiros = {
    schema: () => ({
      rpc: (funcao, argumentos) => {
        chamadas.push({ funcao, argumentos });
        return Promise.resolve({ data, error: null });
      },
    }),
  };
  return { cliente: () => Promise.resolve(cliente), chamadas };
}

const LISTA = {
  mes: "2026-03-01",
  meses: ["2026-03-01"],
  linhas: [],
  pagina: 2,
  paginas: 6,
  tam: 20,
  total: 105,
  totais: { parceiros: 105, placas: 0, despesa: 0, receita: 0, locacao_mensal: "10.50" },
  chips: { acionista: 0, agregado: 70, locador: 35 },
  agrupadores_livres: [],
};

describe("lerParceirosDoMes", () => {
  it("passa a página e o tamanho da URL ao banco", async () => {
    const { cliente, chamadas } = clienteCom(LISTA);
    await lerParceirosDoMes(lerParceiros(new URLSearchParams("q=fic&pagina=2&tam=50")), cliente);
    expect(chamadas).toEqual([
      {
        funcao: "parceiros_do_mes",
        argumentos: { p_mes: null, p_busca: "fic", p_chips: null, p_pagina: 2, p_tam: 50 },
      },
    ]);
  });
  it("sem página nem tamanho, pede a página 1 com 20", async () => {
    const { cliente, chamadas } = clienteCom(LISTA);
    await lerParceirosDoMes(lerParceiros(new URLSearchParams("")), cliente);
    expect(chamadas[0]?.argumentos).toMatchObject({ p_pagina: 1, p_tam: 20 });
  });
  it("devolve a página, as páginas, o tamanho e o total, e os totais do filtro inteiro", async () => {
    const { cliente } = clienteCom(LISTA);
    const r = await lerParceirosDoMes(lerParceiros(new URLSearchParams("pagina=2")), cliente);
    expect([r.pagina, r.paginas, r.tam, r.total]).toEqual([2, 6, 20, 105]);
    expect(r.totais.parceiros).toBe(105);
    expect(r.totais.locacaoMensalCentavos).toBe(1050);
  });
});
