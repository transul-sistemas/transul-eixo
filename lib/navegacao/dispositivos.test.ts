import { describe, expect, it } from "vitest";
import { todasAsTelas } from "./catalogo";
import { AVISO_DE_COMPUTADOR, avisoDeDispositivo } from "./dispositivos";

describe("avisoDeDispositivo (aviso no celular, sem bloquear)", () => {
  it("a frase é a combinada", () => {
    expect(AVISO_DE_COMPUTADOR).toBe("Esta tela funciona melhor em um computador.");
  });
  it("tela sem celular leva o aviso", () => {
    expect(avisoDeDispositivo("/pessoas/escala")).toBe(AVISO_DE_COMPUTADOR);
    expect(avisoDeDispositivo("/frota/acompanhamento")).toBe(AVISO_DE_COMPUTADOR);
    expect(avisoDeDispositivo("/operacional/ordens-de-carregamento")).toBe(AVISO_DE_COMPUTADOR);
  });
  it("as cinco telas de celular não levam aviso", () => {
    for (const rota of [
      "/operacional/patio",
      "/operacional/totem",
      "/frota/carteira",
      "/inicio/tarefas",
      "/pessoas/status-diario",
    ]) {
      expect(avisoDeDispositivo(rota), rota).toBeUndefined();
    }
  });
  it("com ?modo= e barra final vale o mesmo", () => {
    expect(avisoDeDispositivo("/frota/acompanhamento?modo=mapa")).toBe(AVISO_DE_COMPUTADOR);
    expect(avisoDeDispositivo("/operacional/patio/")).toBeUndefined();
  });
  it("rota fora do catálogo não leva aviso", () => {
    expect(avisoDeDispositivo("/nada")).toBeUndefined();
    expect(avisoDeDispositivo("/")).toBeUndefined();
    expect(avisoDeDispositivo("")).toBeUndefined();
  });
  it("vale para o catálogo inteiro: aviso se, e só se, a tela não tem celular", () => {
    for (const tela of todasAsTelas()) {
      const esperado = tela.dispositivos.includes("celular") ? undefined : AVISO_DE_COMPUTADOR;
      expect(avisoDeDispositivo(tela.rota), tela.id).toBe(esperado);
    }
  });
});
