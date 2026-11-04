import { expect, test, type Page } from "@playwright/test";

// Abre a página e espera o React assumir a barra: antes disso, clique e atalho não fazem nada.
async function abrir(page: Page, rota: string) {
  await page.goto(rota);
  await page.waitForFunction(() => {
    // Pronta: hidratada e com os atalhos (Ctrl+B) ligados.
    return !!document.querySelector('aside[data-barra="principal"][data-pronta]');
  });
}

const barra = (page: Page) => page.locator('aside[data-barra="principal"]');
const menu = (page: Page) => page.getByRole("navigation", { name: "Menu principal" });
const grupo = (page: Page, nome: string) =>
  menu(page).getByRole("button", { name: new RegExp(`^${nome}`) });
const larguraDaBarra = async (page: Page) => (await barra(page).boundingBox())?.width ?? 0;

async function semRolagemHorizontal(page: Page) {
  const l = await page.evaluate(() => ({
    conteudo: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }));
  expect(l.conteudo).toBeLessThanOrEqual(l.janela);
}

test.describe("barra lateral: grupos", () => {
  test("mostra os 9 módulos, e só o da tela atual começa aberto", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await expect(menu(page).locator("button[aria-expanded]")).toHaveCount(9);
    await expect(grupo(page, "Início")).toHaveAttribute("aria-expanded", "true");
    await expect(grupo(page, "Frota")).toHaveAttribute("aria-expanded", "false");
    await expect(menu(page).getByRole("link", { name: /^Tarefas/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("clicar no grupo abre e fecha as telas dele", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    const placas = menu(page).getByRole("link", { name: /^Placas/ });
    await expect(placas).toBeHidden();
    await grupo(page, "Frota").click();
    await expect(grupo(page, "Frota")).toHaveAttribute("aria-expanded", "true");
    await expect(placas).toBeVisible();
    await expect(menu(page).getByRole("link", { name: /^Acompanhamento/ })).toBeVisible();
    await grupo(page, "Frota").click();
    await expect(placas).toBeHidden();
  });

  test("abre pelo teclado: Tab até o grupo e Enter", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await grupo(page, "Frota").focus();
    await page.keyboard.press("Enter");
    await expect(grupo(page, "Frota")).toHaveAttribute("aria-expanded", "true");
  });

  test("clicar numa tela navega e a marca como atual", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await grupo(page, "Frota").click();
    await menu(page)
      .getByRole("link", { name: /^Placas/ })
      .click();
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await expect(menu(page).getByRole("link", { name: /^Placas/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(grupo(page, "Frota")).toHaveAttribute("aria-expanded", "true");
  });

  test("abrir uma tela de outro módulo pela URL abre o grupo dela", async ({ page }) => {
    await abrir(page, "/pessoas/escala");
    await expect(grupo(page, "Pessoas")).toHaveAttribute("aria-expanded", "true");
  });

  test("os nomes das telas cabem numa linha, sem ser cortados com reticências", async ({
    page,
  }) => {
    await abrir(page, "/inicio/tarefas");
    await grupo(page, "Frota").click();
    for (const nome of ["Resumo do dia", "Mapa do sistema", "Acompanhamento", "Abastecimento"]) {
      const texto = menu(page).getByText(nome, { exact: true }).first();
      await expect(texto).toBeVisible();
      const caixa = await texto.boundingBox();
      // Uma linha de text-sm tem 20 px; duas linhas passariam de 30.
      expect(caixa?.height, nome).toBeLessThan(26);
      const cortado = await texto.evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(cortado, `${nome} está cortado`).toBe(false);
    }
  });

  test("telas em breve levam a etiqueta, e a Demonstração não", async ({ page }) => {
    await abrir(page, "/admin/demonstracao");
    const demo = menu(page).getByRole("link", { name: /^Demonstração/ });
    await expect(demo).toBeVisible();
    await expect(demo).not.toContainText("Em breve");
    await expect(menu(page).getByRole("link", { name: /^Auditoria/ })).toContainText("Em breve");
  });
});

test.describe("barra lateral: modo compacto e Ctrl+B", () => {
  test("Ctrl+B recolhe e expande, e a barra encolhe de verdade", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    const aberta = await larguraDaBarra(page);
    expect(aberta).toBeGreaterThan(200);
    await page.keyboard.press("Control+b");
    await expect(barra(page)).toHaveAttribute("data-compacta", "true");
    expect(await larguraDaBarra(page)).toBeLessThan(100);
    await semRolagemHorizontal(page);
    await page.keyboard.press("Control+b");
    await expect(barra(page)).toHaveAttribute("data-compacta", "false");
    expect(await larguraDaBarra(page)).toBeGreaterThan(200);
  });

  test("o botão de recolher faz o mesmo", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await page.getByRole("button", { name: "Recolher menu" }).click();
    await expect(barra(page)).toHaveAttribute("data-compacta", "true");
    await page.getByRole("button", { name: "Expandir menu" }).click();
    await expect(barra(page)).toHaveAttribute("data-compacta", "false");
  });

  test("digitando num campo de texto, Ctrl+B não recolhe a barra", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await page.getByRole("searchbox", { name: "Buscar no menu" }).focus();
    await page.keyboard.press("Control+b");
    await expect(barra(page)).toHaveAttribute("data-compacta", "false");
  });

  test("no modo compacto, passar o mouse no módulo abre o painel flutuante", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await page.keyboard.press("Control+b");
    const painel = page.getByRole("group", { name: "Telas de Frota" });
    await expect(painel).toBeHidden();
    await menu(page).getByRole("link", { name: "Frota", exact: true }).hover();
    await expect(painel).toBeVisible();
    await expect(painel.getByRole("link", { name: /^Placas/ })).toBeVisible();
    await page.mouse.move(700, 500);
    await expect(painel).toBeHidden();
  });

  test("o painel também abre pelo foco do teclado e fecha com Esc", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await page.keyboard.press("Control+b");
    const modulo = menu(page).getByRole("link", { name: "Frota", exact: true });
    const painel = page.getByRole("group", { name: "Telas de Frota" });
    await modulo.focus();
    await expect(painel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(painel).toBeHidden();
    await expect(modulo).toBeFocused();
  });

  test("Esc fecha o painel também com o foco num item de dentro dele", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await page.keyboard.press("Control+b");
    const modulo = menu(page).getByRole("link", { name: "Frota", exact: true });
    const painel = page.getByRole("group", { name: "Telas de Frota" });
    await modulo.focus();
    await page.keyboard.press("Tab");
    await expect(painel.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(painel).toBeHidden();
    await expect(modulo).toBeFocused();
  });

  test("no modo compacto, clicar no módulo leva à primeira tela dele", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await page.keyboard.press("Control+b");
    await menu(page).getByRole("link", { name: "Frota", exact: true }).click();
    await expect(page).toHaveURL(/\/frota\/acompanhamento$/);
  });
});

