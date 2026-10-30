import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// Corridas do painel de espiar: o clique que chega antes de a barra de consulta hidratar e o
// Voltar do navegador logo depois de abrir. Pensados para o build de produção.

const ROTA = "/frota/placas";
const ERRO_DE_HIDRATACAO = /hydrat|did(?:n't| not) match|server rendered html/i;

const qualquerPainel = (page: Page) => page.getByRole("dialog", { name: /^Resumo da placa/ });
const botaoEspiar = (page: Page, placa: string) =>
  page.getByRole("button", { name: `Espiar ${placa}`, exact: true });

function vigiarErros(page: Page) {
  const erros: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && ERRO_DE_HIDRATACAO.test(m.text())) erros.push(m.text());
  });
  page.on("pageerror", (e) => {
    if (ERRO_DE_HIDRATACAO.test(e.message)) erros.push(e.message);
  });
  return erros;
}

/** O elemento já tem o React por cima? (o fiber só existe depois da hidratação) */
const hidratado = (alvo: string) => {
  const elemento = document.querySelector(alvo);
  return !!elemento && Object.keys(elemento).some((chave) => chave.startsWith("__reactFiber"));
};

test.describe("clique antes de a barra de consulta hidratar", () => {
  // A lista hidrata antes da barra (a barra é uma fronteira de Suspense aninhada). Atrasar só os
  // arquivos que a barra precisa não é possível de fora, então varia-se o atraso de cada .js até
  // o clique cair na janela "lista pronta, barra ainda não". O teste só passa se a janela foi
  // atingida de verdade em alguma das tentativas.
  const PERFIS = [
    { cpu: 6, base: 100, passo: 200 },
    { cpu: 8, base: 60, passo: 350 },
    { cpu: 4, base: 200, passo: 150 },
    { cpu: 10, base: 40, passo: 500 },
  ];

  test("o painel abre sem erro de hidratação e sem aria-hidden preso", async ({ page }) => {
    test.setTimeout(240_000);
    const erros = vigiarErros(page);
    const cdp = await page.context().newCDPSession(page);
    let atingiu = false;

    for (const perfil of PERFIS) {
      let n = 0;
      await page.unroute("**/_next/static/**/*.js").catch(() => {});
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: perfil.cpu });
      await page.route("**/_next/static/**/*.js", async (rota) => {
        await new Promise((r) => setTimeout(r, perfil.base + (n++ % 6) * perfil.passo));
        await rota.continue();
      });
      await page.goto(ROTA);
      const janela = await page
        .waitForFunction(
          () => {
            const botao = document.querySelector("[data-espiar-placa]");
            const barra = document.querySelector('[role="search"] input');
            const temReact = (e: Element | null) =>
              !!e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
            const barraHidratada =
              !!barra && Object.keys(barra).some((k) => k.startsWith("__reactFiber"));
            // O botão tem o onClick do React e a barra ainda não hidratou.
            return temReact(botao) && !barraHidratada;
          },
          undefined,
          { timeout: 30_000, polling: 5 },
        )
        .then(() => true)
        .catch(() => false);
      if (!janela) continue;
      atingiu = true;
      await page.evaluate(() =>
        document.querySelector<HTMLElement>("[data-espiar-placa]")?.click(),
      );
      break;
    }

    expect(atingiu, "nenhum perfil de atraso colocou o clique entre a lista e a barra").toBe(true);
    await expect(qualquerPainel(page)).toBeVisible({ timeout: 60_000 });
    // Espera tudo hidratar; só então confere o console.
    await page.waitForFunction(hidratado, '[role="search"] input', { timeout: 60_000 });
    await page.waitForTimeout(2000);
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page.locator('[role="search"]')).not.toHaveAttribute("aria-hidden", /.*/);
    await expect(page.locator("main")).not.toHaveAttribute("aria-hidden", /.*/);
    expect(erros, "erro de hidratação no console").toEqual([]);
  });
});

test.describe("Voltar logo depois de abrir o painel", () => {
  /** Vai de outra página para a lista, para o Voltar ter para onde ir. */
  async function chegarNaLista(page: Page, rota: string) {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.goto(rota);
    await abrirHidratada(page, rota);
  }

  test("com a resposta lenta: Voltar antes de a URL confirmar não deixa o painel reabrir", async ({
    page,
  }) => {
    await chegarNaLista(page, `${ROTA}?lento=1500`);
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await botaoEspiar(page, placa).click();
    await expect(qualquerPainel(page)).toBeVisible(); // abertura otimista
    await page.goBack(); // a URL do painel ainda não chegou
    await page.waitForTimeout(4000); // dá tempo para a resposta lenta chegar e tentar reabrir
    await expect(qualquerPainel(page)).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has("espiar")).toBe(false);
    // Nada ficou preso: a página responde e não está inerte.
    await expect(page.locator("main")).not.toHaveAttribute("aria-hidden", /.*/);
    await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");
  });

  test("Voltar logo depois de a URL confirmar: fecha, fica na lista e não reabre", async ({
    page,
  }) => {
    await chegarNaLista(page, ROTA);
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await botaoEspiar(page, placa).click();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
    await page.goBack();
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await page.waitForTimeout(2500);
    await expect(qualquerPainel(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/frota\/placas$/);
    // E dá para abrir de novo normalmente.
    await botaoEspiar(page, placa).click();
    await expect(qualquerPainel(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
  });

  test("Voltar, Avançar e Voltar de novo, em sequência rápida, terminam fechados e consistentes", async ({
    page,
  }) => {
    await chegarNaLista(page, ROTA);
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await botaoEspiar(page, placa).click();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
    await page.goBack();
    await page.goForward();
    await page.goBack();
    await page.waitForTimeout(2500);
    const aberto = (await qualquerPainel(page).count()) > 0;
    const naUrl = new URL(page.url()).searchParams.has("espiar");
    expect(aberto, "o painel e a URL têm de concordar").toBe(naUrl);
    expect(naUrl).toBe(false);
  });
});
