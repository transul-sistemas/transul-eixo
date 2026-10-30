import { describe, expect, it } from "vitest";
import { cliqueAbreAPlaca } from "./clique-na-linha";

// O clique na linha é só atalho de mouse e de toque: o botão "Espiar" é o controle de verdade.
// A guarda abaixo evita abrir o painel quando o clique era de outra coisa.

const alvo = (interativo: boolean) => ({ closest: () => (interativo ? {} : null) });
const SEM_TECLAS = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };

describe("cliqueAbreAPlaca", () => {
  it("clique simples numa célula comum abre", () => {
    expect(cliqueAbreAPlaca(alvo(false), SEM_TECLAS, "")).toBe(true);
  });
  it("clique dentro de botão, link, campo ou rótulo não abre (o controle cuida dele)", () => {
    expect(cliqueAbreAPlaca(alvo(true), SEM_TECLAS, "")).toBe(false);
  });
  it("com Ctrl, Cmd, Shift ou Alt não abre (é seleção ou abrir em outra aba)", () => {
    for (const tecla of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const) {
      expect(cliqueAbreAPlaca(alvo(false), { ...SEM_TECLAS, [tecla]: true }, ""), tecla).toBe(
        false,
      );
    }
  });
  it("com texto selecionado (arrastou para copiar) não abre", () => {
    expect(cliqueAbreAPlaca(alvo(false), SEM_TECLAS, "Gestor Exemplo 3")).toBe(false);
  });
  it("seleção só de espaços não conta como seleção", () => {
    expect(cliqueAbreAPlaca(alvo(false), SEM_TECLAS, "   ")).toBe(true);
  });
  it("sem alvo (clique fora de qualquer elemento) não abre", () => {
    expect(cliqueAbreAPlaca(null, SEM_TECLAS, "")).toBe(false);
  });
  it("o seletor do que é interativo cobre botão, link, campo, rótulo, caixa e menu", () => {
    let visto = "";
    cliqueAbreAPlaca({ closest: (s: string) => ((visto = s), null) }, SEM_TECLAS, "");
    for (const parte of [
      "a",
      "button",
      "input",
      "select",
      "textarea",
      "label",
      '[role="button"]',
    ]) {
      expect(visto, parte).toContain(parte);
    }
  });
});
