import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventosDaFicha } from "./eventos-da-ficha";

const linhas = [
  {
    chave: "2",
    quando: "20/10/2026 08:00",
    situacao: <span>ETc Em trânsito carregado</span>,
    duracao: "10 dias e 4 h",
  },
  {
    chave: "1",
    quando: "12/10/2026 10:00",
    situacao: <span>DOp Disponível no Operacional</span>,
    duracao: "7 dias e 22 h",
  },
];
const com = (l = linhas) => renderToStaticMarkup(<EventosDaFicha linhas={l} />);

describe("<EventosDaFicha>: a alternativa em lista da linha do tempo", () => {
  it("é uma tabela com legenda, cabeçalhos de coluna e a data e hora de cada evento", () => {
    const html = com();
    expect(html).toMatch(/<table/);
    expect(html).toMatch(/<caption[^>]*>[^<]*situações/i);
    expect([...html.matchAll(/<th[^>]*scope="col"/g)]).toHaveLength(3);
    expect(html).toContain("20/10/2026 08:00");
    expect(html).toContain("12/10/2026 10:00");
  });

  it("a data de cada linha é o cabeçalho da linha (th scope=row)", () => {
    const html = com();
    expect([...html.matchAll(/<th[^>]*scope="row"/g)]).toHaveLength(2);
  });

  it("mostra a situação e a duração de cada faixa, na ordem recebida", () => {
    const html = com();
    expect(html.indexOf("Em trânsito carregado")).toBeLessThan(
      html.indexOf("Disponível no Operacional"),
    );
    expect(html).toContain("10 dias e 4 h");
    expect(html).toContain("7 dias e 22 h");
  });

  it("sem eventos, convida a agir em vez de mostrar tabela vazia", () => {
    const html = com([]);
    expect(html).not.toMatch(/<table/);
    expect(html).toContain("Ainda não há situações registradas");
  });

  it("a tabela rola por dentro em telas estreitas, sem rolagem lateral da página", () => {
    expect(com()).toMatch(/overflow-x-auto/);
  });
});
