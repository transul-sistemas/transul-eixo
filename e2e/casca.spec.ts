import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// Casca em tablet (820 px) e celular (390 px): gaveta no lugar da barra lateral, contexto
// recolhido e aviso nas telas que não foram desenhadas para o celular.

const gaveta = (page: Page) => page.locator('aside[data-barra="principal"]');
const abrirMenu = (page: Page) => page.getByRole("button", { name: "Abrir menu" });
const fecharMenu = (page: Page) => gaveta(page).getByRole("button", { name: "Fechar menu" });
const contexto = (page: Page) => page.getByRole("group", { name: "Contexto global" });
const botaoContexto = (page: Page) => page.getByRole("button", { name: "Contexto" });

async function semRolagemHorizontal(page: Page, rota: string) {
  const l = await page.evaluate(() => ({
    conteudo: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }));
  expect(l.conteudo, `${rota} rola na horizontal`).toBeLessThanOrEqual(l.janela);
}

const ROTAS = [
  "/inicio/tarefas",
  "/frota/placas",
  "/frota/acompanhamento?modo=mapa",
  "/frota/carteira",
  "/operacional/patio",
  "/operacional/totem",
  "/pessoas/escala",
  "/pessoas/status-diario",
  "/admin/demonstracao",
];

test.describe("casca pequena: sem rolagem horizontal", () => {
  for (const rota of ROTAS) {
    test(`${rota}`, async ({ page }) => {
      await abrirHidratada(page, rota);
      await semRolagemHorizontal(page, rota);
    });
  }

  test("com a gaveta aberta e com o contexto aberto também", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas");
    await botaoContexto(page).click();
    await semRolagemHorizontal(page, "contexto aberto");
    await botaoContexto(page).click();
    await abrirMenu(page).click();
    await semRolagemHorizontal(page, "gaveta aberta");
  });
});

test.describe("casca pequena: ambiente de teste", () => {
  test("nada do Next em desenvolvimento cobre o botão Contexto, fechado ou aberto", async ({
    page,
  }) => {
    await abrirHidratada(page, "/frota/placas");
    await page.waitForTimeout(1500); // o indicador do Next monta depois da primeira pintura
    const indicadorDoNext = await page.evaluate(
      () =>
        document
          .querySelector("nextjs-portal")
          ?.shadowRoot?.querySelector("[data-nextjs-dev-tools-button]") !== null &&
        document.querySelector("nextjs-portal")?.shadowRoot !== undefined,
    );
    expect(indicadorDoNext, "o botão N do Next não pode existir nos testes").toBe(false);
    const quemRecebeOToque = () =>
      page.evaluate(() => {
        const botao = document.querySelector('[aria-controls="contexto-global"]') as HTMLElement;
        const caixa = botao.getBoundingClientRect();
        const alvo = document.elementFromPoint(
          caixa.x + caixa.width / 2,
          caixa.y + caixa.height / 2,
        );
        return alvo?.closest('[aria-controls="contexto-global"]') ? "o botão" : alvo?.tagName;
      });
    expect(await quemRecebeOToque()).toBe("o botão");
    await botaoContexto(page).click();
    await expect(botaoContexto(page)).toHaveAttribute("aria-expanded", "true");
    expect(await quemRecebeOToque()).toBe("o botão");
    await botaoContexto(page).click();
    await expect(botaoContexto(page)).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("casca pequena: gaveta do menu", () => {
  test("a barra começa fechada, e o botão Abrir menu é fácil de tocar", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await expect(gaveta(page)).toBeHidden();
    await expect(abrirMenu(page)).toBeVisible();
    await expect(abrirMenu(page)).toHaveAttribute("aria-expanded", "false");
    const caixa = await abrirMenu(page).boundingBox();
    expect(caixa?.width).toBeGreaterThanOrEqual(40);
    expect(caixa?.height).toBeGreaterThanOrEqual(40);
  });

  test("abrir mostra o menu inteiro e deixa o resto da página inerte", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await expect(page.locator("[inert]")).toHaveCount(0);
    await abrirMenu(page).click();
    await expect(gaveta(page)).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Menu do sistema" })).toBeVisible();
    await expect(gaveta(page).getByRole("button", { name: /^Frota/ })).toBeVisible();
    await expect(page.locator("[inert]")).toHaveCount(1);
    await expect(fecharMenu(page)).toBeFocused();
  });

  test("a gaveta não ocupa a tela toda: sobra o fundo para tocar", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirMenu(page).click();
    const caixa = await gaveta(page).boundingBox();
    const largura = page.viewportSize()?.width ?? 0;
    expect(caixa?.width).toBeLessThan(largura - 40);
  });

  test("fecha ao tocar numa tela, que abre", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirMenu(page).click();
    await gaveta(page)
      .getByRole("button", { name: /^Frota/ })
      .click();
    await gaveta(page)
      .getByRole("link", { name: /^Placas/ })
      .click();
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await expect(gaveta(page)).toBeHidden();
    await expect(page.locator("[inert]")).toHaveCount(0);
  });

  test("tocar na tela em que já está também fecha a gaveta", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirMenu(page).click();
    await gaveta(page)
      .getByRole("link", { name: /^Tarefas/ })
      .click();
    await expect(page).toHaveURL(/\/inicio\/tarefas/);
    await expect(gaveta(page)).toBeHidden();
  });

  test("fecha com o botão Fechar menu e devolve o foco ao Abrir menu", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirMenu(page).click();
    await fecharMenu(page).click();
    await expect(gaveta(page)).toBeHidden();
    await expect(abrirMenu(page)).toBeFocused();
  });

  test("fecha com Esc", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirMenu(page).click();
    await page.keyboard.press("Escape");
    await expect(gaveta(page)).toBeHidden();
    await expect(abrirMenu(page)).toBeFocused();
  });

  test("fecha ao tocar no fundo", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirMenu(page).click();
    const largura = page.viewportSize()?.width ?? 0;
    await page.mouse.click(largura - 8, 400);
    await expect(gaveta(page)).toBeHidden();
  });

  test("a busca do menu leva ao Pátio, e a gaveta fecha", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirMenu(page).click();
    await gaveta(page).getByRole("searchbox", { name: "Buscar no menu" }).fill("patio");
    await gaveta(page)
      .getByRole("link", { name: /^Operacional › Pátio/ })
      .click();
    await expect(page).toHaveURL(/\/operacional\/patio$/);
    await expect(gaveta(page)).toBeHidden();
  });

  test("o modo compacto guardado do computador não vale na gaveta", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.evaluate(() =>
      localStorage.setItem(
        "eixo:barra:provisorio",
        JSON.stringify({ versao: 1, compacta: true, gruposAbertos: [], fixados: [] }),
      ),
    );
    await page.reload();
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirMenu(page).click();
    await expect(gaveta(page).getByRole("button", { name: /^Frota/ })).toBeVisible();
    await expect(gaveta(page).getByRole("searchbox", { name: "Buscar no menu" })).toBeVisible();
  });

  test("no tema escuro a gaveta abre sem erro no navegador", async ({ browser, baseURL }, info) => {
    const contexto = await browser.newContext({
      colorScheme: "dark",
      viewport: page_viewport(info.project.use.viewport),
      baseURL,
    });
    const page = await contexto.newPage();
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(e.message));
    page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirMenu(page).click();
    await expect(gaveta(page)).toBeVisible();
    expect(erros).toEqual([]);
    await contexto.close();
  });
});

