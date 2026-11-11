import { describe, expect, it } from "vitest";
import { type ClienteDasTarefas, lerExcecoes, lerTarefas } from "./tarefas";

function cliente(resposta: unknown, chamadas: [string, unknown][] = [], erro: string | null = null) {
  const c: ClienteDasTarefas = {
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

describe("lerTarefas", () => {
  it("converte os números do banco", async () => {
    const chamadas: [string, unknown][] = [];
    const n = await lerTarefas(
      cliente(
        {
          para_receber: 2,
          pedidos_abertos: 5,
          excecoes: { total: 3, por_assunto: [{ assunto: "cadastro_incompleto", n: 3 }] },
          placas_com_alerta: 4,
          alertas: [{ alerta: "sem_cr", n: 4 }],
        },
        chamadas,
      ),
    );
    expect(chamadas[0]?.[0]).toBe("tarefas_do_usuario");
    expect(n).toEqual({
      paraReceber: 2,
      pedidosAbertos: 5,
      excecoes: { total: 3, porAssunto: [{ assunto: "cadastro_incompleto", n: 3 }] },
      placasComAlerta: 4,
      alertas: [{ alerta: "sem_cr", n: 4 }],
    });
  });

  it("o erro do banco vira erro com o nome da função", async () => {
    await expect(lerTarefas(cliente(null, [], "sem permissão"))).rejects.toThrow(
      "tarefas_do_usuario: sem permissão",
    );
  });
});

describe("lerExcecoes", () => {
  it("pede a página e o assunto e converte as linhas, sem documento", async () => {
    const chamadas: [string, unknown][] = [];
    const r = await lerExcecoes(
      { assunto: "cadastro_incompleto", pagina: 2 },
      cliente(
        {
          pagina: 2,
          tamanho: 50,
          total: 51,
          tipos: [{ assunto: "cadastro_incompleto", n: 51 }],
          linhas: [
            {
              id: "e1",
              assunto: "cadastro_incompleto",
              descricao: "falta RENAVAM",
              criado_em: "2026-11-01T10:00:00+00:00",
              ativo_id: "a1",
              placa: "ABC1D23",
              tipo_do_ativo: "cavalo",
              cavalo_sem_renavam: true,
              pessoa_id: null,
              pessoa_nome: null,
              cr: null,
              campo: null,
            },
          ],
        },
        chamadas,
      ),
    );
    expect(chamadas[0]).toEqual([
      "excecoes_abertas",
      { p_assunto: "cadastro_incompleto", p_pagina: 2, p_tamanho: 50 },
    ]);
    expect(r.total).toBe(51);
    expect(r.linhas[0]).toMatchObject({ id: "e1", placa: "ABC1D23", ativoId: "a1" });
    expect(r.linhas[0]).not.toHaveProperty("documento");
  });

  it("sem assunto manda nulo", async () => {
    const chamadas: [string, unknown][] = [];
    await lerExcecoes(
      { assunto: null, pagina: 1 },
      cliente({ pagina: 1, tamanho: 50, total: 0, tipos: [], linhas: [] }, chamadas),
    );
    expect(chamadas[0]?.[1]).toMatchObject({ p_assunto: null, p_pagina: 1 });
  });
});
