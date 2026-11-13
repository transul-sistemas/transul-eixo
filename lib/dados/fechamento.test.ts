import { describe, expect, it } from "vitest";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import { decidirAjuste, fecharMes, lerAjustes, pedirAjuste } from "./fechamento";

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

describe("Fechamento, ajustes e maturação", () => {
  it("fechar manda o mês e a chave; sem a Diretoria vira sem permissão", async () => {
    const { c, chamadas } = cliente({ data: "f1" });
    expect(await fecharMes(c, "2026-10-01", "k")).toEqual({ ok: true, linha: { id: "f1" } });
    expect(chamadas[0]).toMatchObject({
      funcao: "nucleo.fechar_mes",
      args: { p_mes: "2026-10-01", p_chave: "k" },
    });
    const r = await fecharMes(
      cliente({ error: { message: "Só a Diretoria", code: "42501" } }).c,
      "2026-10-01",
      "k",
    );
    expect(r).toMatchObject({ ok: false, erro: { codigo: "sem_permissao" } });
  });

  it("pedir e decidir ajuste mandam valor com sinal e versão", async () => {
    const { c, chamadas } = cliente({ data: "a1" });
    await pedirAjuste(
      c,
      {
        mes: "2026-10-01",
        operacaoId: "o",
        crId: null,
        linha: "custo_frota",
        valor: -150,
        justificativa: "Nota em dobro",
      },
      "k",
    );
    await decidirAjuste(c, { ajusteId: "a1", versao: 1, decisao: "aprovado", motivo: null }, "k2");
    expect(chamadas[0]?.args).toMatchObject({ p_valor: -150, p_linha: "custo_frota" });
    expect(chamadas[1]?.args).toMatchObject({ p_versao: 1, p_decisao: "aprovado" });
  });

  it("a leitura dos ajustes não cala erro", async () => {
    await expect(
      lerAjustes(cliente({ error: { message: "x" } }).c, {
        mes: null,
        situacao: null,
        pagina: 1,
        tam: 50,
      }),
    ).rejects.toThrow(/ajustes_do_resultado/);
  });
});
