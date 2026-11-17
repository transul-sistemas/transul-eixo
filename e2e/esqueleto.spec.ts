import { expect, test } from "@playwright/test";
import { todasAsTelas } from "../lib/navegacao/catalogo";
import { podeAbrir } from "../lib/navegacao/visibilidade";
import { PERFIS_DE_TESTE, sessaoDe } from "./apoio/usuarios-de-teste";

// O esqueleto global (10/11/2026): só o caminho principal por módulo e a visibilidade por perfil, sem
// nenhuma gravação. Cada perfil entra com a sessão guardada pelo projeto "preparar".

// Fim da Fase 1 (13/11/2026): nenhuma tela fica como estrutura; as que eram estrutura leem pela tela de
// painel (dados de exemplo enquanto a função do banco não existe, fora de produção).
const ESQUELETOS = todasAsTelas().filter((t) => t.estado === "esqueleto");
const PAINEIS = [
  "/inicio/resumo-do-dia",
  "/operacional/analise",
  "/operacoes/comparativo",
  "/pessoas/documentos",
  "/parceiros/livro-do-acionista",
  "/resultados/fechamentos",
  "/admin/auditoria",
].map((rota) => todasAsTelas().find((t) => t.rota === rota));
const UMA_POR_MODULO = [
  "inicio",
  "operacional",
  "operacoes",
  "pessoas",
  "parceiros",
  "resultados",
  "admin",
].map((modulo) => ESQUELETOS.find((t) => t.permissao.modulo === modulo));

test.describe("Administrador: o caminho principal de cada módulo com tela de painel", () => {
  test.use({ storageState: sessaoDe("administrador") });

  test("nenhuma tela é estrutura", () => {
    expect(ESQUELETOS.map((t) => t.id)).toEqual([]);
    expect(UMA_POR_MODULO.filter(Boolean)).toEqual([]);
  });

  for (const tela of PAINEIS) {
    if (!tela) continue;
    test(`${tela.rota} abre no padrão, com indicadores e o olho em toda linha`, async ({
      page,
    }) => {
      await page.goto(tela.rota);
      await expect(
        page.getByRole("heading", { level: 1, name: tela.nome, exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("list", { name: "Indicadores" })).toBeVisible();
      const olhos = page.getByRole("button", { name: /^Ver detalhes de / });
      if ((await olhos.count()) > 0) await expect(olhos.first()).toBeEnabled();
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
