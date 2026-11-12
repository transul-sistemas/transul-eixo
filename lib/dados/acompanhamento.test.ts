import { describe, expect, it, vi } from "vitest";
import { type ClienteDoAcompanhamento, lerGradePorConjunto } from "@/lib/dados/acompanhamento";

// A leitura da grade por conjunto: pede ao banco (nucleo.grade_por_conjunto) com os filtros certos e
// converte o formato. Total, chips e "X de Y" chegam prontos; nada se soma aqui.

const dia = (n: number, sigla: string | null) => ({
  dia: `2026-11-${String(n).padStart(2, "0")}`,
  sigla,
  grupo: sigla ? "em-atividade" : null,
  eventos: 0,
  manual: false,
  tardia: false,
});

function clienteQueDevolve(data: unknown) {
  const rpc = vi.fn(async () => ({ data, error: null }));
  const schema = vi.fn(() => ({ rpc }));
  return {
    cliente: (async () =>
      ({ schema }) as unknown as ClienteDoAcompanhamento) as () => Promise<ClienteDoAcompanhamento>,
    rpc,
    schema,
  };
}

const RESPOSTA = {
  mes: "2026-11-01",
  hoje: "2026-11-12",
  dias_no_mes: 30,
  linhas: [
    {
      ativo_id: "a1",
      placa: "AAA1A11",
      modelo: "Cavalo X",
      ano: 2022,
      operacao: "Grãos",
      sigla_atual: "ETc",
      grupo_atual: "em-atividade",
      tipos_de_cr: ["frota"],
      nome_do_conjunto: "Simples",
      dias: [dia(1, "ETc")],
      implementos: [
        {
          ativo_id: "i1",
          placa: "BBB1B11",
          modelo: "Graneleira",
          funcao: "semirreboque",
          posicao: 1,
          dias: [{ dia: "2026-11-01", engatado: true, sigla: "ETc", grupo: "em-atividade" }],
        },
      ],
    },
  ],
  total: 31,
  pagina: 2,
  paginas: 2,
  tam: 20,
  chips: { todos: 31, "em-atividade": 20, atencao: 3, impedida: 5, patio: 2, fora: 1 },
  lancamento_hoje: { x: 9, y: 14 },
  fora: {
    linhas: [
      {
        ativo_id: "s1",
        placa: "CCC1C11",
        tipo: "caminhao",
        modelo: "Caminhão",
        ano: null,
        operacao: null,
        sigla_atual: "PÁT",
        grupo_atual: "patio",
        tipos_de_cr: [],
        dias: [dia(1, "PÁT")],
      },
    ],
    total: 1,
    pagina: 1,
    paginas: 1,
  },
};

const FILTROS = {
  mes: "2026-11",
  busca: "aaa",
  tipoDeCr: "frota" as const,
  grupo: "impedida" as const,
  pagina: 2,
  foraPagina: 3,
  tam: 20,
};

describe("lerGradePorConjunto", () => {
  it("pede ao banco a grade por conjunto com os filtros no formato da função", async () => {
    const { cliente, rpc, schema } = clienteQueDevolve(RESPOSTA);
    await lerGradePorConjunto(FILTROS, cliente);
    expect(schema).toHaveBeenCalledWith("nucleo");
    expect(rpc).toHaveBeenCalledWith("grade_por_conjunto", {
      p_mes: "2026-11-01",
      p_filtros: { busca: "aaa", tipo_de_cr: "frota", grupo: "impedida", fora_pagina: 3 },
      p_pagina: 2,
      p_tam: 20,
    });
  });

  it("sem tipo de CR nem grupo, manda vazio (o banco lê como sem filtro)", async () => {
    const { cliente, rpc } = clienteQueDevolve(RESPOSTA);
    await lerGradePorConjunto({ ...FILTROS, tipoDeCr: null, grupo: null }, cliente);
    const chamada = rpc.mock.calls[0] as unknown as [
      string,
      { p_filtros: Record<string, unknown> },
    ];
    expect(chamada[1].p_filtros).toMatchObject({ tipo_de_cr: "", grupo: "" });
  });

  it("converte o conjunto, os implementos e a seção fora de conjunto", async () => {
    const { cliente } = clienteQueDevolve(RESPOSTA);
    const g = await lerGradePorConjunto(FILTROS, cliente);
    expect(g.diasNoMes).toBe(30);
    expect(g.linhas[0]).toMatchObject({
      ativoId: "a1",
      siglaAtual: "ETc",
      nomeDoConjunto: "Simples",
      tiposDeCr: ["frota"],
    });
    expect(g.linhas[0]?.implementos[0]).toMatchObject({ ativoId: "i1", posicao: 1 });
    expect(g.fora.linhas[0]).toMatchObject({ ativoId: "s1", tipo: "caminhao", siglaAtual: "PÁT" });
  });

  it("repassa total, chips e X de Y como vieram do banco (nada é somado aqui)", async () => {
    const { cliente } = clienteQueDevolve(RESPOSTA);
    const g = await lerGradePorConjunto(FILTROS, cliente);
    expect(g.total).toBe(31);
    expect(g.chips).toEqual(RESPOSTA.chips);
    expect(g.lancamentoHoje).toEqual({ x: 9, y: 14 });
    expect(g.pagina).toBe(2);
    expect(g.fora.total).toBe(1);
  });

  it("erro do banco vira falha de leitura (a tela mostra Tentar de novo)", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "falhou", code: "XX000" } }));
    const cliente = async () => ({ schema: () => ({ rpc }) }) as unknown as ClienteDoAcompanhamento;
    await expect(lerGradePorConjunto(FILTROS, cliente)).rejects.toBeDefined();
  });
});