test.describe("barra lateral: memória por usuário", () => {
  test("lembra o modo compacto, os grupos abertos e os fixados depois de recarregar", async ({
    page,
  }) => {
    await abrir(page, "/inicio/tarefas");
    await grupo(page, "Frota").click();
    await menu(page).getByRole("button", { name: "Fixar Placas" }).click();
    await page.keyboard.press("Control+b");
    await expect(barra(page)).toHaveAttribute("data-compacta", "true");
    await page.reload();
    await expect(barra(page)).toHaveAttribute("data-compacta", "true");
    await page.keyboard.press("Control+b");
    await expect(grupo(page, "Frota")).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("region", { name: "Fixados" }).getByRole("link", { name: /^Placas/ }),
    ).toBeVisible();
  });

  test("memória corrompida não quebra a barra", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await page.locator("#menu-principal[data-usuario]").waitFor({ state: "attached" });
    await page.evaluate(() => {
      const usuario = document.querySelector("#menu-principal")?.getAttribute("data-usuario");
      localStorage.setItem(`eixo:barra:${usuario}`, "{isto não é json");
    });
    await page.reload();
    await expect(menu(page).locator("button[aria-expanded]")).toHaveCount(9);
    await expect(barra(page)).toHaveAttribute("data-compacta", "false");
  });
});

