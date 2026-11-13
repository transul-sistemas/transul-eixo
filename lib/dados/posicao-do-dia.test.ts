import { describe, expect, it } from "vitest";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import {
  buscarCidades,
  lerPortaDaPosicao,
  lerPosicoesDoDia,
  liberarPosicaoDoDia,
  registrarPosicaoDoDia,
} from "./posicao-do-dia";

function cliente(resposta: { data?: unknown; error?: { message: string; code?: string } | null }) {
  const chamadas: { funcao: string; args: unknown }[] = [];
  const c = {
    schema: (esquema: string) => ({
      rpc: async (funcao: string, args?: unknown) => {
        chamadas.push({ funcao: `${esquema}.${funcao}`, args });
        return { data: resposta.data ?? null, error: resposta.error ?? null };
      },
    }),
  } as unknown as ClienteDeEscrita;
  return { c, chamadas };
}

describe("Posição do dia: leituras", () => {
  it("a porta e as posições vêm das funções de leitura", async () => {
    const { c, chamadas } = cliente({
      data: { abrir: true, dia: "2026-11-13", total: 2, respondidos: 0, liberada: false },
    });
    expect((await lerPortaDaPosicao(c)).abrir).toBe(true);
    await lerPosicoesDoDia(c, null);
    expect(chamadas.map((x) => x.funcao)).toEqual([
      "nucleo.porta_da_posicao",
      "nucleo.posicoes_do_dia",
    ]);
    expect(chamadas[1]?.args).toEqual({ p_dia: null });
  });

  it("erro de leitura vira exceção, nunca lista vazia calada", async () => {
    await expect(
      lerPosicoesDoDia(cliente({ error: { message: "falhou" } }).c, null),
    ).rejects.toThrow(/posicoes_do_dia/);
  });

  it("busca curta não vai ao banco", async () => {
    const { c, chamadas } = cliente({ data: [] });
    expect(await buscarCidades(c, "a")).toEqual([]);
    expect(chamadas).toHaveLength(0);
  });
});

describe("Posição do dia: gravações", () => {
  const resposta = {
    ativoId: "a1",
    dia: "2026-11-13",
    cidadeId: 10,
    semSinal: true,
    motivo: "Rastreador desligado",
    sigla: null,
    confirmouAlerta: false,
    versao: null,
  };

  it("Sem sinal não manda cidade; manda o motivo, a versão e a chave", async () => {
    const { c, chamadas } = cliente({ data: "p1" });
    const r = await registrarPosicaoDoDia(c, resposta, "k1");
    expect(r).toEqual({ ok: true, linha: { posicaoId: "p1" } });
    expect(chamadas[0]?.args).toMatchObject({
      p_cidade_id: null,
      p_sem_sinal: true,
      p_motivo: "Rastreador desligado",
      p_chave: "k1",
    });
  });

  it("com cidade, o motivo não vai", async () => {
    const { c, chamadas } = cliente({ data: "p1" });
    await registrarPosicaoDoDia(c, { ...resposta, semSinal: false }, "k1");
    expect(chamadas[0]?.args).toMatchObject({ p_cidade_id: 10, p_motivo: null });
  });

  it("versão velha vira conflito; sem permissão vira erro tipado", async () => {
    const a = await registrarPosicaoDoDia(
      cliente({ error: { message: "mudou", code: "40001" } }).c,
      resposta,
      "k",
    );
    expect(a).toMatchObject({ ok: false, erro: { codigo: "conflito" } });
    const b = await liberarPosicaoDoDia(
      cliente({ error: { message: "Só o líder", code: "42501" } }).c,
      "g",
      "2026-11-13",
      "x",
      "k",
    );
    expect(b).toMatchObject({ ok: false, erro: { codigo: "sem_permissao" } });
  });
});
