import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

const contexto = (page: Page) => page.getByRole("group", { name: "Contexto global" });
const periodo = (page: Page) => contexto(page).getByLabel("Período");
const trilha = (page: Page) => page.getByRole("navigation", { name: "Trilha" });

async function semRolagemHorizontal(page: Page) {
  const l = await page.evaluate(() => ({
    conteudo: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }));
  expect(l.conteudo).toBeLessThanOrEqual(l.janela);
}

test.describe("topo: contexto global na URL", () => {
  test("mostra período, filial, operação e regime Gerencial", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await expect(periodo(page)).toBeVisible();
    await expect(contexto(page).getByLabel("Filial")).toHaveValue("todas");
    await expect(contexto(page).getByLabel("Operação")).toHaveValue("todas");
    await expect(contexto(page).getByLabel("Regime")).toHaveValue("gerencial");
    await expect(contexto(page).getByLabel("Regime").locator("option:checked")).toHaveText(
      "Gerencial",
    );
  });

  test("o período padrão é um mês, e a URL fica limpa", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await expect(periodo(page)).toHaveValue(/^\d{4}-(0[1-9]|1[0-2])$/);
    expect(new URL(page.url()).search).toBe("");
  });

  test("trocar o período muda a URL, e Voltar devolve o período anterior", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    const padrao = await periodo(page).inputValue();
    const outro = padrao === "2025-03" ? "2025-04" : "2025-03";
    await periodo(page).fill(outro);
    await expect(page).toHaveURL(new RegExp(`periodo=${outro}`));
    await expect(periodo(page)).toHaveValue(outro);
    await page.goBack();
    await expect(periodo(page)).toHaveValue(padrao);
    expect(new URL(page.url()).search).toBe("");
  });

  test("recarregar a página mantém o período", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas?periodo=2025-03");
    await expect(periodo(page)).toHaveValue("2025-03");
    await page.reload();
    await expect(periodo(page)).toHaveValue("2025-03");
  });

  test("voltar ao período padrão tira o parâmetro da URL", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    const padrao = await periodo(page).inputValue();
    await periodo(page).fill("2025-03");
    await expect(page).toHaveURL(/periodo=2025-03/);
    await periodo(page).fill(padrao);
    await expect(page).not.toHaveURL(/periodo=/);
  });

  test("período inválido na URL volta ao mês de hoje", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas?periodo=2026-13");
    await expect(periodo(page)).toHaveValue(/^\d{4}-(0[1-9]|1[0-2])$/);
    await expect(periodo(page)).not.toHaveValue("2026-13");
  });

  test("o contexto acompanha a pessoa de uma tela para outra, pela barra lateral", async ({
    page,
  }) => {
    await abrirHidratada(page, "/inicio/tarefas?periodo=2025-03");
    const menu = page.getByRole("navigation", { name: "Menu principal" });
    await menu.getByRole("button", { name: /^Frota/ }).click();
    await menu.getByRole("link", { name: /^Placas/ }).click();
    await expect(page).toHaveURL(/\/frota\/placas\?periodo=2025-03$/);
    await expect(periodo(page)).toHaveValue("2025-03");
  });

  test("o contexto acompanha pela trilha também", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas?periodo=2025-03");
    await trilha(page).getByRole("link", { name: "Frota" }).click();
    await expect(page).toHaveURL(/\/frota\/acompanhamento\?periodo=2025-03$/);
  });

  test("/frota leva à primeira tela e leva o contexto junto", async ({ page }) => {
    await page.goto("/frota?periodo=2025-03");
    await expect(page).toHaveURL(/\/frota\/acompanhamento\?periodo=2025-03$/);
  });

  test("mudar o período não perde o modo da tela", async ({ page }) => {
    await abrirHidratada(page, "/frota/acompanhamento?modo=mapa");
    await periodo(page).fill("2025-03");
    await expect(page).toHaveURL(/modo=mapa/);
    await expect(page).toHaveURL(/periodo=2025-03/);
  });
});

test.describe("topo: no computador", () => {
  test("não mostra Abrir menu nem Contexto: a barra e o contexto já estão à vista", async ({
    page,
  }) => {
    await abrirHidratada(page, "/frota/placas");
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Contexto", exact: true })).toBeHidden();
    await expect(page.locator('aside[data-barra="principal"]')).toBeVisible();
    await expect(page.getByRole("group", { name: "Contexto global" })).toBeVisible();
  });

  test("não mostra o aviso de celular", async ({ page }) => {
    await abrirHidratada(page, "/pessoas/escala");
    await expect(page.getByRole("note")).toBeHidden();
  });
});

test.describe("topo: trilha", () => {
  test("mostra Módulo e Tela, com o módulo clicável e a tela atual marcada", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas");
    const modulo = trilha(page).getByRole("link", { name: "Frota" });
    await expect(modulo).toHaveAttribute("href", "/frota/acompanhamento");
    await expect(trilha(page).getByText("Placas")).toHaveAttribute("aria-current", "page");
    await modulo.click();
    await expect(page).toHaveURL(/\/frota\/acompanhamento$/);
  });

  test("com ?modo=mapa a trilha ganha o modo, e a tela vira link", async ({ page }) => {
    await abrirHidratada(page, "/frota/acompanhamento?modo=mapa");
    await expect(trilha(page).getByText("Mapa")).toHaveAttribute("aria-current", "page");
    const tela = trilha(page).getByRole("link", { name: "Acompanhamento" });
    await expect(tela).toBeVisible();
    await tela.click();
    await expect(page).toHaveURL(/\/frota\/acompanhamento$/);
    await expect(trilha(page).getByText("Acompanhamento")).toHaveAttribute("aria-current", "page");
  });
});

test.describe("topo: tema e acesso", () => {
  test("o botão de tema está no topo e troca o tema", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    const botao = page.locator("header").getByRole("button", { name: "Alternar tema" });
    await expect(page.getByRole("button", { name: "Alternar tema" })).toHaveCount(1);
    const html = page.locator("html");
    const escuroAntes = await html.evaluate((el) => el.classList.contains("dark"));
    await botao.click();
    await expect(html).toHaveClass(escuroAntes ? /^((?!dark).)*$/ : /dark/);
  });

  test("Pular para o conteúdo é o primeiro item do teclado e leva ao conteúdo", async ({
    page,
  }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.keyboard.press("Tab");
    const pular = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(pular).toBeFocused();
    await expect(pular).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#conteudo")).toBeFocused();
  });

  test("há um só main, e é o conteúdo", async ({ page }) => {
    await abrirHidratada(page, "/admin/demonstracao");
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  for (const rota of ["/frota/placas", "/admin/demonstracao"]) {
    test(`${rota}: o topo não faz a página rolar na horizontal, com a barra aberta ou recolhida`, async ({
      page,
    }) => {
      await abrirHidratada(page, rota);
      await semRolagemHorizontal(page);
      await page
        .locator('aside[data-barra="principal"]')
        .getByRole("button", { name: "Recolher menu" })
        .click();
      await semRolagemHorizontal(page);
    });
  }
});
