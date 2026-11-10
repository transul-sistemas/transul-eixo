import { describe, expect, it } from "vitest";
import {
  type ClienteDasOperacoes,
  editarOperacao,
  lerFichaDaOperacao,
  lerOperacoesDoMes,
} from "./operacoes";
import { lerOperacoes } from "@/lib/navegacao/operacoes";

// Dados fictícios. O banco filtra, ordena e soma; aqui só se confere a chamada e a conversão.
function clienteCom(data: unknown, error: { message: string; code?: string } | null = null) {
  const chamadas: { funcao: string; argumentos?: Record<string, unknown> }[] = [];
  const gravacoes: { valores: Record<string, unknown>; filtros: unknown[] }[] = [];
  const cliente: ClienteDasOperacoes = {
    schema: () => ({
      rpc: (funcao, argumentos) => {
        chamadas.push({ funcao, argumentos });
        return Promise.resolve({ data, error });
      },
      from: () => ({
        update: (valores) => ({
          eq: (_c1, v1) => ({
            eq: (_c2, v2) => ({
              select: () => ({
                maybeSingle: () => {
                  gravacoes.push({ valores, filtros: [v1, v2] });
                  return Promise.resolve({ data, error });
                },
              }),
            }),
          }),
        }),
      }),
    }),
  };
  return { cliente: () => Promise.resolve(cliente), cru: cliente, chamadas, gravacoes };
}

const LISTA = {
  mes: "2026-03-01",
  meses: ["2026-04-01", "2026-03-01"],
  ve_resultado: true,
  linhas: [
    {
      id: "o1",
      nome: "Operação Fictícia",
      tipo: "operacao",
      base_cidade: "Cordeirópolis",
      base_uf: "SP",
      filial: "Cordeirópolis",
      placas: 3,
      crs: 2,
      receita: 4000,
      documentos: 2,
      custo_frota: "400.10",
      custo_servico: 600,
      margem: 2999.9,
      margem_percentual: 75,
    },
  ],
  pagina: 1,
  paginas: 1,
  tam: 20,
  total: 1,
  totais: {
    operacoes: 1,
    placas: 3,
    receita: 4000,
    custo_frota: 400.1,
    custo_servico: 600,
    margem: 2999.9,
    margem_percentual: 75,
  },
  chips: { operacao: 1 },
};

describe("lerOperacoesDoMes", () => {
  it("passa mês, busca, chips, ordem, página e tamanho da URL ao banco", async () => {
    const { cliente, chamadas } = clienteCom(LISTA);
    await lerOperacoesDoMes(
      lerOperacoes(
        new URLSearchParams("mes=2026-03&q=fic&chip=parada&chip=x&ordem=-margem&pagina=3&tam=50"),
      ),
      cliente,
    );
    expect(chamadas).toEqual([
      {
        funcao: "operacoes_do_mes",
        argumentos: {
          p_mes: "2026-03-01",
          p_busca: "fic",
          p_chips: ["parada"],
          p_ordem: "-margem",
          p_pagina: 3,
          p_tam: 50,
        },
      },
    ]);
  });
  it("sem filtros, manda nulos, a ordem pelo nome e a página 1 com 20", async () => {
    const { cliente, chamadas } = clienteCom(LISTA);
    await lerOperacoesDoMes(lerOperacoes(new URLSearchParams("")), cliente);
    expect(chamadas[0]?.argumentos).toEqual({
      p_mes: null,
      p_busca: null,
      p_chips: null,
      p_ordem: "nome",
      p_pagina: 1,
      p_tam: 20,
    });
  });
  it("sem tamanho na URL, usa o lembrado; o teto é 100", async () => {
    const { cliente, chamadas } = clienteCom(LISTA);
    await lerOperacoesDoMes(lerOperacoes(new URLSearchParams(""), 50), cliente);
    await lerOperacoesDoMes(lerOperacoes(new URLSearchParams("tam=500"), 50), cliente);
    expect(chamadas.map((c) => c.argumentos?.p_tam)).toEqual([50, 100]);
  });
  it("devolve a página, as páginas, o tamanho e o total do banco", async () => {
    const { cliente } = clienteCom({ ...LISTA, pagina: 2, paginas: 6, tam: 20, total: 105 });
    const r = await lerOperacoesDoMes(lerOperacoes(new URLSearchParams("pagina=2")), cliente);
    expect([r.pagina, r.paginas, r.tam, r.total]).toEqual([2, 6, 20, 105]);
  });
  it("converte reais em centavos e o mês em aaaa-mm", async () => {
    const { cliente } = clienteCom(LISTA);
    const r = await lerOperacoesDoMes(lerOperacoes(new URLSearchParams("")), cliente);
    expect(r.mes).toBe("2026-03");
    expect(r.meses).toEqual(["2026-04", "2026-03"]);
    expect(r.linhas[0]?.cascata).toEqual({
      receitaCentavos: 400000,
      documentos: 2,
      custoFrotaCentavos: 40010,
      custoServicoCentavos: 60000,
      margemCentavos: 299990,
      margemPercentual: 75,
    });
    expect(r.totais.cascata?.margemCentavos).toBe(299990);
  });
  it("sem Resultados, a cascata fica nula", async () => {
    const { cliente } = clienteCom({ ...LISTA, ve_resultado: false });
    const r = await lerOperacoesDoMes(lerOperacoes(new URLSearchParams("")), cliente);
    expect(r.linhas[0]?.cascata).toBeNull();
    expect(r.totais.cascata).toBeNull();
  });
  it("erro do banco vira exceção (a tela mostra Tentar de novo)", async () => {
    const { cliente } = clienteCom(null, { message: "falhou" });
    await expect(lerOperacoesDoMes(lerOperacoes(new URLSearchParams("")), cliente)).rejects.toThrow(
      "operacoes_do_mes",
    );
  });
});

