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
    await abrirHidratada(page, `${ROTA}?q=AAA0A08`);
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
