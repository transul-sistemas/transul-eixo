import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

const LISTA = "/frota/placas";
const FICHA = (placa: string, consulta = "") => `${LISTA}/${placa}${consulta}`;

const aba = (page: Page, nome: string) => page.getByRole("tab", { name: nome, exact: true });
const painelAtivo = (page: Page) => page.getByRole("tabpanel").and(page.locator(":not([hidden])"));
const titulo = (page: Page, placa: string) => page.getByRole("heading", { level: 1, name: placa });

/** Espera a ficha e as abas ficarem vivas (as abas dependem da URL e hidratam depois do topo). */
async function abrirFicha(page: Page, placa: string, consulta = "") {
  await abrirHidratada(page, FICHA(placa, consulta));
  await expect(titulo(page, placa)).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Seções da ficha" })).toBeVisible();
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="tab"]');
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
  });
}

test.describe("ficha da placa: a rota", () => {
  test("abre com o nome da placa, a trilha, o título da aba do navegador e o grupo da barra lateral", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A00");
    await expect(page).toHaveTitle("AAA0A00 · TranSul Eixo");
    const trilha = page.getByRole("navigation", { name: "Trilha" });
    await expect(trilha).toContainText("Frota");
    await expect(trilha.getByRole("link", { name: "Placas" })).toHaveAttribute(
      "href",
      /\/frota\/placas/,
    );
    await expect(trilha.locator('[aria-current="page"]')).toHaveText("AAA0A00");
    // A barra lateral abre o grupo Frota e marca Placas como a seção atual.
    const lateral = page.getByRole("navigation", { name: /principal|menu/i }).first();
    await expect(lateral.getByRole("link", { name: /Placas/ }).first()).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("a placa fica no cabeçalho como mini placa, com a situação por extenso e o subtítulo", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A04");
    const cabecalho = page.locator("header").filter({ has: titulo(page, "AAA0A04") });
    await expect(cabecalho.locator('[aria-label="Placa AAA0A04"]')).toBeVisible();
    await expect(cabecalho).toContainText("DOp");
    await expect(cabecalho).toContainText("Disponível no Operacional");
    await expect(cabecalho).toContainText(/desde \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    await expect(cabecalho).toContainText("A DEFINIR, cavalo");
  });

  test("Voltar à lista e a trilha levam à lista de placas", async ({ page }) => {
    await abrirFicha(page, "AAA0A00");
    await page.getByRole("link", { name: "Voltar à lista" }).click();
    await expect(page).toHaveURL(/\/frota\/placas(\?|$)/);
    await expect(page.getByTestId("resumo-da-pagina")).toBeVisible();
  });

  test("Esc não sai da ficha", async ({ page }) => {
    await abrirFicha(page, "AAA0A00");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/frota\/placas\/AAA0A00$/);
    await expect(titulo(page, "AAA0A00")).toBeVisible();
  });
});

test.describe("ficha da placa: placa mal escrita, inexistente e baixada", () => {
  for (const ruim of ["aaa-0a00", "AAA0A0", "AAA0A000", "%3Cscript%3E", "AAA%200A00", "aaa0a00"]) {
    test(`placa mal escrita (${ruim}) dá 404`, async ({ page }) => {
      const resposta = await page.goto(FICHA(ruim));
      expect(resposta?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "Placa não encontrada" })).toHaveCount(0);
    });
  }

  test("placa bem escrita que não existe: 'Placa não encontrada' dentro do casco, com o que fazer", async ({
    page,
  }) => {
    const resposta = await page.goto(FICHA("ZZZ9Z99"));
    expect(resposta?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Placa não encontrada" }),
    ).toBeVisible();
    await expect(page.getByText("Não há cadastro para a placa ZZZ9Z99.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para a lista de placas" })).toBeVisible();
    // Dentro do casco: a barra lateral e o topo estão lá.
    await expect(page.getByRole("navigation", { name: "Trilha" })).toBeVisible();
  });

  test("placa baixada abre por link, com o aviso, mesmo escondida da lista", async ({ page }) => {
    await abrirHidratada(page, `${LISTA}?baixadas=1&sigla=VND`);
    const baixada = await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa");
    expect(baixada).not.toBeNull();
    await abrirFicha(page, baixada!);
    await expect(page.locator("[data-aviso]")).toContainText("Placa baixada");
    await expect(page.locator("[data-aviso]")).toContainText("só para consulta");
    // E ela continua fora da lista padrão.
    await page.goto(LISTA);
    await expect(page.locator(`[data-espiar-placa="${baixada}"]`)).toHaveCount(0);
  });
});

