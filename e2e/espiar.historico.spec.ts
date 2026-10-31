import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// Achados da revisão independente da 2C-2: histórico, foco, anúncio e dado velho do painel.
// Pensados para o build de produção.

const ROTA = "/frota/placas";

const qualquerPainel = (page: Page) => page.getByRole("dialog", { name: /^Resumo da placa/ });
const painelDe = (page: Page, placa: string) =>
  page.getByRole("dialog", { name: `Resumo da placa ${placa}` });
const botaoEspiar = (page: Page, placa: string) =>
  page.getByRole("button", { name: `Espiar ${placa}`, exact: true });
const primeiraPlaca = async (page: Page) =>
  (await page.locator("[data-espiar-placa]").first().getAttribute("data-espiar-placa"))!;

/** Vai de outra página para a lista, para o Voltar ter para onde ir. */
async function chegarNaLista(page: Page, rota: string) {
  await abrirHidratada(page, "/inicio/tarefas");
  await page.goto(rota);
  await abrirHidratada(page, rota);
}

test.describe("fechar desfaz o passo do histórico", () => {
  test("abrir pela lista e fechar com Esc: um único Voltar depois chega à página de antes", async ({
    page,
  }) => {
    await chegarNaLista(page, ROTA);
    const placa = await primeiraPlaca(page);
    await botaoEspiar(page, placa).click();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/inicio\/tarefas/); // o fechar usou o Voltar, não empilhou
  });

  test("abrir e fechar com Esc antes de a URL confirmar: também desfaz só o passo", async ({
    page,
  }) => {
    await chegarNaLista(page, `${ROTA}?lento=1200`);
    const placa = await primeiraPlaca(page);
    await botaoEspiar(page, placa).click();
    await expect(qualquerPainel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await page.waitForTimeout(3500); // a resposta lenta chega e o fechamento é refeito
    await expect(qualquerPainel(page)).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has("espiar")).toBe(false);
    await page.goBack();
    await expect(page).toHaveURL(/\/inicio\/tarefas/);
  });

  test("fechar logo depois de trocar de placa (replace pendente) não reabre o painel", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await chegarNaLista(page, `${ROTA}?lento=1500`);
    const placa = await primeiraPlaca(page);
    await botaoEspiar(page, placa).click();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`), { timeout: 15_000 });
    await expect(qualquerPainel(page).getByRole("button", { name: "Próxima placa" })).toBeVisible({
      timeout: 15_000,
    });
    await qualquerPainel(page).getByRole("button", { name: "Próxima placa" }).click();
    await page.keyboard.press("Escape"); // antes de a placa seguinte chegar
    await page.waitForTimeout(5000);
    await expect(qualquerPainel(page)).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has("espiar")).toBe(false);
  });

  test("ao fechar, o painel não pisca aberto de novo (sequência só de aberto para fechado)", async ({
    page,
  }) => {
    await chegarNaLista(page, ROTA);
    const placa = await primeiraPlaca(page);
    await botaoEspiar(page, placa).click();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
    await expect(qualquerPainel(page)).toBeVisible();
    await page.evaluate(() => {
      const w = window as unknown as { __estados: boolean[]; __parar: boolean };
      w.__estados = [];
      w.__parar = false;
      const olhar = () => {
        const aberto = document.querySelector('[role="dialog"][data-open]') !== null;
        if (w.__estados.at(-1) !== aberto) w.__estados.push(aberto);
        if (!w.__parar) requestAnimationFrame(olhar);
      };
      olhar();
    });
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await page.waitForTimeout(1500);
    const estados = await page.evaluate(() => {
      const w = window as unknown as { __estados: boolean[]; __parar: boolean };
      w.__parar = true;
      return w.__estados;
    });
    expect(estados, "aberto -> fechado, sem reabrir").toEqual([true, false]);
  });
});

test.describe("foco, anúncio e dado velho", () => {
  test("clicar numa placa do conjunto mantém o foco dentro do painel (no título)", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?espiar=AAA0A00`);
    const painel = painelDe(page, "AAA0A00");
    await expect(painel).toBeVisible();
    const vizinha = painel.locator(
      'section:has(h3:text-is("Conjunto")) button[aria-label^="Espiar "]',
    );
    expect(await vizinha.count()).toBeGreaterThan(0);
    const outra = ((await vizinha.first().getAttribute("aria-label")) ?? "").replace("Espiar ", "");
    await vizinha.first().click();
    await expect(painelDe(page, outra)).toBeVisible();
    await expect(painelDe(page, outra).getByRole("heading", { level: 2 })).toBeFocused();
  });

  test("o anúncio da troca some quando o painel fecha por fora (Voltar) e não vaza na próxima abertura", async ({
    page,
  }) => {
    await chegarNaLista(page, ROTA);
    const placa = await primeiraPlaca(page);
    await botaoEspiar(page, placa).click();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
    await qualquerPainel(page).getByRole("button", { name: "Próxima placa" }).click();
    await expect(qualquerPainel(page).locator('[role="status"].sr-only')).not.toHaveText("");
    await expect(page).toHaveURL(/espiar=/);
    await page.goBack(); // fecha por fora do onOpenChange
    await expect(qualquerPainel(page)).toBeHidden();
    await botaoEspiar(page, placa).click();
    await expect(qualquerPainel(page)).toBeVisible();
    await expect(qualquerPainel(page).locator('[role="status"].sr-only')).toHaveText("");
  });

  test("reabrir uma placa que deu erro mostra o carregando, não o erro velho", async ({ page }) => {
    test.setTimeout(60_000);
    await abrirHidratada(page, `${ROTA}?falhaNoPainel=1&lento=1500`);
    await page.locator("[data-espiar-placa]").first().waitFor();
    const placa = await primeiraPlaca(page);
    await botaoEspiar(page, placa).click();
    await expect(qualquerPainel(page).getByRole("alert")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await botaoEspiar(page, placa).click();
    await expect(qualquerPainel(page)).toBeVisible();
    // Na janela da resposta lenta o painel mostra o carregando, nunca o erro da abertura anterior.
    await expect(
      qualquerPainel(page).getByRole("status", { name: "Carregando o resumo" }),
    ).toBeVisible();
    await expect(qualquerPainel(page).getByRole("alert")).toHaveCount(0);
  });
});