test.describe("barra lateral: fixados", () => {
  test("fixar põe a tela no topo, desfixar tira", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await grupo(page, "Frota").click();
    const fixar = menu(page).getByRole("button", { name: "Fixar Placas" }).first();
    await expect(fixar).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("region", { name: "Fixados" })).toHaveCount(0);
    await fixar.click();
    const fixados = page.getByRole("region", { name: "Fixados" });
    await expect(fixados.getByRole("link", { name: /^Placas/ })).toBeVisible();
    await fixados.getByRole("button", { name: "Fixar Placas" }).click();
    await expect(page.getByRole("region", { name: "Fixados" })).toHaveCount(0);
  });
});

test.describe("barra lateral: busca no menu", () => {
  const busca = (page: Page) => page.getByRole("searchbox", { name: "Buscar no menu" });

  test("filtra por nome, sem acento, e mostra o caminho de cada resultado", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await busca(page).fill("operacoes");
    await expect(menu(page).getByRole("link", { name: /^Operações › Operações/ })).toBeVisible();
    await expect(menu(page).getByRole("link", { name: /^Operações › Comparativo/ })).toBeVisible();
    await expect(menu(page).getByRole("link", { name: /^Frota/ })).toHaveCount(0);
  });

  test("acha os modos do Acompanhamento e leva ao modo certo", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await busca(page).fill("mapa");
    const modo = menu(page).getByRole("link", { name: /^Frota › Acompanhamento › Mapa/ });
    await expect(modo).toHaveAttribute("href", "/frota/acompanhamento?modo=mapa");
    await modo.click();
    await expect(page).toHaveURL(/\/frota\/acompanhamento\?modo=mapa$/);
    await expect(busca(page)).toHaveValue("");
  });

  test("sem resultado diz o que fazer, e limpar volta aos grupos", async ({ page }) => {
    await abrir(page, "/inicio/tarefas");
    await busca(page).fill("zzzz");
    await expect(menu(page).getByText("Nenhuma tela encontrada. Tente outro nome.")).toBeVisible();
    await menu(page).getByRole("button", { name: "Limpar busca" }).click();
    await expect(busca(page)).toHaveValue("");
    await expect(menu(page).locator("button[aria-expanded]")).toHaveCount(9);
  });
});

test.describe("barra lateral: contadores (barra da página de demonstração)", () => {
  test("o contador da tela sobe, somado, para o grupo", async ({ page }) => {
    await abrir(page, "/admin/demonstracao");
    const demo = page.getByRole("navigation", { name: "Menu de demonstração" });
    await expect(demo.locator('[data-contador="frota"]')).toHaveText("5");
    await expect(demo.locator('[data-contador="operacional"]')).toHaveText("12");
    await expect(demo.locator('[data-contador="pessoas"]')).toHaveText("99+");
    await demo.getByRole("button", { name: /^Frota/ }).click();
    await expect(
      demo.locator('#grupo-demonstracao-frota [data-contador="frota.placas"]'),
    ).toHaveText("3");
    await expect(
      demo.locator('#grupo-demonstracao-frota [data-contador="frota.carteira"]'),
    ).toHaveText("2");
  });

  test("a barra da demonstração não grava memória nem responde a Ctrl+B", async ({ page }) => {
    await abrir(page, "/admin/demonstracao");
    await page.keyboard.press("Control+b");
    const demo = page.locator('aside[data-barra="demonstracao"]');
    await expect(demo).toHaveAttribute("data-compacta", "false");
    const chaves = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("eixo:barra")),
    );
    expect(chaves.length).toBeLessThanOrEqual(1);
  });
});

test.describe("barra lateral: página inteira", () => {
  for (const rota of ["/inicio/tarefas", "/frota/acompanhamento", "/admin/demonstracao"]) {
    test(`${rota} sem rolagem horizontal, aberta e recolhida`, async ({ page }) => {
      await abrir(page, rota);
      await semRolagemHorizontal(page);
      await page.keyboard.press("Control+b");
      await semRolagemHorizontal(page);
    });
  }

  test("no tema escuro a barra continua legível e sem erro", async ({ browser }) => {
    const contexto = await browser.newContext({ colorScheme: "dark" });
    const page = await contexto.newPage();
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(e.message));
    page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
    await abrir(page, "/inicio/tarefas");
    await expect(menu(page).locator("button[aria-expanded]")).toHaveCount(9);
    expect(erros).toEqual([]);
    await contexto.close();
  });
});
