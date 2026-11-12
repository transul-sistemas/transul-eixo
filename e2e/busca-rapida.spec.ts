import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

const janela = (page: Page) => page.getByRole("dialog", { name: "Busca rápida" });
const campo = (page: Page) =>
  janela(page).getByRole("combobox", { name: "Buscar tela, modo ou ação" });
const opcao = (page: Page, nome: RegExp | string) =>
  janela(page).getByRole("option", { name: nome });

/** Ctrl+K, repetido até a janela abrir (antes de a página hidratar o atalho ainda não existe). */
async function abrirBusca(page: Page) {
  await expect(async () => {
    if (!(await janela(page).isVisible())) await page.keyboard.press("Control+k");
    await expect(janela(page)).toBeVisible({ timeout: 400 });
  }).toPass({ timeout: 6000 });
}

test.describe("busca rápida: abrir e fechar", () => {
  test("Ctrl+K abre com o campo em foco, e Ctrl+K de novo fecha", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    await expect(campo(page)).toBeFocused();
    await page.keyboard.press("Control+k");
    await expect(janela(page)).toBeHidden();
  });

  test("o botão Buscar do topo abre, e Esc fecha devolvendo o foco ao botão", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    const botao = page.locator("header").getByRole("button", { name: /^Buscar/ });
    await expect(botao).toHaveAttribute("aria-keyshortcuts", "Control+K");
    await botao.click();
    await expect(campo(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(janela(page)).toBeHidden();
    await expect(botao).toBeFocused();
  });

  test("funciona com o foco num campo de texto, e Esc devolve o foco a ele", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    const busca = page.getByRole("searchbox", { name: "Buscar no menu" });
    await busca.focus();
    await abrirBusca(page);
    await expect(campo(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(janela(page)).toBeHidden();
    await expect(busca).toBeFocused();
  });

  test("digitando na busca, Ctrl+B não recolhe a barra lateral", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    await page.keyboard.press("Control+b");
    await expect(page.locator('aside[data-barra="principal"]')).toHaveAttribute(
      "data-compacta",
      "false",
    );
  });
});

test.describe("busca rápida: encontrar e abrir", () => {
  test("digitar carteira mostra Frota › Carteira, e Enter abre a tela", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    await campo(page).fill("carteira");
    await expect(opcao(page, /^Frota › Carteira/)).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/frota\/carteira$/);
    await expect(janela(page)).toBeHidden();
  });

  test("as setas escolhem a opção, e Enter abre a escolhida", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    await campo(page).fill("pessoas");
    await expect(opcao(page, /^Pessoas › Pessoas/)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(opcao(page, /^Pessoas › Escala/)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/pessoas\/escala$/);
  });

  test("a seta para cima, na primeira opção, dá a volta para a última", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    await campo(page).fill("analise");
    await expect(janela(page).getByRole("option")).toHaveCount(4);
    await page.keyboard.press("ArrowUp");
    await expect(janela(page).getByRole("option").last()).toHaveAttribute("aria-selected", "true");
  });

  test("clicar numa opção também abre a tela", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    await campo(page).fill("auditoria");
    await opcao(page, /^Administração › Auditoria/).click();
    await expect(page).toHaveURL(/\/admin\/auditoria$/);
  });

  for (const [nome, id] of [
    ["Grade · Conjuntos", "grade"],
    ["Grade · Soltas", "soltas"],
    ["Agora", "agora"],
    ["Censo", "censo"],
    ["Mapa", "mapa"],
  ] as const) {
    test(`acha o modo ${nome} do Acompanhamento e abre com ?modo=${id}`, async ({ page }) => {
      await abrirHidratada(page, "/inicio/tarefas");
      await abrirBusca(page);
      await campo(page).fill(nome.toLowerCase());
      const modo = opcao(page, new RegExp(`^Frota › Acompanhamento › ${nome}`));
      await expect(modo).toBeVisible();
      await modo.click();
      await expect(page).toHaveURL(new RegExp(`/frota/acompanhamento\\?modo=${id}$`));
      const trilha = page.getByRole("navigation", { name: "Trilha" });
      await expect(trilha.getByText(nome, { exact: true })).toHaveAttribute("aria-current", "page");
    });
  }

  test("o contexto global acompanha a escolha", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas?periodo=2025-03");
    await abrirBusca(page);
    await campo(page).fill("carteira");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/frota\/carteira\?periodo=2025-03$/);
  });

  test("sem resultado diz o que fazer", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    await campo(page).fill("zzzz");
    await expect(
      janela(page).getByText("Nenhuma tela encontrada. Tente outro nome."),
    ).toBeVisible();
    await expect(janela(page).getByRole("option")).toHaveCount(0);
  });
});