function page_viewport(v: { width: number; height: number } | null | undefined) {
  return v ?? { width: 390, height: 844 };
}

test.describe("casca pequena: contexto recolhido", () => {
  test("começa escondido atrás do botão Contexto", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas");
    await expect(contexto(page)).toBeHidden();
    await expect(botaoContexto(page)).toBeVisible();
    await expect(botaoContexto(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("tocar no botão mostra os quatro itens, e tocar de novo esconde", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas");
    await botaoContexto(page).click();
    await expect(botaoContexto(page)).toHaveAttribute("aria-expanded", "true");
    await expect(contexto(page)).toBeVisible();
    for (const rotulo of ["Período", "Filial", "Operação", "Regime"]) {
      await expect(contexto(page).getByLabel(rotulo)).toBeVisible();
    }
    await botaoContexto(page).click();
    await expect(contexto(page)).toBeHidden();
  });

  test("o contexto aberto aparece logo abaixo do botão e acima da busca e do tema", async ({
    page,
  }) => {
    await abrirHidratada(page, "/frota/placas");
    await botaoContexto(page).click();
    const y = async (l: ReturnType<Page["locator"]>) => (await l.boundingBox())?.y ?? -1;
    const busca = page.locator("header").getByRole("button", { name: /^Buscar/ });
    const tema = page.locator("header").getByRole("button", { name: "Alternar tema" });
    expect(await y(botaoContexto(page))).toBeLessThan(await y(contexto(page)));
    expect(await y(contexto(page))).toBeLessThan(await y(busca));
    expect(await y(contexto(page))).toBeLessThan(await y(tema));
  });

  test("mudar o período pelo contexto recolhido muda a URL", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas");
    await botaoContexto(page).click();
    await contexto(page).getByLabel("Período").fill("2025-03");
    await expect(page).toHaveURL(/periodo=2025-03/);
  });

  test("a trilha, a busca e o tema continuam à mão", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas");
    await expect(page.getByRole("navigation", { name: "Trilha" })).toBeVisible();
    await expect(page.locator("header").getByRole("button", { name: /^Buscar/ })).toBeVisible();
    await expect(
      page.locator("header").getByRole("button", { name: "Alternar tema" }),
    ).toBeVisible();
  });

  test("a busca rápida cabe na tela", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas");
    await page
      .locator("header")
      .getByRole("button", { name: /^Buscar/ })
      .click();
    const janela = page.getByRole("dialog", { name: "Busca rápida" });
    await expect(janela).toBeVisible();
    const caixa = await janela.boundingBox();
    const largura = page.viewportSize()?.width ?? 0;
    expect((caixa?.x ?? -1) + (caixa?.width ?? 0)).toBeLessThanOrEqual(largura);
    expect(caixa?.x).toBeGreaterThanOrEqual(0);
  });
});

test.describe("casca pequena: aviso de dispositivo", () => {
  const AVISO = "Esta tela funciona melhor em um computador.";

  test("no celular, tela sem versão de celular mostra o aviso e continua utilizável", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "celular-390", "o aviso é só do celular");
    await abrirHidratada(page, "/pessoas/escala");
    await expect(page.getByRole("note")).toHaveText(AVISO);
    await expect(page.getByRole("heading", { level: 1, name: "Escala" })).toBeVisible();
  });

  test("no celular, as telas de celular não mostram aviso", async ({ page }, info) => {
    test.skip(info.project.name !== "celular-390", "o aviso é só do celular");
    for (const rota of [
      "/operacional/patio",
      "/operacional/totem",
      "/frota/carteira",
      "/inicio/tarefas",
      "/pessoas/status-diario",
    ]) {
      await abrirHidratada(page, rota);
      await expect(page.getByRole("note"), rota).toHaveCount(0);
    }
  });

  test("no tablet nenhuma tela mostra o aviso", async ({ page }, info) => {
    test.skip(info.project.name !== "tablet-820", "o tablet não tem aviso");
    await abrirHidratada(page, "/pessoas/escala");
    await expect(page.getByRole("note")).toBeHidden();
  });
});
