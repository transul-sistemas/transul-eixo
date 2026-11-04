import { expect, test as preparar } from "@playwright/test";
import {
  PERFIS_DE_TESTE,
  emailDe,
  prepararUsuarios,
  senhaDe,
  sessaoDe,
} from "./apoio/usuarios-de-teste";

// Roda antes dos e2e (projeto "preparar" do Playwright): cria os usuários de teste no Auth local e
// entra pela tela com cada perfil, guardando a sessão de cada um em e2e/.auth/ (fora do Git). Os
// testes de tela usam a do Administrador; os de login, a de cada perfil.

preparar("usuários de teste e a sessão de cada perfil", async ({ page }) => {
  preparar.setTimeout(180_000);
  await prepararUsuarios();
  for (const perfil of PERFIS_DE_TESTE) {
    await page.context().clearCookies();
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(emailDe(perfil.codigo));
    await page.getByLabel("Senha", { exact: true }).fill(senhaDe(perfil.codigo));
    await page.getByRole("button", { name: "Entrar" }).click();
    // Cada perfil termina na sua primeira tela (aprovação da 3.8); basta ter saído do /entrar.
    await expect(page).not.toHaveURL(/\/entrar/, { timeout: 60_000 });
    await page.context().storageState({ path: sessaoDe(perfil.codigo) });
  }
});
