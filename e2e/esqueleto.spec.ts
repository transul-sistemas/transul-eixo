import { expect, test } from "@playwright/test";
import { todasAsTelas } from "../lib/navegacao/catalogo";
import { podeAbrir } from "../lib/navegacao/visibilidade";
import { PERFIS_DE_TESTE, sessaoDe } from "./apoio/usuarios-de-teste";

// O esqueleto global (10/11/2026): só o caminho principal por módulo e a visibilidade por perfil, sem
// nenhuma gravação. Cada perfil entra com a sessão guardada pelo projeto "preparar".

const ESQUELETOS = todasAsTelas().filter((t) => t.estado === "esqueleto");
const UMA_POR_MODULO = [
  "inicio",
  "operacional",
  "operacoes",
  "pessoas",
  "parceiros",
  "resultados",
  "admin",
].map((modulo) => ESQUELETOS.find((t) => t.permissao.modulo === modulo));

test.describe("Administrador: o caminho principal de cada módulo com tela esqueleto", () => {
  test.use({ storageState: sessaoDe("administrador") });

  for (const tela of UMA_POR_MODULO) {
    if (!tela) continue;
    test(`${tela.rota} abre no padrão, com o selo Estrutura no menu`, async ({ page }) => {
      await page.goto(tela.rota);
      await expect(
        page.getByRole("heading", { level: 1, name: tela.nome, exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("list", { name: "Indicadores" })).toBeVisible();
      await expect(page.locator("[data-sem-dados]").first()).toContainText(
        "Sem dados ainda: depende de",
      );
      await expect(page.getByRole("button", { name: /^Ver detalhes de / })).toBeDisabled();
      await expect(
        page.getByRole("link", { name: new RegExp(`${tela.nome}.*Estrutura`) }).first(),
      ).toBeVisible();
      const larguras = await page.evaluate(() => ({
        conteudo: document.documentElement.scrollWidth,
        janela: window.innerWidth,
      }));
      expect(larguras.conteudo).toBeLessThanOrEqual(larguras.janela);
    });
  }

  test("o Mapa do sistema lista todas as telas do catálogo, com o estado e o link", async ({
    page,
  }) => {
    await page.goto("/inicio/mapa-do-sistema");
    await expect(page.locator("[data-tela]")).toHaveCount(todasAsTelas().length);
    await expect(page.locator('[data-tela="inicio.tarefas"] a')).toHaveAttribute(
      "href",
      "/inicio/tarefas",
    );
    await expect(page.locator('[data-tela="frota.placas"] [data-estado]')).toHaveText("Pronta");
    await page.getByRole("link", { name: /^Estrutura/ }).click();
    await expect(page).toHaveURL(/estado=esqueleto/);
    await expect(page.locator("[data-tela]")).toHaveCount(ESQUELETOS.length);
  });
});

for (const perfil of PERFIS_DE_TESTE) {
  test.describe(`visibilidade por perfil: ${perfil.nome}`, () => {
    test.use({ storageState: sessaoDe(perfil.codigo) });

    test("o Mapa do sistema mostra só o que o perfil abre", async ({ page }) => {
      await page.goto("/inicio/mapa-do-sistema");
      const esperadas = todasAsTelas().filter((t) => podeAbrir(perfil.nome, t));
      await expect(page.locator("[data-tela]")).toHaveCount(esperadas.length);
    });

    test("tela esqueleto: abre para Administrador e Diretoria, 404 para os demais", async ({
      page,
    }) => {
      for (const tela of ESQUELETOS.filter((t) => t.permissao.modulo === "inicio")) {
        const resposta = await page.goto(tela.rota);
        expect(resposta?.status(), `${perfil.nome} ${tela.rota}`).toBe(
          podeAbrir(perfil.nome, tela) ? 200 : 404,
        );
      }
    });
  });
}
