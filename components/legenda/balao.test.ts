import { describe, expect, it } from "vitest";
import { balaoAberto, BALAO_FECHADO, reduzirBalao } from "./balao";

describe("balão do nome da sigla", () => {
  it("começa fechado", () => {
    expect(balaoAberto(BALAO_FECHADO)).toBe(false);
  });

  it("abre ao passar o mouse e fecha ao sair", () => {
    const aberto = reduzirBalao(BALAO_FECHADO, "entrou-mouse");
    expect(balaoAberto(aberto)).toBe(true);
    expect(balaoAberto(reduzirBalao(aberto, "saiu-mouse"))).toBe(false);
  });

  it("abre ao focar com o teclado e fecha ao sair do foco", () => {
    const aberto = reduzirBalao(BALAO_FECHADO, "focou");
    expect(balaoAberto(aberto)).toBe(true);
    expect(balaoAberto(reduzirBalao(aberto, "desfocou"))).toBe(false);
  });

  it("o toque abre e o segundo toque fecha", () => {
    const aberto = reduzirBalao(BALAO_FECHADO, "tocou");
    expect(balaoAberto(aberto)).toBe(true);
    expect(balaoAberto(reduzirBalao(aberto, "tocou"))).toBe(false);
  });

  it("o toque fica aberto mesmo sem mouse nem foco, até tocar fora", () => {
    const aberto = reduzirBalao(BALAO_FECHADO, "tocou");
    expect(balaoAberto(reduzirBalao(aberto, "saiu-mouse"))).toBe(true);
    expect(balaoAberto(reduzirBalao(aberto, "tocou-fora"))).toBe(false);
  });

  it("tocar fora fecha tudo, inclusive o que o mouse segurava", () => {
    const aberto = reduzirBalao(reduzirBalao(BALAO_FECHADO, "entrou-mouse"), "tocou");
    expect(balaoAberto(reduzirBalao(aberto, "tocou-fora"))).toBe(false);
  });

  it("Esc fecha tudo", () => {
    const aberto = reduzirBalao(reduzirBalao(BALAO_FECHADO, "focou"), "entrou-mouse");
    expect(balaoAberto(reduzirBalao(aberto, "esc"))).toBe(false);
  });

  it("o mouse no balão aberto pelo teclado não o fecha ao sair", () => {
    const aberto = reduzirBalao(reduzirBalao(BALAO_FECHADO, "focou"), "entrou-mouse");
    expect(balaoAberto(reduzirBalao(aberto, "saiu-mouse"))).toBe(true);
  });
});
