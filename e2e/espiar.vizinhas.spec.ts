import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

const ROTA = "/frota/placas";

const painelDe = (page: Page, placa: string) =>
  page.getByRole("dialog", { name: `Resumo da placa ${placa}` });
const qualquerPainel = (page: Page) => page.getByRole("dialog", { name: /^Resumo da placa/ });
const botaoEspiar = (page: Page, placa: string) =>
  page.getByRole("button", { name: `Espiar ${placa}`, exact: true });
const caixaDaTabela = (page: Page) => page.locator('[role="region"][aria-label*="rolável"]');
const anterior = (page: Page) =>
  qualquerPainel(page).getByRole("button", { name: "Placa anterior" });
const proxima = (page: Page) => qualquerPainel(page).getByRole("button", { name: "Próxima placa" });

/** As placas da página atual, na ordem das linhas (lidas do DOM, que fica inerte com o painel aberto). */
const placasDaPagina = (page: Page) =>
  page
    .locator("table[aria-label='Placas'] [data-espiar-placa]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-espiar-placa") as string));

test.describe("placa anterior e próxima: só dentro da página atual", () => {
  test("mostra '1 de N', anda com replace e mantém filtros, ordem e página", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?chip=em-atividade&ordem=-gestor`);
    const placas = await placasDaPagina(page);
    await botaoEspiar(page, placas[0]!).click();
    await expect(painelDe(page, placas[0]!)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${placas[0]}`));
    await expect(qualquerPainel(page)).toContainText(`1 de ${placas.length}`);
    await expect(anterior(page)).toHaveAttribute("aria-disabled", "true");

    const historico = await page.evaluate(() => history.length);
    await proxima(page).click();
    await expect(painelDe(page, placas[1]!)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${placas[1]}`));
    await expect(qualquerPainel(page)).toContainText(`2 de ${placas.length}`);
    expect(await page.evaluate(() => history.length)).toBe(historico);
    const url = new URL(page.url());
    expect(url.searchParams.get("chip")).toBe("em-atividade");
    expect(url.searchParams.get("ordem")).toBe("-gestor");

    await anterior(page).click();
    await expect(painelDe(page, placas[0]!)).toBeVisible();
    await expect(qualquerPainel(page)).toContainText(`1 de ${placas.length}`);
  });

  test("na última linha da página a próxima fica desligada e não passa para a página seguinte", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    const placas = await placasDaPagina(page);
    const ultima = placas.at(-1)!;
    await botaoEspiar(page, ultima).click();
    await expect(painelDe(page, ultima)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${ultima}`)); // a URL confirma depois do painel
    await expect(qualquerPainel(page)).toContainText(`${placas.length} de ${placas.length}`);
    await expect(proxima(page)).toHaveAttribute("aria-disabled", "true");
    await expect(proxima(page)).toBeInViewport({ ratio: 1 }); // espera a animação de entrada
    await proxima(page).click({ force: true }); // o Playwright trata aria-disabled como desligado
    await expect(painelDe(page, ultima)).toBeVisible();
    expect(new URL(page.url()).searchParams.get("espiar")).toBe(ultima);
    expect(new URL(page.url()).searchParams.get("pagina")).toBeNull();
  });

  test("na primeira linha da página 2 a anterior fica desligada: não volta para a página 1", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?pagina=2`);
    const placas = await placasDaPagina(page);
    await botaoEspiar(page, placas[0]!).click();
    await expect(painelDe(page, placas[0]!)).toBeVisible();
    await expect(anterior(page)).toHaveAttribute("aria-disabled", "true");
    await expect(proxima(page)).not.toHaveAttribute("aria-disabled", "true");
    expect(new URL(page.url()).searchParams.get("pagina")).toBe("2");
  });

  test("placa que não está na página: os dois botões desligados e o texto diz por quê", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?pagina=2&espiar=AAA0A00`);
    await expect(painelDe(page, "AAA0A00")).toBeVisible();
    await expect(qualquerPainel(page)).toContainText("Fora desta página");
    await expect(anterior(page)).toHaveAttribute("aria-disabled", "true");
    await expect(proxima(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("a troca é anunciada ao leitor de tela, e o foco fica no botão acionado", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    const placas = await placasDaPagina(page);
    await botaoEspiar(page, placas[2]!).click();
    await expect(painelDe(page, placas[2]!)).toBeVisible();
    const aviso = qualquerPainel(page).locator('[role="status"].sr-only');
    await expect(aviso).toHaveText("");
    await proxima(page).focus();
    await page.keyboard.press("Enter");
    await expect(painelDe(page, placas[3]!)).toBeVisible();
    await expect(aviso).toHaveText(`Placa ${placas[3]}, 4 de ${placas.length}`);
    await expect(proxima(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(aviso).toHaveText(`Placa ${placas[4]}, 5 de ${placas.length}`);
  });

  test("fechar devolve o foco à linha da última placa vista, sem mexer na rolagem lateral", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    const placas = await placasDaPagina(page);
    await botaoEspiar(page, placas[0]!).click();
    await expect(painelDe(page, placas[0]!)).toBeVisible();
    const andar = 14;
    for (let i = 1; i <= andar; i++) {
      await proxima(page).click();
      await expect(painelDe(page, placas[i]!)).toBeVisible();
    }
    const esquerdaAntes = await caixaDaTabela(page).evaluate((c) => c.scrollLeft);
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    const destino = botaoEspiar(page, placas[andar]!);
    await expect(destino).toBeFocused();
    await expect(destino).toBeInViewport(); // a linha foi trazida para a área visível da tabela
    expect(await caixaDaTabela(page).evaluate((c) => c.scrollLeft)).toBe(esquerdaAntes);
    expect(new URL(page.url()).searchParams.has("espiar")).toBe(false);
  });

  test("abrir e andar: um passo de Voltar desfaz o painel e não sai da lista", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const placas = await placasDaPagina(page);
    await botaoEspiar(page, placas[0]!).click();
    await expect(painelDe(page, placas[0]!)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${placas[0]}`)); // o push só vale depois da URL
    await proxima(page).click();
    await expect(painelDe(page, placas[1]!)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${placas[1]}`));
    await proxima(page).click();
    await expect(painelDe(page, placas[2]!)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${placas[2]}`));
    await page.goBack();
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/frota\/placas$/);
  });
});
