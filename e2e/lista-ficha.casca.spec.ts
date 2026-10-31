import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// A lista leva à ficha no tablet (820 px) e no celular (390 px): a placa é um link de verdade, o olho
// espia, voltar da ficha devolve a lista ao mesmo ponto e a página não ganha rolagem lateral.

const LISTA = "/frota/placas";
const CONSULTA = "?chip=em-atividade&ordem=-gestor&pagina=2";

const caixa = (page: Page) => page.locator('[role="region"][aria-label*="rolável"]');
const linhas = (page: Page) => page.locator('table[aria-label="Placas"] tbody tr');
const linkDaFicha = (page: Page, placa: string) =>
  page.getByRole("link", { name: `Abrir ficha de ${placa}`, exact: true });

test.describe("lista de placas e ficha em tablet e celular", () => {
  test("a placa é um link para a ficha (th scope=row) e o botão Espiar fica ao lado, com alvo de 24 px", async ({
    page,
  }) => {
    await abrirHidratada(page, LISTA);
    const primeira = linhas(page).first();
    const placa = (await primeira
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa"))!;
    await expect(primeira.locator('th[scope="row"]')).toHaveCount(1);
    const link = await linkDaFicha(page, placa).boundingBox();
    const olho = await page
      .getByRole("button", { name: `Espiar ${placa}`, exact: true })
      .boundingBox();
    expect(link?.height ?? 0).toBeGreaterThanOrEqual(24);
    expect(olho?.width ?? 0).toBeGreaterThanOrEqual(24);
    expect(olho?.height ?? 0).toBeGreaterThanOrEqual(24);
    const m = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(m.pagina).toBeLessThanOrEqual(m.janela);
  });

  test("tocar na placa abre a ficha; Voltar devolve a mesma página, a ordem, os filtros e o foco na placa", async ({
    page,
  }) => {
    await abrirHidratada(page, `${LISTA}${CONSULTA}`);
    await expect(page.getByTestId("resumo-da-pagina")).toContainText("Mostrando 26–");
    const placa = (await linhas(page)
      .nth(2)
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa"))!;
    await linkDaFicha(page, placa).tap();
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/frota\/placas\?chip=em-atividade&ordem=-gestor&pagina=2/);
    await expect(page.getByTestId("resumo-da-pagina")).toContainText("Mostrando 26–");
    await expect(linkDaFicha(page, placa)).toBeFocused();
  });

  test("o Voltar à lista da ficha também devolve ao mesmo ponto", async ({ page }) => {
    await abrirHidratada(page, `${LISTA}${CONSULTA}`);
    const placa = (await linhas(page)
      .nth(3)
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa"))!;
    await linkDaFicha(page, placa).tap();
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await page.getByRole("link", { name: "Voltar à lista" }).tap();
    await expect(page).toHaveURL(/\/frota\/placas\?chip=em-atividade&ordem=-gestor&pagina=2/);
    await expect(linkDaFicha(page, placa)).toBeFocused();
    expect(await caixa(page).count()).toBe(1);
  });

  test("o botão Espiar abre o painel (folha de baixo no celular) sem sair da lista", async ({
    page,
  }) => {
    await abrirHidratada(page, LISTA);
    const placa = (await linhas(page)
      .first()
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa"))!;
    await page.getByRole("button", { name: `Espiar ${placa}`, exact: true }).tap();
    await expect(page.getByRole("dialog", { name: `Resumo da placa ${placa}` })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
  });
});
