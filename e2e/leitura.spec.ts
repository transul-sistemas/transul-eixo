import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

const ROTA = "/admin/demonstracao";
const consulta = (page: Page) => page.getByRole("search", { name: "Consulta" });
const busca = (page: Page) => consulta(page).getByRole("searchbox", { name: "Buscar placa" });
const chip = (page: Page, nome: string) =>
  consulta(page).getByRole("button", { name: new RegExp(`^${nome}`) });
const kpis = (page: Page) => page.getByRole("list", { name: "Indicadores" });

test.describe("layout de leitura (página de demonstração)", () => {
  test("tem um único título, as ações, a consulta e os indicadores", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "Base visual do Eixo" }),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "Ações" })).toBeVisible();
    await expect(consulta(page)).toBeVisible();
    await expect(kpis(page)).toBeVisible();
  });

  test("segue a ordem do esqueleto: título, consulta, indicadores, conteúdo", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const topos = await Promise.all([
      page.getByRole("heading", { level: 1 }).boundingBox(),
      consulta(page).boundingBox(),
      kpis(page).boundingBox(),
      page.getByRole("region", { name: "Moeda" }).boundingBox(),
    ]);
    const ys = topos.map((caixa) => caixa?.y ?? -1);
    expect(ys.every((y) => y >= 0)).toBe(true);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  test("usa a largura inteira da área de conteúdo", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const principal = await page.getByRole("main").boundingBox();
    const faixa = await kpis(page).boundingBox();
    expect(principal && faixa).toBeTruthy();
    // px-8 em cada lado: 64 px de margem no total.
    expect(Math.abs((principal?.width ?? 0) - 64 - (faixa?.width ?? 0))).toBeLessThan(2);
  });

  test("os indicadores mostram os valores já formatados, com algarismos de largura fixa", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await expect(kpis(page).getByText(/^R\$\s987\.654,32$/)).toBeVisible();
    await expect(kpis(page).getByText("983", { exact: true })).toBeVisible();
    await expect(kpis(page).getByText("3,25 km/l")).toBeVisible();
    await expect(kpis(page).getByText("82,6%")).toBeVisible();
  });

  test("os chips mostram a contagem, formatada", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await expect(chip(page, "Em atividade")).toContainText("812");
    await expect(chip(page, "Atenção")).toContainText("41");
  });

  test("Mais filtros e Visões salvas aparecem desabilitados até a tabela existir", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await expect(consulta(page).getByRole("button", { name: "Mais filtros" })).toBeDisabled();
    await expect(consulta(page).getByRole("button", { name: "Visões salvas" })).toBeDisabled();
  });
});

test.describe("barra de consulta na URL", () => {
  test("ligar um chip põe na URL, e Voltar desliga", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await expect(chip(page, "Atenção")).toHaveAttribute("aria-pressed", "false");
    await chip(page, "Atenção").click();
    await expect(page).toHaveURL(/chip=atencao/);
    await expect(chip(page, "Atenção")).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(chip(page, "Atenção")).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/chip=/);
  });

  test("vários chips ao mesmo tempo, e recarregar mantém", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await chip(page, "Atenção").click();
    await expect(chip(page, "Atenção")).toHaveAttribute("aria-pressed", "true");
    await chip(page, "Pátio").click();
    await expect(page).toHaveURL(/chip=atencao&chip=patio/);
    await page.reload();
    await expect(chip(page, "Atenção")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Pátio")).toHaveAttribute("aria-pressed", "true");
  });

  test("a busca vai para a URL depois de uma pausa, e recarregar mantém o texto", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await busca(page).fill("abc1d23");
    await expect(page).toHaveURL(/q=abc1d23/);
    await page.reload();
    await expect(busca(page)).toHaveValue("abc1d23");
  });

  test("Limpar filtros aparece com busca ou chip, e zera tudo", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const limpar = consulta(page).getByRole("button", { name: "Limpar filtros" });
    await expect(limpar).toHaveCount(0);
    await chip(page, "Fora").click();
    await busca(page).fill("xyz");
    await expect(page).toHaveURL(/q=xyz/);
    await expect(limpar).toBeVisible();
    await limpar.click();
    await expect(page).not.toHaveURL(/chip=|q=/);
    await expect(busca(page)).toHaveValue("");
    await expect(limpar).toHaveCount(0);
  });

  test("busca e chips convivem com o contexto global", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?periodo=2025-03`);
    await chip(page, "Fora").click();
    await expect(page).toHaveURL(/periodo=2025-03/);
    await expect(page).toHaveURL(/chip=fora/);
  });
});
