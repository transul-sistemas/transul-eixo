import { describe, expect, it } from "vitest";
import {
  esquemaClassificarCentro,
  esquemaDecidirBaixa,
  esquemaLancarODia,
  esquemaPedirBaixa,
  esquemaTrocarCr,
  instanteEmSaoPaulo,
  textoDosRecusados,
} from "./dia-cr-e-baixa";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("A2: Lançar o dia em lote", () => {
  it("pede ao menos um conjunto, a sigla, o dia e a hora", () => {
    expect(
      esquemaLancarODia.safeParse({ ativos: [A], sigla: "ETc", dia: "2026-11-13", hora: "08:30" })
        .success,
    ).toBe(true);
    expect(
      esquemaLancarODia.safeParse({ ativos: [], sigla: "ETc", dia: "2026-11-13", hora: "08:30" })
        .success,
    ).toBe(false);
    expect(
      esquemaLancarODia.safeParse({ ativos: [A], sigla: "ETc", dia: "2026-11-13", hora: "25:00" })
        .success,
    ).toBe(false);
  });
  it("o instante é o de São Paulo (-03:00)", () => {
    expect(instanteEmSaoPaulo("2026-11-13", "08:30")).toBe("2026-11-13T08:30:00-03:00");
  });
  it("os recusados viram 'placa: motivo'", () => {
    const placas: Record<string, string> = { [A]: "ZDM0A00" };
    expect(
      textoDosRecusados(
        [
          { ativo_id: A, motivo: "MAN não vale para conjunto" },
          { ativo_id: B, motivo: "sem permissão" },
        ],
        (x) => placas[x],
      ),
    ).toEqual(["ZDM0A00: MAN não vale para conjunto", "Placa: sem permissão"]);
  });
});

describe("Trocar CR", () => {
  it("pede o CR novo, a data e o motivo", () => {
    const ok = {
      ativoId: A,
      crNovoId: B,
      dia: "2026-11-01",
      motivo: "Mudou de operação",
      origemDaData: "informada",
      versao: 2,
    };
    expect(esquemaTrocarCr.safeParse(ok).success).toBe(true);
    expect(esquemaTrocarCr.safeParse({ ...ok, motivo: " " }).success).toBe(false);
    expect(esquemaTrocarCr.safeParse({ ...ok, origemDaData: "chute" }).success).toBe(false);
  });
});

describe("Baixa com quatro olhos", () => {
  it("pedir pede motivo e justificativa", () => {
    const ok = {
      ativoId: A,
      motivo: "venda",
      dia: "2026-11-13",
      justificativa: "Vendida",
      documento: null,
    };
    expect(esquemaPedirBaixa.safeParse(ok).success).toBe(true);
    expect(esquemaPedirBaixa.safeParse({ ...ok, motivo: "roubo" }).success).toBe(false);
  });
  it("recusar pede o motivo; aprovar não", () => {
    const base = { pedidoId: A, versao: 1, motivo: "" };
    expect(esquemaDecidirBaixa.safeParse({ ...base, decisao: "aprovar" }).success).toBe(true);
    expect(esquemaDecidirBaixa.safeParse({ ...base, decisao: "recusar" }).success).toBe(false);
  });
});

describe("Saúde do CR: classificar centro sem CR", () => {
  it("criar o CR pede o código", () => {
    const base = { codcencus: "2990001", nome: null, motivo: "x" };
    expect(
      esquemaClassificarCentro.safeParse({ ...base, decisao: "criar_cr", codigo: null }).success,
    ).toBe(false);
    expect(
      esquemaClassificarCentro.safeParse({ ...base, decisao: "sem_destino", codigo: null }).success,
    ).toBe(true);
  });
});
