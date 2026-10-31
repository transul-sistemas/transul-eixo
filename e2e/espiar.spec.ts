import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

const ROTA = "/frota/placas";
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

const tabela = (page: Page) => page.getByRole("table", { name: "Placas" });
// Por CSS: com o modal aberto a região sai da árvore de acessibilidade e `getByRole` não a acha.
const caixaDaTabela = (page: Page) => page.locator('[role="region"][aria-label*="rolável"]');
// Por CSS: com o modal aberto a tabela sai da árvore de acessibilidade e `getByRole` não a acha.
const tabelaPorCss = (page: Page) => page.locator('table[aria-label="Placas"]');
const linhas = (page: Page) => tabela(page).locator("tbody tr");
const botaoEspiar = (page: Page, placa: string) =>
  page.getByRole("button", { name: `Espiar ${placa}`, exact: true });
const painel = (page: Page, placa: string) =>
  page.getByRole("dialog", { name: `Resumo da placa ${placa}` });
const qualquerPainel = (page: Page) => page.getByRole("dialog", { name: /^Resumo da placa/ });
const urlSemEspiar = (page: Page) => {
  const url = new URL(page.url());
  url.searchParams.delete("espiar");
  return `${url.pathname}?${url.searchParams.toString()}`;
};

/** Clica em Espiar e espera o painel e a URL: o painel abre na hora, e a URL confirma depois. */
async function abrir(page: Page, placa: string) {
  await botaoEspiar(page, placa).click();
  await expect(painel(page, placa)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
}

async function estadoDaLista(page: Page) {
  const caixa = caixaDaTabela(page);
  return {
    url: urlSemEspiar(page),
    rolagem: await caixa.evaluate((c) => ({ topo: c.scrollTop, esquerda: c.scrollLeft })),
    resumo: await page.getByTestId("resumo-da-pagina").textContent(),
    ordem: await tabelaPorCss(page)
      .locator("thead th[aria-sort]:not([aria-sort='none'])")
      .evaluateAll((ths) =>
        ths.map((t) => `${t.textContent?.trim()}:${t.getAttribute("aria-sort")}`),
      ),
    chips: await page
      .locator('[role="search"][aria-label="Consulta"]')
      .locator('button[aria-pressed="true"]')
      .evaluateAll((bs) => bs.map((b) => b.textContent?.trim())),
    primeiraLinha: await tabelaPorCss(page).locator("tbody tr").first().textContent(),
  };
}

test.describe("painel de espiar: o botão na célula da Placa e o atalho na linha", () => {
  test("o botão Espiar AAA0A00 abre o painel e põe ?espiar= na URL", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await botaoEspiar(page, "AAA0A00").click();
    await expect(page).toHaveURL(/espiar=AAA0A00/);
    await expect(painel(page, "AAA0A00")).toBeVisible();
  });

  test("clicar em qualquer ponto da linha também abre (atalho de mouse)", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const segunda = linhas(page).nth(1);
    const placa = await segunda.locator("[data-espiar-placa]").getAttribute("data-espiar-placa");
    await segunda.locator("td").nth(1).click();
    await expect(page).toHaveURL(new RegExp(`espiar=${placa}`));
    await expect(painel(page, placa as string)).toBeVisible();
  });

  test("abrir é um passo só no histórico (push)", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const antes = await page.evaluate(() => history.length);
    await abrir(page, "AAA0A00");
    expect(await page.evaluate(() => history.length)).toBe(antes + 1);
  });

  test("Enter e Espaço no botão abrem", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await botaoEspiar(page, "AAA0A04").focus();
    await page.keyboard.press("Enter");
    await expect(painel(page, "AAA0A04")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await botaoEspiar(page, "AAA0A04").focus();
    await page.keyboard.press("Space");
    await expect(painel(page, "AAA0A04")).toBeVisible();
  });

  test("selecionar texto da linha arrastando o mouse não abre o painel", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const celula = linhas(page).first().locator("td").nth(1);
    const caixa = await celula.boundingBox();
    expect(caixa).not.toBeNull();
    const y = (caixa?.y ?? 0) + (caixa?.height ?? 0) / 2;
    await page.mouse.move((caixa?.x ?? 0) + 6, y);
    await page.mouse.down();
    await page.mouse.move((caixa?.x ?? 0) + (caixa?.width ?? 0) - 6, y, { steps: 6 });
    await page.mouse.up();
    expect(
      await page.evaluate(() => (getSelection()?.toString() ?? "").trim().length),
    ).toBeGreaterThan(0);
    await expect(qualquerPainel(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/espiar=/);
  });

  test("Ctrl+clique na linha não abre o painel", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await linhas(page)
      .first()
      .locator("td")
      .nth(1)
      .click({ modifiers: ["Control"] });
    await expect(qualquerPainel(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/espiar=/);
  });

  test("a linha mostra que é clicável (cursor)", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const cursor = await linhas(page)
      .first()
      .evaluate((tr) => getComputedStyle(tr).cursor);
    expect(cursor).toBe("pointer");
  });

  test("abrir não muda nenhum outro parâmetro da URL", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?chip=impedida&ordem=-gestor&pagina=2&tam=50`);
    const antes = new URL(page.url()).searchParams;
    const placa = await linhas(page)
      .first()
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa");
    await botaoEspiar(page, placa as string).click();
    await expect(painel(page, placa as string)).toBeVisible();
    const depois = new URL(page.url()).searchParams;
    depois.delete("espiar");
    expect(depois.toString()).toBe(antes.toString());
  });
});

test.describe("painel de espiar: abrir e fechar sem perder nada", () => {
  test("o painel é um diálogo nomeado 'Resumo da placa AAA0A00', com o foco no título", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await botaoEspiar(page, "AAA0A00").click();
    await expect(painel(page, "AAA0A00")).toBeVisible();
    await expect(painel(page, "AAA0A00").getByRole("heading", { name: "AAA0A00" })).toBeFocused();
  });

  test("Esc fecha e o foco volta ao botão Espiar da linha de origem", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await botaoEspiar(page, "AAA0A04").click();
    await expect(painel(page, "AAA0A04")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page).not.toHaveURL(/espiar=/);
    await expect(botaoEspiar(page, "AAA0A04")).toBeFocused();
  });

  test("o botão Fechar painel e o clique no fundo fecham, com o mesmo foco", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await botaoEspiar(page, "AAA0A04").click();
    await painel(page, "AAA0A04").getByRole("button", { name: "Fechar painel" }).click();
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(botaoEspiar(page, "AAA0A04")).toBeFocused();
    await botaoEspiar(page, "AAA0A04").click();
    await expect(painel(page, "AAA0A04")).toBeVisible();
    await page.mouse.click(40, 400); // no fundo, à esquerda do painel
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(botaoEspiar(page, "AAA0A04")).toBeFocused();
  });

  test("depois de abrir e fechar, filtros, página, ordem, tamanho, colunas e rolagem são os mesmos", async ({
    page,
    baseURL,
  }) => {
    await page.context().addCookies([
      {
        name: "eixo-tabela-placas",
        value: encodeURIComponent(JSON.stringify({ colunas: TODAS_AS_COLUNAS })),
        url: baseURL ?? "http://localhost:3000",
      },
    ]);
    await abrirHidratada(page, `${ROTA}?chip=em-atividade&ordem=-gestor&pagina=2`);
    await expect(page.getByTestId("resumo-da-pagina")).toContainText("Mostrando 26–");
    await caixaDaTabela(page).evaluate((c) => {
      c.scrollTop = 150;
      c.scrollLeft = 220;
    });
    const antes = await estadoDaLista(page);
    expect(antes.rolagem.topo).toBeGreaterThan(0);
    expect(antes.rolagem.esquerda).toBeGreaterThan(0);

    const placa = await linhas(page)
      .nth(4)
      .locator("[data-espiar-placa]")
      .getAttribute("data-espiar-placa");
    await botaoEspiar(page, placa as string).click();
    await expect(painel(page, placa as string)).toBeVisible();
    // O clique do Playwright rola a caixa até o botão; vale a rolagem de quando o painel abriu.
    const aberta = await estadoDaLista(page);
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();

    const depois = await estadoDaLista(page);
    expect(depois).toEqual(aberta);
    expect({ ...depois, rolagem: antes.rolagem }).toEqual(antes);
    await expect(botaoEspiar(page, placa as string)).toBeFocused();
  });

  test("Voltar do navegador fecha o painel e o foco volta à linha; Voltar de novo não sai do sistema", async ({
    page,
  }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.goto(ROTA);
    await abrirHidratada(page, ROTA);
    await abrir(page, "AAA0A00");
    await page.goBack();
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await expect(botaoEspiar(page, "AAA0A00")).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/\/inicio\/tarefas/);
  });

  test("fechar com Esc desfaz um passo: depois dele o Voltar não reabre o painel", async ({
    page,
  }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.goto(ROTA);
    await abrirHidratada(page, ROTA);
    await abrir(page, "AAA0A00");
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await page.goBack();
    await expect(qualquerPainel(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/espiar=/);
    await expect(page).toHaveURL(/\/inicio\/tarefas/); // o Esc desfez o passo: um Voltar chega à página de antes
  });

  test("abrir, voltar e avançar reabre o painel", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await abrir(page, "AAA0A00");
    await page.goBack();
    await expect(qualquerPainel(page)).toBeHidden();
    await page.goForward();
    await expect(painel(page, "AAA0A00")).toBeVisible();
  });

  test("link direto abre o painel, e fechar tira o espiar sem sair da lista", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?espiar=AAA0A00`);
    await expect(painel(page, "AAA0A00")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await expect(tabela(page)).toBeVisible();
  });

  test("recarregar com o painel aberto mantém o painel", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await abrir(page, "AAA0A04");
    await page.reload();
    await expect(painel(page, "AAA0A04")).toBeVisible();
    await expect(page).toHaveURL(/espiar=AAA0A04/);
  });

  test("se a linha de origem não está na página, o foco cai na caixa da tabela, nunca no body", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?espiar=AAA0C17`);
    await expect(painel(page, "AAA0C17")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(caixaDaTabela(page)).toBeFocused();
  });

  test("no modo foco, Esc fecha só o painel e continua em foco", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?foco=1&espiar=AAA0A00`);
    await expect(painel(page, "AAA0A00")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await expect(page).toHaveURL(/foco=1/);
    await expect(page.locator('aside[data-barra="principal"]')).toBeHidden();
  });

  test("abre na hora (otimista) e, se fecha antes de a resposta chegar, nada reabre depois", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?lento=2500`);
    await botaoEspiar(page, "AAA0A00").click();
    await expect(painel(page, "AAA0A00")).toBeVisible({ timeout: 1000 });
    await page.keyboard.press("Escape");
    await expect(qualquerPainel(page)).toBeHidden();
    await page.waitForTimeout(4500);
    await expect(qualquerPainel(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/espiar=/);
    await expect(page).toHaveURL(/lento=2500/);
    await expect(tabela(page)).toBeVisible();
  });
});

test.describe("painel de espiar: o parâmetro só aceita a placa normalizada", () => {
  for (const [nome, valor] of [
    ["minúscula", "aaa0a00"],
    ["com hífen", "aaa-0a00"],
    ["curta", "AAA0A"],
    ["HTML", "%3Cscript%3Ealert(1)%3C%2Fscript%3E"],
    ["longa", "A".repeat(300)],
  ] as const) {
    test(`ignora ${nome}: não abre painel, não quebra e a lista aparece`, async ({ page }) => {
      const erros: string[] = [];
      page.on("pageerror", (e) => erros.push(e.message));
      await abrirHidratada(page, `${ROTA}?espiar=${valor}`);
      await expect(tabela(page)).toBeVisible();
      await expect(qualquerPainel(page)).toHaveCount(0);
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
      expect(erros).toEqual([]);
    });
  }

  test("uma placa válida que não existe abre o painel, sem derrubar a lista", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?espiar=ZZZ9Z99`);
    await expect(painel(page, "ZZZ9Z99")).toBeVisible();
    await expect(caixaDaTabela(page)).toBeVisible();
  });
});

