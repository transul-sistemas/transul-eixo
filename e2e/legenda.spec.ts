import { expect, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// A5: a legenda sai da régua. Abre pelo botão "Legenda" do Acompanhamento, acha uma sigla pela busca,
// mostra o nome ao focar e não rola de lado em 1366, 1092, 820 e 390.

const TELAS = [
  { nome: "1366", largura: 1366, altura: 768 },
  { nome: "1092", largura: 1092, altura: 614 },
  { nome: "820", largura: 820, altura: 1180 },
  { nome: "390", largura: 390, altura: 844 },
];

test.describe("legenda e siglas", () => {
  test("abre pelo botão Legenda e acha uma sigla pela busca", async ({ page }) => {
    await abrirHidratada(page, "/frota/acompanhamento");
    await page.getByRole("link", { name: "Legenda", exact: true }).click();
    await expect(page).toHaveURL(/\/frota\/acompanhamento\/legenda$/);
    await expect(page.getByRole("heading", { level: 1, name: "Legenda e siglas" })).toBeVisible();
    // as 25 siglas da régua estão na tela
    await expect(page.locator("[data-sigla-da-legenda]")).toHaveCount(25);

    await page.getByLabel("Buscar sigla ou palavra").fill("folga");
    await expect(page.locator("[data-sigla-da-legenda]")).toHaveCount(1);
    await expect(page.locator('[data-sigla-da-legenda="FOg"]')).toBeVisible();
    await expect(page).toHaveURL(/busca=folga/);

    await page.getByLabel("Buscar sigla ou palavra").fill("xyz");
    await expect(page.getByTestId("legenda-vazia")).toContainText("Nenhuma sigla ou palavra");
    await page.getByRole("button", { name: "Limpar a busca" }).click();
    await expect(page.locator("[data-sigla-da-legenda]")).toHaveCount(25);
  });

  test("o nome da sigla aparece no balão ao focar e ao tocar", async ({ page }) => {
    await abrirHidratada(page, "/frota/acompanhamento/legenda");
    const sigla = page.getByRole("button", { name: "ACe: Aguardando carregamento" });
    await sigla.focus();
    await expect(page.getByRole("tooltip")).toContainText("Aguardando carregamento");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await sigla.click();
    await expect(page.getByRole("tooltip")).toBeVisible();
  });

  test("a barra de busca e o botão de imprimir existem", async ({ page }) => {
    await abrirHidratada(page, "/frota/acompanhamento/legenda");
    await expect(page.getByRole("button", { name: "Imprimir ou salvar em PDF" })).toBeVisible();
    await expect(page.getByText("Tons de verde")).toBeVisible();
  });

  for (const tela of TELAS) {
    test(`sem rolagem lateral em ${tela.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: tela.largura, height: tela.altura });
      await abrirHidratada(page, "/frota/acompanhamento/legenda");
      await expect(page.locator("[data-sigla-da-legenda]")).toHaveCount(25);
      const m = await page.evaluate(() => {
        const raiz = document.scrollingElement as Element;
        return { conteudo: raiz.scrollWidth, janela: raiz.clientWidth };
      });
      expect(m.conteudo).toBeLessThanOrEqual(m.janela);
    });
  }
});
