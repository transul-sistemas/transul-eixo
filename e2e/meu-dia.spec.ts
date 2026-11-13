import { expect, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import { sessaoIsolada } from "./apoio-assistentes-frota";

// Início › Meu dia como Administrador (rodada 2, 12/11/2026): o Administrador não age em nome de
// ninguém (H5), então vê a fila em MODO LEITURA, sem o popup "Receber placas" e sem os botões de
// decidir. O caminho de quem decide (gestor de destino: aceitar, com pendências, recusar com motivo,
// clique duplo, fechar com decisões) fica nos testes de componente e no cenário 1 da demonstração
// (banco), onde há um gestor Demo de destino.

const ROTA = "/inicio/meu-dia";
const PLACA = "AAA0A00";

test.beforeEach(async ({ context, baseURL }) => {
  await sessaoIsolada(context, baseURL);
});

test.describe("Meu dia (Administrador, só leitura)", () => {
  test("entra e vê a fila em modo leitura, com o CR vigente, a pendência e o olhinho da linha", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await expect(page.getByRole("heading", { name: "Meu dia", level: 1 })).toBeVisible();
    await expect(page.getByText("Teste", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Você vê a fila em modo leitura: só o gestor de destino decide cada placa."),
    ).toBeVisible();
    const linha = page.locator(`[data-pedido="${PLACA}"]`);
    await expect(linha).toBeVisible();
    await expect(linha).toContainText("CRLV vence em breve");
    await expect(linha.getByRole("button", { name: `Ver detalhes de ${PLACA}` })).toBeVisible();
  });

  test("o popup Receber placas não abre e não há como decidir", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await expect(page.locator(`[data-pedido="${PLACA}"]`)).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Receber placas" })).toHaveCount(0);
    await expect(page.getByLabel("Aceitar", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Recusar", { exact: true })).toHaveCount(0);
  });
});
