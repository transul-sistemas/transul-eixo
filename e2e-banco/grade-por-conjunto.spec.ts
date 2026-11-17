import { expect, type Page, test } from "@playwright/test";

// Frota › Acompanhamento, a grade por conjunto (A1). ESCRITO, ainda não executado: roda no CI de banco ou
// à mão (`pnpm test:e2e-banco`), com os dados da demonstração (docs/demonstracao.md).
//
// Mede as larguras e as alturas reais no navegador (docs/padrao-de-telas.md, "Tabela em grade preenche a
// largura; só rola por dentro"; decisões de Alexandre de 12/11/2026):
//  * em 1366 × 768, 1667 × 900 e 1920 × 1080, nas abas Conjuntos e Soltas, nos temas claro e escuro, com
//    "Linhas: Auto" (o padrão): a PÁGINA não tem rolagem vertical nem lateral e o paginador fica visível;
//  * a barra lateral recolhe sozinha abaixo de 1440 px; 1366 px cabem sem rolagem lateral (31 dias a 34 px),
//    1667 e 1920 também, e as colunas preenchem o cartão sem faixa vazia à direita;
//  * em 1092 px a rolagem é interna ao cartão, com o cabeçalho dos dias e a primeira coluna fixos;
//  * o conjunto é uma peça só: uma linha por conjunto, os implementos são chips na célula da esquerda;
//  * a coluna de hoje leva rótulo e ícone, não só cor.

const TELAS = [
  { largura: 1366, altura: 768 },
  { largura: 1667, altura: 900 },
  { largura: 1920, altura: 1080 },
] as const;
const TEMAS = ["light", "dark"] as const;
const ABAS = [
  { nome: "Conjuntos", modo: "grade", linha: "conjunto" },
  { nome: "Soltas", modo: "soltas", linha: "solta" },
] as const;

interface Medidas {
  cartaoLargura: number;
  cartaoRolavel: number;
  /** Quanto falta entre a borda direita da última coluna e a do cartão (sobra vazia); 0 = preenche. */
  sobraADireita: number;
  paginaLargura: number;
  paginaJanela: number;
  paginaAltura: number;
  paginaAlturaDaJanela: number;
}

async function medir(page: Page, testid: string): Promise<Medidas> {
  // A grade chega por streaming: até a troca, fica num contêiner oculto e mede 0.
  await page.getByTestId(testid).waitFor({ state: "visible" });
  return page.evaluate((alvo) => {
    const cartao = document.querySelector<HTMLElement>(`[data-testid="${alvo}"]`);
    if (!cartao) throw new Error("A grade não abriu.");
    const cabecalho = cartao.querySelector<HTMLElement>('[role="row"]');
    const colunas = [...(cabecalho?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? [])];
    const ultima = colunas[colunas.length - 1];
    if (!ultima) throw new Error("A grade não tem colunas.");
    const raiz = document.scrollingElement as Element;
    return {
      cartaoLargura: cartao.clientWidth,
      cartaoRolavel: cartao.scrollWidth,
      sobraADireita:
        cartao.getBoundingClientRect().right - 1 - ultima.getBoundingClientRect().right,
      paginaLargura: raiz.scrollWidth,
      paginaJanela: raiz.clientWidth,
      paginaAltura: raiz.scrollHeight,
      paginaAlturaDaJanela: raiz.clientHeight,
    };
  }, testid);
}

async function abrir(
  page: Page,
  rota: string,
  tela: { largura: number; altura: number },
  tema: (typeof TEMAS)[number],
) {
  await page.setViewportSize({ width: tela.largura, height: tela.altura });
  await page.emulateMedia({ colorScheme: tema });
  await page.goto(rota);
  await expect(page.getByRole("heading", { level: 1, name: "Acompanhamento" })).toBeVisible();
}

for (const aba of ABAS) {
  const testid = aba.modo === "grade" ? "grade-do-mes" : "grade-de-soltas";
  for (const tela of TELAS) {
    for (const tema of TEMAS) {
      test(`aba ${aba.nome} em ${tela.largura} × ${tela.altura} (${tema}): a página não rola e o paginador fica visível`, async ({
        page,
      }) => {
        await abrir(page, `/frota/acompanhamento?modo=${aba.modo}`, tela, tema);
        // O Auto conta as linhas pela altura da janela; a primeira abertura já pode ajustar e recarregar.
        await expect(page.getByLabel("Linhas por página")).toHaveValue("auto");
        await expect(page.getByTestId(testid)).toBeVisible();
        const m = await medir(page, testid);
        // A página nunca rola na vertical, nem de lado.
        expect(m.paginaAltura).toBeLessThanOrEqual(m.paginaAlturaDaJanela);
        expect(m.paginaLargura).toBeLessThanOrEqual(m.paginaJanela);
        // O paginador e a legenda rápida ficam dentro da janela.
        await expect(page.getByTestId("total-da-grade")).toBeInViewport({ ratio: 1 });
        // 31 dias a 34 px com a coluna de 12 rem e o olho: cabem de 1366 a 1920 (a barra recolhe até 1439 px).
        expect(m.cartaoRolavel).toBeLessThanOrEqual(m.cartaoLargura);
        // As colunas dos dias preenchem o cartão, sem faixa vazia à direita.
        expect(Math.abs(m.sobraADireita)).toBeLessThanOrEqual(1);
      });
    }
  }

  for (const tema of TEMAS) {
    test(`aba ${aba.nome} em 1092 px (${tema}): a rolagem é interna, com o cabeçalho e a primeira coluna fixos`, async ({
      page,
    }) => {
      await abrir(
        page,
        `/frota/acompanhamento?modo=${aba.modo}`,
        { largura: 1092, altura: 700 },
        tema,
      );
      const m = await medir(page, testid);
      expect(m.cartaoRolavel).toBeGreaterThan(m.cartaoLargura);
      expect(m.paginaLargura).toBeLessThanOrEqual(m.paginaJanela);
      expect(m.paginaAltura).toBeLessThanOrEqual(m.paginaAlturaDaJanela);

      const cartao = page.getByTestId(testid);
      const primeira = cartao.locator(`[data-linha="${aba.linha}"] [role="rowheader"]`).first();
      const diaDeHoje = cartao.locator('[role="columnheader"][data-hoje]');
      const antes = await primeira.boundingBox();
      const cabecalhoAntes = await diaDeHoje.boundingBox();
      await cartao.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
        el.scrollTop = 40;
      });
      const depois = await primeira.boundingBox();
      const cabecalhoDepois = await diaDeHoje.boundingBox();
      // A primeira coluna fica no mesmo lugar ao rolar de lado; o cabeçalho, ao rolar para baixo.
      expect(Math.abs((depois?.x ?? 0) - (antes?.x ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((cabecalhoDepois?.y ?? 0) - (cabecalhoAntes?.y ?? 0))).toBeLessThanOrEqual(1);
    });
  }
}

