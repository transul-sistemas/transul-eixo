import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// A lista leva à ficha pela placa (th scope=row com link), o botão Espiar continua, o clique na linha
// continua abrindo o painel, e voltar da ficha devolve a lista no mesmo ponto: página, ordem, filtros,
// rolagem da tabela e a linha (armadilha 2 e "Qualidade de interação").

const LISTA = "/frota/placas";
const CONSULTA = "?chip=em-atividade&ordem=-gestor&pagina=2";
const TODAS_AS_COLUNAS = [
  "placa",
  "tipo",
  "modelo",
  "conjunto",
  "gestor",
  "operacao",
  "situacao",
  "alertas",
  "motorista",
  "filial",
  "dias",
  "km",
  "cr",
  "fipe",
];

const caixa = (page: Page) => page.locator('[role="region"][aria-label*="rolável"]');
const linhas = (page: Page) => page.locator('table[aria-label="Placas"] tbody tr');
const linkDaFicha = (page: Page, placa: string) =>
  page.getByRole("link", { name: `Abrir ficha de ${placa}`, exact: true });
const botaoEspiar = (page: Page, placa: string) =>
  page.getByRole("button", { name: `Espiar ${placa}`, exact: true });
const painel = (page: Page, placa: string) =>
  page.getByRole("dialog", { name: `Resumo da placa ${placa}` });

/**
 * Clica com o mouse no centro do link, como uma pessoa. O `click()` do Playwright rola a caixa da
 * tabela até o alvo antes de clicar e mudaria a rolagem que se quer guardar.
 */
async function clicarComOMouse(page: Page, alvo: ReturnType<Page["locator"]>) {
  const caixaDoAlvo = await alvo.boundingBox();
  expect(caixaDoAlvo).not.toBeNull();
  await page.mouse.click(
    (caixaDoAlvo?.x ?? 0) + (caixaDoAlvo?.width ?? 0) / 2,
    (caixaDoAlvo?.y ?? 0) + (caixaDoAlvo?.height ?? 0) / 2,
  );
}

async function listaRolada(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([
    {
      name: "eixo-tabela-placas",
      value: encodeURIComponent(JSON.stringify({ colunas: TODAS_AS_COLUNAS })),
      url: baseURL ?? "http://localhost:3000",
    },
  ]);
  await abrirHidratada(page, `${LISTA}${CONSULTA}`);
  await expect(page.getByTestId("resumo-da-pagina")).toContainText("Mostrando 26–");
  await caixa(page).evaluate((c) => {
    c.scrollTop = 150;
    c.scrollLeft = 220;
  });
  const placa = await linhas(page)
    .nth(4)
    .locator("[data-espiar-placa]")
    .getAttribute("data-espiar-placa");
  const rolagem = await caixa(page).evaluate((c) => ({
    topo: c.scrollTop,
    esquerda: c.scrollLeft,
  }));
  expect(rolagem.topo).toBeGreaterThan(0);
  expect(rolagem.esquerda).toBeGreaterThan(0);
  return { placa: placa as string, rolagem };
}

