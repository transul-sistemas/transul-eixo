import { describe, expect, it, vi } from "vitest";
import type { ClienteDeEscrita } from "./escrita-do-banco";
import { lerVinculosDaPlaca, versaoDoVigenteDoTipo } from "./vinculos-da-placa";

const A = "11111111-1111-4111-8111-111111111111";

describe("lerVinculosDaPlaca", () => {
  it("acha o ativo pela placa e lê os CRs com a história", async () => {
    const rpc = vi.fn(async (f: string) =>
      f === "placa_para_assistente"
        ? { data: { ativo_id: A, placa: "ZDM0A00" }, error: null }
        : { data: [{ vinculo_id: "v1", tipo: "frota", vigente: true, versao: 2 }], error: null },
    );
    const cliente = { schema: () => ({ rpc }) } as unknown as ClienteDeEscrita;
    const r = await lerVinculosDaPlaca(cliente, "ZDM0A00");
    expect(r?.ativoId).toBe(A);
    expect(r?.vinculos).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("crs_da_placa", { p_ativo_id: A, p_incluir_historico: true });
  });
  it("placa que não existe: nulo", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const cliente = { schema: () => ({ rpc }) } as unknown as ClienteDeEscrita;
    expect(await lerVinculosDaPlaca(cliente, "ZZZ9Z99")).toBeNull();
  });
});

describe("versaoDoVigenteDoTipo", () => {
  it("a versão do vigente do mesmo tipo; o encerrado não conta", () => {
    const v = [
      { tipo: "frota", vigente: false, versao: 1 },
      { tipo: "frota", vigente: true, versao: 4 },
      { tipo: "acionista", vigente: true, versao: 7 },
    ];
    expect(versaoDoVigenteDoTipo(v, "frota")).toBe(4);
    expect(versaoDoVigenteDoTipo(v, "servico")).toBeNull();
  });
});