test("com 20, 50 ou 100 linhas a tabela rola por dentro e a página continua sem rolagem vertical", async ({
  page,
}) => {
  await abrir(page, "/frota/acompanhamento?tam=100", TELAS[0], "light");
  await expect(page.getByTestId("grade-do-mes")).toBeVisible();
  const m = await medir(page, "grade-do-mes");
  expect(m.paginaAltura).toBeLessThanOrEqual(m.paginaAlturaDaJanela);
  await expect(page.getByTestId("total-da-grade")).toBeInViewport({ ratio: 1 });
});

test("o conjunto é uma peça só: uma linha, sem células nem linhas próprias para os implementos", async ({
  page,
}) => {
  await abrir(page, "/frota/acompanhamento", TELAS[1], "light");
  await expect(page.locator('[data-linha="implemento"]')).toHaveCount(0);
  // Os implementos são chips na célula da esquerda do conjunto: "+ N implementos" e as placas pequenas.
  const comImplementos = page
    .locator('[data-linha="conjunto"] [data-chips-dos-implementos]')
    .first();
  if ((await comImplementos.count()) > 0) {
    await expect(comImplementos).toContainText(/\+ \d+ implementos?/);
    await expect(comImplementos.locator("[data-implemento]").first()).toBeVisible();
  }
});

test("a célula de um dia impedido por implemento diz a causa na dica", async ({ page }) => {
  await abrir(page, "/frota/acompanhamento?chip=impedida", TELAS[1], "light");
  const impedidas = page.locator('[data-linha="conjunto"] button[data-causa]');
  if ((await impedidas.count()) > 0) {
    await expect(impedidas.first()).toHaveAttribute(
      "title",
      /impedido por ([A-Z0-9]{7} · [A-Za-zÀ-ú]{3}|\d+ peças: [A-Z0-9]{7} [A-Za-zÀ-ú]{3}(, [A-Z0-9]{7} [A-Za-zÀ-ú]{3})+)/,
    );
  }
});

test("a coluna de hoje tem rótulo e ícone, não só cor; o fim de semana é marcado", async ({
  page,
}) => {
  await abrir(page, "/frota/acompanhamento", TELAS[0], "light");
  const hoje = page.locator('[role="columnheader"][data-hoje]');
  await expect(hoje).toHaveCount(1);
  await expect(hoje).toContainText("hoje");
  await expect(hoje.locator("svg")).toHaveCount(1);
  await expect(page.locator('[role="columnheader"][data-fim-de-semana]').first()).toBeVisible();
});

test("cada aba tem a sua medida do dia: conjuntos com lançamento e soltas com situação", async ({
  page,
}) => {
  await abrir(page, "/frota/acompanhamento", TELAS[0], "light");
  await expect(page.getByTestId("x-de-y")).toContainText(
    /(\d+ de \d+ conjuntos com lançamento hoje|Sem dados ainda)/,
  );
  await page.getByRole("link", { name: "Grade · Soltas" }).click();
  await expect(page).toHaveURL(/modo=soltas/);
  await expect(page.getByTestId("x-de-y")).toContainText(
    /(\d+ de \d+ soltas com situação hoje|Sem dados ainda)/,
  );
});

test("o chip filtra a grade pela URL e volta com 'Todos'", async ({ page }) => {
  await abrir(page, "/frota/acompanhamento", TELAS[0], "light");
  const chips = page.getByTestId("chips-da-grade");
  await chips.getByRole("link", { name: /^Impedida/ }).click();
  await expect(page).toHaveURL(/chip=impedida/);
  await chips.getByRole("link", { name: /^Todos/ }).click();
  await expect(page).not.toHaveURL(/chip=/);
});

test("a densidade Confortável fica lembrada ao recarregar", async ({ page }) => {
  await abrir(page, "/frota/acompanhamento", TELAS[0], "light");
  const seletor = page.getByRole("group", { name: "Densidade da grade" });
  await seletor.getByRole("button", { name: "Confortável" }).click();
  await expect(seletor.getByRole("button", { name: "Confortável" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  const depois = page.getByRole("group", { name: "Densidade da grade" });
  await expect(depois.getByRole("button", { name: "Confortável" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Volta ao padrão para não deixar o cookie sujo.
  await depois.getByRole("button", { name: "Compacto" }).click();
});
