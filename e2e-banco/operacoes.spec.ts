import { expect, test } from "@playwright/test";
import { comBanco } from "../e2e/apoio/usuarios-de-teste";

// Operações › lista e ficha (primeira versão), o caminho principal no modo banco, com a sessão do
// Administrador: a lista acha a operação, a ficha abre com a cascata do mês e o assistente "Editar
// operação" grava a nova base (a filial acompanha). A operação é fictícia e só deste teste: recolocada
// no estado de partida no começo e arquivada no fim (operação não se apaga de verdade).

const NOME = "Operação do e2e (fictícia)";

async function prepararOperacao(): Promise<string> {
  return comBanco(async (banco) => {
    const r = await banco.query<{ id: string }>(
      `insert into nucleo.operacao (nome, tipo, base_cidade, base_uf)
       values ($1, 'operacao', 'Cordeirópolis', 'SP')
       on conflict (nome) do update
         set tipo = 'operacao', base_cidade = 'Cordeirópolis', base_uf = 'SP',
             excluido_em = null, excluido_por = null, motivo_da_exclusao = null
       returning id`,
      [NOME],
    );
    return r.rows[0]!.id;
  });
}

test.describe("Operações (Administrador)", () => {
  test.beforeAll(async () => {
    await prepararOperacao();
  });
  test.afterAll(async () => {
    await comBanco((banco) =>
      banco.query(
        `update nucleo.operacao
            set excluido_em = now(), motivo_da_exclusao = 'Operação fictícia do e2e'
          where nome = $1 and excluido_em is null`,
        [NOME],
      ),
    );
  });

  test("a lista acha a operação, a ficha mostra a cascata e o assistente edita a base", async ({
    page,
  }) => {
    await page.goto(`/operacoes/lista?q=${encodeURIComponent("do e2e")}`);
    await expect(page.getByRole("heading", { level: 1, name: "Operações" })).toBeVisible();
    const tabela = page.getByRole("table", { name: "Operações do mês" });
    const linha = tabela.getByRole("row").filter({ hasText: NOME });
    await expect(linha).toHaveCount(1);
    await expect(linha).toContainText("Cordeirópolis");
    await expect(linha).toContainText("R$ 0,00");

    await linha.getByRole("link", { name: `Abrir a ficha da operação ${NOME}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: NOME })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Resumo" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByLabel("Cascata do mês")).toContainText("Margem");
    await expect(page.getByText("filial Cordeirópolis")).toBeVisible();

    await page.getByRole("button", { name: "Editar operação" }).click();
    const d = page.getByRole("dialog", { name: "Editar operação", exact: true });
    await d.getByLabel("Cidade da base").fill("Parauapebas");
    await d.getByLabel("UF da base").fill("PA");
    await d.getByRole("button", { name: "Continuar" }).click();
    await expect(d).toContainText("Parauapebas/PA");
    await d.getByRole("button", { name: "Editar operação" }).click();
    await expect(d.getByTestId("assistente-concluido")).toHaveText("Operação editada.");
    await d.getByRole("button", { name: "Fechar", exact: true }).click();

    await page.reload();
    await expect(page.getByText("filial Parauapebas")).toBeVisible();
  });
});
