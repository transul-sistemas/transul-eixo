import { expect, type Locator, type Page, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import {
  abrirOCadastro,
  cadastro,
  disponibilizacao,
  FICHA,
  irAteConferirOCadastro,
  LISTA,
  placaUnica,
  recebimento,
  sessaoIsolada,
} from "./apoio-assistentes-frota";

// As telas de resultado dos assistentes (placa já cadastrada, concluído, conflito e erro) ficam
// centralizadas no painel: conteúdo e botões ao centro, em uma coluna de leitura de uns 480 px.
// Vale para os três assistentes, nos quatro tamanhos de tela (os specs finos só escolhem os projetos).

const PLACA_COM_PEDIDO = "AAA0A00";

async function centrado(painel: Locator, alvo: Locator) {
  const p = (await painel.boundingBox())!;
  const a = (await alvo.boundingBox())!;
  expect(Math.abs(a.x + a.width / 2 - (p.x + p.width / 2))).toBeLessThanOrEqual(4);
}

/** Botões lado a lado se centram como grupo: o meio da caixa que os envolve fica no meio do painel. */
async function gruposCentrados(painel: Locator, botoes: Locator[]) {
  const p = (await painel.boundingBox())!;
  const caixas = await Promise.all(botoes.map(async (b) => (await b.boundingBox())!));
  const esquerda = Math.min(...caixas.map((c) => c.x));
  const direita = Math.max(...caixas.map((c) => c.x + c.width));
  expect(Math.abs((esquerda + direita) / 2 - (p.x + p.width / 2))).toBeLessThanOrEqual(4);
}

async function conferirTela(painel: Locator, botoes: Locator[], emGrupo = false) {
  const tela = painel.getByTestId("resultado-do-assistente");
  await expect(tela).toBeVisible();
  const caixa = (await tela.boundingBox())!;
  expect(caixa.width).toBeLessThanOrEqual(481);
  await centrado(painel, tela);
  expect(await tela.evaluate((el) => getComputedStyle(el).textAlign)).toBe("center");
  for (const botao of botoes) await expect(botao).toBeVisible();
  if (emGrupo) await gruposCentrados(painel, botoes);
  else for (const botao of botoes) await centrado(painel, botao);
}

async function abrirDisponibilizar(page: Page) {
  await abrirHidratada(page, `${LISTA}?chip=patio&chip=cavalo`);
  const placa = (await page
    .locator("[data-espiar-placa]")
    .first()
    .getAttribute("data-espiar-placa"))!;
  await abrirHidratada(page, FICHA(placa));
  await page.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
  const d = disponibilizacao(page);
  await d.getByLabel("Filial", { exact: true }).selectOption({ label: "Filial Exemplo B" });
  await d.getByRole("button", { name: "Continuar" }).click();
  return d;
}

async function abrirReceber(page: Page) {
  await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
  await page.getByRole("button", { name: "Receber placa" }).click();
  const r = recebimento(page);
  for (const caixa of await r.getByLabel("Resolvida:", { exact: false }).all()) await caixa.check();
  await r.getByLabel("Conferi o que chegou").check();
  for (let i = 0; i < 3; i++) await r.getByRole("button", { name: "Continuar" }).click();
  return r;
}

export function definir() {
  test.beforeEach(async ({ context, baseURL }) => {
    await sessaoIsolada(context, baseURL);
  });

  test("placa já cadastrada: a tela de erro fica centralizada, com o link e o botão ao centro", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    await irAteConferirOCadastro(page, { placa: PLACA_COM_PEDIDO });
    const c = cadastro(page);
    await c.getByRole("button", { name: "Cadastrar placa" }).click();
    await expect(c.getByRole("alert").filter({ hasText: "já está cadastrada" })).toBeVisible();
    await conferirTela(c, [
      c.getByRole("link", { name: "Abrir a ficha de AAA0A00" }),
      c.getByRole("button", { name: "Voltar ao formulário" }),
    ]);
    await expect(c.getByRole("button", { name: "Tentar de novo" })).toHaveCount(0);
  });

  test("Voltar ao formulário leva de volta ao último passo, com o que foi digitado", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    await irAteConferirOCadastro(page, { placa: PLACA_COM_PEDIDO });
    const c = cadastro(page);
    await c.getByRole("button", { name: "Cadastrar placa" }).click();
    await c.getByRole("button", { name: "Voltar ao formulário" }).click();
    await expect(c.getByRole("button", { name: "Cadastrar placa" })).toBeVisible();
    await expect(c.getByTestId("resultado-do-assistente")).toHaveCount(0);
  });

  test("concluído, no cadastro: mensagem e botão Fechar ao centro", async ({ page }) => {
    await abrirOCadastro(page);
    await irAteConferirOCadastro(page, { placa: placaUnica() });
    const c = cadastro(page);
    await c.getByRole("button", { name: "Cadastrar placa" }).click();
    await expect(c.getByTestId("assistente-concluido")).toBeVisible();
    await conferirTela(c, [c.getByRole("button", { name: "Fechar", exact: true })]);
  });

  test("concluído, ao receber a placa: mensagem e botão Fechar ao centro", async ({ page }) => {
    const r = await abrirReceber(page);
    await r.getByRole("button", { name: "Receber placa" }).click();
    await expect(r.getByTestId("assistente-concluido")).toHaveText("Placa recebida.");
    await conferirTela(r, [r.getByRole("button", { name: "Fechar", exact: true })]);
  });

  test("concluído, ao disponibilizar: mensagem e botão Fechar ao centro", async ({ page }) => {
    const d = await abrirDisponibilizar(page);
    await d.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
    await expect(d.getByTestId("assistente-concluido")).toBeVisible();
    await conferirTela(d, [d.getByRole("button", { name: "Fechar", exact: true })]);
  });

  test("conflito (a placa mudou em outra aba): a tela fica centralizada com o botão Revisar", async ({
    page,
    context,
  }) => {
    const d = await abrirDisponibilizar(page);
    const outra = await context.newPage();
    await abrirHidratada(outra, page.url().split("?")[0] as string);
    await outra.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
    const d2 = disponibilizacao(outra);
    await d2.getByLabel("Filial", { exact: true }).selectOption({ label: "Filial Exemplo A" });
    await d2.getByRole("button", { name: "Continuar" }).click();
    await d2.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
    await expect(d2.getByTestId("assistente-concluido")).toBeVisible();
    await d.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
    await expect(d.getByRole("alert")).toContainText("mudou");
    await conferirTela(d, [d.getByRole("button", { name: "Revisar com os dados atuais" })]);
  });

  test("erro de gravação: a tela fica centralizada, com Tentar de novo ao centro, e o retry grava", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    await irAteConferirOCadastro(page, { placa: placaUnica() });
    const c = cadastro(page);
    // Derruba só o envio da Server Action (o cabeçalho `next-action` a identifica).
    await page.route("**/*", (rota) =>
      rota.request().headers()["next-action"] ? rota.abort() : rota.continue(),
    );
    await c.getByRole("button", { name: "Cadastrar placa" }).click();
    await expect(c.getByRole("alert")).toContainText("Não foi possível gravar");
    await conferirTela(
      c,
      [
        c.getByRole("button", { name: "Tentar de novo" }),
        c.getByRole("button", { name: "Voltar ao formulário" }),
      ],
      true,
    );
    await page.unroute("**/*");
    await c.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(c.getByTestId("assistente-concluido")).toHaveText("Placa cadastrada.");
  });
}
