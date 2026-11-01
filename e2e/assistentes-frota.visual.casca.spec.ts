import { expect, test } from "@playwright/test";
import {
  abrirOCadastro,
  cadastro,
  irAteConferirOCadastro,
  passoIdentificacao,
  placaUnica,
  sessaoIsolada,
} from "./apoio-assistentes-frota";

// O mesmo visual, abaixo de 1024 px: tela cheia, uma coluna no celular, Conferir empilhado.

test.beforeEach(async ({ context, baseURL }) => {
  await sessaoIsolada(context, baseURL);
});

const caixa = async (l: import("@playwright/test").Locator) => (await l.boundingBox())!;
const celular = (page: import("@playwright/test").Page) => page.viewportSize()!.width < 640;

test("abaixo de 1024 px o assistente continua em tela cheia (margens pequenas, sem painel de 1040)", async ({
  page,
}) => {
  await abrirOCadastro(page);
  const tela = page.viewportSize()!;
  const b = await caixa(cadastro(page));
  expect(b.width).toBeGreaterThanOrEqual(tela.width - 36);
  expect(b.height).toBeGreaterThanOrEqual(tela.height - 36);
});

test("campos em duas colunas só a partir de 640 px", async ({ page }) => {
  await abrirOCadastro(page);
  const c = cadastro(page);
  const placa = await caixa(c.getByLabel("Placa", { exact: true }));
  const renavam = await caixa(c.getByLabel("RENAVAM"));
  if (celular(page)) expect(renavam.y).toBeGreaterThan(placa.y + placa.height - 2);
  else expect(Math.abs(placa.y - renavam.y)).toBeLessThanOrEqual(2);
});

test("Conferir empilha Dados e O que vai acontecer", async ({ page }) => {
  await abrirOCadastro(page);
  await irAteConferirOCadastro(page, { placa: placaUnica() });
  const c = cadastro(page);
  const dados = await caixa(c.getByRole("region", { name: "Dados" }));
  const efeitos = await caixa(c.getByRole("region", { name: "O que vai acontecer" }));
  expect(efeitos.y).toBeGreaterThan(dados.y + dados.height - 2);
  const lateral = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(lateral).toBe(true);
});

test("o + continua com 40 px ou mais e o rodapé tem Voltar e Continuar", async ({ page }) => {
  await abrirOCadastro(page);
  const c = cadastro(page);
  await passoIdentificacao(page, { placa: placaUnica() });
  const b = await caixa(c.getByRole("button", { name: "Cadastrar marca" }));
  expect(b.width).toBeGreaterThanOrEqual(40);
  await expect(c.getByRole("button", { name: "Voltar" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Continuar" })).toBeVisible();
});
