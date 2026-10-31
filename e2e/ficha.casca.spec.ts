import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// A ficha no tablet (820 px) e no celular (390 px): sem rolagem lateral da página, abas que rolam
// por dentro da própria faixa, faixa colorida e legenda à vista, alvos de toque de 24 px ou mais.

const aba = (page: Page, nome: string) => page.getByRole("tab", { name: nome, exact: true });

async function abrirFicha(page: Page, consulta = "") {
  await abrirHidratada(page, `/frota/placas/AAA0A00${consulta}`);
  await expect(page.getByRole("heading", { level: 1, name: "AAA0A00" })).toBeVisible();
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="tab"]');
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
  });
}

test.describe("ficha da placa em tablet e celular", () => {
  test("a página não rola na horizontal e o cabeçalho, a faixa e a legenda aparecem", async ({
    page,
  }) => {
    await abrirFicha(page);
    const m = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(m.pagina).toBeLessThanOrEqual(m.janela);
    await expect(page.getByRole("link", { name: "Voltar à lista" })).toBeVisible();
    await expect(page.getByRole("img", { name: /^Linha do tempo de AAA0A00/ })).toBeVisible();
    await expect(page.locator("[data-legenda]")).toBeVisible();
  });

  test("as seis abas rolam dentro da faixa; tocar na última a deixa selecionada e à vista", async ({
    page,
  }) => {
    await abrirFicha(page);
    const lista = page.getByRole("tablist", { name: "Seções da ficha" });
    const folga = await lista.evaluate((el) => el.scrollWidth - el.clientWidth);
    if (folga > 0) {
      // Celular: a lista é mais larga que a tela e rola por dentro (a página não).
      expect(await lista.evaluate((el) => getComputedStyle(el).overflowX)).toMatch(/auto|scroll/);
    }
    await aba(page, "Mapa mental").tap();
    await expect(aba(page, "Mapa mental")).toHaveAttribute("aria-selected", "true");
    await expect(aba(page, "Mapa mental")).toBeInViewport();
    await expect(page).toHaveURL(/aba=mapa-mental/);
    const m = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(m.pagina).toBeLessThanOrEqual(m.janela);
  });

  test("as abas têm alvo de toque de pelo menos 24 px", async ({ page }) => {
    await abrirFicha(page);
    for (const nome of ["Resumo", "Linha do tempo", "Documentos"]) {
      const caixa = await aba(page, nome).boundingBox();
      expect(caixa?.height ?? 0, nome).toBeGreaterThanOrEqual(24);
      expect(caixa?.width ?? 0, nome).toBeGreaterThanOrEqual(24);
    }
  });

  test("a aba Linha do tempo cabe na tela: a tabela rola por dentro, não a página", async ({
    page,
  }) => {
    await abrirFicha(page, "?aba=linha-do-tempo");
    await expect(
      page.getByRole("tabpanel").and(page.locator(":not([hidden])")).getByRole("table"),
    ).toBeVisible();
    const m = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(m.pagina).toBeLessThanOrEqual(m.janela);
  });

  test("'Placa não encontrada' cabe na tela e o caminho de volta aparece", async ({ page }) => {
    await page.goto("/frota/placas/ZZZ9Z99");
    await expect(
      page.getByRole("heading", { level: 1, name: "Placa não encontrada" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para a lista de placas" })).toBeInViewport();
  });
});
