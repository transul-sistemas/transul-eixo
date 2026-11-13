import { expect, type Page, test } from "@playwright/test";
import { comBanco, sessaoDe } from "../e2e/apoio/usuarios-de-teste";

// Frota › Acompanhamento e Frota › Carteira (primeira versão), o caminho principal de cada tela no modo
// banco: a grade abre, uma célula de hoje lança PÁT pelo assistente (e o banco grava o evento), o Agora e
// o Censo trazem a linha de total; o Gestor de frota confirma uma placa da carteira como "não confere",
// com a observação. Dados: `pnpm db:dev-dados`. Rodar de novo é seguro (lançar PÁT de novo e confirmar
// de novo só trocam a resposta).

const dialogo = (page: Page, nome: string) => page.getByRole("dialog", { name: nome, exact: true });

/** O primeiro cavalo do gerador (DAA1A00), com o id do ativo. */
async function cavaloDoGerador(): Promise<{ placa: string; ativo: string }> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ placa: string; ativo: string }>(
      `select placa, ativo_id as ativo from nucleo.leitura_da_placa
        where placa = 'DAA1A00' and baixada_em is null`,
    );
    if (!rows[0]) throw new Error("Os dados de desenvolvimento não têm o cavalo DAA1A00.");
    return rows[0];
  });
}

test.describe("Acompanhamento (Administrador)", () => {
  test("a grade lança a situação do dia pelo assistente, e o banco grava o evento", async ({
    page,
  }) => {
    const alvo = await cavaloDoGerador();
    await page.goto(`/frota/acompanhamento?busca=${alvo.placa}`);
    await expect(page.getByRole("heading", { level: 1, name: "Acompanhamento" })).toBeVisible();
    // O cavalo do gerador não tem implemento: é o conjunto "Caminhão", uma linha por conjunto.
    const grade = page.getByTestId("grade-do-mes");
    await expect(grade).toBeVisible();
    await expect(page.getByTestId("total-da-grade")).toContainText("1 conjuntos");

    // A última célula clicável da linha é a de hoje.
    await grade
      .getByRole("button", { name: new RegExp(`^Lançar situação: ${alvo.placa}`) })
      .last()
      .click();
    const caixa = dialogo(page, "Lançar situação");
    await expect(caixa).toBeVisible();
    await caixa.getByRole("radio", { name: /PÁT/ }).check();
    await caixa.getByRole("button", { name: "Continuar" }).click();
    await caixa.getByRole("button", { name: "Lançar situação" }).click();
    await expect(caixa).toBeHidden();

    const gravado = await comBanco(async (banco) => {
      const { rows } = await banco.query<{ sigla: string }>(
        `select sigla from nucleo.evento_de_status
          where ativo_id = $1 and excluido_em is null and camada = 'atividade'
            and justificativa = 'Lançamento da situação do dia (Acompanhamento)'
            and registrado_em > now() - interval '5 minutes'
          order by em desc limit 1`,
        [alvo.ativo],
      );
      return rows[0]?.sigla;
    });
    expect(gravado).toBe("PÁT");
  });

  test("Agora e Censo trazem a linha de total pronta do banco", async ({ page }) => {
    await page.goto("/frota/acompanhamento?modo=agora&por=gestor");
    const agora = page.getByTestId("tabela-do-agora");
    await expect(agora).toBeVisible();
    await expect(agora.locator("tfoot")).toContainText("Total");

    await page.goto("/frota/acompanhamento?modo=censo");
    const censo = page.getByTestId("tabela-do-censo");
    await expect(censo).toBeVisible();
    await expect(censo.locator("tfoot")).toContainText("Total");
  });
});

test.describe("Carteira (Gestor de frota)", () => {
  test.use({ storageState: sessaoDe("gestor_de_frota") });

  test("o gestor confirma uma placa como 'não confere', com a observação", async ({ page }) => {
    await page.goto("/frota/carteira");
    await expect(page.getByRole("heading", { level: 1, name: "Carteira" })).toBeVisible();
    const tabela = page.getByTestId("tabela-da-carteira");
    await expect(tabela).toBeVisible();
    const primeira = tabela.locator("tbody tr").first();
    await primeira.getByRole("button", { name: /^Confirmar / }).click();

    const caixa = dialogo(page, "Confirmar carteira");
    await expect(caixa).toBeVisible();
    await caixa.getByRole("radio", { name: "Não confere" }).check();
    await caixa.getByRole("textbox").fill("Placa está no pátio de outra filial (teste e2e)");
    await caixa.getByRole("button", { name: "Continuar" }).click();
    await caixa.getByRole("button", { name: "Confirmar carteira" }).click();
    await expect(caixa).toBeHidden();

    await expect(primeira).toContainText("Não confere");
    await expect(primeira).toContainText("teste e2e");
  });
});