test.describe("busca rápida: ações da Frota", () => {
  test("Receber placa aparece em Ações, executa e abre o assistente", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    await campo(page).fill("receber placa");
    const acoes = janela(page).getByRole("group", { name: "Ações" });
    await expect(acoes).toBeVisible();
    const acao = acoes.getByRole("option", { name: /Frota › Receber placa/ });
    await expect(acao).not.toHaveAttribute("aria-disabled", "true");
    await expect(acao).not.toContainText("Em breve");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/frota\/placas\?.*assistente=receber-placa/);
    await expect(page.getByRole("dialog", { name: "Receber placa" })).toBeVisible();
  });

  test("Entregar ao Operacional, Disponibilizar placa e Concluir recebimento também estão ligadas", async ({
    page,
  }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    for (const [termo, nome] of [
      ["entregar", /Frota › Entregar ao Operacional/],
      ["disponibilizar", /Frota › Disponibilizar placa/],
      ["concluir recebimento", /Frota › Concluir recebimento/],
    ] as const) {
      await campo(page).fill(termo);
      await expect(opcao(page, nome)).not.toHaveAttribute("aria-disabled", "true");
      await expect(opcao(page, nome)).not.toContainText("Em breve");
    }
  });
});

test.describe("busca rápida: sem termo", () => {
  test("mostra as telas visitadas em Recentes", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas");
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    const recentes = janela(page).getByRole("group", { name: "Recentes" });
    await expect(recentes.getByRole("option", { name: /^Frota › Placas/ })).toBeVisible();
    // A tela em que a pessoa já está não é um recente.
    await expect(recentes.getByRole("option", { name: /^Início › Tarefas/ })).toHaveCount(0);
  });

  test("mostra as telas fixadas na barra lateral em Fixados", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    const menu = page.getByRole("navigation", { name: "Menu principal" });
    await menu.getByRole("button", { name: /^Frota/ }).click();
    await menu.getByRole("button", { name: "Fixar Carteira" }).click();
    await abrirBusca(page);
    const fixados = janela(page).getByRole("group", { name: "Fixados" });
    await expect(fixados.getByRole("option", { name: /^Frota › Carteira/ })).toBeVisible();
  });

  test("sem nada para mostrar, convida a digitar", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.locator("#menu-principal[data-usuario]").waitFor({ state: "attached" });
    await page.evaluate(() => {
      const usuario = document.querySelector("#menu-principal")?.getAttribute("data-usuario");
      localStorage.removeItem(`eixo:recentes:${usuario}`);
    });
    await abrirBusca(page);
    await campo(page).fill("a");
    await campo(page).fill("");
    await expect(
      janela(page)
        .getByText("Digite o nome de uma tela, de um modo ou de uma ação.")
        .or(janela(page).getByRole("group", { name: "Recentes" })),
    ).toBeVisible();
  });
});

test.describe("busca rápida: acabamento", () => {
  test("com a janela aberta a página não rola na horizontal", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    await campo(page).fill("a");
    const l = await page.evaluate(() => ({
      conteudo: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(l.conteudo).toBeLessThanOrEqual(l.janela);
  });

  test("no tema escuro abre sem erro no navegador", async ({ browser }) => {
    const contexto = await browser.newContext({ colorScheme: "dark" });
    const page = await contexto.newPage();
    const erros: string[] = [];
    page.on("pageerror", (e) => erros.push(e.message));
    page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
    await abrirHidratada(page, "/inicio/tarefas");
    await abrirBusca(page);
    await campo(page).fill("mapa");
    await expect(opcao(page, /Frota › Acompanhamento › Mapa/)).toBeVisible();
    expect(erros).toEqual([]);
    await contexto.close();
  });
});
