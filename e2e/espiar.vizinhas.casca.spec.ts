import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// Anterior e próxima no tablet e no celular: aparecem inteiros, ao alcance do toque.

const qualquerPainel = (page: Page) => page.getByRole("dialog", { name: /^Resumo da placa/ });

test.describe("placa anterior e próxima em tablet e celular", () => {
  test("os botões e a posição ficam à vista e a troca funciona por toque", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas?espiar=AAA0A01");
    const painel = qualquerPainel(page);
    await expect(painel).toContainText("2 de 20");
    const anterior = painel.getByRole("button", { name: "Placa anterior" });
    const proxima = painel.getByRole("button", { name: "Próxima placa" });
    await expect(anterior).toBeInViewport();
    await expect(proxima).toBeInViewport();
    for (const b of [anterior, proxima]) {
      const caixa = await b.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(24);
      expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(24);
    }
    await proxima.tap();
    await expect(page).toHaveURL(/espiar=AAA0A02/);
    await expect(painel).toContainText("3 de 20");
    const m = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(m.pagina).toBeLessThanOrEqual(m.janela);
  });
});
