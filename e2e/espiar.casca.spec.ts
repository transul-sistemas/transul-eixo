import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// O painel de espiar em tablet (820 px) e celular (390 px): lateral de 420 px no tablet, folha de
// baixo no celular, aberto por toque e fechado por Esc, Voltar, botão ou arrastar para baixo.

const ROTA = "/frota/placas";
const tabela = (page: Page) => page.getByRole("table", { name: "Placas" });
const linhas = (page: Page) => tabela(page).locator("tbody tr");
const botaoEspiar = (page: Page, placa: string) =>
  page.getByRole("button", { name: `Espiar ${placa}`, exact: true });
const painel = (page: Page, placa: string) =>
  page.getByRole("dialog", { name: `Resumo da placa ${placa}` });
const qualquerPainel = (page: Page) => page.getByRole("dialog", { name: /^Resumo da placa/ });

async function arrastar(page: Page, de: { x: number; y: number }, para: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [de] });
  const passos = 8;
  for (let i = 1; i <= passos; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: de.x + ((para.x - de.x) * i) / passos, y: de.y + ((para.y - de.y) * i) / passos },
      ],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function abrirPorToque(page: Page) {
  await abrirHidratada(page, ROTA);
  const placa = await linhas(page)
    .first()
    .locator("[data-espiar-placa]")
    .getAttribute("data-espiar-placa");
  await linhas(page).first().locator("td").nth(1).tap();
  await expect(painel(page, placa as string)).toBeVisible();
  return placa as string;
}

test.describe("painel de espiar em tablet e celular", () => {
  test("tocar na linha abre o painel, nomeado pela placa", async ({ page }) => {
    const placa = await abrirPorToque(page);
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
  });

  test("no tablet o painel fica à direita com 420 px; no celular é a folha de baixo", async ({
    page,
  }, info) => {
    const placa = await abrirPorToque(page);
    await page.waitForTimeout(600); // fim da animação
    const caixa = await painel(page, placa).boundingBox();
    const janela = page.viewportSize() as { width: number; height: number };
    expect(caixa).not.toBeNull();
    if (info.project.name === "tablet-820") {
      expect(Math.abs((caixa?.width ?? 0) - 420)).toBeLessThanOrEqual(2);
      expect(Math.abs((caixa?.x ?? 0) + (caixa?.width ?? 0) - janela.width)).toBeLessThanOrEqual(2);
      expect(Math.abs((caixa?.height ?? 0) - janela.height)).toBeLessThanOrEqual(2);
    } else {
      expect(Math.abs((caixa?.width ?? 0) - janela.width)).toBeLessThanOrEqual(2);
      expect(Math.abs((caixa?.y ?? 0) + (caixa?.height ?? 0) - janela.height)).toBeLessThanOrEqual(
        2,
      );
      expect(caixa?.height ?? 999).toBeLessThanOrEqual(janela.height * 0.85 + 1);
    }
  });

  test("o botão Fechar painel tem alvo de toque de pelo menos 40 px", async ({ page }) => {
    const placa = await abrirPorToque(page);
    const caixa = await painel(page, placa)
      .getByRole("button", { name: "Fechar painel" })
      .boundingBox();
    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(40);
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(40);
  });

  test("Esc fecha e o foco volta ao botão Espiar da linha", async ({ page }) => {
    const placa = await abrirPorToque(page);
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(botaoEspiar(page, placa)).toBeFocused();
  });

  test("Voltar do navegador fecha o painel", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.goto(ROTA);
    await abrirHidratada(page, ROTA);
    const placa = await linhas(page)
      .first()
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa");
    await linhas(page).first().locator("td").nth(1).tap();
    await expect(painel(page, placa as string)).toBeVisible();
    await expect(page).toHaveURL(/espiar=/); // o painel abre na hora; a URL confirma depois
    await page.goBack();
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/frota\/placas$/);
  });

  test("a página não rola na horizontal com o painel aberto", async ({ page }) => {
    await abrirPorToque(page);
    const m = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(m.pagina).toBeLessThanOrEqual(m.janela);
  });

  test("o corpo do painel rola por dentro e o cabeçalho fica à vista", async ({ page }) => {
    const placa = await abrirPorToque(page);
    const corpo = painel(page, placa).locator("[data-painel-corpo]");
    expect(await corpo.evaluate((e) => getComputedStyle(e).overflowY)).toMatch(/auto|scroll/);
    await expect(painel(page, placa).getByRole("heading", { name: placa })).toBeInViewport();
  });

  test("em janela baixa (celular na horizontal) o painel cabe e o cabeçalho continua à vista", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular-390", "só o celular gira");
    await page.setViewportSize({ width: 844, height: 390 });
    const placa = await abrirPorToque(page);
    await page.waitForTimeout(600);
    const caixa = await painel(page, placa).boundingBox();
    // Com 844 px de largura o painel é o lateral, na altura toda da janela (a folha de baixo é só até 639 px).
    expect(caixa?.height ?? 999).toBeLessThanOrEqual(390);
    await expect(painel(page, placa).getByRole("heading", { name: placa })).toBeInViewport();
    await expect(
      painel(page, placa).getByRole("button", { name: "Fechar painel" }),
    ).toBeInViewport();
  });

  test("no celular, arrastar a folha para baixo fecha; arrastar para cima não fecha", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular-390", "a folha de baixo é do celular");
    const placa = await abrirPorToque(page);
    await page.waitForTimeout(600);
    const caixa = (await painel(page, placa).boundingBox()) as {
      x: number;
      y: number;
      width: number;
    };
    const x = caixa.x + caixa.width / 2;
    const y = caixa.y + 24;
    await arrastar(page, { x, y }, { x, y: y - 120 });
    await page.waitForTimeout(500);
    await expect(painel(page, placa)).toBeVisible();
    await arrastar(page, { x, y }, { x, y: y + 400 });
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page).not.toHaveURL(/espiar=/);
    await expect(botaoEspiar(page, placa)).toBeFocused();
  });
});
