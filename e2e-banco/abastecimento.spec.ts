import { expect, test } from "@playwright/test";
import { comBanco } from "../e2e/apoio/usuarios-de-teste";

// Frota › Abastecimento (primeira versão), o caminho principal no modo banco: o mês abre com os KPIs
// somados pelo banco e a placa na tabela. Dados fictícios: dois abastecimentos do primeiro cavalo do
// gerador (DAA1A00, `pnpm db:dev-dados`) em janeiro de 2020, gravados no staging e apagados no fim.
// 100→400 km com 100 l e 400→700 km com 50 l: 600 km / 150 l = 4,00 km/l.

const ORIGEM = "e2e-abastecimento-";

async function limpar() {
  await comBanco((banco) =>
    banco.query(`delete from staging.abastecimento where origem_id like $1`, [`${ORIGEM}%`]),
  );
}

test.describe("Abastecimento (Administrador)", () => {
  test.beforeAll(async () => {
    await limpar();
    await comBanco((banco) =>
      banco.query(
        `insert into staging.abastecimento (origem_id, placa, data, km_inicial, km_final, litros, valor_total)
         values ($1, 'DAA1A00', '2020-01-10', 100, 400, 100, 600.00),
                ($2, 'DAA1A00', '2020-01-20', 400, 700, 50, 300.00)`,
        [`${ORIGEM}1`, `${ORIGEM}2`],
      ),
    );
  });
  test.afterAll(limpar);

  test("o mês mostra litros, km e km/l da placa, somados pelo banco", async ({ page }) => {
    await page.goto("/frota/abastecimento?mes=2020-01&q=DAA1A00");
    await expect(page.getByRole("heading", { level: 1, name: "Abastecimento" })).toBeVisible();

    const indicadores = page.getByRole("list", { name: "Indicadores" });
    await expect(indicadores).toContainText("150,00 L");
    await expect(indicadores).toContainText("600 km");
    await expect(indicadores).toContainText("4,00 km/l");

    const tabela = page.getByRole("table", { name: "Abastecimento por placa" });
    const linha = tabela
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: "Abrir a ficha da placa DAA1A00" }) });
    await expect(linha).toHaveCount(1);
    await expect(linha).toContainText("4,00 km/l");
    await expect(page.getByRole("link", { name: "01/2020" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
