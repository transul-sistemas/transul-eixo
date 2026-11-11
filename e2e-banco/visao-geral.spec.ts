import { expect, test } from "@playwright/test";
import { formatarMoeda } from "../components/formato/moeda-valor";
import { comBanco } from "../e2e/apoio/usuarios-de-teste";

// Resultados › Visão geral (primeira versão), o caminho principal no modo banco: o mês abre com os KPIs
// calculados pelo banco (nucleo.visao_geral_dos_resultados), a tabela por operação traz a linha de
// total e trocar o agrupamento fica na URL. Dados fictícios em janeiro de 2020, a primeira data dentro da
// faixa válida do resultado (a partir de 01/01/2020; antes dela a despesa fica fora e vai para a fila) e
// antes de qualquer dado real, num CR que o Eixo não conhece, gravados no staging e apagados no fim:
// receita 12.345,67; custo 2.345,67 → resultado 10.000,00 e margem 81,0%.

const ORIGEM = "e2e-visao-geral-";
const NUNOTA = -9_700_001;

async function limpar() {
  await comBanco(async (banco) => {
    await banco.query(`delete from staging.despesa where origem_id like $1`, [`${ORIGEM}%`]);
    await banco.query(`delete from staging.viagem where nunota = $1`, [NUNOTA]);
    await banco.query(`delete from staging.natureza where codnat = $1`, [`${ORIGEM}nat`]);
  });
}

test.describe("Visão geral de Resultados (Administrador)", () => {
  test.beforeAll(async () => {
    await limpar();
    await comBanco(async (banco) => {
      await banco.query(
        `insert into staging.natureza (codnat, descricao) values ($1, 'Natureza do e2e')`,
        [`${ORIGEM}nat`],
      );
      await banco.query(
        `insert into staging.viagem (nunota, tipo_documento, status_cte, dt_negociacao, codcencus, frete_empresa)
         values ($1, 'CTE', 'A', '2020-01-10', '1', 12345.67)`,
        [NUNOTA],
      );
      await banco.query(
        `insert into staging.despesa (origem_id, nufin, codcencus, codnat, dt_competencia, dtentsai, provisao, valor_liquido)
         values ($1, 'e2e', '1', $2, '2020-01-05', '2020-01-05', 'REAL', 2345.67)`,
        [`${ORIGEM}1`, `${ORIGEM}nat`],
      );
    });
  });
  test.afterAll(limpar);

  test("o mês mostra receita, custo, resultado e margem do banco, com o total por operação", async ({
    page,
  }) => {
    await page.goto("/resultados/visao-geral?periodo=2020-01");
    await expect(page.getByRole("heading", { level: 1, name: "Visão geral" })).toBeVisible();

    const kpis = page.getByRole("list", { name: "Indicadores" });
    await expect(kpis.getByRole("listitem").filter({ hasText: /^Receita de/ })).toContainText(
      formatarMoeda(1234567),
    );
    await expect(kpis.getByRole("listitem").filter({ hasText: /^Custo/ })).toContainText(
      formatarMoeda(234567),
    );
    await expect(kpis.getByRole("listitem").filter({ hasText: /^Resultado/ })).toContainText(
      formatarMoeda(1000000),
    );
    await expect(kpis.getByRole("listitem").filter({ hasText: /^Margem/ })).toContainText("81,0%");

    await expect(page.getByRole("heading", { level: 2, name: "Resultado por mês" })).toBeVisible();
    const porGrupo = page.getByTestId("tabela-por-grupo");
    await expect(porGrupo.locator("tbody")).toContainText("Sem operação");
    await expect(porGrupo.locator("tfoot")).toContainText("Total");
    await expect(porGrupo.locator("tfoot")).toContainText(formatarMoeda(1000000));
    await expect(page.getByTestId("tabela-por-natureza")).toContainText("Natureza do e2e");

    await page
      .getByRole("navigation", { name: "Agrupar por" })
      .getByRole("link", { name: "Unidade" })
      .click();
    await expect(page).toHaveURL(/periodo=2020-01.*por=unidade/);
    await expect(porGrupo.locator("tbody")).toContainText("Sem unidade");
  });
});
