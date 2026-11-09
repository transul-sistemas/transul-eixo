import { expect, type Page, test } from "@playwright/test";
import { comBanco } from "../e2e/apoio/usuarios-de-teste";

// Cadastros › Catálogos e Administração › Usuários e perfis, pelo banco local, com a sessão do
// Administrador: o catálogo do Eixo grava (cadastrar, editar e arquivar pelo assistente), o que é do
// Sankhya é só leitura, e o assistente de acesso muda o perfil de um usuário de teste.

const dialogo = (page: Page, nome: string) => page.getByRole("dialog", { name: nome, exact: true });
const continuar = (caixa: ReturnType<typeof dialogo>) =>
  caixa.getByRole("button", { name: "Continuar" }).click();

test.describe.serial("Cadastros › Catálogos", () => {
  const nome = `Marca do e2e ${Date.now()}`;
  const editado = `${nome} editada`;

  test("cadastrar marca pelo assistente: a linha aparece na lista", async ({ page }) => {
    await page.goto("/cadastros/catalogos?catalogo=marca");
    await expect(
      page.getByRole("heading", { level: 1, name: "Catálogos e parâmetros" }),
    ).toBeVisible();
    await expect(
      page.getByRole("table", { name: "Marcas" }).or(page.getByTestId("lista-vazia")),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cadastrar marca" }).click();
    const d = dialogo(page, "Cadastrar marca");
    await d.getByLabel("Nome da marca").fill(nome);
    await continuar(d);
    await d.getByRole("button", { name: "Cadastrar marca" }).click();
    await expect(d.getByTestId("assistente-concluido")).toHaveText("Marca cadastrada.");
    await d.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.goto(`/cadastros/catalogos?catalogo=marca&q=${encodeURIComponent(nome)}`);
    await expect(page.getByRole("table", { name: "Marcas" })).toContainText(nome);
  });

  test("editar e arquivar: sai da lista e volta com 'incluir arquivados'", async ({ page }) => {
    const url = `/cadastros/catalogos?catalogo=marca&q=${encodeURIComponent(nome)}`;
    await page.goto(url);
    await page.getByRole("button", { name: "Editar marca" }).click();
    let d = dialogo(page, "Editar marca");
    await d.getByLabel("Nome da marca").fill(editado);
    await continuar(d);
    await d.getByRole("button", { name: "Editar marca" }).click();
    await expect(d.getByTestId("assistente-concluido")).toHaveText("Marca editada.");
    await d.getByRole("button", { name: "Fechar", exact: true }).click();

    await page.goto(`/cadastros/catalogos?catalogo=marca&q=${encodeURIComponent(editado)}`);
    await expect(page.getByRole("table", { name: "Marcas" })).toContainText(editado);
    await page.getByRole("button", { name: "Arquivar marca" }).click();
    d = dialogo(page, "Arquivar marca");
    await d.getByLabel("Motivo do arquivamento").fill("Cadastro de teste do e2e");
    await continuar(d);
    await d.getByRole("button", { name: "Arquivar marca" }).click();
    await expect(d.getByTestId("assistente-concluido")).toHaveText("Marca arquivada.");
    await d.getByRole("button", { name: "Fechar", exact: true }).click();

    await page.goto(`/cadastros/catalogos?catalogo=marca&q=${encodeURIComponent(editado)}`);
    await expect(page.getByTestId("lista-vazia")).toBeVisible();
    await page.goto(
      `/cadastros/catalogos?catalogo=marca&q=${encodeURIComponent(editado)}&arquivados=1`,
    );
    await expect(page.getByRole("table", { name: "Marcas" })).toContainText("Arquivado");
  });

  test("o CR, que é do Sankhya, é só leitura", async ({ page }) => {
    await page.goto("/cadastros/catalogos?catalogo=cr");
    await expect(page.getByTestId("somente-leitura")).toContainText("Só leitura");
    await expect(page.getByRole("button", { name: /^Cadastrar/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Editar/ })).toHaveCount(0);
  });
});

const NOME_DO_USUARIO_DE_TESTE = "Pessoa do e2e de acesso";
const EMAIL_DO_USUARIO_DE_TESTE = "acesso-e2e@eixo.teste";

/** Um usuário só deste teste (Operacional), criado uma vez e recolocado no estado de partida a cada execução. */
async function prepararUsuarioDeTeste(): Promise<void> {
  await comBanco(async (banco) => {
    const { rows } = await banco.query<{ pessoa_id: string }>(
      `select u.pessoa_id from nucleo.usuario u
         join auth.users a on a.id = u.auth_user_id where a.email = $1`,
      [EMAIL_DO_USUARIO_DE_TESTE],
    );
    if (rows[0]) {
      await banco.query(
        `update nucleo.usuario set perfil = 'operacional', ativo = true where pessoa_id = $1`,
        [rows[0].pessoa_id],
      );
      return;
    }
    const auth = await banco.query<{ id: string }>(
      `insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values (gen_random_uuid(), 'authenticated', 'authenticated', $1, '{}'::jsonb, '{}'::jsonb, now(), now())
       returning id`,
      [EMAIL_DO_USUARIO_DE_TESTE],
    );
    const pessoa = await banco.query<{ id: string }>(
      `insert into nucleo.pessoa (nome) values ($1) returning id`,
      [NOME_DO_USUARIO_DE_TESTE],
    );
    await banco.query(
      `insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values ($1, $2, 'operacional')`,
      [pessoa.rows[0]!.id, auth.rows[0]!.id],
    );
  });
}

test.describe.serial("Administração › Usuários e perfis", () => {
  test.beforeAll(prepararUsuarioDeTeste);

  test("lista os usuários, mostra a matriz do perfil e explica como pedir um login novo", async ({
    page,
  }) => {
    await page.goto("/admin/usuarios-e-perfis");
    await expect(page.getByRole("heading", { level: 1, name: "Usuários e perfis" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Usuários" })).toContainText(
      NOME_DO_USUARIO_DE_TESTE,
    );
    await expect(page.getByTestId("como-pedir-login")).toContainText("não cria login");
    await page
      .getByRole("navigation", { name: "Perfis" })
      .getByRole("link", { name: "Gestor de frota" })
      .click();
    const matriz = page.getByRole("table", { name: "Permissões do perfil Gestor de frota" });
    await expect(matriz.locator("tbody tr", { hasText: "Frota" }).first()).toContainText(
      "Minha carteira",
    );
  });

  test("Mudar acesso: o assistente troca o perfil e a mudança chega ao banco", async ({ page }) => {
    await page.goto(`/admin/usuarios-e-perfis?q=${encodeURIComponent(NOME_DO_USUARIO_DE_TESTE)}`);
    await page.getByRole("button", { name: "Mudar acesso" }).click();
    const d = dialogo(page, "Mudar acesso");
    await d.getByLabel("Perfil").selectOption({ label: "Diretoria" });
    await continuar(d);
    await d.getByRole("button", { name: "Mudar acesso" }).click();
    await expect(d.getByTestId("assistente-concluido")).toContainText("Acesso mudado");
    const { rows } = await comBanco((banco) =>
      banco.query<{ perfil: string }>(
        `select u.perfil from nucleo.usuario u join auth.users a on a.id = u.auth_user_id where a.email = $1`,
        [EMAIL_DO_USUARIO_DE_TESTE],
      ),
    );
    expect(rows[0]?.perfil).toBe("diretoria");
  });
});
