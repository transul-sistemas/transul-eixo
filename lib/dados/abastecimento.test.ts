import { describe, expect, it } from "vitest";
import { type ClienteDoAbastecimento, lerAbastecimentoDoMes } from "./abastecimento";
import { lerAbastecimento } from "@/lib/navegacao/abastecimento";

// Dados fictícios. O banco soma e pagina; aqui só se confere a chamada e a conversão do formato.
function clienteCom(data: unknown, error: { message: string } | null = null) {
  const chamadas: { funcao: string; argumentos?: Record<string, unknown> }[] = [];
  const cliente: ClienteDoAbastecimento = {
    schema: () => ({
      rpc: (funcao, argumentos) => {
        chamadas.push({ funcao, argumentos });
        return Promise.resolve({ data, error });
      },
    }),
  };
  return { cliente: () => Promise.resolve(cliente), chamadas };
}

const RESPOSTA = {
  mes: "2026-03-01",
  meses: ["2026-04-01", "2026-03-01"],
  linhas: [
    {
      placa: "FFF8B81",
      ativo_id: "a1",
      tipo: "cavalo",
      modelo: "Modelo X",
      abastecimentos: 2,
      litros: 300,
      km: 900,
      km_por_litro: 3,
      valor: 1800.5,
      sem_hodometro: 0,
    },
    {
      placa: "ZZZ8Z99",
      ativo_id: null,
      tipo: null,
      modelo: null,
      abastecimentos: 1,
      litros: 10,
      km: 0,
      km_por_litro: null,
      valor: null,
      sem_hodometro: 1,
    },
  ],
  totais: {
    placas: 2,
    abastecimentos: 3,
    litros: 310,
    km: 900,
    km_por_litro: 3,
    valor: 1800.5,
    sem_hodometro: 1,
  },
  filtradas: 2,
  pagina: 1,
  paginas: 1,
  tam: 50,
};

describe("lerAbastecimentoDoMes", () => {
  it("chama nucleo.abastecimento_do_mes com mês, busca, ordem, página e tamanho", async () => {
    const { cliente, chamadas } = clienteCom(RESPOSTA);
    await lerAbastecimentoDoMes(
      lerAbastecimento(new URLSearchParams("mes=2026-03&q=fff&ordem=-km&pagina=2&tam=25")),
      cliente,
    );
    expect(chamadas).toEqual([
      {
        funcao: "abastecimento_do_mes",
        argumentos: { p_mes: "2026-03-01", p_busca: "fff", p_ordem: "-km", p_pagina: 2, p_tam: 25 },
      },
    ]);
  });

  it("sem mês na URL, deixa o banco escolher o mais recente com dados", async () => {
    const { cliente, chamadas } = clienteCom(RESPOSTA);
    await lerAbastecimentoDoMes(lerAbastecimento(new URLSearchParams("")), cliente);
    expect(chamadas[0]?.argumentos?.p_mes).toBeNull();
    expect(chamadas[0]?.argumentos?.p_busca).toBeNull();
  });

  it("converte o formato: meses em aaaa-mm e valores em centavos", async () => {
    const { cliente } = clienteCom(RESPOSTA);
    const r = await lerAbastecimentoDoMes(lerAbastecimento(new URLSearchParams("")), cliente);
    expect(r.mes).toBe("2026-03");
    expect(r.meses).toEqual(["2026-04", "2026-03"]);
    expect(r.linhas[0]).toEqual({
      placa: "FFF8B81",
      ativoId: "a1",
      tipo: "cavalo",
      modelo: "Modelo X",
      abastecimentos: 2,
      litros: 300,
      km: 900,
      kmPorLitro: 3,
      valorCentavos: 180050,
      semHodometro: 0,
    });
    expect(r.linhas[1]?.valorCentavos).toBeNull();
    expect(r.linhas[1]?.kmPorLitro).toBeNull();
    expect(r.totais).toEqual({
      placas: 2,
      abastecimentos: 3,
      litros: 310,
      km: 900,
      kmPorLitro: 3,
      valorCentavos: 180050,
      semHodometro: 1,
    });
  });

  it("erro do banco vira exceção (a tela mostra o erro com tentar de novo)", async () => {
    const { cliente } = clienteCom(null, { message: "falhou" });
    await expect(
      lerAbastecimentoDoMes(lerAbastecimento(new URLSearchParams("")), cliente),
    ).rejects.toThrow("abastecimento_do_mes");
  });
});
