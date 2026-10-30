import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type ColunaDeTabela, TabelaDeDados } from "./tabela-de-dados";

interface Linha {
  id: string;
  nome: string;
}
const LINHAS: Linha[] = [
  { id: "a", nome: "Alfa" },
  { id: "b", nome: "Beta" },
];

function renderizar(aoClicarNaLinha?: (linha: Linha) => void, cabecalhoDeLinha = false) {
  const contextos: unknown[] = [];
  const colunas: ColunaDeTabela<Linha>[] = [
    {
      id: "nome",
      titulo: "Nome",
      cabecalhoDeLinha,
      celula: (linha, contexto) => {
        contextos.push(contexto);
        return linha.nome;
      },
    },
  ];
  const html = renderToStaticMarkup(
    <TabelaDeDados
      rotulo="Teste"
      colunas={colunas}
      linhas={LINHAS}
      idDaLinha={(l) => l.id}
      ordem={{ campo: "nome", sentido: "asc" }}
      aoOrdenar={() => {}}
      aoClicarNaLinha={aoClicarNaLinha}
    />,
  );
  return { html, contextos };
}

describe("<TabelaDeDados>: clique na linha como atalho", () => {
  it("com a ação, as linhas ganham cursor de clique e a célula recebe aoAbrir", () => {
    const { html, contextos } = renderizar(() => {});
    expect(html.match(/<tr[^>]*class="[^"]*cursor-pointer/g)).toHaveLength(2);
    expect(contextos.length).toBeGreaterThan(0);
    for (const contexto of contextos as { aoAbrir?: unknown }[]) {
      expect(typeof contexto.aoAbrir).toBe("function");
    }
  });
  it("sem a ação, nada muda: sem cursor de clique e sem aoAbrir", () => {
    const { html, contextos } = renderizar();
    expect(html).not.toContain("cursor-pointer");
    for (const contexto of contextos as { aoAbrir?: unknown }[]) {
      expect(contexto.aoAbrir).toBeUndefined();
    }
  });
  it("continua com a tabela semântica e o nome acessível", () => {
    const { html } = renderizar(() => {});
    expect(html).toContain('aria-label="Teste"');
    expect(html).toContain("<tbody>");
  });
});

describe("<TabelaDeDados>: a primeira coluna como cabeçalho da linha", () => {
  it("com cabecalhoDeLinha, a primeira célula de cada linha é th scope=row, e fica fixa", () => {
    const { html } = renderizar(undefined, true);
    const corpo = /<tbody>([\s\S]*)<\/tbody>/.exec(html)?.[1] ?? "";
    expect([...corpo.matchAll(/<th[^>]*scope="row"/g)]).toHaveLength(2);
    expect(corpo).not.toContain("<td");
    expect(corpo).toMatch(/<th[^>]*class="[^"]*sticky left-0/);
  });
  it("o cabeçalho da linha não muda a aparência: texto à esquerda e peso normal", () => {
    const { html } = renderizar(undefined, true);
    const th = /<tbody>[\s\S]*?(<th[^>]*scope="row"[^>]*>)/.exec(html)?.[1] ?? "";
    expect(th).toMatch(/text-left/);
    expect(th).toMatch(/font-normal/);
  });
  it("sem a marca, as células continuam td", () => {
    const { html } = renderizar();
    const corpo = /<tbody>([\s\S]*)<\/tbody>/.exec(html)?.[1] ?? "";
    expect(corpo).not.toContain('scope="row"');
    expect([...corpo.matchAll(/<td/g)].length).toBeGreaterThan(0);
  });
});
