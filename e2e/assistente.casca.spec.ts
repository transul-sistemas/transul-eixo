import { expect, test } from "@playwright/test";
import {
  abrirOAssistente,
  assistente,
  botaoDeAbrir,
  campoNome,
  irAteConferir,
  mini,
} from "./apoio-assistente";

// O assistente no tablet (820) e no celular (390): stepper compacto, resumo em gaveta, sem rolagem
// lateral, alvos de toque grandes e o mini-wizard como folha de baixo.

const caixaDe = (el: ReturnType<typeof assistente>) => el.boundingBox();

test.describe("assistente em tablet e celular", () => {
  test("o stepper vira 'Passo 1 de 4 · Identificação' com a barra de progresso", async ({
    page,
  }) => {
    await abrirOAssistente(page);
    const nav = assistente(page).getByRole("navigation", { name: "Passos do assistente" });
    await expect(nav.locator("[data-passo-compacto]")).toBeVisible();
    await expect(nav.locator("[data-passo-compacto]")).toHaveText("Passo 1 de 4 · Identificação");
    await expect(nav.getByRole("list")).toBeHidden();
    await expect(nav.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  test("o resumo vira uma gaveta: Ver resumo abre e Esconder resumo fecha", async ({ page }) => {
    await abrirOAssistente(page);
    await campoNome(page).fill("Pneu 295/80");
    await expect(assistente(page).getByRole("complementary", { name: "Resumo" })).toHaveCount(0);
    const botao = assistente(page).getByRole("button", { name: /resumo$/ });
    await expect(botao).toHaveText("Ver resumo");
    await expect(botao).toHaveAttribute("aria-expanded", "false");
    await botao.click();
    await expect(botao).toHaveAttribute("aria-expanded", "true");
    await expect(assistente(page).getByRole("complementary", { name: "Resumo" })).toContainText(
      "Pneu 295/80",
    );
    await botao.click();
    await expect(assistente(page).getByRole("complementary", { name: "Resumo" })).toHaveCount(0);
  });

  test("a página não rola na horizontal e o assistente cabe na janela", async ({ page }) => {
    await abrirOAssistente(page);
    const m = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
      altura: window.innerHeight,
    }));
    expect(m.pagina).toBeLessThanOrEqual(m.janela);
    const caixa = await caixaDe(assistente(page));
    expect(caixa).not.toBeNull();
    expect(caixa!.x).toBeGreaterThanOrEqual(0);
    expect(caixa!.y).toBeGreaterThanOrEqual(0);
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(m.janela + 1);
    expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(m.altura + 1);
  });

  test("no celular os alvos de toque têm pelo menos 40 px", async ({ page }, info) => {
    test.skip(info.project.name !== "celular-390", "só no celular");
    await abrirOAssistente(page);
    for (const nome of ["Fechar assistente", "Continuar", "Voltar", "Cadastrar categoria"]) {
      const caixa = await assistente(page)
        .getByRole("button", { name: nome, exact: true })
        .boundingBox();
      expect(caixa?.height ?? 0, nome).toBeGreaterThanOrEqual(40);
      expect(caixa?.width ?? 0, nome).toBeGreaterThanOrEqual(40);
    }
    const campo = await campoNome(page).boundingBox();
    expect(campo?.height ?? 0).toBeGreaterThanOrEqual(40);
  });

  test("o fluxo inteiro funciona no toque e termina em Item cadastrado.", async ({ page }) => {
    await abrirOAssistente(page);
    await irAteConferir(page);
    await assistente(page).getByRole("button", { name: "Cadastrar item" }).click();
    await expect(assistente(page).getByTestId("assistente-concluido")).toHaveText(
      "Item cadastrado.",
    );
    await assistente(page).getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(assistente(page)).toBeHidden();
    await expect(botaoDeAbrir(page)).toBeFocused();
  });

  test("o mini-wizard é um painel lateral (tablet) ou a folha de baixo (celular) e devolve o campo", async ({
    page,
  }, info) => {
    await abrirOAssistente(page);
    await assistente(page).getByRole("button", { name: "Cadastrar categoria" }).click();
    await expect(mini(page)).toBeVisible();
    const janela = await page.evaluate(() => ({ l: window.innerWidth, a: window.innerHeight }));
    const caixa = (await caixaDe(mini(page)))!;
    if (info.project.name === "celular-390") {
      expect(Math.abs(caixa.width - janela.l)).toBeLessThanOrEqual(1); // largura toda
      expect(Math.abs(caixa.y + caixa.height - janela.a)).toBeLessThanOrEqual(1); // colada embaixo
      expect(caixa.y).toBeGreaterThan(0);
    } else {
      expect(Math.abs(caixa.x + caixa.width - janela.l)).toBeLessThanOrEqual(1); // colada à direita
      expect(caixa.width).toBeLessThan(janela.l);
    }
    await mini(page).getByLabel("Nome da categoria").fill("Bateria");
    await page.keyboard.press("Enter");
    await mini(page).getByRole("button", { name: "Cadastrar categoria" }).click();
    await expect(mini(page)).toBeHidden();
    await expect(
      assistente(page).getByLabel("Categoria", { exact: true }).locator("option:checked"),
    ).toHaveText("Bateria");
  });

  test("Esc fecha o assistente e o foco volta ao botão que abriu", async ({ page }) => {
    await abrirOAssistente(page);
    await page.keyboard.press("Escape");
    await expect(assistente(page)).toBeHidden();
    await expect(botaoDeAbrir(page)).toBeFocused();
  });
});
