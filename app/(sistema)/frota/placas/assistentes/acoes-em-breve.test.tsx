import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AcoesEmBreve } from "./acoes-em-breve";

// Fatia 3.9a: no modo banco, as gravações entram na 3.9b. Os botões aparecem (a pessoa sabe o que vem),
// desabilitados, com o aviso de em breve.

describe("<AcoesEmBreve>", () => {
  it("na lista, Cadastrar placa desabilitado com o aviso", () => {
    const html = renderToStaticMarkup(<AcoesEmBreve comBotaoDeCadastrar />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*Cadastrar placa/);
    expect(html).toContain("Em breve");
    expect(html).toContain("Gravar pelo banco entra em breve");
  });
  it("na ficha, as ações do momento desabilitadas", () => {
    const html = renderToStaticMarkup(
      <AcoesEmBreve acoesDaFicha={[{ id: "receber-placa", nome: "Receber placa" }]} />,
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*Receber placa/);
    expect(html).not.toContain("Cadastrar placa");
  });
});
