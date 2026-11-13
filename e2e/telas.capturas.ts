import { expect, type Page, test } from "@playwright/test";
import { sessaoDe } from "./apoio/usuarios-de-teste";

// Galeria da Fase 1 (13/11/2026): cada tela e assistente do catálogo, a 1366, claro e escuro, como o
// Administrador. Só no CI do pull request (EIXO_CAPTURAS=1), no artefato "capturas-do-acesso", com o
// prefixo "tela-". Alexandre revisa pela galeria sem abrir o servidor.

const TELAS: readonly { readonly nome: string; readonly rota: string }[] = [
  // Nível 1
  { nome: "n1-meu-dia", rota: "/inicio/meu-dia" },
  { nome: "n1-tarefas", rota: "/inicio/tarefas" },
  { nome: "n1-acompanhamento-conjuntos", rota: "/frota/acompanhamento" },
  { nome: "n1-acompanhamento-soltas", rota: "/frota/acompanhamento?modo=soltas" },
  { nome: "n1-carteira", rota: "/frota/carteira" },
  { nome: "n1-confirmar-carteira", rota: "/frota/carteira?assistente=confirmar-carteira" },
  { nome: "n1-excecoes", rota: "/frota/excecoes" },
  { nome: "n1-placas", rota: "/frota/placas" },
  { nome: "n1-saude-do-cr", rota: "/cadastros/saude-do-cr" },
  { nome: "n1-operacoes", rota: "/operacoes/lista" },
];

const TEMAS = [
  { nome: "claro", esquema: "light" },
  { nome: "escuro", esquema: "dark" },
] as const;

test.use({ storageState: sessaoDe("administrador") });

async function capturar(page: Page, nome: string) {
  for (const tema of TEMAS) {
    await page.emulateMedia({ colorScheme: tema.esquema });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `capturas/tela-1366-${tema.nome}-${nome}.png` });
  }
}

for (const tela of TELAS) {
  test(`captura ${tela.nome}`, async ({ page }, info) => {
    test.skip(info.project.name !== "capturas-1366", "a galeria é só a 1366");
    await page.goto(tela.rota);
    await expect(page.locator("main").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await capturar(page, tela.nome);
  });
}
