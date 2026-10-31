import { describe, expect, it } from "vitest";
import { PERFIS } from "@/lib/navegacao/perfis";
import { ErroDePermissao, exigirPermissao, temPermissao } from "./exigir-permissao";

describe("temPermissao: módulo × ação, por perfil (provisório até a Fase 3, quando vira RLS)", () => {
  it("Administrador e Diretoria podem criar em qualquer módulo", () => {
    for (const perfil of ["Administrador", "Diretoria"] as const) {
      for (const modulo of ["frota", "operacional", "operacoes", "pessoas"] as const) {
        expect(temPermissao(perfil, { modulo, acao: "criar" }), `${perfil}/${modulo}`).toBe(true);
      }
    }
  });
  it("Gestor de frota cria em Frota (cadastrar, receber, disponibilizar) e não em Operacional", () => {
    expect(temPermissao("Gestor de frota", { modulo: "frota", acao: "criar" })).toBe(true);
    expect(temPermissao("Gestor de frota", { modulo: "operacional", acao: "criar" })).toBe(false);
    expect(temPermissao("Gestor de frota", { modulo: "operacoes", acao: "criar" })).toBe(false);
  });
  it("Operacional não cria em Frota (não recebe, não cadastra, não disponibiliza)", () => {
    expect(temPermissao("Operacional", { modulo: "frota", acao: "criar" })).toBe(false);
    expect(temPermissao("Operacional", { modulo: "operacional", acao: "criar" })).toBe(true);
  });
  it("todo perfil conhecido tem resposta, sem exceção", () => {
    for (const perfil of PERFIS) {
      expect(typeof temPermissao(perfil, { modulo: "frota", acao: "criar" })).toBe("boolean");
    }
  });
  it("perfil desconhecido nunca tem permissão", () => {
    expect(temPermissao("Visitante" as never, { modulo: "frota", acao: "criar" })).toBe(false);
  });
});

describe("exigirPermissao: lança ErroDePermissao quando falta permissão", () => {
  it("com permissão, não faz nada", () => {
    expect(() =>
      exigirPermissao({ modulo: "frota", acao: "criar" }, "Gestor de frota"),
    ).not.toThrow();
  });
  it("sem permissão, lança com o módulo, a ação e o perfil, e uma mensagem que diz como resolver", () => {
    try {
      exigirPermissao({ modulo: "frota", acao: "criar" }, "Operacional");
      throw new Error("devia ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(ErroDePermissao);
      const erro = e as ErroDePermissao;
      expect(erro.codigo).toBe("sem_permissao");
      expect(erro.modulo).toBe("frota");
      expect(erro.acao).toBe("criar");
      expect(erro.perfil).toBe("Operacional");
      expect(erro.message).toMatch(/Operacional/);
      expect(erro.message.toLowerCase()).not.toMatch(/desculp/);
    }
  });
  it("sem perfil na chamada usa o perfil atual (provisório: Administrador)", () => {
    expect(() => exigirPermissao({ modulo: "frota", acao: "criar" })).not.toThrow();
  });
});
