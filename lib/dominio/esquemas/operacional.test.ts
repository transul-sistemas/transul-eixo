import { describe, expect, it } from "vitest";
import {
  ACOES_DO_PATIO,
  acoesPossiveis,
  esquemaAvancarNoPatio,
  esquemaCriarOrdem,
  esquemaRegistrarChegada,
} from "./operacional";
import { normalizarPlaca } from "@/lib/dominio/placa";

const ATIVO = "6f1c1f4e-2b7a-4c55-9a51-0d1f5e2a7b10";
const OPERACAO = "0b8f0a3e-6a7c-4a0e-8f3e-5c0a1b2c3d4e";

describe("totem: registrar a chegada", () => {
  it("normaliza a placa digitada (minúscula, traço e espaço)", () => {
    expect(normalizarPlaca(" abc-1d23 ")).toBe("ABC1D23");
  });
  it("aceita a placa antiga e a Mercosul", () => {
    expect(esquemaRegistrarChegada.safeParse({ placa: "ABC1234" }).success).toBe(true);
    expect(esquemaRegistrarChegada.safeParse({ placa: "abc-1d23" }).success).toBe(true);
  });
  it("recusa a placa incompleta, com a mensagem de como digitar", () => {
    const r = esquemaRegistrarChegada.safeParse({ placa: "AB12" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/placa completa/);
  });
});

describe("pátio: o que cada situação permite", () => {
  it("DOp aceita ou devolve; ACe cria a ordem ou devolve; CAr conclui; CAn libera", () => {
    expect(acoesPossiveis("DOp")).toEqual(["aceitar", "devolver"]);
    expect(acoesPossiveis("ACe")).toEqual(["criar-ordem", "devolver"]);
    expect(acoesPossiveis("CAr")).toEqual(["concluir"]);
    expect(acoesPossiveis("CAn")).toEqual(["liberar"]);
  });
  it("outra situação não tem ação no pátio", () => {
    expect(acoesPossiveis("MAN")).toEqual([]);
    expect(acoesPossiveis("pendente")).toEqual([]);
  });
  it("cada ação tem o nome do botão (verbo + objeto)", () => {
    expect(ACOES_DO_PATIO.aceitar.botao).toBe("Aceitar placa");
    expect(ACOES_DO_PATIO.devolver.botao).toBe("Devolver ao gestor");
  });
});

describe("pátio: avançar a placa", () => {
  it("aceita aceitar sem motivo", () => {
    const r = esquemaAvancarNoPatio.safeParse({
      ativoId: ATIVO,
      placa: "ABC1D23",
      acao: "aceitar",
      motivo: "",
    });
    expect(r.success).toBe(true);
  });
  it("devolver ao gestor exige o motivo", () => {
    const r = esquemaAvancarNoPatio.safeParse({
      ativoId: ATIVO,
      placa: "ABC1D23",
      acao: "devolver",
      motivo: "  ",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["motivo"]);
  });
  it("recusa ação desconhecida", () => {
    const r = esquemaAvancarNoPatio.safeParse({
      ativoId: ATIVO,
      placa: "ABC1D23",
      acao: "pular",
      motivo: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("ordem de carregamento: criar", () => {
  const base = {
    ativoId: ATIVO,
    placa: "ABC1D23",
    operacaoId: OPERACAO,
    destino: "Porto de Paranaguá",
    dataPrevista: "2026-11-12",
  };
  it("aceita a ordem completa com a data a partir de hoje", () => {
    expect(esquemaCriarOrdem("2026-11-12").safeParse(base).success).toBe(true);
  });
  it("recusa a data antes de hoje (o limite é o próprio dia)", () => {
    const r = esquemaCriarOrdem("2026-11-13").safeParse(base);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["dataPrevista"]);
  });
  it("exige a placa, a operação e o destino", () => {
    const r = esquemaCriarOrdem("2026-11-12").safeParse({
      ...base,
      ativoId: "",
      operacaoId: "",
      destino: " ",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      "ativoId",
      "destino",
      "operacaoId",
    ]);
  });
  it("destino com até 120 caracteres", () => {
    expect(
      esquemaCriarOrdem("2026-11-12").safeParse({ ...base, destino: "x".repeat(121) }).success,
    ).toBe(false);
  });
});
