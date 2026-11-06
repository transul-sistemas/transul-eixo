import { expect, type Page, test } from "@playwright/test";
import { emailDe, senhaDe, sessaoDe } from "../e2e/apoio/usuarios-de-teste";

// O modo banco (fatia 3.9a): as telas de leitura completas, lendo do Supabase local com a sessão de
// quem entrou (RLS); as gravações estão em gravacao.spec.ts (3.9b-1). Dados: `pnpm db:dev-dados` (o gerador de desenvolvimento).
// DAA1A00 é o primeiro cavalo do gerador, da carteira de Ana Ribeiro (não do gestor do e2e).

const ROTA = "/frota/placas";
const PLACA_DE_OUTRO_GESTOR = "DAA1A00";
const tabela = (page: Page) => page.getByRole("table", { name: "Placas" });
const linhas = (page: Page) => tabela(page).locator("tbody tr");

async function total(page: Page): Promise<number> {
  const texto = (await page.getByTestId("resumo-da-pagina").textContent()) ?? "";
  return Number((/de ([\d.]+) placas/.exec(texto)?.[1] ?? "0").replaceAll(".", ""));
}

test.describe("Administrador", () => {
  test("a lista lê do banco, com o total do servidor, e Cadastrar placa já grava (sem em breve)", async ({
    page,
  }) => {
    await page.goto(ROTA);
    await expect(page.getByRole("heading", { level: 1, name: "Placas" })).toBeVisible();
    await expect(linhas(page).first()).toContainText(/D[A-Z]{2}\d[A-Z]\d{2}/);
    expect(await total(page)).toBeGreaterThan(150);
    await expect(page.getByRole("button", { name: "Cadastrar placa" })).toBeEnabled();
    await expect(page.locator("[data-acoes-em-breve]")).toHaveCount(0);
  });

  test("a busca filtra no servidor", async ({ page }) => {
    await page.goto(`${ROTA}?q=${PLACA_DE_OUTRO_GESTOR}`);
    await expect(linhas(page)).toHaveCount(1);
    await expect(linhas(page).first()).toContainText(PLACA_DE_OUTRO_GESTOR);
  });

  test("o painel de espiar mostra o resumo da placa", async ({ page }) => {
    await page.goto(`${ROTA}?q=${PLACA_DE_OUTRO_GESTOR}`);
    await page
      .getByRole("button", { name: `Espiar ${PLACA_DE_OUTRO_GESTOR}`, exact: true })
      .click();
    const painel = page.getByRole("dialog", { name: `Resumo da placa ${PLACA_DE_OUTRO_GESTOR}` });
    await expect(painel).toBeVisible();
    await expect(painel).toContainText("Ana Ribeiro");
  });

  test("a ficha abre, com as seis abas", async ({ page }) => {
    await page.goto(`${ROTA}/${PLACA_DE_OUTRO_GESTOR}`);
    await expect(
      page.getByRole("heading", { level: 1, name: PLACA_DE_OUTRO_GESTOR }),
    ).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Seções da ficha" })).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(6);
  });
});

test.describe("escopo por carteira (Gestor de frota)", () => {
  test.use({ storageState: sessaoDe("gestor_de_frota") });

  test("o gestor vê só a carteira dele", async ({ page }) => {
    await page.goto(ROTA);
    await expect(linhas(page).first()).toBeVisible();
    const celulas = await tabela(page).locator("tbody tr td").allInnerTexts();
    expect(celulas.join(" ")).not.toContain("Ana Ribeiro");
    expect(await total(page)).toBeLessThan(100);
  });

  test("a placa de outro gestor não existe para ele", async ({ page }) => {
    await page.goto(`${ROTA}/${PLACA_DE_OUTRO_GESTOR}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Placa não encontrada" }),
    ).toBeVisible();
  });
});

test.describe("escopo por filial (Operacional)", () => {
  test.use({ storageState: sessaoDe("operacional") });

  // As placas da filial aparecem nas telas do Operacional (ainda em breve); a leitura por filial está
  // provada no pgTAP (80-leitura-das-placas). Aqui: a Frota não existe para o Operacional.
  test("o Operacional não abre a lista da Frota", async ({ page }) => {
    const resposta = await page.goto(ROTA);
    expect(resposta?.status()).toBe(404);
  });
});

test.describe("perfil sem vínculo", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("entra e vê o acesso não liberado", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(emailDe("sem_vinculo"));
    await page.getByLabel("Senha", { exact: true }).fill(senhaDe("sem_vinculo"));
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/acesso-nao-liberado$/);
    await expect(
      page.getByText("Seu acesso ainda não foi liberado. Fale com o administrador."),
    ).toBeVisible();
  });
});
