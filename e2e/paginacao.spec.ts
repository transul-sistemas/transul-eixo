import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// 20 linhas por página em toda lista, com o seletor 20, 50 e 100 lembrado e a página no banco
// (docs/decisoes.md, 10/11/2026). A grade do Acompanhamento só existe no modo banco: nos dados de
// exemplo (o do CI) o teste dela se declara pulado, e roda no servidor com o banco local.
const linhasDasPlacas = (page: Page) =>
  page.getByRole("table", { name: "Placas" }).locator("tbody tr");
const tamanho = (page: Page) => page.getByRole("combobox", { name: "Linhas por página" });
const TELAS = [
  { nome: "1366 × 768", largura: 1366, altura: 768 },
  { nome: "1092 × 614", largura: 1092, altura: 614 },
];

test.describe("lista de placas: 20 por página, troca para 50", () => {
  test("abre com 20 linhas e o resumo 1–20; escolher 50 mostra 50 e fica lembrado ao sair e voltar", async ({
    page,
  }) => {
    await abrirHidratada(page, "/frota/placas");
    await expect(tamanho(page)).toHaveValue("20");
    await expect(linhasDasPlacas(page)).toHaveCount(20);
    await expect(page.getByTestId("resumo-da-pagina")).toContainText("Mostrando 1–20 de");
    await tamanho(page).selectOption("50");
    await expect(linhasDasPlacas(page)).toHaveCount(50);
    await expect(page.getByTestId("resumo-da-pagina")).toContainText("Mostrando 1–50 de");
    await expect(page).not.toHaveURL(/tam=/);
    await abrirHidratada(page, "/frota/carteira");
    await abrirHidratada(page, "/frota/placas");
    await expect(tamanho(page)).toHaveValue("50");
  });
});

for (const tela of TELAS) {
  test.describe(`grade do Acompanhamento em ${tela.nome}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: tela.largura, height: tela.altura });
      await abrirHidratada(page, "/frota/acompanhamento");
      const soBanco = await page.getByText("O Acompanhamento lê só do banco").count();
      test.skip(soBanco > 0, "o Acompanhamento não tem dados de exemplo; roda com o banco local");
      await expect(page.getByTestId("grade-do-mes")).toBeVisible();
    });

    test("Auto cabe na janela, o paginador fica visível sem rolar a página e a troca para 50 vale", async ({
      page,
    }) => {
      const linhas = page.getByTestId("grade-do-mes").locator('[data-linha="conjunto"]');
      // "Linhas: Auto" é o padrão: o que cabe na janela (de 3 a 100 linhas), nunca mais que isso.
      await expect(tamanho(page)).toHaveValue("auto");
      await expect.poll(() => linhas.count()).toBeLessThanOrEqual(100);
      // A página não rola: o paginador já está à vista, sem mexer a roda do mouse.
      await expect(page.getByTestId("total-da-grade")).toBeInViewport({ ratio: 1 });
      await expect(tamanho(page)).toBeInViewport({ ratio: 1 });
      const raiz = await page.evaluate(() => {
        const r = document.scrollingElement as Element;
        return { conteudo: r.scrollWidth, janela: r.clientWidth };
      });
      expect(raiz.conteudo).toBeLessThanOrEqual(raiz.janela);
      await tamanho(page).selectOption("50");
      await expect(page).toHaveURL(/tam=50/);
      await expect.poll(() => linhas.count()).toBeLessThanOrEqual(50);
    });
  });
}
