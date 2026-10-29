import { expect, test, type Page } from "@playwright/test";

const ROTA = "/admin/demonstracao";

function observarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (erro) => erros.push(erro.message));
  page.on("console", (mensagem) => {
    if (mensagem.type() === "error") erros.push(mensagem.text());
  });
  return erros;
}

for (const tema of ["light", "dark"] as const) {
  test.describe(`demonstração, tema ${tema === "light" ? "claro" : "escuro"}`, () => {
    test.use({ colorScheme: tema });

    test("não tem rolagem horizontal e não dá erro no navegador", async ({ page }) => {
      const erros = observarErros(page);
      await page.goto(ROTA);
      await page.getByRole("heading", { name: "Base visual do Eixo" }).waitFor();
      const larguras = await page.evaluate(() => ({
        conteudo: document.documentElement.scrollWidth,
        janela: window.innerWidth,
      }));
      expect(larguras.conteudo).toBeLessThanOrEqual(larguras.janela);
      expect(erros).toEqual([]);
    });

    test("mostra os 7 módulos e os 5 status", async ({ page }) => {
      await page.goto(ROTA);
      await expect(page.locator('[data-tom^="modulo:"]')).toHaveCount(7);
      await expect(page.locator('[data-tom^="status:"]')).toHaveCount(5);
      await expect(page.locator('[data-tom="modulo:frota"]')).toBeVisible();
    });

    test("a moeda aparece inteira, com centavos, e o negativo fica em vermelho", async ({
      page,
    }) => {
      await page.goto(ROTA);
      await expect(page.getByText(/^R\$\s1\.284\.300,00$/)).toBeVisible();
      const negativo = page.locator("[data-negativo]").first();
      await expect(negativo).toBeVisible();
      const cores = await page.evaluate(() => {
        const negativo = document.querySelector("[data-negativo]");
        const comum = [...document.querySelectorAll("span.tabular-nums")].find(
          (el) => !el.hasAttribute("data-negativo"),
        );
        return [
          negativo && getComputedStyle(negativo).color,
          comum && getComputedStyle(comum).color,
        ];
      });
      expect(cores[0]).not.toBe(cores[1]);
    });

    test("o campo de moeda preenche a partir dos centavos", async ({ page }) => {
      await page.goto(ROTA);
      const campo = page.getByLabel("Valor do frete");
      await campo.click();
      await campo.pressSequentially("1234");
      await expect(campo).toHaveValue(/^R\$\s12,34$/);
      await campo.press("Backspace");
      await expect(campo).toHaveValue(/^R\$\s1,23$/);
    });

    test("algarismos têm largura fixa", async ({ page }) => {
      await page.goto(ROTA);
      const larguras = await page.evaluate(() =>
        ["largura-a", "largura-b"].map((id) => {
          const texto = document.querySelector(`[data-testid="${id}"]`)?.firstChild;
          if (!texto) return -1;
          const faixa = document.createRange();
          faixa.selectNodeContents(texto);
          return faixa.getBoundingClientRect().width;
        }),
      );
      expect(larguras[0]).toBeGreaterThan(0);
      expect(Math.abs((larguras[0] ?? 0) - (larguras[1] ?? 1))).toBeLessThan(0.5);
    });

    test("o alternador troca o tema", async ({ page }) => {
      await page.goto(ROTA);
      const html = page.locator("html");
      const escuroAntes = tema === "dark";
      await expect(html).toHaveClass(escuroAntes ? /dark/ : /^((?!dark).)*$/);
      await page.getByRole("button", { name: "Alternar tema" }).click();
      await expect(html).toHaveClass(escuroAntes ? /^((?!dark).)*$/ : /dark/);
    });

    test("mostra o azul de ação e o da Frota lado a lado", async ({ page }) => {
      await page.goto(ROTA);
      const secao = page.getByRole("region", { name: "Azul de ação e azul da Frota" });
      await expect(secao.getByRole("button", { name: "Receber placa", exact: true })).toBeVisible();
      await expect(secao.getByRole("button", { name: "Receber placa (Frota)" })).toBeVisible();
    });
  });
}
