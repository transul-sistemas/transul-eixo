import { expect, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import {
  abrirLista,
  disponibilizacao,
  FICHA,
  LISTA,
  passoAtual,
  recebimento,
  sessaoIsolada,
} from "./apoio-assistentes-frota";

// Receber placa (o pedido de transferência de exemplo está na AAA0A00) e Disponibilizar ao
// Operacional, pela ficha e pelo Ctrl+K. Cada teste usa um armazém de exemplo só dele.

test.beforeEach(async ({ context, baseURL }) => {
  await sessaoIsolada(context, baseURL);
});

const PLACA_COM_PEDIDO = "AAA0A00";

async function irAteAConferir(page: import("@playwright/test").Page) {
  const r = recebimento(page);
  for (const caixa of await r.getByLabel("Resolvida:", { exact: false }).all()) await caixa.check();
  await r.getByLabel("Conferi o que chegou").check();
  await r.getByRole("button", { name: "Continuar" }).click(); // situação
  await r.getByRole("button", { name: "Continuar" }).click(); // conjunto
  await r.getByRole("button", { name: "Continuar" }).click(); // conferir
  await expect(r.getByRole("button", { name: "Receber placa" })).toBeVisible();
}

test.describe("disponibilizar ao Operacional", () => {
  test("pela ficha: escolhe a filial e a placa vai a DOp", async ({ page }) => {
    await abrirLista(page, "?chip=patio&chip=cavalo");
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await abrirHidratada(page, FICHA(placa));
    await page.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
    const d = disponibilizacao(page);
    await expect(d).toBeVisible();
    await d.getByLabel("Filial", { exact: true }).selectOption({ label: "Filial Exemplo B" });
    await d.getByRole("button", { name: "Continuar" }).click();
    await expect(d).toContainText("Filial Exemplo B");
    await d.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
    await expect(d.getByTestId("assistente-concluido")).toHaveText(
      "Placa disponibilizada ao Operacional.",
    );
    await d.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(d).toBeHidden();
    await expect(page.getByText("DOp").first()).toBeVisible();
    // Já está no Operacional: a ação some.
    await expect(page.getByRole("button", { name: "Disponibilizar ao Operacional" })).toHaveCount(
      0,
    );
  });

  test("sem escolher a filial, avisa no campo e fica no passo", async ({ page }) => {
    await abrirLista(page, "?chip=patio&chip=cavalo");
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await abrirHidratada(page, FICHA(placa));
    await page.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
    const d = disponibilizacao(page);
    await d.getByLabel("Filial", { exact: true }).selectOption({ label: "Escolha…" });
    await d.getByRole("button", { name: "Continuar" }).click();
    await expect(d.getByText("Escolha a filial.")).toBeVisible();
    await expect(passoAtual(d)).toContainText("Filial");
  });

  test("pelo Ctrl+K: pergunta a placa e continua", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: /Buscar tela, modo ou ação/ }).fill("disponibilizar");
    await page.getByRole("option", { name: /Frota › Disponibilizar ao Operacional/ }).click();
    const escolher = page.getByRole("dialog", { name: "Disponibilizar ao Operacional" });
    await escolher.getByLabel("Escolher a placa").selectOption({ index: 1 });
    await escolher.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/placa=/);
    await expect(disponibilizacao(page).getByLabel("Filial", { exact: true })).toBeVisible();
  });

  test("placa que não pode ser disponibilizada diz por quê", async ({ page }) => {
    await abrirHidratada(page, `${LISTA}?assistente=disponibilizar&placa=AAA0A04`);
    const aviso = page.getByRole("dialog", { name: "Disponibilizar ao Operacional" });
    await expect(aviso).toContainText("Só placas em PÁT, VAz ou ETv");
    await aviso.getByRole("button", { name: "Fechar" }).click();
    await expect(aviso).toBeHidden();
  });

  test("duas abas: quem grava depois recebe o aviso de que a placa mudou", async ({
    page,
    context,
  }) => {
    await abrirLista(page, "?chip=patio&chip=cavalo");
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await abrirHidratada(page, FICHA(placa));
    await page.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
    const outra = await context.newPage();
    await abrirHidratada(outra, FICHA(placa));
    await outra.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
    for (const [aba, filial] of [
      [outra, "Filial Exemplo A"],
      [page, "Filial Exemplo B"],
    ] as const) {
      const d = disponibilizacao(aba);
      await d.getByLabel("Filial", { exact: true }).selectOption({ label: filial });
      await d.getByRole("button", { name: "Continuar" }).click();
      await d.getByRole("button", { name: "Disponibilizar ao Operacional" }).click();
    }
    await expect(disponibilizacao(outra).getByTestId("assistente-concluido")).toBeVisible();
    await expect(disponibilizacao(page).getByRole("alert")).toContainText("mudou");
  });
});

