import { describe, expect, it } from "vitest";
import {
  esquemaCadastrarLocacao,
  esquemaCadastrarParceiro,
  esquemaEncerrarLocacao,
  esquemaJustificarDiferenca,
} from "./parceiros";

const UUID = "3f1e7d6a-2b4c-4d5e-8f90-1a2b3c4d5e6f";
const erros = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => String(i.path[0]));

describe("esquemaCadastrarParceiro", () => {
  const valido = {
    documento: "529.982.247-25",
    nome: "  Parceiro Fictício  ",
    tipos: ["acionista"],
    codparc: "",
    agrupadorId: "",
  };
  it("aceita o cadastro, com o documento só em dígitos e sem CODPARC nem agrupador", () => {
    const r = esquemaCadastrarParceiro.parse(valido);
    expect(r).toEqual({
      documento: "52998224725",
      nome: "Parceiro Fictício",
      tipos: ["acionista"],
      codparc: null,
      agrupadorId: null,
    });
  });
  it("recusa documento inválido, sem tipo e sem nome", () => {
    const r = esquemaCadastrarParceiro.safeParse({
      ...valido,
      documento: "52998224724",
      tipos: [],
      nome: " ",
    });
    expect(erros(r).sort()).toEqual(["documento", "nome", "tipos"]);
  });
  it("aceita CNPJ, o CODPARC em número e o agrupador", () => {
    const r = esquemaCadastrarParceiro.parse({
      ...valido,
      documento: "11.222.333/0001-81",
      codparc: "1234",
      agrupadorId: UUID,
      tipos: ["agregado", "locador"],
    });
    expect(r.codparc).toBe(1234);
    expect(r.agrupadorId).toBe(UUID);
  });
  it("recusa CODPARC com letras", () => {
    expect(erros(esquemaCadastrarParceiro.safeParse({ ...valido, codparc: "12a" }))).toEqual([
      "codparc",
    ]);
  });
});

describe("esquemaJustificarDiferenca", () => {
  it("pede o motivo com 10 caracteres ou mais", () => {
    expect(
      erros(esquemaJustificarDiferenca.safeParse({ crId: UUID, mes: "2026-03", motivo: "curto" })),
    ).toEqual(["motivo"]);
    expect(
      esquemaJustificarDiferenca.parse({
        crId: UUID,
        mes: "2026-03",
        motivo: " Lançado no CR errado. ",
      }).motivo,
    ).toBe("Lançado no CR errado.");
  });
  it("recusa mês fora do formato", () => {
    expect(
      erros(
        esquemaJustificarDiferenca.safeParse({
          crId: UUID,
          mes: "03/2026",
          motivo: "Motivo suficiente.",
        }),
      ),
    ).toEqual(["mes"]);
  });
});

describe("esquemaCadastrarLocacao", () => {
  const valida = {
    parceiroId: UUID,
    placa: "abc-1d23",
    inicio: "2026-03-01",
    fim: "",
    valorMensalCentavos: 450000,
  };
  it("normaliza a placa e deixa o fim vazio como nulo", () => {
    const r = esquemaCadastrarLocacao.parse(valida);
    expect(r.placa).toBe("ABC1D23");
    expect(r.fim).toBeNull();
  });
  it("recusa valor zero e fim antes do início ([início, fim))", () => {
    const r = esquemaCadastrarLocacao.safeParse({
      ...valida,
      valorMensalCentavos: 0,
      fim: "2026-03-01",
    });
    expect(erros(r).sort()).toEqual(["fim", "valorMensalCentavos"]);
  });
  it("recusa placa incompleta", () => {
    expect(erros(esquemaCadastrarLocacao.safeParse({ ...valida, placa: "AB12" }))).toEqual([
      "placa",
    ]);
  });
});

describe("esquemaEncerrarLocacao", () => {
  const valido = {
    locacaoId: UUID,
    versao: 1,
    inicio: "2026-03-01",
    fim: "2026-06-01",
    motivo: "Fim do contrato.",
  };
  it("aceita o encerramento depois do início", () => {
    expect(esquemaEncerrarLocacao.parse(valido).fim).toBe("2026-06-01");
  });
  it("recusa o encerramento no dia do início e sem motivo", () => {
    expect(
      erros(esquemaEncerrarLocacao.safeParse({ ...valido, fim: "2026-03-01", motivo: "" })).sort(),
    ).toEqual(["fim", "motivo"]);
  });
});
