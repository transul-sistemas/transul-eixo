import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

const ROTA = "/frota/placas";
const tabela = (page: Page) => page.getByRole("table", { name: "Placas" });
const linhas = (page: Page) => tabela(page).locator("tbody tr");
const consulta = (page: Page) => page.getByRole("search", { name: "Consulta" });
const chip = (page: Page, nome: string) =>
  consulta(page).getByRole("button", { name: new RegExp(`^${nome}`) });
const busca = (page: Page) => consulta(page).getByRole("searchbox", { name: "Buscar placa" });
const resumo = (page: Page) => page.getByTestId("resumo-da-pagina");

async function totalDoResumo(page: Page): Promise<number> {
  const texto = (await resumo(page).textContent()) ?? "";
  const achado = /de ([\d.]+) placas/.exec(texto);
  return Number((achado?.[1] ?? "").replaceAll(".", ""));
}

async function contagemDoChip(page: Page, id: string): Promise<number> {
  const texto = (await consulta(page).locator(`[data-contagem="${id}"]`).textContent()) ?? "";
  return Number(texto.replaceAll(".", ""));
}

test.describe("lista de placas", () => {
  test("mostra o título, a tabela e a primeira placa", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await expect(page.getByRole("heading", { level: 1, name: "Placas" })).toBeVisible();
    await expect(tabela(page)).toBeVisible();
    await expect(linhas(page).first()).toContainText("AAA0A00");
    await expect(linhas(page)).toHaveCount(25);
  });

  test("as colunas padrão estão no cabeçalho, e KM, CR e Valor FIPE não", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const cabecalho = tabela(page).locator("thead");
    for (const nome of [
      "Placa",
      "Tipo",
      "Modelo",
      "Conjunto",
      "Gestor",
      "Operação",
      "Situação",
      "Alertas",
    ]) {
      await expect(
        cabecalho.getByRole("columnheader", { name: new RegExp(`^${nome}`) }),
      ).toBeVisible();
    }
    for (const nome of ["KM", "CR", "Valor FIPE"]) {
      await expect(
        cabecalho.getByRole("columnheader", { name: new RegExp(`^${nome}`) }),
      ).toHaveCount(0);
    }
  });

  test("a situação mostra a sigla exata e o nome por extenso", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?q=AAA0A22`);
    await expect(linhas(page).first()).toContainText("ETc");
    await expect(linhas(page).first()).toContainText("Em trânsito carregado");
  });

  test("os chips mostram a contagem do servidor, e a soma dos cinco é o total", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    const ids = ["em-atividade", "atencao", "impedida", "patio", "fora"];
    let soma = 0;
    for (const id of ids) soma += await contagemDoChip(page, id);
    expect(soma).toBeGreaterThan(100);
    expect(await totalDoResumo(page)).toBe(soma);
  });

  test("ligar um chip filtra, vai à URL e sobrevive a recarregar", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await chip(page, "Pátio").click();
    await expect(page).toHaveURL(/chip=patio/);
    await expect(chip(page, "Pátio")).toHaveAttribute("aria-pressed", "true");
    await expect(linhas(page).first()).toContainText("PÁT");
    for (const celula of await linhas(page).allTextContents()) expect(celula).toContain("PÁT");
    await page.reload();
    await expect(chip(page, "Pátio")).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/chip=patio/);
  });

  test("a busca filtra e vai à URL", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await busca(page).fill("AAA0A0");
    await expect(page).toHaveURL(/q=AAA0A0/);
    await expect(linhas(page).first()).toContainText("AAA0A0");
    expect(await totalDoResumo(page)).toBeLessThan(15);
  });

  test("clicar no cabeçalho ordena, inverte e vai à URL", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const placa = tabela(page).getByRole("columnheader", { name: /^Placa/ });
    await expect(placa).toHaveAttribute("aria-sort", "ascending");
    const primeira = await linhas(page).first().textContent();
    await placa.getByRole("button").click();
    await expect(page).toHaveURL(/ordem=-placa/);
    await expect(placa).toHaveAttribute("aria-sort", "descending");
    await expect(linhas(page).first()).not.toHaveText(primeira ?? "");
    const tipo = tabela(page).getByRole("columnheader", { name: /^Tipo/ });
    await tipo.getByRole("button").click();
    await expect(page).toHaveURL(/ordem=tipo/);
    await expect(tipo).toHaveAttribute("aria-sort", "ascending");
  });

  test("a segunda página mostra outras linhas e o resumo certo", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const primeira = await linhas(page).first().textContent();
    await expect(resumo(page)).toContainText("Mostrando 1–25 de");
    await page.getByRole("link", { name: "Próxima página" }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(resumo(page)).toContainText("Mostrando 26–50 de");
    await expect(linhas(page).first()).not.toHaveText(primeira ?? "");
  });

  test("mudar um filtro na página 2 volta para a página 1", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?pagina=2`);
    await chip(page, "Pátio").click();
    await expect(page).toHaveURL(/chip=patio/);
    await expect(page).not.toHaveURL(/pagina=/);
  });

  test("Voltar desfaz um passo e não sai do sistema", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await chip(page, "Atenção").click();
    await expect(page).toHaveURL(/chip=atencao/);
    await page.goBack();
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await expect(chip(page, "Atenção")).toHaveAttribute("aria-pressed", "false");
  });

  test("a página não rola na horizontal", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const medidas = await page.evaluate(() => ({
      conteudo: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(medidas.conteudo).toBeLessThanOrEqual(medidas.janela);
  });
});

