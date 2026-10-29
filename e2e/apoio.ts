import type { Page } from "@playwright/test";

/**
 * Abre a página e espera o React assumir o elemento (`seletor`): antes disso, clique, digitação e
 * atalho não fazem nada, e o teste ficaria dependendo da sorte.
 */
export async function abrirHidratada(page: Page, rota: string, seletor = "header") {
  await page.goto(rota);
  await page.waitForFunction((alvo) => {
    const elemento = document.querySelector(alvo);
    return !!elemento && Object.keys(elemento).some((chave) => chave.startsWith("__reactFiber"));
  }, seletor);
}