describe("lerFichaDaOperacao", () => {
  it("operação que não existe (ou fora do escopo) volta nula", async () => {
    const { cliente } = clienteCom(null);
    expect(await lerFichaDaOperacao("o1", null, cliente)).toBeNull();
  });
  it("converte a cascata, as naturezas, as placas e as pessoas", async () => {
    const { cliente, chamadas } = clienteCom({
      operacao: {
        id: "o1",
        nome: "Operação Fictícia",
        tipo: "operacao",
        base_cidade: null,
        base_uf: null,
        filial: null,
        versao: 2,
      },
      mes: "2026-03-01",
      meses: ["2026-03-01"],
      ve_resultado: true,
      cascata: {
        receita: 100,
        documentos: 1,
        custo_frota: 10,
        custo_servico: 20,
        margem: 70,
        margem_percentual: 70,
        crs: 2,
        frota_por_natureza: [{ natureza: "Combustível", valor: 10 }],
        servico_por_natureza: [{ natureza: "Salário", valor: 20 }],
      },
      placas: [
        {
          ativo_id: "a1",
          placa: "FFF1A11",
          tipo: "cavalo",
          modelo: null,
          sigla: "PÁT",
          grupo: "patio",
          nome_da_situacao: "Pátio",
          cr: null,
          gestor: null,
        },
      ],
      pessoas: {
        funcionarios: 2,
        salario_bruto: 2700,
        por_departamento: [{ departamento: "Dep", funcionarios: 2, salario_bruto: 2700 }],
      },
    });
    const f = await lerFichaDaOperacao("o1", "2026-03", cliente);
    expect(chamadas[0]).toEqual({
      funcao: "ficha_da_operacao",
      argumentos: { p_operacao: "o1", p_mes: "2026-03-01" },
    });
    expect(f?.operacao.versao).toBe(2);
    expect(f?.cascata?.servicoPorNatureza).toEqual([{ natureza: "Salário", valorCentavos: 2000 }]);
    expect(f?.placas[0]?.placa).toBe("FFF1A11");
    expect(f?.pessoas?.salarioBrutoCentavos).toBe(270000);
  });
});

describe("editarOperacao", () => {
  const entrada = {
    id: "00000000-0000-4000-8000-000000000001",
    versao: 3,
    nome: "Operação Fictícia",
    tipo: "operacao" as const,
    baseCidade: "",
    baseUf: "SP",
  };
  it("grava com a versão vista e devolve a linha", async () => {
    const { cru, gravacoes } = clienteCom({ id: entrada.id, nome: entrada.nome, versao: 4 });
    const r = await editarOperacao(cru, entrada);
    expect(r).toEqual({ ok: true, linha: { id: entrada.id, nome: entrada.nome, versao: 4 } });
    expect(gravacoes[0]).toEqual({
      valores: { nome: "Operação Fictícia", tipo: "operacao", base_cidade: null, base_uf: "SP" },
      filtros: [entrada.id, 3],
    });
  });
  it("sem linha com a versão vista, é conflito", async () => {
    const { cru } = clienteCom(null);
    const r = await editarOperacao(cru, entrada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.codigo).toBe("conflito");
  });
  it("nome repetido vira erro no campo", async () => {
    const { cru } = clienteCom(null, { message: "duplicada", code: "23505" });
    const r = await editarOperacao(cru, entrada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro.campos?.nome).toHaveLength(1);
  });
});
