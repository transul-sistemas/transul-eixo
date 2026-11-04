import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProvedorDoUsuario, useUsuarioDaSessao } from "./usuario-da-sessao";

// Fatia 3.9a: os rascunhos dos assistentes são de cada pessoa (a chave é o usuário da sessão); sem a
// sessão, não há chave inventada: o componente acusa o erro de montagem.

function Mostra() {
  return <span>{useUsuarioDaSessao()}</span>;
}

describe("useUsuarioDaSessao", () => {
  it("devolve o usuário do provedor", () => {
    expect(
      renderToStaticMarkup(
        <ProvedorDoUsuario usuario="u-123">
          <Mostra />
        </ProvedorDoUsuario>,
      ),
    ).toBe("<span>u-123</span>");
  });
  it("fora do provedor, acusa (nunca uma chave provisória)", () => {
    expect(() => renderToStaticMarkup(<Mostra />)).toThrow(/ProvedorDoUsuario/);
  });
});
