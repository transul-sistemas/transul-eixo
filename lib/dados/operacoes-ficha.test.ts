import { describe, expect, it, vi } from "vitest";
import type { ClienteDasOperacoes } from "./operacoes";
import { lerContextoDaOperacao, lerMesFechado, lerResultadoDaOperacao } from "./operacoes-ficha";

function cliente(data: unknown, error: { message: string; code?: string } | null = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  const c = { schema: () => ({ rpc }) } as unknown as ClienteDasOperacoes;
  return { c: async () => c, rpc };
}

const TOTAIS = {
  receita: "100.50",
  documentos: 2,
  receita_cte: "60.50",
  documentos_cte: 1,
  receita_nfse: "40.00",
  documentos_nfse: 1,
  custo_frota: "10.00",
  custo_servico: "20.00",
  margem: "70.50",
  margem_percentual: "70.1",
  placas: 2,
  receita_por_placa: "50.25",
};

describe("lerMesFechado", () => {
  it("devolve aaaa-mm", async () => {
    const { c, rpc } = cliente("2026-09-01");
    expect(await lerMesFechado(c)).toBe("2026-09");
    expect(rpc).toHaveBeenCalledWith("mes_fechado_mais_recente", {});
  });
  it("erro do banco vira exceção", async () => {
    await expect(lerMesFechado(cliente(null, { message: "x" }).c)).rejects.toThrow(
      "mes_fechado_mais_recente",
    );
  });
});

describe("lerResultadoDaOperacao", () => {
  it("passa o período e converte reais em centavos", async () => {
    const { c, rpc } = cliente({
      ve_resultado: true,
      inicio: "2026-03-01",
      fim: "2026-04-01",
      atual: TOTAIS,
      anterior: { ...TOTAIS, receita: "0", receita_por_placa: null, margem_percentual: null },
      serie: [
        { mes: "2026-03-01", receita: "100.50", custo_frota: 10, custo_servico: 20, margem: 70.5 },
      ],
      meses_do_periodo: [],
      dias: [{ dia: "2026-03-05", receita: "100.50", custo: 0 }],
      frota_por_natureza: [{ natureza: "Combustível", valor: "10.00" }],
      servico_por_natureza: [],
    });
    const r = await lerResultadoDaOperacao("o1", { inicio: "2026-03-01", fim: "2026-04-01" }, c);
    expect(rpc).toHaveBeenCalledWith("resultado_da_operacao", {
      p_operacao: "o1",
      p_inicio: "2026-03-01",
      p_fim: "2026-04-01",
    });
    expect(r?.atual.receitaCentavos).toBe(10_050);
    expect(r?.atual.receitaCteCentavos).toBe(6_050);
    expect(r?.atual.receitaNfseCentavos).toBe(4_000);
    expect(r?.atual.documentosCte).toBe(1);
    expect(r?.atual.receitaPorPlacaCentavos).toBe(5_025);
    expect(r?.anterior.receitaPorPlacaCentavos).toBeNull();
    expect(r?.serie[0]).toMatchObject({ mes: "2026-03", margemCentavos: 7_050 });
    expect(r?.dias[0]).toEqual({ dia: "2026-03-05", receitaCentavos: 10_050, custoCentavos: 0 });
    expect(r?.frotaPorNatureza).toEqual([{ natureza: "Combustível", valorCentavos: 1_000 }]);
  });
  it("sem Resultados, ou fora do escopo, volta nulo (sem número)", async () => {
    expect(
      await lerResultadoDaOperacao(
        "o1",
        { inicio: "2026-03-01", fim: "2026-04-01" },
        cliente({ ve_resultado: false, inicio: "2026-03-01", fim: "2026-04-01" }).c,
      ),
    ).toBeNull();
    expect(
      await lerResultadoDaOperacao(
        "o1",
        { inicio: "2026-03-01", fim: "2026-04-01" },
        cliente(null).c,
      ),
    ).toBeNull();
  });
});

describe("lerContextoDaOperacao", () => {
  it("converte pessoas, mapa e árvore", async () => {
    const { c, rpc } = cliente({
      mes: "2026-03-01",
      ve_pessoas: false,
      pessoas: [
        {
          funcao: "motorista",
          nome_da_funcao: "Motorista",
          pessoas: 3,
          escala: { T: 2 },
          nomes: null,
        },
      ],
      linha_do_tempo: [
        {
          quando: "2026-01-10T11:00:00+00:00",
          tipo: "placa_entrou",
          objeto: "AAA0A00",
          detalhe: null,
        },
      ],
      mapa: {
        base: { cidade: "Cordeirópolis", uf: "SP", filial: "Cordeirópolis" },
        filiais: [
          {
            filial: "Matriz",
            cidade: "São Luís",
            uf: "MA",
            placas: 4,
            em_atividade: 3,
            impedidas: 1,
          },
        ],
      },
      arvore: {
        crs: [{ codigo: "K1", nome: "CR", frota: true, placas: ["AAA0A00"], total_de_placas: 1 }],
        placas_sem_cr: 2,
      },
    });
    const r = await lerContextoDaOperacao("o1", "2026-03", c);
    expect(rpc).toHaveBeenCalledWith("contexto_da_operacao", {
      p_operacao: "o1",
      p_mes: "2026-03-01",
    });
    expect(r?.mes).toBe("2026-03");
    expect(r?.pessoas[0]).toMatchObject({ nomeDaFuncao: "Motorista", pessoas: 3, nomes: null });
    expect(r?.mapa.filiais[0]).toMatchObject({ emAtividade: 3, impedidas: 1 });
    expect(r?.arvore).toEqual({
      crs: [{ codigo: "K1", nome: "CR", frota: true, placas: ["AAA0A00"], totalDePlacas: 1 }],
      placasSemCr: 2,
    });
  });
  it("operação fora do escopo volta nula", async () => {
    expect(await lerContextoDaOperacao("o1", "2026-03", cliente(null).c)).toBeNull();
  });
});
