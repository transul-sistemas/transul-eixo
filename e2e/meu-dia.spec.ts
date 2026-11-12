import { expect, type Page, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import { dialogo, sessaoIsolada } from "./apoio-assistentes-frota";

// Início › Meu dia (tela em teste, só do Administrador): a fila guiada abre sozinha o popup "Receber
// placas"; cada placa é um pedido independente (Aceitar, Com pendências, Recusar com motivo). No exemplo
// há um pedido aberto para quem usa (AAA0A00, com duas pendências conhecidas), então só "Com pendências"
// e "Recusar" valem; o lote com várias placas, com falha em uma delas, fica no cenário 1 da
// demonstração (banco). ESCRITO, ainda não rodado (CI e Alexandre rodam).

const ROTA = "/inicio/meu-dia";
const PLACA = "AAA0A00";
const lote = (page: Page) => dialogo(page, "Receber placas");

test.beforeEach(async ({ context, baseURL }) => {
  await sessaoIsolada(context, baseURL);
});

test.describe("Meu dia (Administrador)", () => {
  test("entra, vê a fila e o popup Receber placas abre sozinho, com o CR vigente e o olhinho da linha", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await expect(page.getByRole("heading", { name: "Meu dia", level: 1 })).toBeVisible();
    await expect(page.getByText("Teste", { exact: true }).first()).toBeVisible();
    const d = lote(page);
    await expect(d).toBeVisible();
    await expect(d).toContainText("Tarefa 1 de 3 do seu dia");
    const linha = d.locator(`[data-pedido="${PLACA}"]`);
    await expect(linha).toBeVisible();
    await expect(linha).toContainText("CRLV vence em breve");
    await expect(linha.getByRole("button", { name: `Ver detalhes de ${PLACA}` })).toBeVisible();
    // pendência conhecida: aceitar limpo não vale, só "Com pendências" e "Recusar"
    await expect(linha.getByLabel("Aceitar", { exact: true })).toBeDisabled();
  });

  test("sem decidir, não avança; recusar sem motivo bloqueia; com motivo grava e diz X de Y", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    const d = lote(page);
    await d.getByRole("button", { name: "Continuar" }).click();
    await expect(d).toContainText(`Escolha o que fazer com a placa ${PLACA}`);

    const linha = d.locator(`[data-pedido="${PLACA}"]`);
    await linha.getByLabel("Recusar", { exact: true }).check();
    await d.getByRole("button", { name: "Continuar" }).click();
    await expect(d).toContainText(`Informe o motivo da recusa da placa ${PLACA}`);

    await linha.getByLabel("Motivo (obrigatório)").fill("Placa enviada por engano");
    await d.getByRole("button", { name: "Continuar" }).click();
    await d.getByRole("button", { name: "Confirmar decisões" }).click();
    await expect(d.getByTestId("assistente-concluido")).toContainText(
      "1 de 1 decisão gravada: 1 recusada.",
    );
    await d.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(d).toBeHidden();
    // a fila atualiza: a placa decidida não volta como pedido
    await expect(page.getByText("Nenhuma placa espera a sua decisão.")).toBeVisible();
  });

  test("aceitar com pendências grava uma vez, mesmo com clique duplo", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const d = lote(page);
    const linha = d.locator(`[data-pedido="${PLACA}"]`);
    await linha.getByLabel("Com pendências", { exact: true }).check();
    await d.getByRole("button", { name: "Continuar" }).click();
    await d.getByRole("button", { name: "Confirmar decisões" }).dblclick();
    await expect(d.getByTestId("assistente-concluido")).toContainText(
      "1 de 1 decisão gravada: 1 com pendências.",
    );
  });

  test("fechar com decisões preenchidas pergunta antes de descartar", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const d = lote(page);
    await d.locator(`[data-pedido="${PLACA}"]`).getByLabel("Recusar", { exact: true }).check();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toBeVisible();
  });
});