test.describe("ficha da placa: as abas", () => {
  test("são seis, na ordem, com o Resumo selecionado por padrão", async ({ page }) => {
    await abrirFicha(page, "AAA0A00");
    const nomes = await page.getByRole("tab").allInnerTexts();
    expect(nomes.map((n) => n.trim())).toEqual([
      "Resumo",
      "Linha do tempo",
      "Documentos",
      "Resultado",
      "Mapa",
      "Mapa mental",
    ]);
    await expect(aba(page, "Resumo")).toHaveAttribute("aria-selected", "true");
    await expect(page).not.toHaveURL(/aba=/);
  });

  test("?aba= abre a aba; valor inválido cai no Resumo, sem erro", async ({ page }) => {
    await abrirFicha(page, "AAA0A00", "?aba=documentos");
    await expect(aba(page, "Documentos")).toHaveAttribute("aria-selected", "true");
    await expect(painelAtivo(page).getByText("Esta aba entra em breve.")).toBeVisible();
    for (const lixo of ["lixo", "%3Cscript%3E", "Documentos", ""]) {
      await abrirFicha(page, "AAA0A00", `?aba=${lixo}`);
      await expect(aba(page, "Resumo")).toHaveAttribute("aria-selected", "true");
    }
  });

  test("trocar de aba muda a URL sem empilhar histórico, e recarregar devolve a mesma aba", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A00");
    const antes = await page.evaluate(() => history.length);
    await aba(page, "Resultado").click();
    await expect(aba(page, "Resultado")).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/aba=resultado/);
    expect(await page.evaluate(() => history.length)).toBe(antes);
    await page.reload();
    await expect(aba(page, "Resultado")).toHaveAttribute("aria-selected", "true");
    await aba(page, "Resumo").click();
    await expect(page).not.toHaveURL(/aba=/);
  });

  test("as quatro abas sem conteúdo usam o 'Em breve', cada uma com o seu texto", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A00");
    for (const nome of ["Documentos", "Resultado", "Mapa", "Mapa mental"]) {
      await aba(page, nome).click();
      const painel = painelAtivo(page);
      await expect(painel.getByRole("heading", { level: 3, name: nome })).toBeVisible();
      await expect(painel.getByText("Esta aba entra em breve.")).toBeVisible();
    }
  });

  test("teclado: Tab entra uma vez na lista; setas, Home e End andam e levam o foco", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A00");
    await aba(page, "Resumo").focus();
    // Só uma aba entra no Tab (roving).
    expect(await page.locator('[role="tab"][tabindex="0"]').count()).toBe(1);
    expect(await page.locator('[role="tab"][tabindex="-1"]').count()).toBe(5);
    await page.keyboard.press("ArrowRight");
    await expect(aba(page, "Linha do tempo")).toBeFocused();
    await expect(aba(page, "Linha do tempo")).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/aba=linha-do-tempo/);
    await page.keyboard.press("End");
    await expect(aba(page, "Mapa mental")).toBeFocused();
    await page.keyboard.press("ArrowRight"); // dá a volta
    await expect(aba(page, "Resumo")).toBeFocused();
    await page.keyboard.press("ArrowLeft"); // e volta para o fim
    await expect(aba(page, "Mapa mental")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(aba(page, "Resumo")).toBeFocused();
    await expect(aba(page, "Resumo")).toHaveAttribute("aria-selected", "true");
  });

  test("teclado: setas apertadas em sequência rápida não perdem passos nem trocam de aba errada", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A00");
    await aba(page, "Resumo").focus();
    // Sete setas sem esperar a URL: seis voltam ao Resumo e a sétima chega à Linha do tempo.
    for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowRight");
    await expect(aba(page, "Linha do tempo")).toBeFocused();
    await expect(aba(page, "Linha do tempo")).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/aba=linha-do-tempo/);
    for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowLeft"); // Resumo e, dando a volta, Mapa mental
    await expect(aba(page, "Mapa mental")).toBeFocused();
    await expect(page).toHaveURL(/aba=mapa-mental/);
  });

  test("teclado: Tab sai da lista de abas para o painel, não para a próxima aba", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A00");
    await aba(page, "Resumo").focus();
    await page.keyboard.press("Tab");
    const foco = await page.evaluate(() => {
      const el = document.activeElement;
      return { papel: el?.getAttribute("role"), id: el?.id };
    });
    expect(foco.papel === "tab", "o foco foi para outra aba").toBe(false);
  });

  test("setas verticais e outras teclas não mexem nas abas", async ({ page }) => {
    await abrirFicha(page, "AAA0A00");
    await aba(page, "Resumo").focus();
    for (const tecla of ["ArrowDown", "ArrowUp", "a", "Escape"]) await page.keyboard.press(tecla);
    await expect(aba(page, "Resumo")).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/\/frota\/placas\/AAA0A00$/);
  });

  test("cada painel abre com um h2 e o conteúdo não pula os níveis de título", async ({ page }) => {
    await abrirFicha(page, "AAA0A00");
    const niveis = await page.evaluate(() =>
      [...document.querySelectorAll("main h1, main h2, main h3")]
        .filter((h) => !h.closest("[hidden]"))
        .map((h) => Number(h.tagName[1])),
    );
    for (let i = 1; i < niveis.length; i++) {
      expect(niveis[i]! - niveis[i - 1]!, `salto de título na posição ${i}`).toBeLessThanOrEqual(1);
    }
    expect(niveis.filter((n) => n === 1)).toHaveLength(1);
  });
});

