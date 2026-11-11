import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/lib/erros/detalhe-do-erro", () => ({ detalheDoErroDeLeitura: async () => null }));

import { montarDigest, type CausaDaFalha } from "@/lib/erros/leitura";
import { ErroDeLeitura, TEXTO_DA_CAUSA } from "./erro-de-leitura";

const render = (digest?: string, extra = {}) =>
  renderToStaticMarkup(
    <ErroDeLeitura
      error={Object.assign(new Error("texto interno"), { digest })}
      reset={() => undefined}
      oQue="as operações"
      titulo="Operações"
      {...extra}
    />,
  );

describe("<ErroDeLeitura>", () => {
  const casos: [CausaDaFalha, string][] = [
    ["funcao_ausente", "Aplique as migrations"],
    ["banco_fora", "Tente de novo em instantes"],
    ["lenta", "demorou mais que o limite"],
    ["sem_permissao", "Você não tem permissão para ver isto"],
    ["inesperado", "erro inesperado"],
  ];
  it.each(casos)("causa %s mostra o texto certo e o botão Tentar de novo", (causa, trecho) => {
    const html = render(montarDigest(causa, "abcd1234"));
    expect(html).toContain(trecho);
    expect(html).toContain(TEXTO_DA_CAUSA[causa].replaceAll("'", "&#x27;"));
    expect(html).toContain("Tentar de novo");
    expect(html).toContain("Não foi possível carregar as operações");
  });
  it("sem digest do Eixo cai em inesperado e nunca mostra a mensagem interna nem o nome da função", () => {
    const html = render("2093847561");
    expect(html).toContain("erro inesperado");
    expect(html).not.toContain("texto interno");
    expect(html).not.toContain("PGRST");
  });
  it("perfil comum não vê código: a tela só tem o detalhe depois que o servidor o entrega (Administrador)", () => {
    const html = render(montarDigest("funcao_ausente", "abcd1234"));
    expect(html).not.toContain("Código do erro");
    expect(html).not.toContain("abcd1234");
  });
  it("ficha: mostra o topo (voltar) sem título de página", () => {
    const html = render(undefined, { titulo: undefined, topo: <a href="/x">Voltar</a> });
    expect(html).toContain("Voltar");
  });
});