async function conferirRetorno(
  page: Page,
  placa: string,
  rolagem: { topo: number; esquerda: number },
) {
  await expect(page).toHaveURL(
    new RegExp(`/frota/placas\\?chip=em-atividade&ordem=-gestor&pagina=2`),
  );
  await expect(page.getByTestId("resumo-da-pagina")).toContainText("Mostrando 26–");
  await expect
    .poll(async () => caixa(page).evaluate((c) => Math.round(c.scrollTop)), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(Math.round(rolagem.topo) - 2);
  const depois = await caixa(page).evaluate((c) => ({ topo: c.scrollTop, esquerda: c.scrollLeft }));
  expect(Math.abs(depois.topo - rolagem.topo)).toBeLessThanOrEqual(2);
  expect(Math.abs(depois.esquerda - rolagem.esquerda)).toBeLessThanOrEqual(2);
  await expect(linkDaFicha(page, placa)).toBeFocused();
  await expect(linkDaFicha(page, placa)).toBeInViewport();
}

test.describe("lista de placas: a placa leva à ficha, o olho espia, a linha abre o painel", () => {
  test("a primeira coluna é th scope=row, com o link da ficha e o botão Espiar ao lado", async ({
    page,
  }) => {
    await abrirHidratada(page, LISTA);
    const primeira = linhas(page).first();
    await expect(primeira.locator('th[scope="row"]')).toHaveCount(1);
    const placa = (await primeira
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa"))!;
    const celula = primeira.locator('th[scope="row"]');
    await expect(celula.getByRole("link", { name: `Abrir ficha de ${placa}` })).toHaveAttribute(
      "href",
      new RegExp(`/frota/placas/${placa}`),
    );
    await expect(celula.getByRole("button", { name: `Espiar ${placa}` })).toBeVisible();
    // Só a primeira coluna é cabeçalho de linha.
    expect(await primeira.locator("td").count()).toBeGreaterThan(3);
  });

  test("a placa fica fixa à esquerda e o cabeçalho continua fixo no alto (rolagem dentro da tabela)", async ({
    page,
    baseURL,
  }) => {
    await listaRolada(page, baseURL);
    const th = linhas(page).first().locator('th[scope="row"]');
    const antes = await th.boundingBox();
    await caixa(page).evaluate((c) => (c.scrollLeft = 400));
    const depois = await th.boundingBox();
    expect(Math.abs((depois?.x ?? 0) - (antes?.x ?? 0))).toBeLessThanOrEqual(1);
  });

  test("clicar na placa vai à ficha e não abre o painel", async ({ page }) => {
    await abrirHidratada(page, LISTA);
    const placa = (await linhas(page)
      .first()
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa"))!;
    await linkDaFicha(page, placa).click();
    await expect(page).toHaveURL(new RegExp(`/frota/placas/${placa}`));
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("o botão Espiar abre o painel, e o clique no resto da linha também (o atalho continua)", async ({
    page,
  }) => {
    await abrirHidratada(page, LISTA);
    const primeira = linhas(page).first();
    const placa = (await primeira
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa"))!;
    await botaoEspiar(page, placa).click();
    await expect(painel(page, placa)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
    await page.keyboard.press("Escape");
    await expect(painel(page, placa)).toBeHidden();
    await primeira.locator("td").nth(1).click();
    await expect(painel(page, placa)).toBeVisible();
    await expect(page).not.toHaveURL(/\/frota\/placas\/AAA/);
  });

  test("teclado: o link da ficha vem primeiro, depois o botão Espiar", async ({ page }) => {
    await abrirHidratada(page, LISTA);
    const placa = (await linhas(page)
      .first()
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa"))!;
    await linkDaFicha(page, placa).focus();
    await page.keyboard.press("Tab");
    await expect(botaoEspiar(page, placa)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(painel(page, placa)).toBeVisible();
  });
});

test.describe("voltar da ficha devolve a lista ao mesmo ponto", () => {
  test("Voltar do navegador: mesma página, ordem, filtros, rolagem e o foco na placa", async ({
    page,
    baseURL,
  }) => {
    const { placa, rolagem } = await listaRolada(page, baseURL);
    await clicarComOMouse(page, linkDaFicha(page, placa));
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await page.goBack();
    await conferirRetorno(page, placa, rolagem);
  });

  test("o botão Voltar à lista da ficha leva ao mesmo ponto", async ({ page, baseURL }) => {
    const { placa, rolagem } = await listaRolada(page, baseURL);
    await clicarComOMouse(page, linkDaFicha(page, placa));
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await page.getByRole("link", { name: "Voltar à lista" }).click();
    await conferirRetorno(page, placa, rolagem);
  });

  test("a trilha (Placas) também leva ao mesmo ponto", async ({ page, baseURL }) => {
    const { placa, rolagem } = await listaRolada(page, baseURL);
    await clicarComOMouse(page, linkDaFicha(page, placa));
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Trilha" })
      .getByRole("link", { name: "Placas" })
      .click();
    await conferirRetorno(page, placa, rolagem);
  });

  test("do painel, 'Abrir ficha completa' e Voltar devolvem a lista com o painel aberto e a rolagem", async ({
    page,
    baseURL,
  }) => {
    const { placa, rolagem } = await listaRolada(page, baseURL);
    await clicarComOMouse(page, botaoEspiar(page, placa));
    await expect(painel(page, placa)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
    await painel(page, placa).getByRole("link", { name: "Abrir ficha completa" }).click();
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await page.goBack();
    await expect(painel(page, placa)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`pagina=2.*espiar=${placa}|espiar=${placa}.*pagina=2`));
    // A lista devolve a rolagem logo depois de reaparecer: espera isso antes de fechar o painel.
    await expect
      .poll(async () => caixa(page).evaluate((c) => Math.round(c.scrollTop)), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(Math.round(rolagem.topo) - 2);
    await page.keyboard.press("Escape");
    await expect(painel(page, placa)).toBeHidden();
    const depois = await caixa(page).evaluate((c) => ({
      topo: c.scrollTop,
      esquerda: c.scrollLeft,
    }));
    expect(Math.abs(depois.topo - rolagem.topo)).toBeLessThanOrEqual(2);
    expect(Math.abs(depois.esquerda - rolagem.esquerda)).toBeLessThanOrEqual(2);
  });

  test("a restauração é de uma vez só: recarregar a lista depois não rola de novo", async ({
    page,
    baseURL,
  }) => {
    const { placa, rolagem } = await listaRolada(page, baseURL);
    await clicarComOMouse(page, linkDaFicha(page, placa));
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await page.goBack();
    await conferirRetorno(page, placa, rolagem);
    await page.reload();
    await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
    await page.waitForTimeout(800);
    expect(await caixa(page).evaluate((c) => c.scrollTop)).toBe(0);
  });

  test("outra lista (outra página) não recebe a rolagem guardada", async ({ page, baseURL }) => {
    const { placa } = await listaRolada(page, baseURL);
    await clicarComOMouse(page, linkDaFicha(page, placa));
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await page.goto(`${LISTA}?chip=em-atividade&ordem=-gestor&pagina=3`);
    await expect(page.getByTestId("resumo-da-pagina")).toContainText("Mostrando 51–");
    await page.waitForTimeout(800);
    expect(await caixa(page).evaluate((c) => c.scrollTop)).toBe(0);
    const focada = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-ficha-placa"),
    );
    expect(focada).not.toBe(placa);
  });

  test("ficha aberta por link direto (sem lista atrás): Voltar à lista e a trilha levam à lista", async ({
    page,
  }) => {
    await abrirHidratada(page, `${LISTA}/AAA0A00`);
    await expect(page.getByRole("heading", { level: 1, name: "AAA0A00" })).toBeVisible();
    await page.getByRole("link", { name: "Voltar à lista" }).click();
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
  });

  test("a placa que saiu da página (a ordem mudou) devolve o foco à caixa da tabela, sem erro", async ({
    page,
    baseURL,
  }) => {
    const { placa } = await listaRolada(page, baseURL);
    await clicarComOMouse(page, linkDaFicha(page, placa));
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    // A pessoa volta à mesma URL com outra página de resultados: simula o registro de uma placa que não está nela.
    await page.evaluate((url) => {
      const bruto = sessionStorage.getItem("eixo-retorno-da-lista");
      if (!bruto) throw new Error("sem registro de retorno");
      const r = JSON.parse(bruto);
      r.placa = "ZZZ9Z99";
      r.url = url;
      sessionStorage.setItem("eixo-retorno-da-lista", JSON.stringify(r));
    }, `${LISTA}${CONSULTA}`);
    await page.goBack();
    await expect(page.getByTestId("resumo-da-pagina")).toContainText("Mostrando 26–");
    await expect(caixa(page)).toBeFocused({ timeout: 10_000 });
  });
});

test.describe("só Voltar, Avançar e os links de voltar restauram; visita nova à lista começa no topo", () => {
  async function listaBaseRolada(page: Page) {
    await abrirHidratada(page, LISTA);
    await caixa(page).evaluate((c) => (c.scrollTop = 150));
    expect(await caixa(page).evaluate((c) => c.scrollTop)).toBeGreaterThan(0);
    const placa = (await linhas(page)
      .nth(4)
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa"))!;
    await clicarComOMouse(page, linkDaFicha(page, placa));
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    return placa;
  }

  test("visita nova pelo menu (a mesma URL da lista guardada) começa no topo, sem foco na placa", async ({
    page,
  }) => {
    const placa = await listaBaseRolada(page);
    await page
      .getByRole("navigation", { name: /principal|menu/i })
      .first()
      .getByRole("link", { name: /^Placas/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
    await page.waitForTimeout(800);
    expect(await caixa(page).evaluate((c) => c.scrollTop)).toBe(0);
    const focada = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-ficha-placa"),
    );
    expect(focada).not.toBe(placa);
  });

  test("visita nova por link direto (a mesma URL da lista guardada) começa no topo", async ({
    page,
  }) => {
    await listaBaseRolada(page);
    await page.goto(LISTA);
    await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
    await page.waitForTimeout(800);
    expect(await caixa(page).evaluate((c) => c.scrollTop)).toBe(0);
  });

  test("Voltar, Avançar e Voltar de novo restauram as duas vezes", async ({ page }) => {
    const placa = await listaBaseRolada(page);
    await page.goBack();
    await expect(linkDaFicha(page, placa)).toBeFocused({ timeout: 10_000 });
    expect(await caixa(page).evaluate((c) => Math.round(c.scrollTop))).toBeGreaterThan(100);
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await page.goBack();
    await expect(linkDaFicha(page, placa)).toBeFocused({ timeout: 10_000 });
    expect(await caixa(page).evaluate((c) => Math.round(c.scrollTop))).toBeGreaterThan(100);
  });

  test("a trilha restaura mesmo na mesma URL da lista", async ({ page }) => {
    const placa = await listaBaseRolada(page);
    await page
      .getByRole("navigation", { name: "Trilha" })
      .getByRole("link", { name: "Placas" })
      .click();
    await expect(linkDaFicha(page, placa)).toBeFocused({ timeout: 10_000 });
    expect(await caixa(page).evaluate((c) => Math.round(c.scrollTop))).toBeGreaterThan(100);
  });

  test("recarregar a lista (F5) nunca restaura", async ({ page }) => {
    await listaBaseRolada(page);
    await page.goBack();
    await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
    await page.reload();
    await page.waitForTimeout(800);
    expect(await caixa(page).evaluate((c) => c.scrollTop)).toBe(0);
  });
});

test.describe("os olhos de espiar alinham de forma exata, por densidade", () => {
  async function posicoes(page: Page) {
    return page.evaluate(() =>
      [...document.querySelectorAll('table[aria-label="Placas"] tbody tr')].map((linha) => {
        const link = linha.querySelector("[data-ficha-placa]")!.getBoundingClientRect();
        const olho = linha.querySelector("[data-espiar-placa]")!.getBoundingClientRect();
        return { olhoX: olho.x, larguraDoLink: link.width, linkX: link.x };
      }),
    );
  }

  for (const densidade of ["Compacta", "Confortável"]) {
    test(`densidade ${densidade}: o olho e o link ficam na mesma posição em todas as linhas`, async ({
      page,
    }) => {
      await abrirHidratada(page, LISTA);
      await page.getByRole("button", { name: densidade, exact: true }).click();
      await expect(page.getByRole("button", { name: densidade, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const todas = await posicoes(page);
      expect(todas.length).toBeGreaterThanOrEqual(20);
      expect(new Set(todas.map((p) => p.olhoX)).size, "x do olho").toBe(1);
      expect(new Set(todas.map((p) => p.linkX)).size, "x do link").toBe(1);
      expect(new Set(todas.map((p) => p.larguraDoLink)).size, "largura do link").toBe(1);
    });
  }

  test("com placas largas (letras largas e algarismos largos) a mini placa cabe no link, sem empurrar o olho", async ({
    page,
  }) => {
    await abrirHidratada(page, LISTA);
    const larguraDaMaior = await page.evaluate(() => {
      const modelo = document.querySelector('[data-ficha-placa] [role="img"]') as HTMLElement;
      const clone = modelo.cloneNode(true) as HTMLElement;
      const texto = clone.querySelector("[aria-hidden]:last-child") as HTMLElement;
      texto.textContent = "WWW0M00";
      modelo.parentElement!.appendChild(clone);
      const w = clone.getBoundingClientRect().width;
      clone.remove();
      return w;
    });
    const link = await page.evaluate(
      () => document.querySelector("[data-ficha-placa]")!.getBoundingClientRect().width,
    );
    expect(larguraDaMaior).toBeLessThanOrEqual(link);
  });
});
