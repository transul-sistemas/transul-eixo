import { expect, test } from "@playwright/test";

test.describe("página inicial", () => {
  test("mostra o título TranSul Eixo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "TranSul Eixo" })).toBeVisible();
  });

  test("a aba do navegador se chama TranSul Eixo", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/TranSul Eixo/);
  });

  test("não tem rolagem horizontal na página", async ({ page }) => {
    await page.goto("/");
    const larguras = await page.evaluate(() => ({
      conteudo: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(larguras.conteudo).toBeLessThanOrEqual(larguras.janela);
  });
});
