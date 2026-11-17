import { describe, expect, it } from "vitest";
import {
  type ClienteDosParceiros,
  gravarConciliacaoDoMes,
  lerConferenciasDaConciliacao,
  lerParceirosDoMes,
} from "./parceiros";
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

// Conciliar o mês: o lote primeiro (com a chave do assistente), a conferência depois (com a parte 1
// da mesma chave, estável para "Tentar de novo"). Lote recusado não chega a conferir.
function clienteEmSequencia(respostas: { data: unknown; error: unknown }[]) {
  const chamadas: { funcao: string; argumentos?: Record<string, unknown> }[] = [];
  const cliente = {
    schema: () => ({
      rpc: (funcao: string, argumentos?: Record<string, unknown>) => {
        chamadas.push({ funcao, argumentos });
        return Promise.resolve(respostas.shift() ?? { data: null, error: null });
      },
    }),
  } as unknown as ClienteDosParceiros;
  return { cliente: () => Promise.resolve(cliente), chamadas };
}

const AG = "3f1e7d6a-2b4c-4d5e-8f90-1a2b3c4d5e6f";
const CR = "4a1e7d6a-2b4c-4d5e-8f90-1a2b3c4d5e6f";
const CHAVE = "5b1e7d6a-2b4c-4d5e-8f90-1a2b3c4d0000";
const ENTRADA = {
  agrupadorId: AG,
  mes: "2026-03",
  justificativas: [{ crId: CR, motivo: "Placa parada no pátio o mês inteiro." }],
  ciente: true as const,
};

describe("gravarConciliacaoDoMes", () => {
  it("justifica em lote e confere o mês, cada um com a sua chave", async () => {
    const { cliente, chamadas } = clienteEmSequencia([
      { data: { gravadas: 1, total: 1, recusadas: [] }, error: null },
      { data: { conferencia_id: "c1", linhas: 4 }, error: null },
    ]);
    const r = await gravarConciliacaoDoMes(ENTRADA, CHAVE, cliente);
    expect(r).toEqual({ ok: true, linha: { conferenciaId: "c1", justificadas: 1, linhas: 4 } });
    expect(chamadas).toEqual([
      {
        funcao: "justificar_diferencas_em_lote",
        argumentos: {
          p_mes: "2026-03-01",
          p_itens: [{ cr_id: CR, motivo: "Placa parada no pátio o mês inteiro." }],
          p_chave: CHAVE,
        },
      },
      {
        funcao: "conferir_mes_do_acionista",
        argumentos: {
          p_agrupador: AG,
          p_mes: "2026-03-01",
          p_chave: "5b1e7d6a-2b4c-4d5e-8f90-1a2b3c4d0001",
        },
      },
    ]);
  });

  it("sem pendências, só confere", async () => {
    const { cliente, chamadas } = clienteEmSequencia([
      { data: { conferencia_id: "c1", linhas: 4 }, error: null },
    ]);
    await gravarConciliacaoDoMes({ ...ENTRADA, justificativas: [] }, CHAVE, cliente);
    expect(chamadas.map((c) => c.funcao)).toEqual(["conferir_mes_do_acionista"]);
  });

  it("lote com recusa não grava nada e não confere; diz o motivo", async () => {
    const { cliente, chamadas } = clienteEmSequencia([
      {
        data: {
          gravadas: 0,
          total: 1,
          recusadas: [{ cr_id: CR, motivo: "Esta linha não tem diferença no mês." }],
        },
        error: null,
      },
    ]);
    const r = await gravarConciliacaoDoMes(ENTRADA, CHAVE, cliente);
    expect(chamadas).toHaveLength(1);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.erro.mensagem).toContain("Esta linha não tem diferença no mês.");
  });
});

describe("lerConferenciasDaConciliacao", () => {
  it("lê os acionistas conferidos no mês", async () => {
    const { cliente, chamadas } = clienteCom([
      { agrupador_id: AG, conferida_em: "2026-04-02T13:00:00Z", linhas: 4 },
    ]);
    expect(await lerConferenciasDaConciliacao("2026-03", cliente)).toEqual([
      { agrupadorId: AG, conferidaEm: "2026-04-02T13:00:00Z", linhas: 4 },
    ]);
    expect(chamadas).toEqual([
      { funcao: "conferencias_da_conciliacao", argumentos: { p_mes: "2026-03-01" } },
    ]);
  });
});
