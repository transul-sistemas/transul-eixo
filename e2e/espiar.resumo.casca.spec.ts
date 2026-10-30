import { expect, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// O resumo no tablet (painel lateral) e no celular (folha de baixo): o conteúdo rola por dentro,
// o rodapé e o cabeçalho ficam à vista e a página não ganha rolagem lateral.

const painelDe = (page: import("@playwright/test").Page, placa: string) =>
  page.getByRole("dialog", { name: `Resumo da placa ${placa}` });

test.describe("resumo da placa em tablet e celular", () => {
  test("o resumo aparece inteiro por dentro, com cabeçalho e rodapé sempre à vista", async ({
    page,
  }) => {
    await abrirHidratada(page, "/frota/placas?espiar=AAA0A04");
    const painel = painelDe(page, "AAA0A04");
    await expect(painel.getByRole("heading", { name: "Situação" })).toBeVisible();
    await expect(painel.getByRole("button", { name: "Fechar painel" })).toBeInViewport();
    await expect(painel.getByRole("link", { name: "Abrir ficha completa" })).toBeInViewport();
    const corpo = painel.locator("[data-painel-corpo]");
    await corpo.evaluate((e) => e.scrollTo(0, e.scrollHeight));
    await expect(painel.getByRole("heading", { name: "Dados" })).toBeInViewport();
    await expect(painel.getByRole("link", { name: "Abrir ficha completa" })).toBeInViewport();
    await expect(painel).toBeVisible(); // rolar o conteúdo não fecha
    const m = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(m.pagina).toBeLessThanOrEqual(m.janela);
  });

  test("os alertas aparecem por extenso", async ({ page }) => {
    await abrirHidratada(page, "/frota/placas?espiar=AAA0A24");
    await expect(
      painelDe(page, "AAA0A24")
        .getByRole("listitem")
        .filter({ hasText: "Documento (CRLV) vencido" }),
    ).toBeVisible();
  });

  test("placa que não existe mostra o que fazer, e o botão de fechar fica à vista", async ({
    page,
  }) => {
    await abrirHidratada(page, "/frota/placas?espiar=ZZZ9Z99");
    const painel = painelDe(page, "ZZZ9Z99");
    await expect(painel.getByRole("heading", { name: "Placa não encontrada" })).toBeVisible();
    await expect(painel.getByRole("button", { name: "Fechar painel" })).toBeInViewport();
  });
});
