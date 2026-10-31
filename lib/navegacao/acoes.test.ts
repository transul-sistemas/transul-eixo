import { describe, expect, it } from "vitest";
import { ACOES, type AcaoDoCatalogo, buscarAcoes } from "./acoes";
import { CATALOGO } from "./catalogo";

describe("ações reservadas para a entrega 2D (assistentes)", () => {
  it("são Receber placa e Disponibilizar ao Operacional, ainda em breve", () => {
    expect(ACOES.map((a) => a.id)).toEqual([
      "frota.receber-placa",
      "frota.disponibilizar-ao-operacional",
    ]);
    expect(ACOES.map((a) => a.nome)).toEqual(["Receber placa", "Disponibilizar ao Operacional"]);
    expect(ACOES.every((a) => a.estado === "em-breve")).toBe(true);
  });
  it("cada ação pertence a um módulo do catálogo, e a permissão é a desse módulo", () => {
    const modulos = CATALOGO.map((m) => m.id);
    for (const acao of ACOES) {
      expect(modulos, acao.id).toContain(acao.modulo);
      expect(acao.permissao).toEqual({ modulo: acao.modulo, acao: "criar" });
      expect(acao.id.startsWith(`${acao.modulo}.`), acao.id).toBe(true);
    }
  });
  it("Receber placa é a transferência entre gestores de frota: pertence ao módulo Frota, não ao Operacional", () => {
    const receber = ACOES.find((a) => a.nome === "Receber placa");
    expect(receber?.id).toBe("frota.receber-placa");
    expect(receber?.modulo).toBe("frota");
    expect(receber?.permissao).toEqual({ modulo: "frota", acao: "criar" });
    expect(receber?.descricao).toMatch(/gestor/i);
    expect(ACOES.some((a) => a.id.startsWith("operacional."))).toBe(false);
  });
  it("o nome é verbo mais objeto, com o verbo no infinitivo", () => {
    for (const acao of ACOES) {
      expect(acao.nome, acao.id).toMatch(/^\p{Lu}\p{L}*r\s+\S/u);
      expect(acao.nome).not.toContain("!");
    }
  });
  it("a descrição é uma frase que termina em ponto", () => {
    for (const acao of ACOES) {
      expect(acao.descricao.trim(), acao.id).not.toBe("");
      expect(acao.descricao.endsWith("."), acao.id).toBe(true);
    }
  });
  it("os ids são únicos", () => {
    expect(new Set(ACOES.map((a) => a.id)).size).toBe(ACOES.length);
  });
});

describe("buscarAcoes", () => {
  it("acha pelo nome, sem acento nem maiúscula", () => {
    expect(buscarAcoes("receber placa", "Administrador").map((a) => a.id)).toEqual([
      "frota.receber-placa",
    ]);
    expect(buscarAcoes("RECEBER", "Administrador")).toHaveLength(1);
    expect(buscarAcoes("disponibilizar", "Diretoria")[0]?.nome).toBe(
      "Disponibilizar ao Operacional",
    );
  });
  it("acha por uma palavra só, com o nome que contém o termo antes do que só combina pelo módulo", () => {
    expect(buscarAcoes("placa", "Administrador").map((a) => a.nome)).toEqual(["Receber placa"]);
    // "Receber placa" saiu do módulo Operacional: só o nome de "Disponibilizar ao Operacional" combina.
    expect(buscarAcoes("operacional", "Administrador").map((a) => a.nome)).toEqual([
      "Disponibilizar ao Operacional",
    ]);
  });
  it("termo vazio ou sem resultado devolve lista vazia", () => {
    expect(buscarAcoes("", "Administrador")).toEqual([]);
    expect(buscarAcoes("   ", "Administrador")).toEqual([]);
    expect(buscarAcoes("zzzz", "Administrador")).toEqual([]);
  });
  it("ação em breve só aparece para Administrador e Diretoria", () => {
    expect(buscarAcoes("receber placa", "Gestor de frota")).toEqual([]);
    expect(buscarAcoes("receber placa", "Operacional")).toEqual([]);
    expect(buscarAcoes("receber placa", "Diretoria")).toHaveLength(1);
  });

  const pronta = (modulo: AcaoDoCatalogo["modulo"]): AcaoDoCatalogo => ({
    id: `${modulo}.fazer-algo`,
    nome: "Fazer algo",
    icone: "IconCirclePlus",
    modulo,
    permissao: { modulo, acao: "criar" },
    estado: "pronto",
    descricao: "Faz algo.",
  });

  it("pronta, Receber placa e Disponibilizar são do Gestor de frota e não do Operacional", () => {
    const prontas = ACOES.map((a) => ({ ...a, estado: "pronto" as const }));
    expect(buscarAcoes("receber placa", "Gestor de frota", prontas).map((a) => a.id)).toEqual([
      "frota.receber-placa",
    ]);
    expect(buscarAcoes("receber placa", "Operacional", prontas)).toEqual([]);
    expect(buscarAcoes("disponibilizar", "Operacional", prontas)).toEqual([]);
    expect(buscarAcoes("disponibilizar", "Gestor de frota", prontas)).toHaveLength(1);
  });

  it("ação pronta aparece para quem tem o módulo, e só para ele", () => {
    expect(buscarAcoes("fazer", "Gestor de frota", [pronta("frota")])).toHaveLength(1);
    expect(buscarAcoes("fazer", "Operacional", [pronta("frota")])).toEqual([]);
    expect(buscarAcoes("fazer", "Operacional", [pronta("operacional")])).toHaveLength(1);
  });
});
