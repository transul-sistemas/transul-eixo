import { describe, expect, it } from "vitest";
import { centavos, type ClienteDaVisaoGeral, lerVisaoGeral } from "./visao-geral";

function cliente(
  resposta: unknown,
  chamadas: [string, unknown][] = [],
  erro: string | null = null,
) {
  const c: ClienteDaVisaoGeral = {
    schema: () => ({
      rpc: (funcao: string, argumentos?: Record<string, unknown>) => {
        chamadas.push([funcao, argumentos]);
        return Promise.resolve({
          data: erro ? null : resposta,
          error: erro ? { message: erro, code: "42501" } : null,
        });
      },
    }),
  };
  return async () => c;
}

const VALORES = { receita: 15000.0, custo: 5700.0, resultado: 9300.0, margem: 62.0 };
const DO_BANCO = {
  mes: "2026-03-01",
  dia_do_corte: 10,
  meses: ["2026-04-01", "2026-03-01"],
  kpis: {
    ...VALORES,
    mudaram_de_mes: { lancamentos: 1, valor: 700.0 },
    sem_dtentsai: { lancamentos: 1, valor: 1000.0 },
    sem_cr: { lancamentos: 1, valor: 1000.0 },
  },
  serie: [{ mes: "2026-03-01", ...VALORES }],
  grupos: [
    {
      chave: null,
      rotulo: "Sem operação",
      receita: 0,
      custo: 1000.0,
      resultado: -1000.0,
      margem: null,
    },
  ],
  total: VALORES,
  naturezas: [{ codnat: "1", descricao: "Combustível", valor: 3000.1, participacao: 52.6 }],
  outras: { naturezas: 1, valor: 700.0, participacao: 12.3 },
  opcoes: { filiais: [{ id: "f", nome: "Matriz" }], operacoes: [] },
};

describe("lerVisaoGeral", () => {
  it("pede ao banco o mês, a filial, a operação e o agrupamento; sem mês, o banco escolhe", async () => {
    const chamadas: [string, unknown][] = [];
    await lerVisaoGeral(
      { mes: null, filial: null, operacao: "op", agrupamento: "unidade" },
      cliente(DO_BANCO, chamadas),
    );
    expect(chamadas).toEqual([
      [
        "visao_geral_dos_resultados",
        {
          p_mes: null,
          p_garagem_id: null,
          p_operacao_id: "op",
          p_agrupamento: "unidade",
          p_top: 10,
        },
      ],
    ]);
    await lerVisaoGeral(
      { mes: "2026-03", filial: "f", operacao: null, agrupamento: "operacao" },
      cliente(DO_BANCO, chamadas),
    );
    expect(chamadas[1]?.[1]).toMatchObject({ p_mes: "2026-03-01", p_garagem_id: "f" });
  });
  it("converte reais em centavos e datas em aaaa-mm, sem somar nada", async () => {
    const v = await lerVisaoGeral(
      { mes: "2026-03", filial: null, operacao: null, agrupamento: "operacao" },
      cliente(DO_BANCO),
    );
    expect(v.mes).toBe("2026-03");
    expect(v.meses).toEqual(["2026-04", "2026-03"]);
    expect(v.kpis).toMatchObject({
      receita: 1500000,
      custo: 570000,
      resultado: 930000,
      margem: 62,
    });
    expect(v.kpis.mudaramDeMes).toEqual({ lancamentos: 1, valor: 70000 });
    expect(v.grupos[0]).toEqual({
      chave: null,
      rotulo: "Sem operação",
      receita: 0,
      custo: 100000,
      resultado: -100000,
      margem: null,
    });
    expect(v.naturezas[0]?.valor).toBe(300010);
    expect(v.total.resultado).toBe(930000);
    expect(v.opcoes.filiais).toEqual([{ id: "f", nome: "Matriz" }]);
  });
  it("erro do banco vira exceção (a tela mostra o erro com tentar de novo)", async () => {
    await expect(
      lerVisaoGeral(
        { mes: null, filial: null, operacao: null, agrupamento: "operacao" },
        cliente(null, [], "sem permissão"),
      ),
    ).rejects.toThrow("visao_geral_dos_resultados: sem permissão");
  });
  it("centavos arredonda o numeric sem erro de ponto flutuante", () => {
    expect(centavos("1234.57")).toBe(123457);
    expect(centavos(0.29)).toBe(29);
    expect(centavos(null)).toBe(0);
  });
});
