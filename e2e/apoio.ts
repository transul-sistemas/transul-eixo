import type { Page } from "@playwright/test";

const hidratado = (alvo: string) => {
  const elemento = document.querySelector(alvo);
  return !!elemento && Object.keys(elemento).some((chave) => chave.startsWith("__reactFiber"));
};

/**
 * Abre a página e espera o React assumir o elemento (`seletor`): antes disso, clique, digitação e
 * atalho não fazem nada, e o teste ficaria dependendo da sorte. Se a página tem barra de consulta
 * (que fica dentro de um Suspense e hidrata depois do topo), espera por ela também: texto digitado
 * antes disso se perde.
 */
export async function abrirHidratada(page: Page, rota: string, seletor = "header") {
  await page.goto(rota);
  await page.waitForFunction(hidratado, seletor);
  if ((await page.locator('[role="search"]').count()) > 0) {
    await page.waitForFunction(hidratado, '[role="search"] input');
  }
}
