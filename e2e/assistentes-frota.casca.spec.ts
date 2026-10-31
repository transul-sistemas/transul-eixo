import { expect, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import {
  abrirOCadastro,
  cadastro,
  dialogo,
  FICHA,
  irAteConferirOCadastro,
  buscarNaLista,
  placaUnica,
  recebimento,
  sessaoIsolada,
} from "./apoio-assistentes-frota";

// Os assistentes da Frota no tablet (820) e no celular (390): stepper compacto, sem rolagem lateral,
// alvos de toque de pelo menos 40 px, mini-wizard como folha de baixo e o fluxo inteiro no toque.

test.beforeEach(async ({ context, baseURL }) => {
  await sessaoIsolada(context, baseURL);
});

// Abaixo de 640 px (celular) os alvos têm 44 px e o mini-wizard vira folha de baixo; no tablet o motor
// mantém os alvos de 32 a 36 px e o mini é um painel à direita.
const ehCelular = (page: import("@playwright/test").Page) => page.viewportSize()!.width < 640;

const semRolagemLateral = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("assistentes da Frota em tablet e celular", () => {
  test("o stepper vira 'Passo 1 de 6 · Identificação' e nada rola de lado", async ({ page }) => {
    await abrirOCadastro(page);
    const nav = cadastro(page).getByRole("navigation", { name: "Passos do assistente" });
    await expect(nav.locator("[data-passo-compacto]")).toHaveText("Passo 1 de 6 · Identificação");
    expect(await semRolagemLateral(page)).toBe(true);
  });

  test("os botões e campos do cadastro têm o alvo de toque do tamanho da tela", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    const c = cadastro(page);
    for (const alvo of [
      c.getByLabel("Placa", { exact: true }),
      c.getByLabel("Tipo de ativo"),
      c.getByRole("button", { name: "Continuar" }),
      c.getByRole("button", { name: "Fechar assistente" }),
    ]) {
      const caixa = await alvo.boundingBox();
      expect(caixa!.height).toBeGreaterThanOrEqual(ehCelular(page) ? 40 : 32);
    }
    await c.getByLabel("Tipo de ativo").selectOption({ label: "Cavalo" });
    await c.getByLabel("Ano").fill("2022");
    await c.getByLabel("Placa", { exact: true }).fill(placaUnica());
    await c.getByLabel("RENAVAM").fill("00639884962");
    await c.getByRole("button", { name: "Continuar" }).click();
    const mais = await c.getByRole("button", { name: "Cadastrar marca" }).boundingBox();
    expect(mais!.width).toBeGreaterThanOrEqual(ehCelular(page) ? 40 : 32);
    expect(mais!.height).toBeGreaterThanOrEqual(ehCelular(page) ? 40 : 32);
  });

  test("o + abre o mini-wizard dentro da tela (folha de baixo no celular, painel à direita no tablet)", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    const c = cadastro(page);
    await c.getByLabel("Tipo de ativo").selectOption({ label: "Cavalo" });
    await c.getByLabel("Ano").fill("2022");
    await c.getByLabel("Placa", { exact: true }).fill(placaUnica());
    await c.getByLabel("RENAVAM").fill("00639884962");
    await c.getByRole("button", { name: "Continuar" }).click();
    await c.getByRole("button", { name: "Cadastrar marca" }).tap();
    const mini = dialogo(page, "Cadastrar marca");
    await expect(mini).toBeVisible();
    const caixa = (await mini.boundingBox())!;
    const tela = page.viewportSize()!;
    expect(caixa.x).toBeGreaterThanOrEqual(0);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(tela.width + 1);
    if (ehCelular(page)) {
      expect(caixa.y + caixa.height).toBeGreaterThan(tela.height - 2); // encostada embaixo
      expect(caixa.y).toBeGreaterThan(tela.height * 0.05);
    } else {
      expect(caixa.x + caixa.width).toBeGreaterThan(tela.width - 2); // encostado à direita
      expect(caixa.height).toBeGreaterThan(tela.height - 2); // de ponta a ponta
    }
  });

  test("cadastra uma placa inteira no toque", async ({ page }) => {
    const placa = placaUnica();
    await abrirOCadastro(page);
    await irAteConferirOCadastro(page, { placa });
    await cadastro(page).getByRole("button", { name: "Cadastrar placa" }).tap();
    await expect(cadastro(page).getByTestId("assistente-concluido")).toHaveText(
      "Placa cadastrada.",
    );
    await cadastro(page).getByRole("button", { name: "Fechar", exact: true }).tap();
    await expect(await buscarNaLista(page, placa)).toHaveCount(1);
    expect(await semRolagemLateral(page)).toBe(true);
  });

  test("a ficha mostra as ações do momento com alvo de toque e abre o recebimento", async ({
    page,
  }) => {
    await abrirHidratada(page, FICHA("AAA0A00"));
    const botao = page.getByRole("button", { name: "Receber placa" });
    expect((await botao.boundingBox())!.height).toBeGreaterThanOrEqual(ehCelular(page) ? 40 : 32);
    await botao.tap();
    await expect(recebimento(page)).toBeVisible();
    expect(await semRolagemLateral(page)).toBe(true);
  });
});
