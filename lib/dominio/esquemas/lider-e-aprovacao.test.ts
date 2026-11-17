import { describe, expect, it } from "vitest";
import {
  esquemaDecidirAprovacao,
  esquemaLiberarPosicao,
  esquemaPedirAprovacao,
} from "./lider-e-aprovacao";

const UUID = "3f1e7d6a-2b4c-4d5e-8f90-1a2b3c4d5e6f";
const campos = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => String(i.path[0]));

describe("esquemaLiberarPosicao (31)", () => {
  const valido = { gestorId: UUID, dia: "2026-11-17", motivo: "  Queda do sistema na filial.  " };
  it("aceita e apara o motivo", () => {
    expect(esquemaLiberarPosicao.parse(valido).motivo).toBe("Queda do sistema na filial.");
  });
  it("pede motivo com 10 caracteres ou mais e o dia no formato aaaa-mm-dd", () => {
    expect(campos(esquemaLiberarPosicao.safeParse({ ...valido, motivo: "curto" }))).toEqual([
      "motivo",
    ]);
    expect(campos(esquemaLiberarPosicao.safeParse({ ...valido, dia: "17/11/2026" }))).toEqual([
      "dia",
    ]);
  });
});

describe("esquemaPedirAprovacao (37)", () => {
  const valido = {
    tipo: "mes_fechado",
    descricao: "Ajustar a despesa de outubro.",
    referencia: "",
  };
  it("aceita os três tipos; referência vazia vira nula", () => {
    expect(esquemaPedirAprovacao.parse(valido).referencia).toBeNull();
    for (const tipo of ["mes_fechado", "permissao", "outro"]) {
      expect(esquemaPedirAprovacao.safeParse({ ...valido, tipo }).success).toBe(true);
    }
  });
  it("recusa tipo fora da lista e descrição curta", () => {
    expect(campos(esquemaPedirAprovacao.safeParse({ ...valido, tipo: "qualquer" }))).toEqual([
      "tipo",
    ]);
    expect(campos(esquemaPedirAprovacao.safeParse({ ...valido, descricao: "curta" }))).toEqual([
      "descricao",
    ]);
  });
});

describe("esquemaDecidirAprovacao (37)", () => {
  const valido = { pedidoId: UUID, versao: 1, decisao: "aprovado", motivo: "" };
  it("aprovar não exige motivo", () => {
    expect(esquemaDecidirAprovacao.safeParse(valido).success).toBe(true);
  });
  it("recusar exige o motivo, com 10 caracteres ou mais", () => {
    expect(campos(esquemaDecidirAprovacao.safeParse({ ...valido, decisao: "recusado" }))).toEqual([
      "motivo",
    ]);
  });
  it("sem decisão, pede escolher", () => {
    expect(campos(esquemaDecidirAprovacao.safeParse({ ...valido, decisao: "" }))).toEqual([
      "decisao",
    ]);
  });
});
