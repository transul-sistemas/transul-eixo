import { describe, expect, it } from "vitest";
import { lerFila } from "./excecoes";

const q = (texto: string) => new URLSearchParams(texto);

describe("lerFila", () => {
  it("sem parâmetros: todos os assuntos, página 1", () => {
    expect(lerFila(q(""))).toEqual({ assunto: null, pagina: 1 });
  });
  it("lê o assunto e a página", () => {
    expect(lerFila(q("assunto=cadastro_incompleto&pagina=3"))).toEqual({
      assunto: "cadastro_incompleto",
      pagina: 3,
    });
  });
  it("assunto fora do formato vira todos (nunca vai cru ao banco)", () => {
    expect(lerFila(q("assunto=Drop Table;")).assunto).toBeNull();
    expect(lerFila(q("assunto=")).assunto).toBeNull();
  });
  it("página inválida volta à 1", () => {
    expect(lerFila(q("pagina=0")).pagina).toBe(1);
    expect(lerFila(q("pagina=abc")).pagina).toBe(1);
    expect(lerFila(q("pagina=-2")).pagina).toBe(1);
  });
});
