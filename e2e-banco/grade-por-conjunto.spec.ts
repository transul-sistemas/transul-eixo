import { expect, type Page, test } from "@playwright/test";

// Frota › Acompanhamento, a grade por conjunto (A1). ESCRITO, ainda não executado: roda no CI de banco ou
// à mão (`pnpm test:e2e-banco`), com os dados da demonstração (docs/demonstracao.md).
//
// Mede as larguras reais no navegador (docs/padrao-de-telas.md, "Tabela em grade preenche a largura; só
// rola por dentro"):
//  * em 1366, 1667 e 1920 px, a soma das colunas ocupa a largura do cartão, sem faixa vazia à direita
//    (se as colunas passam do cartão, a diferença vira rolagem interna, nunca sobra);
//  * em 1092 px a rolagem é interna ao cartão, o cabeçalho dos dias e a primeira coluna ficam fixos e a
//    página não ganha rolagem lateral;
//  * nos temas claro e escuro;
//  * a coluna de hoje leva rótulo e ícone, não só cor.

const LARGURAS = [1366, 1667, 1920] as const;
const TEMAS = ["light", "dark"] as const;

interface Medidas {
  cartaoLargura: number;
  cartaoRolavel: number;
  /** Quanto falta entre a borda direita da última coluna e a borda direita do cartão (sobra vazia). */
  sobraADireita: number;
  paginaLargura: number;
  paginaJanela: number;
}

async function medir(page: Page): Promise<Medidas> {
  return page.evaluate(() => {
    const cartao = document.querySelector<HTMLElement>('[data-testid="grade-do-mes"]');
    if (!cartao) throw new Error("A grade por conjunto não abriu.");
    const cabecalho = cartao.querySelector<HTMLElement>('[role="row"]');
    if (!cabecalho) throw new Error("A grade não tem cabeçalho.");
    const colunas = [...cabecalho.querySelectorAll<HTMLElement>('[role="columnheader"]')];
    const ultima = colunas[colunas.length - 1];
    if (!ultima) throw new Error("A grade não tem colunas.");
    const caixaDoCartao = cartao.getBoundingClientRect();
    const raiz = document.scrollingElement as Element;
    return {
      cartaoLargura: cartao.clientWidth,
      cartaoRolavel: cartao.scrollWidth,
      // Sem rolagem, a última coluna termina na borda do cartão (descontada a borda de 1 px).
      sobraADireita: caixaDoCartao.right - 1 - ultima.getBoundingClientRect().right,
      paginaLargura: raiz.scrollWidth,
      paginaJanela: raiz.clientWidth,
    };
  });
}

async function abrirGrade(page: Page, largura: number, tema: (typeof TEMAS)[number]) {
  await page.setViewportSize({ width: largura, height: 768 });
  await page.emulateMedia({ colorScheme: tema });
  await page.goto("/frota/acompanhamento");
  await expect(page.getByRole("heading", { level: 1, name: "Acompanhamento" })).toBeVisible();
  await expect(page.getByTestId("grade-do-mes")).toBeVisible();
}

