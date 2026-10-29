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

    test("mostra os 8 módulos e os 5 status", async ({ page }) => {
      await page.goto(ROTA);
      await expect(page.locator('[data-tom^="modulo:"]')).toHaveCount(8);
      await expect(page.locator('[data-tom^="status:"]')).toHaveCount(5);
      await expect(page.locator('[data-tom="modulo:frota"]')).toBeVisible();
      await expect(page.locator('[data-tom="modulo:admin"]')).toHaveAttribute(
        "title",
        "Administração",
      );
      await expect(page.locator('[data-tom="modulo:cadastros"]')).toHaveText("Cadastros");
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
        const sonda = document.createElement("span");
        sonda.style.color = "var(--texto-negativo)";
        document.body.append(sonda);
        const esperada = getComputedStyle(sonda).color;
        sonda.remove();
        return [negativo && getComputedStyle(negativo).color, esperada];
      });
      expect(cores[0]).toBe(cores[1]);
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
      // A medida só vale com a fonte web já carregada; antes dela vale a fonte reserva do sistema.
      await page.evaluate(() => document.fonts.ready);
      const medidas = await page.evaluate(() => {
        const alvos = ["largura-a", "largura-b"].map((id) =>
          document.querySelector(`[data-testid="${id}"]`),
        );
        const larguras = alvos.map((alvo) => {
          const texto = alvo?.firstChild;
          if (!texto) return -1;
          const faixa = document.createRange();
          faixa.selectNodeContents(texto);
          return faixa.getBoundingClientRect().width;
        });
        const estilo = alvos[0]?.firstElementChild
          ? getComputedStyle(alvos[0].firstElementChild)
          : null;
        return {
          larguras,
          familia: estilo?.fontFamily,
          numerico: estilo?.fontVariantNumeric,
          fontes: [...document.fonts].map((f) => `${f.family}:${f.status}`),
        };
      });
      expect(medidas.larguras[0]).toBeGreaterThan(0);
      const diferenca = Math.abs((medidas.larguras[0] ?? 0) - (medidas.larguras[1] ?? 1));
      expect(diferenca, `diagnóstico: ${JSON.stringify(medidas)}`).toBeLessThan(0.5);
    });

    test("o alternador troca o tema", async ({ page }) => {
      await page.goto(ROTA);
      const html = page.locator("html");
      const escuroAntes = tema === "dark";
      if (escuroAntes) await expect(html).toHaveClass(/dark/);
      else await expect(html).not.toHaveClass(/dark/);
      await page.getByRole("button", { name: "Alternar tema" }).click();
      if (escuroAntes) await expect(html).not.toHaveClass(/dark/);
      else await expect(html).toHaveClass(/dark/);
    });

    test("mostra o azul de ação e o da Frota lado a lado", async ({ page }) => {
      await page.goto(ROTA);
      const secao = page.getByRole("region", { name: "Azul de ação e azul da Frota" });
      await expect(secao.getByRole("button", { name: "Receber placa", exact: true })).toBeVisible();
      await expect(secao.getByRole("button", { name: "Receber placa (Frota)" })).toBeVisible();
    });
  });
}
