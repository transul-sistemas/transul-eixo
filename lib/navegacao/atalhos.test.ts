import { describe, expect, it } from "vitest";
import { ehAtalho, ehCampoDeTexto } from "./atalhos";

const tecla = (parcial: Partial<Parameters<typeof ehAtalho>[0]>) => ({
  key: "b",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...parcial,
});

describe("ehAtalho", () => {
  it("Ctrl+B e ⌘B valem, em maiúscula ou minúscula", () => {
    expect(ehAtalho(tecla({ ctrlKey: true }), "b")).toBe(true);
    expect(ehAtalho(tecla({ metaKey: true }), "b")).toBe(true);
    expect(ehAtalho(tecla({ ctrlKey: true, key: "B" }), "b")).toBe(true);
  });
  it("a tecla sozinha não é atalho", () => {
    expect(ehAtalho(tecla({}), "b")).toBe(false);
  });
  it("outra tecla com Ctrl não é o atalho", () => {
    expect(ehAtalho(tecla({ ctrlKey: true, key: "k" }), "b")).toBe(false);
  });
  it("Ctrl+Shift+B e Ctrl+Alt+B são outros atalhos, do navegador ou do sistema", () => {
    expect(ehAtalho(tecla({ ctrlKey: true, shiftKey: true }), "b")).toBe(false);
    expect(ehAtalho(tecla({ ctrlKey: true, altKey: true }), "b")).toBe(false);
  });
  it("funciona para o Ctrl+K também", () => {
    expect(ehAtalho(tecla({ ctrlKey: true, key: "k" }), "k")).toBe(true);
  });
});

describe("ehCampoDeTexto (onde digitar não pode disparar atalho de letra)", () => {
  it.each(["INPUT", "TEXTAREA", "SELECT", "input", "textarea"])("%s é campo de texto", (tag) => {
    expect(ehCampoDeTexto({ tagName: tag })).toBe(true);
  });
  it("área editável é campo de texto", () => {
    expect(ehCampoDeTexto({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });
  it("botão, link e div comum não são", () => {
    expect(ehCampoDeTexto({ tagName: "BUTTON" })).toBe(false);
    expect(ehCampoDeTexto({ tagName: "A" })).toBe(false);
    expect(ehCampoDeTexto({ tagName: "DIV", isContentEditable: false })).toBe(false);
  });
  it("sem alvo ou com alvo estranho, não é", () => {
    expect(ehCampoDeTexto(null)).toBe(false);
    expect(ehCampoDeTexto(undefined)).toBe(false);
    expect(ehCampoDeTexto({})).toBe(false);
    expect(ehCampoDeTexto("texto")).toBe(false);
  });
});
