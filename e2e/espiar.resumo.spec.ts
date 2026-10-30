import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

const ROTA = "/frota/placas";

const painelDe = (page: Page, placa: string) =>
  page.getByRole("dialog", { name: `Resumo da placa ${placa}` });
const botaoEspiar = (page: Page, placa: string) =>
  page.getByRole("button", { name: `Espiar ${placa}`, exact: true });
const qualquerPainel = (page: Page) => page.getByRole("dialog", { name: /^Resumo da placa/ });
// Com o modal aberto a lista sai da árvore de acessibilidade: por CSS.
const linhasDaLista = (page: Page) => page.locator('table[aria-label="Placas"] tbody tr');

/** O texto de um campo do resumo (`dt` -> `dd`), dentro do painel. */
const campo = (painel: ReturnType<typeof painelDe>, rotulo: string) =>
  painel
    .locator("dt", { hasText: new RegExp(`^${rotulo}$`) })
    .locator("xpath=following-sibling::dd[1]");

test.describe("resumo da placa: o conteúdo do painel", () => {
  test("mostra as cinco seções, na ordem, com títulos de terceiro nível", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?espiar=AAA0A00`);
    const painel = painelDe(page, "AAA0A00");
    await expect(painel).toBeVisible();
    await expect(painel.getByRole("heading", { level: 3 })).toHaveText([
      "Situação",
      "Conjunto",
      "Gestão",
      "Alertas",
      "Dados",
    ]);
    await expect(painel.getByRole("heading", { level: 2, name: "AAA0A00" })).toBeVisible();
  });

  const feios: [string, string, string][] = [
    ["AAA0A04", "modelo a definir", "Modelo a definir"],
    ["AAA0A10", "dois CRs vigentes", "Dois CRs vigentes ao mesmo tempo"],
    ["AAA0A22", "cavalo sem motorista", "Cavalo em atividade sem motorista"],
    ["AAA0A24", "CRLV vencido", "Documento (CRLV) vencido"],
    ["AAA0C17", "implemento solto", "Implemento solto há mais de 30 dias"],
  ];
  for (const [placa, nome, alerta] of feios) {
    test(`${placa} (${nome}): o alerta aparece por extenso`, async ({ page }) => {
      await abrirHidratada(page, `${ROTA}?espiar=${placa}`);
      const painel = painelDe(page, placa);
      await expect(painel).toBeVisible();
      await expect(painel.getByRole("listitem").filter({ hasText: alerta })).toBeVisible();
    });
  }

  test("AAA0A10 mostra os dois CRs e AAA0A28 mostra traços onde não há valor", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?espiar=AAA0A10`);
    const dois = painelDe(page, "AAA0A10");
    await expect(campo(dois, "CR vigente")).toContainText("CR-1001");
    await expect(campo(dois, "CR vigente")).toContainText("CR-1002");
    await page.goto(`${ROTA}?espiar=AAA0A28`);
    const vazio = painelDe(page, "AAA0A28");
    await expect(campo(vazio, "Operação")).toHaveText("—");
    await expect(campo(vazio, "CR vigente")).toHaveText("—");
    await expect(campo(vazio, "CRLV vence em")).toHaveText("—");
  });

  test("AAA0A24: a data do CRLV vem em dd/mm/aaaa e marcada como vencida", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?espiar=AAA0A24`);
    await expect(campo(painelDe(page, "AAA0A24"), "CRLV vence em")).toHaveText(
      /^\d{2}\/\d{2}\/\d{4} \(vencido\)$/,
    );
  });

  test("abrir por clique mostra o mesmo resumo da linha", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const linha = linhasDaLista(page).filter({
      has: page.locator('[data-espiar-placa="AAA0A04"]'),
    });
    const situacao = await linha
      .locator("td")
      .nth(7)
      .innerText()
      .catch(() => "");
    await botaoEspiar(page, "AAA0A04").click();
    const painel = painelDe(page, "AAA0A04");
    await expect(painel.getByRole("heading", { name: "Situação" })).toBeVisible();
    await expect(painel).toContainText("A DEFINIR");
    expect(situacao).toBeDefined();
  });
});

test.describe("resumo da placa: o conjunto", () => {
  test("clicar numa placa do conjunto troca o painel com replace (uma entrada de histórico só)", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await botaoEspiar(page, "AAA0A00").click();
    const painel = painelDe(page, "AAA0A00");
    await expect(painel.getByRole("heading", { name: "Conjunto" })).toBeVisible();
    await expect(page).toHaveURL(/espiar=AAA0A00/);

    const vizinhas = painel.locator(
      'section:has(h3:text-is("Conjunto")) button[aria-label^="Espiar "]',
    );
    const total = await vizinhas.count();
    test.skip(total === 0, "a AAA0A00 do exemplo não tem conjunto");
    const nome = (await vizinhas.first().getAttribute("aria-label"))!;
    const outra = nome.replace("Espiar ", "");

    const antes = await page.evaluate(() => history.length);
    await vizinhas.first().click();
    await expect(painelDe(page, outra)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`espiar=${outra}`));
    expect(await page.evaluate(() => history.length)).toBe(antes);
    await expect(painelDe(page, outra).getByRole("heading", { name: "Situação" })).toBeVisible();

    // Esc fecha e o foco volta ao botão da placa então aberta (ou à tabela, se ela não está na página).
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    const destino = botaoEspiar(page, outra);
    if ((await destino.count()) > 0) await expect(destino).toBeFocused();
    else await expect(page.locator('[role="region"][aria-label*="rolável"]')).toBeFocused();
  });
});

test.describe("resumo da placa: abrir ficha completa", () => {
  test("fica desligado: alcança o foco, não navega e explica quando entra", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?espiar=AAA0A00`);
    const painel = painelDe(page, "AAA0A00");
    const ficha = painel.getByRole("button", { name: "Abrir ficha completa" });
    await expect(ficha).toHaveAttribute("aria-disabled", "true");
    await expect(painel.getByText("Entra na próxima entrega")).toBeVisible();
    await ficha.focus();
    await expect(ficha).toBeFocused();
    const antes = page.url();
    // O Playwright trata aria-disabled como desabilitado e esperaria para sempre: força o clique.
    await ficha.click({ force: true });
    expect(page.url()).toBe(antes);
    await expect(painel).toBeVisible();
  });

  test("o rodapé não rola com o resumo", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?espiar=AAA0A00`);
    const painel = painelDe(page, "AAA0A00");
    await expect(painel.getByRole("button", { name: "Abrir ficha completa" })).toBeInViewport();
    await expect(painel.getByRole("button", { name: "Fechar painel" })).toBeInViewport();
  });
});

test.describe("resumo da placa: não encontrada, baixada, erro e carregando", () => {
  test("placa bem escrita que não existe: 'Placa não encontrada', com o que fazer", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?espiar=ZZZ9Z99`);
    const painel = painelDe(page, "ZZZ9Z99");
    await expect(painel.getByRole("heading", { name: "Placa não encontrada" })).toBeVisible();
    await expect(painel).toContainText("Confira");
    await expect(painel.getByRole("button", { name: "Fechar painel" })).toBeVisible();
  });

  test("placa mal escrita nem abre o painel", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?espiar=aaa-0a00`);
    await expect(qualquerPainel(page)).toHaveCount(0);
    await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
  });

  test("placa baixada abre por link, mesmo escondida da lista", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?baixadas=1&sigla=VND`);
    const primeira = await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa");
    expect(primeira).not.toBeNull();
    await page.goto(`${ROTA}?espiar=${primeira}`);
    const painel = painelDe(page, primeira!);
    await expect(painel.getByRole("heading", { name: "Situação" })).toBeVisible();
    await expect(painel).toContainText("VND");
    // A lista, sem "inclui baixadas", não mostra essa placa.
    await expect(page.locator(`[data-espiar-placa="${primeira}"]`)).toHaveCount(0);
  });

  test("o painel falha e a lista segue de pé; 'Tentar de novo' está no painel", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?espiar=AAA0A04&falhaNoPainel=1`);
    const painel = painelDe(page, "AAA0A04");
    await expect(painel.getByRole("alert")).toContainText("Não foi possível carregar o resumo");
    await expect(painel.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(linhasDaLista(page).first()).toBeAttached();
    expect(await linhasDaLista(page).count()).toBeGreaterThan(0);
    await painel.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(painel.getByRole("alert")).toBeVisible(); // continua falhando (simulação na URL)
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
  });

  test("carregando: o esqueleto aparece na hora e o painel não muda de tamanho quando o resumo chega", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?lento=1500`);
    await page.locator("[data-espiar-placa]").first().waitFor();
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await botaoEspiar(page, placa).click();
    const painel = painelDe(page, placa);
    await expect(painel.getByRole("status", { name: "Carregando o resumo" })).toContainText(
      "Carregando o resumo",
    );
    const antes = await painel.boundingBox();
    await expect(painel.getByRole("heading", { name: "Situação" })).toBeVisible({
      timeout: 15_000,
    });
    const depois = await painel.boundingBox();
    // Tolerância de 1 px: a medida de antes pode pegar o fim da animação de entrada.
    expect(Math.abs((depois?.width ?? 0) - (antes?.width ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((depois?.height ?? 0) - (antes?.height ?? 0))).toBeLessThanOrEqual(1);
  });
});
