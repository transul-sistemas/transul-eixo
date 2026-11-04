import { describe, expect, it } from "vitest";
import { DESTINO_PADRAO, caminhoInterno } from "./redirecionamento";

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
  ])("recusa %j e vai para a tela inicial", (valor) => {
    expect(caminhoInterno(valor)).toBe(DESTINO_PADRAO);
  });

  it("normaliza o caminho antes de conferir (o /.. não escapa da regra das telas de entrada)", () => {
    expect(caminhoInterno("/frota/../entrar")).toBe(DESTINO_PADRAO);
  });

  it("não volta para as telas de entrada (evita laço)", () => {
    expect(caminhoInterno("/entrar")).toBe(DESTINO_PADRAO);
    expect(caminhoInterno("/entrar?proximo=/frota")).toBe(DESTINO_PADRAO);
    expect(caminhoInterno("/esqueci-a-senha")).toBe(DESTINO_PADRAO);
  });

  it("a tela inicial é Início › Tarefas", () => {
    expect(DESTINO_PADRAO).toBe("/inicio/tarefas");
  });
});
