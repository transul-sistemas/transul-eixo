import { expect, test, type Page } from "@playwright/test";

// A hidratação lenta de propósito: CPU reduzida em 6x e cada arquivo .js atrasado por um tempo
// diferente, para as fronteiras de Suspense (topo, barra de consulta, lista) hidratarem em ordens e
// momentos variados. É onde um atraso fixo no painel de link direto falha.

const ESTRANGULAMENTO_DA_CPU = 6;
const ERRO_DE_HIDRATACAO = /hydrat|did(?:n't| not) match|server rendered html/i;

async function deixarLento(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: ESTRANGULAMENTO_DA_CPU });
  let n = 0;
  await page.route("**/_next/static/**/*.js", async (rota) => {
    const atraso = 150 + (n++ % 5) * 220;
    await new Promise((r) => setTimeout(r, atraso));
    await rota.continue();
  });
}

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

const hidratado = (alvo: string) => {
  const elemento = document.querySelector(alvo);
  return !!elemento && Object.keys(elemento).some((chave) => chave.startsWith("__reactFiber"));
};

async function esperarHidratacaoTotal(page: Page) {
  for (const alvo of [
    "header",
    '[role="search"] input',
    "table tbody tr, [data-testid='lista-vazia']",
  ]) {
    await page.waitForFunction(hidratado, alvo, { timeout: 60_000 });
  }
  await page.waitForTimeout(1500);
}

const dialogo = (page: Page) => page.getByRole("dialog", { name: /^Resumo da placa/ });

/** Os cenários do painel por link direto com a hidratação lenta; rodam em desktop e celular. */
export function testesDeHidratacaoLenta() {
  const abertura = [
    ["lista com dados", "/frota/placas?espiar=AAA0A01"],
    ["lista vazia", "/frota/placas?q=zzzzzzzz&espiar=AAA0A01"],
    ["esqueleto de carregamento e depois a lista", "/frota/placas?lento=1500&espiar=AAA0A01"],
  ] as const;

  for (const [nome, rota] of abertura) {
    test(`link direto com hidratação lenta, ${nome}: abre sem erro e sem aria-hidden indevido`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const erros = vigiarErros(page);
      await deixarLento(page);
      await page.goto(rota);
      await expect(dialogo(page)).toBeVisible({ timeout: 60_000 });
      await expect(dialogo(page).getByRole("heading", { name: "AAA0A01" })).toBeVisible();

      // Espera a hidratação terminar de vez (o erro aparece quando a última fronteira hidrata,
      // que pode ser depois de o painel abrir) e só então confere o console.
      await esperarHidratacaoTotal(page);
      await page.keyboard.press("Escape");
      await expect(dialogo(page)).toBeHidden();
      await expect(page.locator('[role="search"]')).not.toHaveAttribute("aria-hidden", /.*/);
      await expect(page.locator("main")).not.toHaveAttribute("aria-hidden", /.*/);
      await expect(page.locator("header").first()).not.toHaveAttribute("aria-hidden", /.*/);
      expect(erros, "erro de hidratação no console").toEqual([]);
    });
  }

  test("link direto com a lista em erro: mostra o erro, não abre painel e não trava", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const erros = vigiarErros(page);
    await deixarLento(page);
    await page.goto("/frota/placas?falha=1&espiar=AAA0A01");
    await expect(page.getByText("Não foi possível carregar as placas")).toBeVisible({
      timeout: 60_000,
    });
    await expect(dialogo(page)).toHaveCount(0);
    expect(erros, "erro de hidratação no console").toEqual([]);
  });
}
