import { expect, test } from "@playwright/test";

test.describe("fontes do Eixo", () => {
  test("o texto da página usa Barlow, já carregada", async ({ page }) => {
    await page.goto("/");
    const familia = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(familia).toContain("Barlow");
    await page.evaluate(() => document.fonts.ready);
    const carregada = await page.evaluate(() =>
      [...document.fonts].some((f) => f.family.includes("Barlow") && f.status === "loaded"),
    );
    expect(carregada).toBe(true);
  });

  test("a fonte das placas (Barlow Semi Condensed) está disponível", async ({ page }) => {
    await page.goto("/");
    const variavel = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--font-placa"),
    );
    expect(variavel).toContain("BarlowSemiCondensed");
  });
});
