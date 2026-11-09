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
  ]) {
    test(`${rota} não existe`, async ({ page }) => {
      const resposta = await page.goto(rota);
      expect(resposta?.status()).toBe(404);
    });
  }
});

test.describe("modos do Acompanhamento", () => {
  // No modo exemplo, a tela existe mas lê só do banco: cada modo abre com a aba certa marcada e o
  // aviso de que não há dados de exemplo (o conteúdo de cada modo é conferido em e2e-banco/).
  const nomes = { grade: "Grade", agora: "Agora", censo: "Censo", mapa: "Mapa" } as const;
  for (const [modo, nome] of Object.entries(nomes)) {
    test(`/frota/acompanhamento?modo=${modo} abre a tela`, async ({ page }) => {
      const resposta = await page.goto(`/frota/acompanhamento?modo=${modo}`);
      expect(resposta?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: "Acompanhamento" })).toBeVisible();
      const abas = page.getByRole("navigation", { name: "Modos do Acompanhamento" });
      await expect(abas.getByRole("link", { name: nome, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.getByText("O Acompanhamento lê só do banco")).toBeVisible();
    });
  }
});

test.describe("cada módulo leva à sua primeira tela", () => {
  const destinos: Record<string, string> = {
    "/inicio": "/inicio/tarefas",
    "/frota": "/frota/acompanhamento",
    "/operacional": "/operacional/patio",
    "/operacoes": "/operacoes/lista",
    "/pessoas": "/pessoas/lista",
    "/parceiros": "/parceiros/lista",
    "/resultados": "/resultados/visao-geral",
    "/cadastros": "/cadastros/catalogos",
    "/admin": "/admin/usuarios-e-perfis",
  };
  for (const [modulo, destino] of Object.entries(destinos)) {
    test(`${modulo} redireciona para ${destino}`, async ({ page }) => {
      await page.goto(modulo);
      await expect(page).toHaveURL(new RegExp(`${destino}$`));
    });
  }
});
