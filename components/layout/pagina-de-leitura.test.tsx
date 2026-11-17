import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaginaDeLeitura } from "./pagina-de-leitura";

// O "Exportar CSV" mora nas ações do título, não na linha da barra de consulta: ali ele roubava largura
// da barra (a faixa "Para receber" some abaixo de 31rem e os filtros rápidos rolavam para o lado em 1366).

const pagina = (acoes?: React.ReactNode) =>
  renderToStaticMarkup(
    <PaginaDeLeitura
      titulo="Placas"
      acoes={acoes}
      consulta={<div data-consulta="" />}
      exportar="/exportar/frota.placas"
    >
      <p>conteúdo</p>
    </PaginaDeLeitura>,
  );

const grupoDeAcoes = (html: string) => {
  const inicio = html.indexOf('aria-label="Ações"');
  expect(inicio, "sem o grupo Ações").toBeGreaterThan(-1);
  return html.slice(inicio, html.indexOf("</div>", inicio));
};

describe("<PaginaDeLeitura> com exportar", () => {
  it("o botão fica no grupo Ações do título, depois das ações da tela", () => {
    const grupo = grupoDeAcoes(pagina(<button type="button">Receber placa</button>));
    expect(grupo).toContain("Receber placa");
    expect(grupo).toContain("data-exportar-csv");
    expect(grupo.indexOf("Receber placa")).toBeLessThan(grupo.indexOf("data-exportar-csv"));
  });

  it("sem ações da tela, o grupo Ações existe só com o exportar", () => {
    expect(grupoDeAcoes(pagina())).toContain("data-exportar-csv");
  });

  it("a barra de consulta não divide a linha com o botão (ocupa a largura toda)", () => {
    const html = pagina();
    const consulta = html.indexOf("data-consulta");
    const exportar = html.indexOf("data-exportar-csv");
    expect(exportar).toBeLessThan(consulta);
  });
});
