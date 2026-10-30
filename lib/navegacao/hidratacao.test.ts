import { describe, expect, it, vi } from "vitest";
import { criarLojaDeHidratacao } from "./hidratacao";

describe("loja de hidratação: o painel de link direto só abre com todas as regiões prontas", () => {
  it("começa não pronta, no servidor e no cliente", () => {
    const loja = criarLojaDeHidratacao(["topo", "consulta", "lista"]);
    expect(loja.pronta()).toBe(false);
    expect(loja.prontaNoServidor()).toBe(false);
  });

  it("só fica pronta quando todas as regiões se marcaram", () => {
    const loja = criarLojaDeHidratacao(["topo", "consulta", "lista"]);
    loja.marcar("lista");
    loja.marcar("topo");
    expect(loja.pronta()).toBe(false);
    loja.marcar("consulta");
    expect(loja.pronta()).toBe(true);
  });

  it("a ordem em que as regiões hidratam não importa", () => {
    const loja = criarLojaDeHidratacao(["a", "b"]);
    loja.marcar("b");
    loja.marcar("a");
    expect(loja.pronta()).toBe(true);
  });

  it("desmarcar uma região (a lista saiu da tela) desfaz o pronto", () => {
    const loja = criarLojaDeHidratacao(["topo", "lista"]);
    loja.marcar("topo");
    const desmarcar = loja.marcar("lista");
    expect(loja.pronta()).toBe(true);
    desmarcar();
    expect(loja.pronta()).toBe(false);
  });

  it("a região que remonta antes de a antiga desmontar continua pronta (conta de marcas)", () => {
    const loja = criarLojaDeHidratacao(["lista"]);
    const primeira = loja.marcar("lista");
    const segunda = loja.marcar("lista");
    primeira();
    expect(loja.pronta()).toBe(true);
    segunda();
    expect(loja.pronta()).toBe(false);
  });

  it("desmarcar duas vezes a mesma marca não mexe na conta", () => {
    const loja = criarLojaDeHidratacao(["lista"]);
    const a = loja.marcar("lista");
    loja.marcar("lista");
    a();
    a();
    expect(loja.pronta()).toBe(true);
  });

  it("região que ninguém espera é ignorada e não deixa a loja pronta", () => {
    const loja = criarLojaDeHidratacao(["lista"]);
    loja.marcar("outra");
    expect(loja.pronta()).toBe(false);
  });

  it("avisa quem assinou a cada mudança de estado, e para de avisar ao cancelar", () => {
    const loja = criarLojaDeHidratacao(["lista"]);
    const ouvinte = vi.fn();
    const cancelar = loja.assinar(ouvinte);
    const desmarcar = loja.marcar("lista");
    expect(ouvinte).toHaveBeenCalledTimes(1);
    cancelar();
    desmarcar();
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it("não avisa quando a marca nova não muda o estado pronto", () => {
    const loja = criarLojaDeHidratacao(["lista"]);
    loja.marcar("lista");
    const ouvinte = vi.fn();
    loja.assinar(ouvinte);
    loja.marcar("lista");
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it("sem regiões esperadas, já nasce pronta", () => {
    expect(criarLojaDeHidratacao([]).pronta()).toBe(true);
  });
});
