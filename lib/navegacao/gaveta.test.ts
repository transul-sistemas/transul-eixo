import { describe, expect, it, vi } from "vitest";
import { criarLojaDaGaveta } from "./gaveta";

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
