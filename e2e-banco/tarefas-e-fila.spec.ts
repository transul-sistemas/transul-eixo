import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { comBanco } from "../e2e/apoio/usuarios-de-teste";

// Início › Tarefas e Frota › Exceções (Parte B), o caminho principal no modo banco: uma placa com cadastro
// pendente vira tarefa, a tarefa leva à fila filtrada, e "Completar dado" abre o assistente Corrigir
// placa, que completa o RENAVAM pela função atômica e tira a exceção da fila. A placa é fictícia e nasce
// a cada execução (o banco não apaga linha: a exceção resolvida fica de histórico).

const LETRAS = "BCDFGHJKLMNPQRSTVWXYZ";
const letra = () => LETRAS[randomInt(LETRAS.length)] ?? "Z";
const placaNova = () => `ZQ${letra()}${randomInt(10)}${letra()}${randomInt(10)}${randomInt(10)}`;

async function criarPlacaPendente(): Promise<string> {
  const placa = placaNova();
  await comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string }>(
      `insert into nucleo.ativo (tipo, cadastro_pendente) values ('cavalo', true) returning id`,
    );
    await banco.query(
      `insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
       values ($1, $2, now() - interval '1 day', 'informada')`,
      [rows[0]?.id, placa],
    );
  });
  return placa;
}

/** Um RENAVAM com dígito verificador válido (o banco confere), a partir de um prefixo sorteado. */
async function renavamValido(): Promise<string> {
  const prefixo = String(randomInt(1_000_000_000, 9_999_999_999));
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ renavam: string }>(
      `select p || d::text as renavam
         from (select $1::text as p) x, generate_series(0, 9) d
        where nucleo.renavam_valido(p || d::text) limit 1`,
      [prefixo],
    );
    if (!rows[0]) throw new Error("Sem dígito verificador para o prefixo sorteado.");
    return rows[0].renavam;
  });
}

test.describe("Tarefas e Exceções (Administrador)", () => {
  test("a placa pendente vira tarefa, leva à fila e se completa pelo Corrigir placa", async ({
    page,
  }) => {
    const placa = await criarPlacaPendente();

    await page.goto("/inicio/tarefas");
    await expect(page.getByRole("heading", { level: 1, name: "Tarefas" })).toBeVisible();
    const tarefa = page
      .getByRole("list", { name: "Tarefas" })
      .getByRole("link", { name: /placas? com cadastro incompleto/ });
    await expect(tarefa).toBeVisible();
    await tarefa.click();

    await expect(page).toHaveURL(/\/frota\/excecoes\?assunto=cadastro_incompleto/);
    await expect(page.getByRole("heading", { level: 1, name: "Exceções" })).toBeVisible();
    const tabela = page.getByTestId("tabela-de-excecoes");
    await expect(tabela).toContainText("Cadastro incompleto");

    // A fila é paginada no servidor: procura a placa nova passando pelas páginas.
    const completar = page.getByRole("link", { name: `Completar dado da placa ${placa}` });
    for (let i = 0; i < 20 && !(await completar.isVisible()); i += 1) {
      const proxima = page.getByRole("link", { name: "Próxima página" });
      if (!(await proxima.isVisible())) break;
      await proxima.click();
    }
    await expect(completar).toBeVisible();
    await completar.click();

    const dialogo = page.getByRole("dialog", { name: "Corrigir placa" });
    await expect(dialogo).toBeVisible();
    await expect(page).toHaveURL(/assistente=corrigir-placa/);
    await dialogo.getByLabel("RENAVAM").fill(await renavamValido());
    await dialogo.getByRole("button", { name: "Continuar" }).click();
    await dialogo.getByLabel("Motivo").fill("Conferido no documento do veículo.");
    await dialogo.getByRole("button", { name: "Continuar" }).click();
    await dialogo.getByRole("button", { name: "Corrigir placa" }).click();
    await expect(page.getByText("Placa corrigida.")).toBeVisible();

    // O cadastro completo tira a exceção da fila (o gatilho do banco a resolve).
    const abertas = await comBanco(async (banco) => {
      const { rows } = await banco.query<{ n: string }>(
        `select count(*)::text as n
           from nucleo.fila_de_excecoes f
           join nucleo.placa_do_ativo p on p.ativo_id = f.ativo_id
          where p.placa = $1 and f.resolvida_em is null`,
        [placa],
      );
      return Number(rows[0]?.n ?? 0);
    });
    expect(abertas).toBe(0);
  });
});