test.describe("ficha da placa: o conteúdo", () => {
  test("o Resumo traz as cinco seções, e as placas do conjunto levam à ficha delas", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A00");
    const painel = painelAtivo(page);
    await expect(painel.getByRole("heading", { level: 3 })).toHaveText([
      "Situação",
      "Conjunto",
      "Gestão",
      "Alertas",
      "Dados",
    ]);
    const vizinha = painel.getByRole("link", { name: /^Abrir ficha de / }).first();
    const nome = (await vizinha.getAttribute("aria-label"))!;
    const outra = nome.replace("Abrir ficha de ", "");
    await vizinha.click();
    await expect(page).toHaveURL(new RegExp(`/frota/placas/${outra}`));
    await expect(titulo(page, outra)).toBeVisible();
  });

  test("os alertas do caso feio aparecem por extenso no Resumo", async ({ page }) => {
    await abrirFicha(page, "AAA0A24");
    await expect(
      painelAtivo(page).getByRole("listitem").filter({ hasText: "Documento (CRLV) vencido" }),
    ).toBeVisible();
  });

  test("a faixa colorida resume a história para o leitor de tela e traz a legenda", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A00");
    const faixa = page.getByRole("img", { name: /^Linha do tempo de AAA0A00/ });
    await expect(faixa).toBeVisible();
    const rotulo = (await faixa.getAttribute("aria-label"))!;
    expect(rotulo).toMatch(/de \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/);
    await expect(page.locator("[data-legenda]")).toBeVisible();
    expect(await page.locator("[data-faixa]").count()).toBeGreaterThan(0);
  });

  test("a aba Linha do tempo lista as situações, da mais recente à mais antiga, com data, hora e duração", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A04", "?aba=linha-do-tempo");
    const tabela = painelAtivo(page).getByRole("table");
    await expect(tabela).toBeVisible();
    const linhas = tabela.locator("tbody tr");
    expect(await linhas.count()).toBeGreaterThanOrEqual(3);
    await expect(linhas.first().locator("th")).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    await expect(linhas.first()).toContainText("DOp"); // a situação atual vem primeiro
    await expect(linhas.first().locator("td").last()).toHaveText(/min|h|dia/);
  });

  test("as ações do momento aparecem desligadas, só para quem vê (o Administrador provisório)", async ({
    page,
  }) => {
    await abrirFicha(page, "AAA0A04"); // DOp: receber placa
    const grupo = page.getByRole("group", { name: "Ações do momento" });
    const botao = grupo.getByRole("button", { name: "Receber placa" });
    await expect(botao).toHaveAttribute("aria-disabled", "true");
    await expect(grupo).toContainText("chega com os assistentes (2D)");
    await botao.click({ force: true });
    await expect(page).toHaveURL(/\/frota\/placas\/AAA0A04$/);
    await abrirFicha(page, "AAA0A00"); // outra situação: sem ação
    await expect(page.getByRole("group", { name: "Ações do momento" })).toHaveCount(0);
  });
});

test.describe("ficha da placa: carregando e erro", () => {
  test("com a resposta lenta mostra o esqueleto da ficha e depois a ficha", async ({ page }) => {
    await page.goto(FICHA("AAA0A00", "?lento=1500"), { waitUntil: "commit" });
    await expect(
      page.getByRole("status", { name: /Carregando a ficha da placa AAA0A00/ }),
    ).toBeVisible();
    await expect(titulo(page, "AAA0A00")).toBeVisible({ timeout: 15_000 });
  });

  test("a ficha que falha mostra o erro com 'Tentar de novo' e o caminho de volta", async ({
    page,
  }) => {
    await page.goto(FICHA("AAA0A00", "?falha=1"));
    await expect(page.getByText("Não foi possível carregar a ficha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar à lista" })).toBeVisible();
  });
});

test.describe("ficha da placa: abrir pelo painel de espiar", () => {
  test("'Abrir ficha completa' é um link que usa push: Voltar devolve a lista com o painel aberto", async ({
    page,
  }) => {
    await abrirHidratada(page, LISTA);
    await page.getByRole("button", { name: "Espiar AAA0A00", exact: true }).click();
    const painel = page.getByRole("dialog", { name: "Resumo da placa AAA0A00" });
    await expect(painel).toBeVisible();
    await expect(page).toHaveURL(/espiar=AAA0A00/);
    const link = painel.getByRole("link", { name: "Abrir ficha completa" });
    await expect(link).toHaveAttribute("href", /\/frota\/placas\/AAA0A00/);
    await link.click();
    await expect(page).toHaveURL(/\/frota\/placas\/AAA0A00(\?|$)/);
    await expect(titulo(page, "AAA0A00")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/espiar=AAA0A00/);
    await expect(page.getByRole("dialog", { name: "Resumo da placa AAA0A00" })).toBeVisible();
  });
});