test.describe("foco ao fechar quando a lista não tem linha para devolver", () => {
  test("lista vazia: Esc leva o foco ao campo de busca, nunca ao body", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?q=zzzzzzzz&espiar=AAA0A00`);
    await expect(painelDe(page, "AAA0A00")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page.locator('[role="search"] input')).toBeFocused();
  });

  test("lista com erro: mostra o erro e nenhum painel (não há o que devolver)", async ({
    page,
  }) => {
    await page.goto(`${ROTA}?falha=1&espiar=AAA0A00`);
    await expect(page.getByText("Não foi possível carregar as placas")).toBeVisible();
    await expect(qualquerPainel(page)).toHaveCount(0);
  });
});

test.describe("link direto: clicar na própria placa antes de o painel liberar", () => {
  test("Esc depois fecha o painel sem sair da lista", async ({ page }) => {
    test.setTimeout(180_000);
    const cdp = await page.context().newCDPSession(page);
    const PERFIS = [
      { cpu: 6, base: 100, passo: 200 },
      { cpu: 8, base: 60, passo: 350 },
      { cpu: 4, base: 200, passo: 150 },
      { cpu: 10, base: 40, passo: 500 },
    ];
    let atingiu = false;
    for (const perfil of PERFIS) {
      let n = 0;
      await page.unroute("**/_next/static/**/*.js").catch(() => {});
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: perfil.cpu });
      await page.route("**/_next/static/**/*.js", async (rota) => {
        await new Promise((r) => setTimeout(r, perfil.base + (n++ % 6) * perfil.passo));
        await rota.continue();
      });
      await page.goto(`${ROTA}?espiar=AAA0A00`);
      // A linha já tem o clique do React, e o painel de link direto ainda não abriu.
      const janela = await page
        .waitForFunction(
          () => {
            const botao = document.querySelector('[data-espiar-placa="AAA0A00"]');
            const temReact =
              !!botao && Object.keys(botao).some((k) => k.startsWith("__reactProps"));
            return temReact && document.querySelector('[role="dialog"]') === null;
          },
          undefined,
          { timeout: 30_000, polling: 5 },
        )
        .then(() => true)
        .catch(() => false);
      if (!janela) continue;
      atingiu = true;
      await page.evaluate(() =>
        document.querySelector<HTMLElement>('[data-espiar-placa="AAA0A00"]')?.click(),
      );
      break;
    }
    expect(atingiu, "nenhum perfil de atraso colocou o clique antes de o painel liberar").toBe(
      true,
    );
    await expect(painelDe(page, "AAA0A00")).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/frota\/placas$/); // não saiu da lista
  });
});
