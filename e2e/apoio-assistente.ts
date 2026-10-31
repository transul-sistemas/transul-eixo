import { expect, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

export const ROTA = "/admin/demonstracao";
export const NOME_DO_ASSISTENTE = "Cadastrar item de teste";

export const botaoDeAbrir = (page: Page) =>
  page.getByRole("button", { name: NOME_DO_ASSISTENTE, exact: true });
export const assistente = (page: Page) =>
  page.getByRole("dialog", { name: NOME_DO_ASSISTENTE, exact: true });
export const mini = (page: Page) =>
  page.getByRole("dialog", { name: "Cadastrar categoria", exact: true });
export const confirmacao = (page: Page) => page.getByRole("alertdialog");
export const enviosDoAssistente = (page: Page) => page.getByTestId("envios-do-assistente");
export const passoAtual = (page: Page) =>
  assistente(page).locator('li[aria-current="step"], [data-passo-compacto]:visible').first();
export const campoNome = (page: Page) => assistente(page).getByLabel("Nome", { exact: true });

/** Abre a demonstração já hidratada e abre o assistente pelo botão. */
export async function abrirOAssistente(page: Page, consulta = "") {
  await abrirHidratada(page, `${ROTA}${consulta}`);
  await botaoDeAbrir(page).click();
  await expect(assistente(page)).toBeVisible();
}

/** Preenche o passo 1 (nome e categoria) e avança. */
export async function preencherIdentificacao(page: Page, nome = "Pneu 295/80") {
  await campoNome(page).fill(nome);
  await assistente(page).getByLabel("Categoria", { exact: true }).selectOption("pneu");
  await assistente(page).getByRole("button", { name: "Avançar" }).click();
}

/** Preenche o passo 2 (quantidade e valor) e avança. */
export async function preencherValores(page: Page) {
  await assistente(page).getByLabel("Quantidade").fill("4");
  const valor = assistente(page).getByLabel("Valor", { exact: true });
  await valor.click();
  await page.keyboard.type("12345"); // R$ 123,45
  await assistente(page).getByRole("button", { name: "Avançar" }).click();
}

/** Do começo até o passo de conferir, com dados válidos. */
export async function irAteConferir(page: Page, nome = "Pneu 295/80") {
  await preencherIdentificacao(page, nome);
  await preencherValores(page);
  await assistente(page).getByRole("button", { name: "Avançar" }).click(); // observação (opcional)
  await expect(assistente(page).getByRole("button", { name: "Cadastrar item" })).toBeVisible();
}
