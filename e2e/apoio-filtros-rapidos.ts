import { expect, type Locator, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

// Os grupos de filtro "Situação" e "Tipo de ativo" da lista de placas têm de parecer filtros
// diferentes à vista rápida, em todas as larguras e nos dois temas. Aqui se mede o que o navegador
// realmente desenha (estilos computados), não só as classes.

const NOME_DA_SITUACAO = "Situação, como a placa está agora";
const NOME_DO_TIPO = "Tipo de ativo, o que é a placa";

const grupo = (page: Page, nome: string) => page.getByRole("group", { name: nome });
const chipDe = (alvo: Page | Locator, nome: string) =>
  alvo.getByRole("button", { name: new RegExp(`^${nome}`) });

/** `rgb(...)`, `rgba(...)` ou `color(srgb r g b / a)` para [r, g, b] de 0 a 255. */
function paraRgb(css: string): [number, number, number] {
  const rgb = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(css);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(css);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255];
  throw new Error(`cor que o teste não sabe ler: ${css}`);
}

function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: string, b: string): number {
  const [maior, menor] = [luminancia(paraRgb(a)), luminancia(paraRgb(b))].sort((x, y) => y - x);
  return ((maior as number) + 0.05) / ((menor as number) + 0.05);
}

const estilo = (alvo: ReturnType<Page["locator"]>, propriedade: string) =>
  alvo.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), propriedade);

const raio = async (alvo: ReturnType<Page["locator"]>) =>
  Number.parseFloat(await estilo(alvo, "border-top-left-radius"));

