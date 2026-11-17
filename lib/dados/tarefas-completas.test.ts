import { describe, expect, it } from "vitest";
import { type ClienteDasTarefas, lerExcecoesDaDemonstracao, lerTodasAsExcecoes } from "./tarefas";

// A leitura completa da fila (exportar CSV e filtro Demo): página a página até o total.

function linha(i: number, placa: string) {
  return {
    id: `e-${String(i)}`,
    assunto: "cadastro_incompleto",
    descricao: "Falta o RENAVAM",
    criado_em: "2026-11-10T10:00:00-03:00",
    ativo_id: null,
    placa,
    tipo_do_ativo: "cavalo",
    cavalo_sem_renavam: true,
    pessoa_id: null,
    pessoa_nome: null,
    cr: null,
  };
}

/** 120 exceções, uma em cada três da demonstração (ZDM). */
const TODAS = Array.from({ length: 120 }, (_, i) =>
  linha(i, i % 3 === 0 ? `ZDM${String(i).padStart(4, "0")}` : `AAA${String(i).padStart(4, "0")}`),
);

function cliente(paginas: number[]): () => Promise<ClienteDasTarefas> {
  return async () => ({
    schema: () => ({
      rpc: async (_f: string, a?: Record<string, unknown>) => {
        const p = Number(a?.p_pagina);
        const t = Number(a?.p_tamanho);
        paginas.push(p);
        return {
          data: {
            pagina: p,
            tamanho: t,
            total: TODAS.length,
            tipos: [{ assunto: "cadastro_incompleto", n: TODAS.length }],
            linhas: TODAS.slice((p - 1) * t, p * t),
          },
          error: null,
        };
      },
    }),
  });
}

describe("lerTodasAsExcecoes", () => {
  it("lê as páginas até o total, sem cortar", async () => {
    const paginas: number[] = [];
    const r = await lerTodasAsExcecoes(null, cliente(paginas));
    expect(r.linhas).toHaveLength(120);
    expect(r.cortada).toBe(false);
    expect(paginas).toEqual([1, 2, 3]);
  });
});

describe("lerExcecoesDaDemonstracao", () => {
  it("o total respeita o filtro e a página vem do servidor", async () => {
    const r = await lerExcecoesDaDemonstracao({ assunto: null, pagina: 1 }, cliente([]));
    expect(r.total).toBe(40);
    expect(r.linhas).toHaveLength(40);
    expect(r.linhas.every((l) => l.placa?.startsWith("ZDM"))).toBe(true);
  });
});
