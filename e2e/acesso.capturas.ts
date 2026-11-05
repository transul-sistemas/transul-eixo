import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { emailDe, senhaDe, sessaoDe } from "./apoio/usuarios-de-teste";

// As capturas das telas de acesso (fatia 3.8), claro e escuro, em cada largura de projeto
// (capturas-1366, -1920, -tablet-820 e -celular-390). Só rodam no CI do pull request
// (`pnpm test:capturas` com EIXO_CAPTURAS=1) e sobem como o artefato "capturas-do-acesso".

const PASTA = "capturas";
const TEMAS = [
  { nome: "claro", esquema: "light" },
  { nome: "escuro", esquema: "dark" },
] as const;

test.use({ storageState: { cookies: [], origins: [] } });

async function capturar(page: Page, info: TestInfo, tela: string) {
  const largura = info.project.name.replace(/^capturas-/, "");
  for (const tema of TEMAS) {
    await page.emulateMedia({ colorScheme: tema.esquema });
    const html = page.locator("html");
    if (tema.esquema === "dark") await expect(html).toHaveClass(/\bdark\b/);
    else await expect(html).not.toHaveClass(/\bdark\b/);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${PASTA}/${largura}-${tema.nome}-${tela}.png`, fullPage: true });
  }
}

async function entrar(page: Page, email: string, senha: string) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("entrar", async ({ page }, info) => {
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await capturar(page, info, "entrar");
});

test("entrar com erro", async ({ page }, info) => {
  await page.goto("/entrar");
  // Um e-mail que não existe: não gasta tentativa de nenhum usuário de teste.
  await entrar(page, "ninguem@eixo.teste", "uma-senha-errada-123");
  await expect(
    page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos" }),
  ).toBeVisible();
  await capturar(page, info, "entrar-com-erro");
});

test("esqueci a senha", async ({ page }, info) => {
  await page.goto("/esqueci-a-senha");
  await expect(page.getByRole("button", { name: "Enviar o link" })).toBeVisible();
  await capturar(page, info, "esqueci-a-senha");
});

test("acesso não liberado e nova senha (sessão do sem vínculo)", async ({ page }, info) => {
  await page.goto("/entrar");
  await entrar(page, emailDe("sem_vinculo"), senhaDe("sem_vinculo"));
  await expect(page).toHaveURL(/\/acesso-nao-liberado$/);
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  await capturar(page, info, "acesso-nao-liberado");
  await page.goto("/nova-senha");
  await expect(page).toHaveURL(/\/nova-senha$/);
  await expect(page.getByRole("button", { name: "Salvar a senha nova" })).toBeVisible();
  await capturar(page, info, "nova-senha");
});

// Aprovação da 3.8 (04/11/2026): a tela inicial logada (1366 e celular com a gaveta aberta, claro e
// escuro) e a barra lateral com o Sair no rodapé.
test.describe("tela inicial logada", () => {
  test.use({ storageState: sessaoDe("administrador") });

  test("tela inicial e barra lateral com o Sair", async ({ page }, info) => {
    const largura = info.project.name.replace(/^capturas-/, "");
    test.skip(!["1366", "celular-390"].includes(largura), "só 1366 e celular");
    await page.goto("/inicio/tarefas");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    if (largura === "celular-390") {
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await expect(
        page.locator("#menu-principal").getByRole("button", { name: "Sair" }),
      ).toBeVisible();
      await capturar(page, info, "inicio-gaveta-aberta");
      return;
    }
    await expect(
      page.locator("#menu-principal").getByRole("button", { name: "Sair" }),
    ).toBeVisible();
    await capturar(page, info, "inicio");
    for (const tema of TEMAS) {
      await page.emulateMedia({ colorScheme: tema.esquema });
      if (tema.esquema === "dark") await expect(page.locator("html")).toHaveClass(/\bdark\b/);
      else await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
      await page
        .locator("#menu-principal")
        .screenshot({ path: `${PASTA}/${largura}-${tema.nome}-barra-lateral-com-sair.png` });
    }
  });
});
