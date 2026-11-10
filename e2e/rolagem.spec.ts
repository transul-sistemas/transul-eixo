import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// A página rola quando o conteúdo passa da altura da janela, com o menu e o topo fixos, e a tabela
// guarda a própria rolagem. Nada fica fora do alcance da rodinha nem do teclado (docs/decisoes.md,
// 10/11/2026). Mede nas três telas da queixa: 1366 × 768, 1366 a 125% (1092 × 614) e celular.
const TELAS = [
  { nome: "1366 × 768", largura: 1366, altura: 768 },
  { nome: "1092 × 614 (1366 a 125%)", largura: 1092, altura: 614 },
  { nome: "celular 390 × 844", largura: 390, altura: 844 },
];
const ROTA = "/frota/placas";
const proxima = (page: Page) => page.getByRole("link", { name: "Próxima página" });
const resumo = (page: Page) => page.getByTestId("resumo-da-pagina");
const regiao = (page: Page) => page.getByRole("region", { name: "Placas, área rolável" });

async function semRolagemLateral(page: Page) {
  const largura = await page.evaluate(() => {
    const raiz = document.scrollingElement as Element;
    return { conteudo: raiz.scrollWidth, janela: raiz.clientWidth };
  });
  expect(largura.conteudo).toBeLessThanOrEqual(largura.janela);
}

for (const tela of TELAS) {
  test.describe(`rolagem da página em ${tela.nome}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: tela.largura, height: tela.altura });
      await abrirHidratada(page, ROTA);
      await expect(page.getByRole("table", { name: "Placas" }).locator("tbody tr")).toHaveCount(20);
    });

    test("a rodinha leva ao fim: o resumo e o botão de próxima página aparecem", async ({
      page,
    }) => {
      await page.mouse.move(tela.largura / 2, tela.altura / 2);
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 2000);
        await page.waitForTimeout(150);
      }
      await expect(resumo(page)).toBeInViewport({ ratio: 1 });
      await expect(proxima(page)).toBeInViewport({ ratio: 1 });
      await semRolagemLateral(page);
    });

    test("o teclado rola sem clicar antes: End chega ao paginador, Page Down e Espaço andam", async ({
      page,
    }) => {
      // Recém aberta, sem clique: o foco está no documento, e o teclado tem de rolar a página.
      await page.keyboard.press("PageDown");
      await page.waitForTimeout(200);
      const [y, yDaTabela] = await page.evaluate(() => [
        window.scrollY,
        document.querySelector<HTMLElement>('[role="region"][aria-label$="área rolável"]')!
          .scrollTop,
      ]);
      expect(y + yDaTabela).toBeGreaterThan(0);
      await page.keyboard.press("Space");
      await page.keyboard.press("End");
      await page.waitForTimeout(300);
      await expect(proxima(page)).toBeInViewport({ ratio: 1 });
    });

    test("a tabela é a tela: ocupa a maior parte da janela e rola dentro de si", async ({
      page,
    }) => {
      const caixa = await regiao(page).boundingBox();
      expect(caixa).not.toBeNull();
      expect(caixa!.height).toBeGreaterThanOrEqual(tela.altura * 0.6);
      await semRolagemLateral(page);
    });
  });
}