export function testesDosFiltrosRapidos() {
  for (const tema of ["light", "dark"] as const) {
    test.describe(`filtros rápidos, tema ${tema}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ colorScheme: tema });
        await abrirHidratada(page, "/frota/placas");
      });

      test("os dois grupos têm nome acessível distinto, com título e subtítulo visíveis", async ({
        page,
      }) => {
        await expect(grupo(page, NOME_DA_SITUACAO)).toBeVisible();
        await expect(grupo(page, NOME_DO_TIPO)).toBeVisible();
        const situacao = grupo(page, NOME_DA_SITUACAO);
        const tipo = grupo(page, NOME_DO_TIPO);
        await expect(situacao.getByText("Situação", { exact: true })).toBeVisible();
        await expect(situacao.getByText("como a placa está agora", { exact: true })).toBeVisible();
        await expect(tipo.getByText("Tipo de ativo", { exact: true })).toBeVisible();
        await expect(tipo.getByText("o que é a placa", { exact: true })).toBeVisible();
      });

      test("cada grupo está na sua caixa, com a barra lateral de cor diferente", async ({
        page,
      }) => {
        const situacao = grupo(page, NOME_DA_SITUACAO);
        const tipo = grupo(page, NOME_DO_TIPO);
        for (const caixa of [situacao, tipo]) {
          expect(Number.parseFloat(await estilo(caixa, "border-top-width"))).toBeGreaterThanOrEqual(
            1,
          );
          expect(await raio(caixa)).toBeGreaterThanOrEqual(8);
        }
        const barraDaSituacao = await estilo(situacao.locator("[data-barra]"), "background-color");
        const barraDoTipo = await estilo(tipo.locator("[data-barra]"), "background-color");
        expect(barraDaSituacao).not.toBe(barraDoTipo);
        const larguraDaBarra = await situacao.locator("[data-barra]").boundingBox();
        expect(larguraDaBarra?.width ?? 0).toBeGreaterThanOrEqual(4);
      });

      test("Situação é de pílulas com a bolinha da régua; Tipo é de retângulos de canto leve, sem bolinha", async ({
        page,
      }) => {
        const situacao = grupo(page, NOME_DA_SITUACAO);
        const tipo = grupo(page, NOME_DO_TIPO);
        const pilulas = situacao.getByRole("button");
        const retangulos = tipo.getByRole("button");
        expect(await pilulas.count()).toBe(5);
        expect(await retangulos.count()).toBe(5);
        for (const i of [0, 4]) {
          expect(await raio(pilulas.nth(i))).toBeGreaterThanOrEqual(14);
          expect(await raio(retangulos.nth(i))).toBeLessThanOrEqual(8);
          expect(await raio(retangulos.nth(i))).toBeGreaterThan(0);
        }
        expect(await situacao.locator("[data-bolinha]").count()).toBe(5);
        expect(await tipo.locator("[data-bolinha]").count()).toBe(0);
        // A bolinha é redonda e tem a cor do status (as cinco são diferentes entre si).
        const cores = await situacao
          .locator("[data-bolinha]")
          .evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
        expect(new Set(cores).size).toBe(5);
      });

      test("selecionado: Situação com fundo azul claro e borda azul; Tipo com fundo escuro e texto claro; contraste de 4,5:1", async ({
        page,
      }) => {
        const situacao = grupo(page, NOME_DA_SITUACAO);
        const tipo = grupo(page, NOME_DO_TIPO);
        const acao = await estilo(situacao.locator("[data-barra]"), "background-color");

        const pilula = chipDe(situacao, "Em atividade");
        const fundoAntes = await estilo(pilula, "background-color");
        await pilula.click();
        await expect(pilula).toHaveAttribute("aria-pressed", "true");
        const fundoDaPilula = await estilo(pilula, "background-color");
        const bordaDaPilula = await estilo(pilula, "border-top-color");
        const textoDaPilula = await estilo(pilula, "color");
        expect(fundoDaPilula).not.toBe(fundoAntes);
        expect(paraRgb(bordaDaPilula)).toEqual(paraRgb(acao)); // a borda é o azul da ação
        expect(contraste(textoDaPilula, fundoDaPilula)).toBeGreaterThanOrEqual(4.5);

        const retangulo = chipDe(tipo, "Cavalo");
        await retangulo.click();
        await expect(retangulo).toHaveAttribute("aria-pressed", "true");
        const fundoDoRetangulo = await estilo(retangulo, "background-color");
        const textoDoRetangulo = await estilo(retangulo, "color");
        expect(contraste(textoDoRetangulo, fundoDoRetangulo)).toBeGreaterThanOrEqual(4.5);
        // O Tipo selecionado é escuro no tema claro e invertido no escuro: sempre o oposto do texto da página.
        const corDoTexto = await estilo(page.locator("body"), "color");
        expect(paraRgb(fundoDoRetangulo)).toEqual(paraRgb(corDoTexto));
        // As duas seleções não se confundem.
        expect(fundoDaPilula).not.toBe(fundoDoRetangulo);
      });

      test("o contador mostra 'N filtros ativos' ao lado da busca e some sem filtros", async ({
        page,
      }) => {
        const contador = page.locator("[data-filtros-ativos]");
        await expect(contador).toHaveCount(0);
        await chipDe(grupo(page, NOME_DO_TIPO), "Cavalo").click();
        await expect(contador).toHaveText("1 filtro ativo");
        await chipDe(grupo(page, NOME_DA_SITUACAO), "Pátio").click();
        await expect(contador).toHaveText("2 filtros ativos");
        // Fica ao lado da busca (na mesma linha, logo à direita).
        const busca = await page.getByRole("searchbox", { name: "Buscar placa" }).boundingBox();
        const marca = await contador.boundingBox();
        expect(Math.abs((marca?.y ?? 0) - (busca?.y ?? 0))).toBeLessThanOrEqual(24);
        expect(marca?.x ?? 0).toBeGreaterThan((busca?.x ?? 0) + (busca?.width ?? 0));
        await page.getByRole("button", { name: "Limpar filtros" }).click();
        await expect(contador).toHaveCount(0);
      });

      test("a contagem de cada grupo ignora a seleção do próprio grupo (e reage à do outro)", async ({
        page,
      }) => {
        const contagem = async (id: string) =>
          Number(
            ((await page.locator(`[data-contagem="${id}"]`).textContent()) ?? "0").replaceAll(
              ".",
              "",
            ),
          );
        const tipos = ["cavalo", "implemento", "equipamento", "caminhao", "apoio"];
        const situacoes = ["em-atividade", "atencao", "impedida", "patio", "fora"];
        const tiposAntes = await Promise.all(tipos.map(contagem));
        const situacoesAntes = await Promise.all(situacoes.map(contagem));
        await chipDe(grupo(page, NOME_DO_TIPO), "Cavalo").click();
        await expect(page).toHaveURL(/chip=cavalo/);
        expect(await Promise.all(tipos.map(contagem))).toEqual(tiposAntes);
        expect(await Promise.all(situacoes.map(contagem))).not.toEqual(situacoesAntes);
        const soma = (await Promise.all(situacoes.map(contagem))).reduce((a, b) => a + b, 0);
        expect(soma).toBe(tiposAntes[0]); // só os cavalos
      });

      test("só tokens do sistema visual: nenhuma cor escrita à mão nos dois grupos", async ({
        page,
      }) => {
        const html = await page
          .getByRole("group", { name: "Filtros rápidos" })
          .evaluate((el) => el.outerHTML);
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(html).not.toMatch(/style="[^"]*(?:rgb|hsl|oklch)\(/);
      });
    });
  }

  test("a disposição: caixas empilhadas em qualquer largura, título à esquerda dos chips a partir de 1024 px, sem rolagem lateral", async ({
    page,
  }) => {
    await abrirHidratada(page, "/frota/placas");
    const situacao = await grupo(page, NOME_DA_SITUACAO).boundingBox();
    const tipo = await grupo(page, NOME_DO_TIPO).boundingBox();
    expect(situacao).not.toBeNull();
    expect(tipo).not.toBeNull();
    expect(tipo!.y, "empilhadas").toBeGreaterThanOrEqual(situacao!.y + situacao!.height - 1);
    expect(Math.abs(tipo!.x - situacao!.x)).toBeLessThanOrEqual(1);
    const m = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(m.pagina).toBeLessThanOrEqual(m.janela);
    for (const nome of [NOME_DA_SITUACAO, NOME_DO_TIPO]) {
      const titulo = await grupo(page, nome).locator("p").boundingBox();
      const primeiroChip = await grupo(page, nome).getByRole("button").first().boundingBox();
      expect(titulo).not.toBeNull();
      if ((page.viewportSize()?.width ?? 0) >= 1024) {
        // Título e chips na mesma linha: o título termina antes de os chips começarem.
        expect((titulo?.x ?? 0) + (titulo?.width ?? 0)).toBeLessThanOrEqual(
          (primeiroChip?.x ?? 0) + 1,
        );
        expect(Math.abs((titulo?.y ?? 0) - (primeiroChip?.y ?? 0))).toBeLessThanOrEqual(12);
      } else {
        // Tablet e celular: o título fica em cima, inteiro, e os chips embaixo.
        expect(primeiroChip?.y ?? 0).toBeGreaterThanOrEqual(
          (titulo?.y ?? 0) + (titulo?.height ?? 0) - 1,
        );
      }
    }
  });
}
