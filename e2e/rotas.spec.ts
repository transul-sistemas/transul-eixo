import { expect, test, type Page } from "@playwright/test";
import { todasAsTelas } from "../lib/navegacao/catalogo";

function observarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  page.on("console", (mensagem) => {
    if (mensagem.type() === "error") erros.push(mensagem.text());
  });
  return erros;
}

for (const tema of ["light", "dark"] as const) {
  test.describe(`toda rota do catálogo abre, tema ${tema === "light" ? "claro" : "escuro"}`, () => {
    test.use({ colorScheme: tema });

    for (const tela of todasAsTelas()) {
      test(`${tela.rota} (${tela.estado})`, async ({ page }) => {
        const erros = observarErros(page);
        const resposta = await page.goto(tela.rota);
        expect(resposta?.status()).toBe(200);

        if (tela.estado === "em-breve") {
          await expect(
            page.getByRole("heading", { level: 1, name: tela.nome, exact: true }),
          ).toBeVisible();
          await expect(page.getByRole("status")).toHaveText("Esta tela entra em breve.");
          await expect(page).toHaveTitle(`${tela.nome} · TranSul Eixo`);
        } else {
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        }

        const larguras = await page.evaluate(() => ({
          conteudo: document.documentElement.scrollWidth,
          janela: window.innerWidth,
        }));
        expect(larguras.conteudo).toBeLessThanOrEqual(larguras.janela);
        expect(erros).toEqual([]);
      });
    }
  });
}

test.describe("fora do catálogo", () => {
  for (const rota of [
    "/rota-que-nao-existe",
    "/operacoes/operacoes",
    "/pessoas/pessoas",
    "/parceiros/parceiros",
    "/frota",
  ]) {
    test(`${rota} não existe`, async ({ page }) => {
      const resposta = await page.goto(rota);
      expect(resposta?.status()).toBe(404);
    });
  }
});

test.describe("modos do Acompanhamento", () => {
  for (const modo of ["grade", "agora", "censo", "mapa"]) {
    test(`/frota/acompanhamento?modo=${modo} abre a tela`, async ({ page }) => {
      const resposta = await page.goto(`/frota/acompanhamento?modo=${modo}`);
      expect(resposta?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: "Acompanhamento" })).toBeVisible();
      await expect(page.getByText("Modos previstos: Grade, Agora, Censo e Mapa.")).toBeVisible();
    });
  }
});
