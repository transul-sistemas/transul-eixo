import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import { deixarLento } from "./apoio-lentidao";

// O retorno da lista tem de ser decidido por sinais reais (Voltar, Avançar e os links de voltar),
// nunca por relógio: recarregar (F5) logo depois do Voltar, em máquina lenta, começa no topo.
// REPETIR=30 repete cada cenário 30 vezes seguidas (padrão: 1). CPU_LENTA muda a lentidão (padrão: 6).

const LISTA = "/frota/placas";
const REPETICOES = Number(process.env.REPETIR ?? "1");
const CPU = Number(process.env.CPU_LENTA ?? "6");

const caixa = (page: Page) => page.locator('[role="region"][aria-label*="rolável"]');
const linhas = (page: Page) => page.locator('table[aria-label="Placas"] tbody tr');
const linkDaFicha = (page: Page, placa: string) =>
  page.getByRole("link", { name: `Abrir ficha de ${placa}`, exact: true });
/** Quanto a caixa da tabela rolou (vertical + horizontal): em tela pequena só rola para o lado. */
const topo = (page: Page) => caixa(page).evaluate((c) => Math.round(c.scrollTop + c.scrollLeft));

const TODAS_AS_COLUNAS = [
  "placa",
  "tipo",
  "modelo",
  "conjunto",
  "gestor",
  "operacao",
  "situacao",
  "alertas",
  "motorista",
  "filial",
  "dias",
  "km",
  "cr",
  "fipe",
];

async function clicarComOMouse(page: Page, alvo: ReturnType<Page["locator"]>) {
  const caixaDoAlvo = await alvo.boundingBox();
  expect(caixaDoAlvo).not.toBeNull();
  await page.mouse.click(
    (caixaDoAlvo?.x ?? 0) + (caixaDoAlvo?.width ?? 0) / 2,
    (caixaDoAlvo?.y ?? 0) + (caixaDoAlvo?.height ?? 0) / 2,
  );
}

/** Abre a lista, rola a tabela, entra na ficha da quinta placa e devolve a placa. */
async function daListaParaAFicha(page: Page, baseURL: string | undefined): Promise<string> {
  await page.context().addCookies([
    {
      name: "eixo-tabela-placas",
      value: encodeURIComponent(JSON.stringify({ colunas: TODAS_AS_COLUNAS })),
      url: baseURL ?? "http://localhost:3000",
    },
  ]);
  await abrirHidratada(page, LISTA);
  await caixa(page).evaluate((c) => {
    c.scrollTop = 150;
    c.scrollLeft = 220;
  });
  expect(await topo(page)).toBeGreaterThan(0);
  const placa = (await linhas(page)
    .nth(4)
    .locator("[data-espiar-placa]")
    .getAttribute("data-espiar-placa"))!;
  await clicarComOMouse(page, linkDaFicha(page, placa));
  await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
  return placa;
}

export function testesDoRetornoComCpuLenta() {
  for (let n = 1; n <= REPETICOES; n++) {
    const sufixo = REPETICOES > 1 ? ` (${n}/${REPETICOES})` : "";
    test.describe(`retorno da lista com CPU ${CPU}x mais lenta${sufixo}`, () => {
      test.beforeEach(async ({ page }) => {
        await deixarLento(page, { cpu: CPU });
      });

      test("F5 logo depois do Voltar, sem esperar nada, começa no topo", async ({
        page,
        baseURL,
      }) => {
        await daListaParaAFicha(page, baseURL);
        await page.goBack();
        await page.reload();
        await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
        await page.waitForTimeout(1_000);
        expect(await topo(page)).toBe(0);
      });

      test("F5 depois de a lista restaurar também começa no topo", async ({ page, baseURL }) => {
        const placa = await daListaParaAFicha(page, baseURL);
        await page.goBack();
        await expect(linkDaFicha(page, placa)).toBeFocused({ timeout: 15_000 });
        expect(await topo(page)).toBeGreaterThan(100);
        await page.reload();
        await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
        await page.waitForTimeout(1_000);
        expect(await topo(page)).toBe(0);
      });

      test("F5 depois de Voltar e Avançar seguidos (sem esperar) começa no topo", async ({
        page,
        baseURL,
      }) => {
        const placa = await daListaParaAFicha(page, baseURL);
        await page.goBack();
        await page.goForward();
        await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
        await page.goBack();
        await page.reload();
        await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
        await page.waitForTimeout(1_000);
        expect(await topo(page)).toBe(0);
      });

      test("F5 depois de a página voltar do cache de ida e volta (bfcache) começa no topo", async ({
        page,
        baseURL,
      }) => {
        const placa = await daListaParaAFicha(page, baseURL);
        await page.goBack();
        await expect(linkDaFicha(page, placa)).toBeFocused({ timeout: 15_000 });
        // O navegador guarda a página inteira (memória incluída) ao sair e a devolve igual: o
        // `pagehide` e o `pageshow` com `persisted` são os sinais dessa ida e volta.
        await page.evaluate(() => {
          window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
          window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
        });
        await page.reload();
        await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
        await page.waitForTimeout(1_000);
        expect(await topo(page)).toBe(0);
      });

      test("Voltar restaura a rolagem e o foco; Avançar e Voltar de novo também", async ({
        page,
        baseURL,
      }) => {
        const placa = await daListaParaAFicha(page, baseURL);
        await page.goBack();
        await expect(linkDaFicha(page, placa)).toBeFocused({ timeout: 15_000 });
        expect(await topo(page)).toBeGreaterThan(100);
        await page.goForward();
        await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
        await page.goBack();
        await expect(linkDaFicha(page, placa)).toBeFocused({ timeout: 15_000 });
        expect(await topo(page)).toBeGreaterThan(100);
      });

      test("visita nova pelo menu, logo depois de um Voltar, começa no topo", async ({
        page,
        baseURL,
      }) => {
        const placa = await daListaParaAFicha(page, baseURL);
        await page.goBack();
        await expect(linkDaFicha(page, placa)).toBeFocused({ timeout: 15_000 });
        await page.goto(`${LISTA}?pagina=2`);
        await page.goto(LISTA);
        await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
        await page.waitForTimeout(1_000);
        expect(await topo(page)).toBe(0);
      });

      test("visita nova por link direto, logo depois de entrar na ficha, começa no topo", async ({
        page,
        baseURL,
      }) => {
        await daListaParaAFicha(page, baseURL);
        await page.goto(LISTA);
        await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
        await page.waitForTimeout(1_000);
        expect(await topo(page)).toBe(0);
      });
    });
  }
}