for (const tema of TEMAS) {
  for (const largura of LARGURAS) {
    test(`a soma das colunas ocupa a largura do cartão em ${largura} px (${tema})`, async ({
      page,
    }) => {
      await abrirGrade(page, largura, tema);
      const m = await medir(page);
      if (largura >= 1667) {
        // Com a barra lateral aberta, 1667 px já dão cerca de 1.315 px ao cartão: um mês de 31 dias (coluna do
        // conjunto de 12 rem + olho + 31 × 34 px = 1.294 px) cabe, sem rolagem, e as colunas preenchem o cartão.
        expect(m.cartaoRolavel).toBeLessThanOrEqual(m.cartaoLargura);
        expect(Math.abs(m.sobraADireita)).toBeLessThanOrEqual(1);
      } else if (m.cartaoRolavel <= m.cartaoLargura) {
        // Cabe (1366 só cabe sem a barra lateral, em modo foco): as colunas dividem o cartão inteiro.
        expect(Math.abs(m.sobraADireita)).toBeLessThanOrEqual(1);
      } else {
        // Com a barra aberta o cartão tem cerca de 1.014 px: rola por dentro, nunca sobra faixa vazia.
        expect(m.cartaoRolavel).toBeGreaterThan(m.cartaoLargura);
      }
      // Nunca sobra faixa vazia e a página nunca rola de lado.
      expect(m.paginaLargura).toBeLessThanOrEqual(m.paginaJanela);
    });
  }

  test(`em 1092 px a rolagem é interna, com o cabeçalho e a primeira coluna fixos (${tema})`, async ({
    page,
  }) => {
    await abrirGrade(page, 1092, tema);
    const m = await medir(page);
    expect(m.cartaoRolavel).toBeGreaterThan(m.cartaoLargura);
    expect(m.paginaLargura).toBeLessThanOrEqual(m.paginaJanela);

    const cartao = page.getByTestId("grade-do-mes");
    const primeira = cartao.locator('[data-linha="conjunto"] [role="rowheader"]').first();
    const diaDeHoje = cartao.locator('[role="columnheader"][data-hoje]');
    const antes = await primeira.boundingBox();
    const cabecalhoAntes = await diaDeHoje.boundingBox();
    await cartao.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
      el.scrollTop = 40;
    });
    const depois = await primeira.boundingBox();
    const cabecalhoDepois = await diaDeHoje.boundingBox();
    // A primeira coluna fica no mesmo lugar ao rolar de lado.
    expect(Math.abs((depois?.x ?? 0) - (antes?.x ?? 0))).toBeLessThanOrEqual(1);
    // O cabeçalho dos dias fica no mesmo lugar ao rolar para baixo.
    expect(Math.abs((cabecalhoDepois?.y ?? 0) - (cabecalhoAntes?.y ?? 0))).toBeLessThanOrEqual(1);
    // E a página continua sem rolagem lateral.
    const pagina = await medir(page);
    expect(pagina.paginaLargura).toBeLessThanOrEqual(pagina.paginaJanela);
  });
}

test("a coluna de hoje tem rótulo e ícone, não só cor; o fim de semana é marcado", async ({
  page,
}) => {
  await abrirGrade(page, 1366, "light");
  const hoje = page.locator('[role="columnheader"][data-hoje]');
  await expect(hoje).toHaveCount(1);
  await expect(hoje).toContainText("hoje");
  await expect(hoje.locator("svg")).toHaveCount(1);
  await expect(page.locator('[role="columnheader"][data-fim-de-semana]').first()).toBeVisible();
});

test("a faixa do dia mostra X de Y conjuntos com lançamento hoje, vindo do banco", async ({
  page,
}) => {
  await abrirGrade(page, 1366, "light");
  const medida = page.getByTestId("x-de-y");
  await expect(medida).toBeVisible();
  await expect(medida).toContainText(/(\d+ de \d+ conjuntos com lançamento hoje|Sem dados ainda)/);
});

test("o chip filtra a grade pela URL e volta com 'Todos'", async ({ page }) => {
  await abrirGrade(page, 1366, "light");
  const chips = page.getByTestId("chips-da-grade");
  await chips.getByRole("link", { name: /^Impedida/ }).click();
  await expect(page).toHaveURL(/chip=impedida/);
  await chips.getByRole("link", { name: /^Todos/ }).click();
  await expect(page).not.toHaveURL(/chip=/);
});

test("o caminho principal não ganha rolagem lateral da página (Grade → Legenda → voltar)", async ({
  page,
}) => {
  for (const largura of [1366, 1092]) {
    await abrirGrade(page, largura, "light");
    const m = await medir(page);
    expect(m.paginaLargura).toBeLessThanOrEqual(m.paginaJanela);
  }
  await page.getByRole("link", { name: "Legenda" }).first().click();
  await page.goBack();
  await expect(page.getByTestId("grade-do-mes")).toBeVisible();
});

test("a densidade Confortável fica lembrada ao recarregar", async ({ page }) => {
  await abrirGrade(page, 1366, "light");
  const seletor = page.getByRole("group", { name: "Densidade da grade" });
  await seletor.getByRole("button", { name: "Confortável" }).click();
  await expect(seletor.getByRole("button", { name: "Confortável" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(
    page
      .getByRole("group", { name: "Densidade da grade" })
      .getByRole("button", { name: "Confortável" }),
  ).toHaveAttribute("aria-pressed", "true");
  // Volta ao padrão para não deixar o cookie sujo.
  await page
    .getByRole("group", { name: "Densidade da grade" })
    .getByRole("button", { name: "Compacto" })
    .click();
});