test.describe("receber placa", () => {
  test("pela ficha: confere, resolve as pendências e recebe", async ({ page }) => {
    await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
    await page.getByRole("button", { name: "Receber placa" }).click();
    const r = recebimento(page);
    await expect(r).toBeVisible();
    await expect(r.getByTestId("motivo-da-transferencia")).not.toBeEmpty();
    await irAteAConferir(page);
    await r.getByRole("button", { name: "Receber placa" }).click();
    await expect(r.getByTestId("assistente-concluido")).toHaveText("Placa recebida.");
    await r.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(r).toBeHidden();
    // O pedido foi atendido: a ação some da ficha.
    await expect(page.getByRole("button", { name: "Receber placa" })).toHaveCount(0);
  });

  test("não conclui sem conferir nem resolver as pendências", async ({ page }) => {
    await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
    await page.getByRole("button", { name: "Receber placa" }).click();
    const r = recebimento(page);
    await r.getByRole("button", { name: "Continuar" }).click();
    await expect(r.getByText("Confira o que chegou antes de concluir.")).toBeVisible();
    await expect(passoAtual(r)).toContainText("Chegada");
    await r.getByLabel("Conferi o que chegou").check();
    await r.getByRole("button", { name: "Continuar" }).click();
    await expect(r.getByText("Resolva todas as pendências antes de concluir.")).toBeVisible();
    await expect(passoAtual(r)).toContainText("Chegada");
  });

  test("a meta do conjunto só aparece para o cavalo", async ({ page }) => {
    await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
    await page.getByRole("button", { name: "Receber placa" }).click();
    const r = recebimento(page);
    for (const caixa of await r.getByLabel("Resolvida:", { exact: false }).all())
      await caixa.check();
    await r.getByLabel("Conferi o que chegou").check();
    await r.getByRole("button", { name: "Continuar" }).click();
    await r.getByRole("button", { name: "Continuar" }).click();
    // Passo do conjunto: a placa do pedido de exemplo é um cavalo.
    await expect(r.getByLabel("Meta do conjunto")).toBeVisible();
    await expect(r.getByText("Implementos do conjunto")).toBeVisible();
  });

  test("pelo Ctrl+K: lista as placas com pedido e abre o assistente da escolhida", async ({
    page,
  }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: /Buscar tela, modo ou ação/ }).fill("receber placa");
    await page.getByRole("option", { name: /Frota › Receber placa/ }).click();
    const escolher = page.getByRole("dialog", { name: "Receber placa" });
    await expect(escolher.getByLabel("Escolher a placa").locator("option")).toHaveCount(2);
    await escolher.getByLabel("Escolher a placa").selectOption({ index: 1 });
    await escolher.getByRole("button", { name: "Continuar" }).click();
    await expect(recebimento(page).getByLabel("Conferi o que chegou")).toBeVisible();
  });

  test("placa sem pedido pendente diz o que fazer", async ({ page }) => {
    await abrirHidratada(page, `${LISTA}?assistente=receber-placa&placa=AAA0A04`);
    await expect(page.getByRole("dialog", { name: "Receber placa" })).toContainText(
      "não tem pedido de transferência pendente",
    );
  });

  test("Esc fecha o assistente e devolve o foco ao botão da ficha", async ({ page }) => {
    await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
    const botao = page.getByRole("button", { name: "Receber placa" });
    await botao.click();
    await expect(recebimento(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(recebimento(page)).toBeHidden();
    await expect(botao).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${FICHA(PLACA_COM_PEDIDO)}$`));
  });
});

// Só cavalo ou caminhão vão ao Operacional: carreta (implemento), apoio e equipamento nunca, mesmo
// em PÁT, VAz ou ETv (o catálogo da régua diz em `tipos_validos` de DOp).
const MENSAGEM_DO_TIPO = "Só cavalo ou caminhão podem ser disponibilizados ao Operacional";

async function primeiraPlacaDe(page: import("@playwright/test").Page, consulta: string) {
  await abrirLista(page, consulta);
  return (await page.locator("[data-espiar-placa]").first().getAttribute("data-espiar-placa"))!;
}

test.describe("disponibilizar ao Operacional: só cavalo ou caminhão", () => {
  test("a ficha de uma carreta em PÁT não tem o botão", async ({ page }) => {
    const carreta = await primeiraPlacaDe(page, "?chip=patio&chip=implemento");
    await abrirHidratada(page, FICHA(carreta));
    await expect(page.getByRole("heading", { level: 1, name: carreta })).toBeVisible();
    await expect(page.getByRole("button", { name: "Disponibilizar ao Operacional" })).toHaveCount(
      0,
    );
  });

  test("a ficha de um cavalo em PÁT tem o botão", async ({ page }) => {
    const cavalo = await primeiraPlacaDe(page, "?chip=patio&chip=cavalo");
    await abrirHidratada(page, FICHA(cavalo));
    await expect(page.getByRole("button", { name: "Disponibilizar ao Operacional" })).toBeVisible();
  });

  test("pelo Ctrl+K, a carreta não aparece na lista de placas a escolher", async ({ page }) => {
    const carreta = await primeiraPlacaDe(page, "?chip=patio&chip=implemento");
    await abrirHidratada(page, "/inicio/tarefas");
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: /Buscar tela, modo ou ação/ }).fill("disponibilizar");
    await page.getByRole("option", { name: /Frota › Disponibilizar ao Operacional/ }).click();
    const escolher = page.getByRole("dialog", { name: "Disponibilizar ao Operacional" });
    const opcoes = escolher.getByLabel("Escolher a placa").locator("option");
    await expect(opcoes.nth(1)).toBeAttached(); // a lista chegou: além do "Escolha…", há placas
    const textos = await opcoes.allTextContents();
    expect(textos.length).toBeGreaterThan(1);
    expect(textos.join("|")).not.toContain(carreta);
  });

  test("pela URL, a carreta é recusada com a mensagem do tipo, e nada abre", async ({ page }) => {
    const carreta = await primeiraPlacaDe(page, "?chip=patio&chip=implemento");
    await abrirHidratada(page, `${LISTA}?assistente=disponibilizar&placa=${carreta}`);
    const aviso = page.getByRole("dialog", { name: "Disponibilizar ao Operacional" });
    await expect(aviso).toContainText(MENSAGEM_DO_TIPO);
    await expect(aviso.getByLabel("Filial", { exact: true })).toHaveCount(0);
  });
});
