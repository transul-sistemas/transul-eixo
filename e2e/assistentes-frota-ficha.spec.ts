import { expect, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import { abrirLista, dialogo, FICHA, sessaoIsolada } from "./apoio-assistentes-frota";

// Mudar situação pela ficha da placa: escolhe uma sigla que vale para o contexto (SDo vale solta ou
// em conjunto), confere e grava; a ficha passa a mostrar a nova situação. Um armazém de exemplo por teste.

test.beforeEach(async ({ context, baseURL }) => {
  await sessaoIsolada(context, baseURL);
});

test("mudar situação: escolhe a situação, confere e a ficha mostra a nova", async ({ page }) => {
  await abrirLista(page, "?chip=patio&chip=cavalo");
  const placa = (await page
    .locator("[data-espiar-placa]")
    .first()
    .getAttribute("data-espiar-placa"))!;
  await abrirHidratada(page, FICHA(placa));
  await page.getByRole("button", { name: "Mudar situação" }).click();
  const d = dialogo(page, "Mudar situação");
  await expect(d).toBeVisible();
  // Nunca a baixa, e só o que a régua aceita para o contexto.
  await expect(d.getByRole("option", { name: /^VND/ })).toHaveCount(0);
  await d.getByLabel("Nova situação").selectOption("SDo");
  await d.getByRole("button", { name: "Continuar" }).click();
  await expect(d).toContainText("SDo");
  await d.getByRole("button", { name: "Mudar situação" }).click();
  await expect(d.getByTestId("assistente-concluido")).toHaveText("Situação mudada.");
  await d.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(d).toBeHidden();
  await expect(page.getByText("SDo").first()).toBeVisible();
});
