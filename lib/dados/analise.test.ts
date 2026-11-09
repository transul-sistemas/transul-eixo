import { describe, expect, it, vi } from "vitest";
import { type ClienteDaAnalise, lerAnaliseDaFrota, lerOpcoesDaAnalise } from "./analise";

function cliente(respostas: Record<string, unknown>, chamadas: [string, unknown][] = []) {
  const c: ClienteDaAnalise = {
    schema: () => ({
      rpc: (funcao: string, argumentos?: Record<string, unknown>) => {
        chamadas.push([funcao, argumentos]);
        return Promise.resolve({ data: respostas[funcao] ?? null, error: null });
      },
    }),
  };
  return async () => c;
}

const DO_BANCO = {
  mes: "2026-01-01",
  ate: "2026-01-31",
  retrato: {
    total: 3,
    em_atividade: 1,
    atencao: 0,
    impedida: 0,
    patio: 2,
    fora: 0,
    pendente: 0,
    parados_no_pat: 2,
    dias_medio_no_pat: 302.4,
  },
  tipos: [{ tipo: "cavalo", total: 3, em_atividade: 1 }],
  mais_tempo_no_pat: [
    {
      ativo_id: "a",
      placa: "GGG8A92",
      tipo: "cavalo",
      operacao: "Grãos",
      filial: null,
      desde: "2026-01-10T11:00:00+00:00",
      dias: 302,
    },
  ],
  dias: [
    {
      dia: "2026-01-20",
      na_frota: 3,
      em_atividade: 1,
      atencao: 0,
      impedida: 0,
      patio: 2,
      fora: 0,
      disponibilidade: 33.3,
    },
  ],
  placa_dias: 66,
  disponibilidade: 18.2,
  grupos: [
    {
      chave: "x",
      rotulo: "Grãos",
      total: 2,
      em_atividade: 1,
      impedida: 0,
      patio: 1,
      parados_no_pat: 1,
      placa_dias: 44,
      disponibilidade: 27.3,
    },
  ],
};

describe("leitura da Análise da Frota", () => {
  it("pede ao banco o mês e o contexto, e só converte o formato", async () => {
    const chamadas: [string, unknown][] = [];
    const a = await lerAnaliseDaFrota(
      { mes: "2026-01", filial: "Matriz", operacao: null, agrupamento: "gestor" },
      cliente({ analise_da_frota: DO_BANCO }, chamadas),
    );
    expect(chamadas).toContainEqual([
      "analise_da_frota",
      { p_mes: "2026-01-01", p_filial: "Matriz", p_operacao_id: null, p_agrupamento: "gestor" },
    ]);
    expect(a.retrato).toEqual({
      total: 3,
      emAtividade: 1,
      atencao: 0,
      impedida: 0,
      patio: 2,
      fora: 0,
      pendente: 0,
      paradosNoPat: 2,
      diasMedioNoPat: 302.4,
    });
    expect(a.dias[0]).toEqual({
      dia: "2026-01-20",
      naFrota: 3,
      emAtividade: 1,
      atencao: 0,
      impedida: 0,
      patio: 2,
      fora: 0,
      disponibilidade: 33.3,
    });
    expect(a.grupos[0]?.placaDias).toBe(44);
    expect(a.maisTempoNoPat[0]?.placa).toBe("GGG8A92");
    expect(a.disponibilidade).toBe(18.2);
  });

  it("erro do banco vira exceção (a tela mostra o erro com tentar de novo)", async () => {
    const c: ClienteDaAnalise = {
      schema: () => ({
        rpc: vi.fn(() =>
          Promise.resolve({ data: null, error: { message: "falhou", code: "XX000" } }),
        ),
      }),
    };
    await expect(
      lerAnaliseDaFrota(
        { mes: "2026-01", filial: null, operacao: null, agrupamento: "operacao" },
        async () => c,
      ),
    ).rejects.toThrow("analise_da_frota");
  });

  it("as opções do contexto vêm do banco", async () => {
    const o = await lerOpcoesDaAnalise(
      cliente({
        opcoes_da_analise: { filiais: ["Matriz"], operacoes: [{ id: "1", nome: "Grãos" }] },
      }),
    );
    expect(o).toEqual({ filiais: ["Matriz"], operacoes: [{ id: "1", nome: "Grãos" }] });
  });
});
