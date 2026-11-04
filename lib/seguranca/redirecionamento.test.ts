import { describe, expect, it } from "vitest";
import { caminhoInterno } from "./redirecionamento";

// Depois do login, o "proximo" só leva a um caminho interno do Eixo (o ataque de redirecionamento
// aberto manda a pessoa, já logada, para um site de fora).

describe("caminhoInterno: o redirecionamento depois do login", () => {
  it("aceita caminho interno, com busca e âncora", () => {
    expect(caminhoInterno("/frota/placas")).toBe("/frota/placas");
    expect(caminhoInterno("/frota/placas?pagina=2&ordem=placa")).toBe(
      "/frota/placas?pagina=2&ordem=placa",
    );
    expect(caminhoInterno("/frota/placas/ABC1D23#resumo")).toBe("/frota/placas/ABC1D23#resumo");
  });

  it.each([
    null,
    undefined,
    "",
    "frota/placas",
    "https://exemplo.com/frota",
    "//exemplo.com/frota",
    "/\\exemplo.com",
    "\\\\exemplo.com",
    "/%2F%2Fexemplo.com",
    "/%5Cexemplo.com",
    "javascript:alert(1)",
    "/\texemplo.com",
    "/ /exemplo.com",
    "http:/exemplo.com",
  ])("recusa %j (nulo: quem chama usa a primeira tela do perfil)", (valor) => {
    expect(caminhoInterno(valor)).toBeNull();
  });

  it("normaliza o caminho antes de conferir (o /.. não escapa da regra das telas de entrada)", () => {
    expect(caminhoInterno("/frota/../entrar")).toBeNull();
  });

  it("não volta para as telas de entrada (evita laço)", () => {
    expect(caminhoInterno("/entrar")).toBeNull();
    expect(caminhoInterno("/entrar?proximo=/frota")).toBeNull();
    expect(caminhoInterno("/esqueci-a-senha")).toBeNull();
  });

  it("a raiz (/) não é destino: vale a primeira tela do perfil (aprovação da 3.8)", () => {
    expect(caminhoInterno("/")).toBeNull();
    expect(caminhoInterno("/?periodo=2026-10")).toBeNull();
  });
});