test.describe("painel de espiar: modal de verdade", () => {
  test("o foco fica preso no painel (Tab e Shift+Tab)", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await botaoEspiar(page, "AAA0A00").click();
    await expect(painel(page, "AAA0A00")).toBeVisible();
    const dentro = () => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(60); // o foco passa por uma guarda e volta ao painel
      expect(await dentro(), `Tab ${i + 1}`).toBe(true);
    }
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Shift+Tab");
      await page.waitForTimeout(60);
      expect(await dentro(), `Shift+Tab ${i + 1}`).toBe(true);
    }
  });

  test("a lista, o topo e a barra lateral ficam inertes enquanto o painel está aberto", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await botaoEspiar(page, "AAA0A00").click();
    await expect(painel(page, "AAA0A00")).toBeVisible();
    const alcance = await page.evaluate(() => {
      const tocaOPainel = (seletor: string) => {
        const alvo = document.querySelector(seletor);
        if (!alvo) return "ausente";
        const r = alvo.getBoundingClientRect();
        const em = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return em && alvo.contains(em) ? "alcançável" : "coberto";
      };
      return {
        tabela: tocaOPainel('table[aria-label="Placas"] tbody tr:nth-child(3)'),
        topo: tocaOPainel("header"),
        lateral: tocaOPainel('aside[data-barra="principal"] nav'),
      };
    });
    expect(alcance).toEqual({ tabela: "coberto", topo: "coberto", lateral: "coberto" });
  });

  test("a roda do mouse sobre a lista não rola a tabela", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await botaoEspiar(page, "AAA0A00").click();
    await expect(painel(page, "AAA0A00")).toBeVisible();
    const antes = await caixaDaTabela(page).evaluate((c) => c.scrollTop);
    await page.mouse.move(500, 450);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(250);
    expect(await caixaDaTabela(page).evaluate((c) => c.scrollTop)).toBe(antes);
  });

  test("a largura não pula: a caixa da tabela e o topo ficam onde estavam", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const medir = () =>
      page.evaluate(() => {
        const caixa = (s: string) => {
          const r = document.querySelector(s)!.getBoundingClientRect();
          return {
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        };
        return {
          tabela: caixa('[role="region"]'),
          topo: caixa("header"),
          janela: document.documentElement.clientWidth,
        };
      });
    const antes = await medir();
    await botaoEspiar(page, "AAA0A00").click();
    await expect(painel(page, "AAA0A00")).toBeVisible();
    await page.waitForTimeout(500); // fim da animação
    expect(await medir()).toEqual(antes);
  });

  test("em janela baixa, onde a página rola, abrir trava a rolagem da página sem pulo", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 500 });
    await abrirHidratada(page, ROTA);
    await page.evaluate(() => window.scrollTo(0, 120));
    const antes = await page.evaluate(() => ({
      y: window.scrollY,
      w: document.documentElement.clientWidth,
    }));
    await botaoEspiar(page, "AAA0A00")
      .click()
      .catch(async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
        await botaoEspiar(page, "AAA0A00").click();
      });
    await expect(painel(page, "AAA0A00")).toBeVisible();
    await page.mouse.move(300, 250);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(250);
    const depois = await page.evaluate(() => ({
      y: window.scrollY,
      w: document.documentElement.clientWidth,
    }));
    expect(depois.w).toBe(antes.w);
    expect(Math.abs(depois.y - antes.y)).toBeLessThanOrEqual(120);
    const rolouComPainel = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.scrollY)).toBe(rolouComPainel);
  });
});
