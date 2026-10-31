import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// Com o servidor lento, a URL de abrir o painel ainda está a caminho quando a pessoa troca de placa
// e fecha. Fechar nunca pode jogar para fora do sistema (Voltar desfaz um passo, nunca sai).

const LISTA = "/frota/placas";
const qualquerPainel = (page: Page) => page.getByRole("dialog", { name: /^Resumo da placa/ });
const proxima = (page: Page) => qualquerPainel(page).getByRole("button", { name: "Próxima placa" });

test("abrir, trocar e fechar com o servidor lento não sai do sistema", async ({ page }) => {
  await abrirHidratada(page, `${LISTA}?lento=1500`);
  const placa = (await page
    .locator("table[aria-label='Placas'] [data-espiar-placa]")
    .first()
    .getAttribute("data-espiar-placa"))!;
  await page.getByRole("button", { name: `Espiar ${placa}`, exact: true }).click();
  await expect(qualquerPainel(page)).toBeVisible();
  await proxima(page).click(); // a URL de abrir ainda não chegou
  await page.keyboard.press("Escape");
  await expect(qualquerPainel(page)).toBeHidden();
  // Deixa tudo assentar: as navegações pendentes terminam.
  await page.waitForTimeout(5_000);
  expect(new URL(page.url()).pathname).toBe(LISTA);
  expect(page.url()).not.toContain("espiar=");
  await expect(page.locator("table[aria-label='Placas']")).toBeVisible();
});

test("o mesmo, trocando várias vezes antes de fechar", async ({ page }) => {
  await abrirHidratada(page, `${LISTA}?lento=1500`);
  const placa = (await page
    .locator("table[aria-label='Placas'] [data-espiar-placa]")
    .first()
    .getAttribute("data-espiar-placa"))!;
  await page.getByRole("button", { name: `Espiar ${placa}`, exact: true }).click();
  await expect(qualquerPainel(page)).toBeVisible();
  for (let i = 0; i < 3; i++) await proxima(page).click();
  await page.keyboard.press("Escape");
  await expect(qualquerPainel(page)).toBeHidden();
  await page.waitForTimeout(6_000);
  expect(new URL(page.url()).pathname).toBe(LISTA);
  expect(page.url()).not.toContain("espiar=");
  await expect(page.locator("table[aria-label='Placas']")).toBeVisible();
});
