import { expect, test } from "@playwright/test";
import { formatarInteiro } from "../components/formato/numero";
import { comBanco } from "../e2e/apoio/usuarios-de-teste";

// Frota › Análise (primeira versão), o caminho principal no modo banco: a tela abre com as quatro
// camadas, o KPI de placas bate com a conta do banco (nucleo.analise_da_frota), trocar o
// agrupamento fica na URL e a tabela por grupo traz a linha de total. Dados: `pnpm db:dev-dados`.

test.describe("Análise da Frota (Administrador)", () => {
  test("abre com as camadas, a disponibilidade do banco e o agrupamento na URL", async ({
    page,
  }) => {
    await page.goto("/frota/analise");
    await expect(page.getByRole("heading", { level: 1, name: "Análise" })).toBeVisible();
    for (const camada of [
      "1. Retrato de agora",
      "2. Disponibilidade no mês",
      "3. Onde está a diferença",
      "4. Custo e consumo",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: camada })).toBeVisible();
    }
    await expect(page.getByTestId("camada-proxima-versao")).toBeVisible();

    // O total de placas agora vem do banco (a mesma conta, direto no banco local, só para conferir).
    const total = await comBanco(async (banco) => {
      const { rows } = await banco.query<{ total: string }>(
        `select count(*)::text as total from nucleo.leitura_da_placa where baixada_em is null`,
      );
      return Number(rows[0]?.total ?? 0);
    });
    const kpis = page.getByRole("list", { name: "Indicadores" });
    expect(total).toBeGreaterThan(0);
    await expect(
      kpis.getByRole("listitem").filter({ hasText: "Placas na frota agora" }),
    ).toContainText(formatarInteiro(total));

    const porGrupo = page.getByTestId("tabela-por-grupo");
    await expect(porGrupo).toBeVisible();
    await expect(porGrupo.locator("tfoot")).toContainText("Total");

    await page
      .getByRole("navigation", { name: "Agrupar por" })
      .getByRole("link", { name: "Gestor" })
      .click();
    await expect(page).toHaveURL(/por=gestor/);
    await expect(porGrupo.locator("thead")).toContainText("Gestor");
  });
});
