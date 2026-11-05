import { describe, expect, it, vi } from "vitest";
import { criarLojaDaGaveta, trocouDeTela } from "./gaveta";

describe("gaveta do menu (celular e tablet)", () => {
  it("começa fechada", () => {
    expect(criarLojaDaGaveta().estaAberta()).toBe(false);
  });
  it("abre, fecha e alterna", () => {
    const gaveta = criarLojaDaGaveta();
    gaveta.abrir();
    expect(gaveta.estaAberta()).toBe(true);
    gaveta.fechar();
    expect(gaveta.estaAberta()).toBe(false);
    gaveta.alternar();
    expect(gaveta.estaAberta()).toBe(true);
    gaveta.alternar();
    expect(gaveta.estaAberta()).toBe(false);
  });
  it("avisa quem assina a cada mudança", () => {
    const gaveta = criarLojaDaGaveta();
    const ouvinte = vi.fn();
    gaveta.assinar(ouvinte);
    gaveta.abrir();
    gaveta.fechar();
    expect(ouvinte).toHaveBeenCalledTimes(2);
  });
  it("não avisa quando nada mudou", () => {
    const gaveta = criarLojaDaGaveta();
    const ouvinte = vi.fn();
    gaveta.assinar(ouvinte);
    gaveta.fechar();
    gaveta.abrir();
    ouvinte.mockClear();
    gaveta.abrir();
    expect(ouvinte).not.toHaveBeenCalled();
  });
  it("quem cancela a assinatura deixa de ser avisado", () => {
    const gaveta = criarLojaDaGaveta();
    const ouvinte = vi.fn();
    const cancelar = gaveta.assinar(ouvinte);
    cancelar();
    gaveta.abrir();
    expect(ouvinte).not.toHaveBeenCalled();
  });
  it("cada loja tem o seu estado", () => {
    const a = criarLojaDaGaveta();
    const b = criarLojaDaGaveta();
    a.abrir();
    expect(b.estaAberta()).toBe(false);
  });
});

// Fatia 3.9a: a barra lateral chega por streaming; se a pessoa tocou em "Abrir menu" antes, a primeira
// montagem da barra não pode fechar a gaveta. Só a troca de tela fecha.
describe("trocouDeTela", () => {
  it("na primeira montagem (o mesmo caminho), não", () => {
    expect(trocouDeTela("/inicio/tarefas", "/inicio/tarefas")).toBe(false);
  });
  it("noutro caminho, sim", () => {
    expect(trocouDeTela("/inicio/tarefas", "/frota/placas")).toBe(true);
  });
});
