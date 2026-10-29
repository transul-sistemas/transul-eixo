import { expect, test } from "@playwright/test";

test.describe("raiz do sistema", () => {
  test("a raiz leva para Início › Tarefas", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/inicio\/tarefas$/);
    await expect(page.getByRole("heading", { level: 1, name: "Tarefas" })).toBeVisible();
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
