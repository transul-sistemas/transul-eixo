import { expect, type Page, test } from "@playwright/test";
import { comBanco } from "../e2e/apoio/usuarios-de-teste";

// Parceiros (primeira versão), o caminho principal no modo banco, com a sessão do Administrador: o
// assistente "Cadastrar parceiro" grava uma locadora fictícia (CNPJ de exemplo, com os dígitos
// certos), a ficha abre, o assistente "Cadastrar locação" loca uma placa dos dados de desenvolvimento
// e a Conciliação abre. O teste prepara o próprio dado (não depende do staging nem do banco local):
// no começo e no fim, o parceiro e as locações do e2e são arquivados (exclusão lógica).

const CNPJ = "11.222.333/0001-81";
const NOME = "Locadora do e2e (fictícia)";

const dialogo = (page: Page, nome: string) => page.getByRole("dialog", { name: nome, exact: true });

async function arquivarOParceiroDoE2e(): Promise<void> {
  await comBanco(async (banco) => {
    const parceiros = `select p.id from parceiros.parceiro p
                         join nucleo.pessoa_documento d on d.pessoa_id = p.pessoa_id
                        where d.documento = '11222333000181' and p.excluido_em is null`;
    await banco.query(
      `update parceiros.locacao set excluido_em = now(), motivo_da_exclusao = 'Locação fictícia do e2e'
        where excluido_em is null and parceiro_id in (${parceiros})`,
    );
    await banco.query(
      `update parceiros.parceiro set excluido_em = now(), motivo_da_exclusao = 'Parceiro fictício do e2e'
        where id in (${parceiros})`,
    );
  });
}

/**
 * Uma placa vigente sem locação em aberto. Este teste GRAVA: no banco do localhost (dados reais e a
 * demonstração) ele só usa o bloco ZDM da demonstração, nunca placa real (Alexandre, 10/11/2026); sem a
 * demonstração (CI, dados de desenvolvimento) usa qualquer placa livre.
 */
async function umaPlacaLivre(): Promise<string> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ placa: string }>(
      `select pa.placa from nucleo.placa_do_ativo pa
        where pa.fim is null and pa.excluido_em is null
          and not exists (select 1 from parceiros.locacao l
                           where l.ativo_id = pa.ativo_id and l.excluido_em is null)
          and (pa.placa like 'ZDM%'
               or not exists (select 1 from nucleo.placa_do_ativo z where z.placa like 'ZDM%'))
        order by pa.placa limit 1`,
    );
    if (!rows[0]) throw new Error("Os dados de desenvolvimento não têm placa vigente.");
    return rows[0].placa;
  });
}

test.describe("Parceiros (Administrador)", () => {
  test.beforeAll(arquivarOParceiroDoE2e);
  test.afterAll(arquivarOParceiroDoE2e);

  test("cadastra o parceiro, abre a ficha, cadastra a locação e abre a conciliação", async ({
    page,
  }) => {
    const placa = await umaPlacaLivre();

    // A lista é paginada no banco (20 por página): a busca deixa o parceiro do e2e na primeira, e a
    // lista (vazia antes) precisa atualizar sozinha depois de gravar.
    await page.goto(`/parceiros/lista?q=${encodeURIComponent("do e2e")}`);
    await expect(page.getByRole("heading", { level: 1, name: "Parceiros" })).toBeVisible();
    await expect(page.getByText("Nenhum parceiro encontrado")).toBeVisible();
    await page.getByRole("button", { name: "Cadastrar parceiro" }).click();
    const cadastro = dialogo(page, "Cadastrar parceiro");
    await cadastro.getByLabel("CPF ou CNPJ").fill(CNPJ);
    await cadastro.getByLabel("Nome ou razão social").fill(NOME);
    await cadastro.getByLabel("Locador").check();
    await cadastro.getByRole("button", { name: "Continuar" }).click();
    await cadastro.getByRole("button", { name: "Continuar" }).click();
    await expect(cadastro).toContainText("Locador");
    await cadastro.getByRole("button", { name: "Cadastrar parceiro" }).click();
    await expect(cadastro).toBeHidden();

    const tabela = page.getByRole("table", { name: "Parceiros do mês" });
    // O documento aparece só mascarado; a linha se acha pelo nome.
    const linha = tabela.getByRole("row").filter({ hasText: NOME });
    await expect(linha).toHaveCount(1);
    await expect(linha).toContainText("/0001-");
    await expect(page.getByTestId("resumo-da-pagina")).toHaveText("Mostrando 1–1 de 1 parceiros");
    await linha.getByRole("link", { name: `Abrir a ficha do parceiro ${NOME}` }).click();
    await expect(page.getByRole("tab", { name: "Resumo" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("Sem agrupador do Sankhya")).toBeVisible();

    await page.goto("/parceiros/locacao");
    await expect(page.getByRole("heading", { level: 1, name: "Locação" })).toBeVisible();
    await page.getByRole("button", { name: "Cadastrar locação" }).click();
    const locacao = dialogo(page, "Cadastrar locação");
    const parceiro = locacao.getByLabel("Parceiro (locador)");
    const valor = await parceiro
      .locator("option")
      .filter({ hasText: NOME })
      .first()
      .getAttribute("value");
    await parceiro.selectOption(valor!);
    await locacao.getByLabel("Placa").fill(placa);
    await locacao.getByRole("button", { name: "Continuar" }).click();
    await locacao.getByLabel("Valor mensal").click();
    await page.keyboard.type("450000");
    await locacao.getByRole("button", { name: "Continuar" }).click();
    await expect(locacao).toContainText("R$ 4.500,00");
    await locacao.getByRole("button", { name: "Cadastrar locação" }).click();
    await expect(locacao).toBeHidden();
    const contratos = page.getByRole("table", { name: "Contratos de locação" });
    const contrato = contratos
      .getByRole("row")
      .filter({ has: page.getByRole("img", { name: `Placa ${placa}` }) });
    await expect(contrato).toContainText("R$ 4.500,00");
    await expect(contrato).toContainText("Vigente");

    await page.goto("/parceiros/conciliacao");
    await expect(page.getByRole("heading", { level: 1, name: "Conciliação" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Filtrar pela situação" })).toBeVisible();
  });
});
