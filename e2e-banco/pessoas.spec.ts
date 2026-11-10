import { expect, type Page, test } from "@playwright/test";
import { hojeEmSaoPaulo } from "../components/formato/data";
import { comBanco, cpf } from "../e2e/apoio/usuarios-de-teste";

// Pessoas › lista, ficha e Escala (primeira versão), o caminho principal no modo banco, com a sessão
// do Administrador: o assistente "Cadastrar pessoa" grava a pessoa com o vínculo, a lista a acha (CPF
// mascarado), a ficha abre com o vínculo e a Escala marca o primeiro dia do mês pelo "Marcar dia".
// Tudo fictício e preparado aqui (o CI só tem o seed e os dados de desenvolvimento): a operação é do
// teste, o CPF é sorteado (válido só pelo dígito verificador) e, no fim, a pessoa, o vínculo e a
// operação são arquivados (nada se apaga de verdade).

const OPERACAO = "Operação de Pessoas do e2e (fictícia)";
const MARCA = String(Date.now()).slice(-8);
const NOME = `Pessoa do e2e ${MARCA} (fictícia)`;
const CPF = cpf(`9${MARCA}`);

const dialogo = (page: Page, nome: string) => page.getByRole("dialog", { name: nome, exact: true });

function primeiroDiaDoMes(): { iso: string; br: string; mes: string } {
  const [ano, mes] = hojeEmSaoPaulo(new Date()).split("-");
  return { iso: `${ano}-${mes}-01`, br: `01/${mes}/${ano}`, mes: `${ano}-${mes}` };
}

let operacaoId = "";

test.describe("Pessoas (Administrador)", () => {
  test.beforeAll(async () => {
    operacaoId = await comBanco(async (banco) => {
      const r = await banco.query<{ id: string }>(
        `insert into nucleo.operacao (nome, tipo, base_cidade, base_uf)
         values ($1, 'operacao', 'Cordeirópolis', 'SP')
         on conflict (nome) do update
           set excluido_em = null, excluido_por = null, motivo_da_exclusao = null
         returning id`,
        [OPERACAO],
      );
      return r.rows[0]!.id;
    });
  });
  test.afterAll(async () => {
    await comBanco(async (banco) => {
      await banco.query(
        `update pessoas.vinculo set excluido_em = now(), motivo_da_exclusao = 'Pessoa fictícia do e2e'
          where excluido_em is null
            and pessoa_id in (select id from nucleo.pessoa where nome like 'Pessoa do e2e %(fictícia)')`,
      );
      await banco.query(
        `update nucleo.pessoa set excluido_em = now(), motivo_da_exclusao = 'Pessoa fictícia do e2e'
          where nome like 'Pessoa do e2e %(fictícia)' and excluido_em is null`,
      );
      await banco.query(
        `update nucleo.operacao set excluido_em = now(), motivo_da_exclusao = 'Operação fictícia do e2e'
          where nome = $1 and excluido_em is null`,
        [OPERACAO],
      );
    });
  });

  test("cadastra a pessoa com vínculo, acha na lista, abre a ficha e marca a escala", async ({
    page,
  }) => {
    const dia = primeiroDiaDoMes();

    await page.goto("/pessoas/lista");
    await expect(page.getByRole("heading", { level: 1, name: "Pessoas" })).toBeVisible();
    await page.getByRole("button", { name: "Cadastrar pessoa" }).click();
    const d = dialogo(page, "Cadastrar pessoa");
    await d.getByLabel("Nome completo").fill(NOME);
    await d.getByLabel("CPF", { exact: true }).fill(CPF);
    await d.getByRole("button", { name: "Continuar" }).click();
    await d.getByLabel("Operação", { exact: true }).selectOption(operacaoId);
    await d.getByLabel("Função", { exact: true }).selectOption("motorista");
    await d.getByLabel("Na operação desde").fill(dia.iso);
    await d.getByRole("button", { name: "Continuar" }).click();
    await expect(d).toContainText(OPERACAO);
    await d.getByRole("button", { name: "Cadastrar pessoa" }).click();
    await expect(d.getByTestId("assistente-concluido")).toHaveText("Pessoa cadastrada.");
    await d.getByRole("button", { name: "Fechar", exact: true }).click();

    await page.goto(`/pessoas/lista?q=${encodeURIComponent(MARCA)}`);
    const linha = page.getByRole("table", { name: "Pessoas" }).getByRole("row").filter({
      hasText: NOME,
    });
    await expect(linha).toHaveCount(1);
    await expect(linha).toContainText(`***.${CPF.slice(3, 6)}.${CPF.slice(6, 9)}-**`);
    await expect(linha).not.toContainText(CPF);
    await expect(linha).toContainText("Motorista");

    await linha.getByRole("link", { name: `Abrir a ficha de ${NOME}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: NOME })).toBeVisible();
    await page.getByRole("tab", { name: "Vínculos" }).click();
    await expect(page.getByRole("table", { name: "Vínculos da pessoa" })).toContainText(OPERACAO);

    await page.goto(`/pessoas/escala?operacao=${operacaoId}&mes=${dia.mes}`);
    await expect(page.getByRole("heading", { level: 1, name: "Escala" })).toBeVisible();
    await page
      .getByRole("button", { name: `Marcar dia: ${NOME}, ${dia.br}: sem marcação` })
      .click();
    const m = dialogo(page, "Marcar dia");
    await m.getByLabel(/^T\s*Trabalho$/).check();
    await m.getByRole("button", { name: "Continuar" }).click();
    await m.getByRole("button", { name: "Marcar dia" }).click();
    await expect(
      page.getByRole("button", { name: `Marcar dia: ${NOME}, ${dia.br}: Trabalho` }),
    ).toBeVisible();
  });
});
