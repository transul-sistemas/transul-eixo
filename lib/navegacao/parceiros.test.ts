import { describe, expect, it } from "vitest";
import {
  enderecoDaConciliacao,
  enderecoDaLocacao,
  lerConciliacao,
  lerLocacao,
  lerParceiros,
} from "./parceiros";

const UUID = "3f1e7d6a-2b4c-4d5e-8f90-1a2b3c4d5e6f";

describe("estado de Parceiros na URL", () => {
  it("a lista lê o mês, a busca e só os chips de tipo conhecidos", () => {
    const e = lerParceiros(new URLSearchParams("mes=2026-03&q=ana&chip=acionista&chip=xyz"));
    expect(e.mes).toBe("2026-03");
    expect(e.consulta.busca).toBe("ana");
    expect(e.consulta.chips).toEqual(["acionista"]);
  });
  it("a conciliação lê mês, agrupador e situação; o desconhecido volta ao padrão", () => {
    expect(
      lerConciliacao(new URLSearchParams(`mes=2026-03&agrupador=${UUID}&situacao=diferenca`)),
    ).toEqual({
      mes: "2026-03",
      agrupador: UUID,
      situacao: "diferenca",
    });
    expect(lerConciliacao(new URLSearchParams("mes=13-2026&agrupador=x&situacao=outra"))).toEqual({
      mes: null,
      agrupador: null,
      situacao: "todas",
    });
  });
  it("o endereço da conciliação devolve a mesma visão", () => {
    const estado = { mes: "2026-03", agrupador: UUID, situacao: "sem_lancamento" as const };
    const endereco = enderecoDaConciliacao(estado);
    expect(lerConciliacao(new URLSearchParams(endereco.split("?")[1]))).toEqual(estado);
    expect(enderecoDaConciliacao({ mes: null, agrupador: null, situacao: "todas" })).toBe(
      "/parceiros/conciliacao",
    );
  });
  it("a locação lê a situação, e todas não vai para a URL", () => {
    expect(lerLocacao(new URLSearchParams("situacao=vigente"))).toBe("vigente");
    expect(lerLocacao(new URLSearchParams("situacao=x"))).toBe("todas");
    expect(enderecoDaLocacao("todas")).toBe("/parceiros/locacao");
    expect(enderecoDaLocacao("encerrada")).toBe("/parceiros/locacao?situacao=encerrada");
  });
});