test.describe("lista de placas: estados", () => {
  const esqueleto = (page: Page) => page.getByRole("status", { name: "Carregando placas" });

  test("carregando: o título e a consulta ficam, e o esqueleto ocupa o lugar da tabela", async ({
    page,
  }) => {
    await page.goto(`${ROTA}?lento=1500`, { waitUntil: "commit" });
    await expect(esqueleto(page)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Placas" })).toBeVisible();
    await expect(tabela(page)).toBeVisible({ timeout: 15_000 });
    await expect(esqueleto(page)).toHaveCount(0);
  });

  test("vazio: explica o que houve e Limpar filtros devolve a lista", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?q=zzzzzzzz`);
    const vazio = page.getByTestId("lista-vazia");
    await expect(vazio).toBeVisible();
    await expect(vazio).toContainText("Nenhuma placa encontrada");
    await expect(resumo(page)).toContainText("Mostrando 0–0 de 0 placas");
    await vazio.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(tabela(page)).toBeVisible();
    await expect(linhas(page).first()).toContainText("AAA0A00");
  });

  test("erro: diz o que houve, mantém o título e Tentar de novo recarrega a lista", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?falha=1`, "header");
    const alerta = page.getByRole("main").getByRole("alert");
    await expect(alerta).toContainText("Não foi possível carregar as placas");
    await expect(page.getByRole("heading", { level: 1, name: "Placas" })).toBeVisible();
    // O servidor "se recupera": os próximos pedidos chegam sem a falha simulada.
    await page.route(/falha=1/, (rota) => {
      const url = new URL(rota.request().url());
      url.searchParams.delete("falha");
      return rota.continue({ url: url.toString() });
    });
    await alerta.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(tabela(page)).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });

  test("busca digitada cancela a resposta anterior (só vale a última)", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    // A resposta da primeira busca demora e chega depois da segunda: não pode trocar a lista.
    await page.route(/[?&]q=AAA0A0(&|$)/, async (rota) => {
      await new Promise((resolver) => setTimeout(resolver, 1800));
      await rota.continue();
    });
    await busca(page).fill("AAA0A0");
    await page.waitForTimeout(450); // a primeira busca já saiu e está parada no servidor
    await busca(page).fill("AAA0A1");
    await expect(page).toHaveURL(/q=AAA0A1/);
    await expect(resumo(page)).toContainText("de 9 placas", { timeout: 10_000 });
    for (const texto of await linhas(page).allTextContents()) expect(texto).toContain("AAA0A1");
    await page.waitForTimeout(2500); // a resposta atrasada já chegou: a tela continua na última
    await expect(page).toHaveURL(/q=AAA0A1/);
    await expect(busca(page)).toHaveValue("AAA0A1");
    await expect(resumo(page)).toContainText("de 9 placas");
    for (const texto of await linhas(page).allTextContents()) expect(texto).toContain("AAA0A1");
  });

  test("atualizar a página mantém filtro, ordem e página (armadilha 2)", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?chip=impedida&ordem=-gestor&pagina=2`);
    await expect(resumo(page)).toContainText("Mostrando 26–50 de");
    await page.reload();
    await expect(page).toHaveURL(/chip=impedida&ordem=-gestor&pagina=2/);
    await expect(chip(page, "Impedida")).toHaveAttribute("aria-pressed", "true");
    await expect(tabela(page).getByRole("columnheader", { name: /^Gestor/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await expect(resumo(page)).toContainText("Mostrando 26–50 de");
  });

  test("chip com zero fica apagado; o ligado com zero continua clicável", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?q=AAA0A00`);
    await expect(chip(page, "Fora")).toHaveAttribute("data-zerado", "true");
    await expect(chip(page, "Fora")).toBeEnabled();
    await abrirHidratada(page, `${ROTA}?q=AAA0A00&chip=fora`);
    await expect(chip(page, "Fora")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Fora")).not.toHaveAttribute("data-zerado", "true");
    await expect(page.getByTestId("lista-vazia")).toBeVisible();
    await chip(page, "Fora").click();
    await expect(chip(page, "Fora")).toHaveAttribute("aria-pressed", "false");
    await expect(linhas(page).first()).toContainText("AAA0A00");
  });
});
