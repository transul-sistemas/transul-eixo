import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linhasFecham } from "@/components/layout/grade-de-paineis";
import { zerarPaineisDeExemplo } from "@/lib/exemplo/paineis";
import { FUNCOES_DOS_PAINEIS, gravarPeloPainel, lerPainel, normalizarLeitura } from "./paineis";

const ESTADO = { mes: null, filtro: null, busca: "", pagina: 1, tam: 20 };
const HOJE = "2026-11-13";

function cliente(resposta: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async () => resposta);
  return { rpc, fabrica: async () => ({ schema: () => ({ rpc }) }) as never };
}

const AUSENTE = { code: "PGRST202", message: "Could not find the function nucleo.x" };

describe("leitura das telas de painel", () => {
  beforeEach(() => {
    vi.stubEnv("EIXO_DADOS", "");
    zerarPaineisDeExemplo();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("converte os reais do banco em centavos só onde o formato é moeda", () => {
    const l = normalizarLeitura(
      {
        mes: "2026-10-01",
        kpis: [
          { id: "r", rotulo: "Receita", valor: 1234.56, formato: "moeda" },
          { id: "n", rotulo: "Placas", valor: 7, formato: "inteiro" },
        ],
        tabela: {
          titulo: "T",
          item: "operação",
          colunas: [
            { id: "nome", rotulo: "Nome", formato: "texto" },
            { id: "v", rotulo: "Valor", formato: "moeda" },
          ],
          linhas: [{ id: "1", item: "A", celulas: { nome: "A", v: 10.1 }, detalhes: [] }],
          total: 1,
          pagina: 1,
          paginas: 1,
          tam: 20,
        },
        graficos: [
          {
            id: "g",
            titulo: "G",
            tipo: "barras",
            categorias: ["A"],
            series: [{ nome: "S", tipo: "barra", valores: [2.5] }],
            formato: "moeda",
            colunas: 12,
          },
        ],
      },
      "banco",
      "f",
    );
    expect(l.mes).toBe("2026-10");
    expect(l.funcao).toBe("nucleo.f");
    expect(l.kpis.map((k) => k.valor)).toEqual([123456, 7]);
    expect(l.tabela.linhas[0]?.celulas).toEqual({ nome: "A", v: 1010 });
    expect(l.graficos[0]?.series[0]?.valores).toEqual([250]);
  });

  it("chama a função do banco da tela com o estado da URL", async () => {
    const c = cliente({ data: {}, error: null });
    await lerPainel(
      "resultados.fechamentos",
      { ...ESTADO, mes: "2026-10", pagina: 2 },
      HOJE,
      c.fabrica,
    );
    expect(c.rpc).toHaveBeenCalledWith("fechamentos_do_mes", {
      p_mes: "2026-10-01",
      p_filtro: null,
      p_busca: null,
      p_pagina: 2,
      p_tam: 20,
    });
  });

  it("função ausente: fora de produção usa o exemplo (com a origem marcada)", async () => {
    const l = await lerPainel(
      "operacoes.comparativo",
      ESTADO,
      HOJE,
      cliente({ data: null, error: AUSENTE }).fabrica,
    );
    expect(l.origem).toBe("exemplo");
    expect(l.tabela.linhas.length).toBeGreaterThan(0);
  });

  it("função ausente em produção: sem fonte, nenhum número inventado", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const l = await lerPainel(
      "operacoes.comparativo",
      ESTADO,
      HOJE,
      cliente({ data: null, error: AUSENTE }).fabrica,
    );
    expect(l.origem).toBe("sem-fonte");
    expect(l.kpis).toEqual([]);
    expect(l.tabela.linhas).toEqual([]);
  });

  it("Comparativo lê nucleo.resultado_por_operacao só pelo mês e rearranja sem somar", async () => {
    const cascata = {
      receita: 1000,
      receita_cte: 900,
      receita_nfse: 100,
      custo_frota: 500,
      custo_servico: 200,
      custo: 700,
      resultado: 300,
      margem_percentual: 30,
    };
    const c = cliente({
      data: {
        ve_resultado: true,
        mes: "2026-10-01",
        kpis: cascata,
        operacoes: [
          { ...cascata, operacao_id: "b", nome: "Operação B", peso_na_receita: 60 },
          {
            ...cascata,
            resultado: -10,
            margem_percentual: -1,
            operacao_id: "a",
            nome: "Operação A",
            peso_na_receita: 40,
          },
        ],
        visao_geral: { receita: 1000, custo: 700, resultado: 300 },
        fora_das_operacoes: null,
        custo_por_natureza: [],
        outras_naturezas: null,
      },
      error: null,
    });
    const l = await lerPainel(
      "operacoes.comparativo",
      { ...ESTADO, mes: "2026-10", filtro: "negativa" },
      HOJE,
      c.fabrica,
    );
    expect(c.rpc).toHaveBeenCalledWith("resultado_por_operacao", { p_mes: "2026-10-01" });
    expect(l.origem).toBe("banco");
    expect(l.kpis.find((k) => k.id === "resultado")?.valor).toBe(30000);
    expect(l.tabela.linhas.map((x) => x.id)).toEqual(["a"]);
    expect(l.chips.map((x) => [x.id, x.contagem])).toEqual([
      ["todos", 2],
      ["positiva", 1],
      ["negativa", 1],
    ]);
    expect(l.meses[0]).toBe("2026-10");
  });

  it("sem acesso a Resultados, o Comparativo não mostra número e diz por quê", async () => {
    const c = cliente({ data: { ve_resultado: false, mes: "2026-10-01" }, error: null });
    const l = await lerPainel("operacoes.comparativo", ESTADO, HOJE, c.fabrica);
    expect(l.kpis).toEqual([]);
    expect(l.avisos[0]).toMatch(/acesso a Resultados/);
  });

  it("outro erro do banco não vira exemplo: sobe como erro de leitura", async () => {
    const falha = cliente({ data: null, error: { code: "42501", message: "permission denied" } });
    await expect(lerPainel("pessoas.documentos", ESTADO, HOJE, falha.fabrica)).rejects.toThrow(
      /documentos_das_pessoas/,
    );
  });

  it("no exemplo, toda tela fecha a grade de 12 colunas, pagina e conta os chips", async () => {
    vi.stubEnv("EIXO_DADOS", "exemplo");
    for (const id of Object.keys(FUNCOES_DOS_PAINEIS) as (keyof typeof FUNCOES_DOS_PAINEIS)[]) {
      const l = await lerPainel(id, ESTADO, HOJE);
      expect(l.origem, id).toBe("exemplo");
      if (l.graficos.length > 0) {
        expect(l.graficos[0]?.colunas, id).toBe(12);
        expect(linhasFecham(l.graficos.map((g) => g.colunas)), id).toBe(true);
      }
      expect(l.tabela.linhas.length, id).toBeLessThanOrEqual(20);
      const todos = l.chips.find((c) => c.id === "todos");
      if (todos) expect(todos.contagem, id).toBe(l.tabela.total);
    }
  });

  it("no exemplo, o filtro e a busca respeitam a contagem e a página não passa da última", async () => {
    vi.stubEnv("EIXO_DADOS", "exemplo");
    const l = await lerPainel(
      "pessoas.documentos",
      { ...ESTADO, filtro: "vencido", pagina: 99 },
      HOJE,
    );
    const chip = l.chips.find((c) => c.id === "vencido");
    expect(l.tabela.total).toBe(chip?.contagem);
    expect(l.tabela.pagina).toBe(l.tabela.paginas);
  });
});

describe("gravação dos assistentes de painel (exemplo)", () => {
  beforeEach(() => {
    vi.stubEnv("EIXO_DADOS", "exemplo");
    zerarPaineisDeExemplo();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("fechar e reabrir o mês mudam a lista; a mesma chave grava uma vez só", async () => {
    const antes = await lerPainel("resultados.fechamentos", ESTADO, HOJE);
    const aberto = antes.opcoes.mesesAbertos?.[0]?.id as string;
    expect(aberto).toBeTruthy();
    expect((await gravarPeloPainel("fechar-mes", { mes: aberto }, "k1", HOJE)).ok).toBe(true);
    expect((await gravarPeloPainel("fechar-mes", { mes: aberto }, "k1", HOJE)).ok).toBe(true);
    const repetido = await gravarPeloPainel("fechar-mes", { mes: aberto }, "k2", HOJE);
    expect(repetido.ok).toBe(false);
    const depois = await lerPainel("resultados.fechamentos", ESTADO, HOJE);
    expect(depois.opcoes.mesesFechados?.map((o) => o.id)).toContain(aberto);
    const r = await gravarPeloPainel(
      "reabrir-mes",
      { mes: aberto, motivo: "Chegou frete atrasado do Sankhya." },
      "k3",
      HOJE,
    );
    expect(r.ok).toBe(true);
    const reaberto = await lerPainel(
      "resultados.fechamentos",
      { ...ESTADO, filtro: "reaberto" },
      HOJE,
    );
    expect(reaberto.tabela.linhas.map((l) => l.id)).toEqual([aberto]);
  });

  it("o ajuste pedido entra como pendente", async () => {
    const antes = await lerPainel("resultados.ajustes", { ...ESTADO, filtro: "pendente" }, HOJE);
    await gravarPeloPainel(
      "pedir-ajuste",
      {
        mes: "2026-10",
        operacaoId: "00000000-0000-4000-8000-000000000001",
        natureza: "custo",
        valorCentavos: 50000,
        justificativa: "Despesa no CR errado.",
      },
      "k4",
      HOJE,
    );
    const depois = await lerPainel("resultados.ajustes", { ...ESTADO, filtro: "pendente" }, HOJE);
    expect(depois.tabela.total).toBe(antes.tabela.total + 1);
  });
});
