import { createClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";
import {
  type CodigoDoPerfil,
  comBanco,
  emailDe,
  restaurarSenha,
  senhaDe,
  sessaoDe,
  supabaseLocal,
} from "./apoio/usuarios-de-teste";

// O login (fatia 3.8), pela tela, com um usuário de cada perfil no Auth local. Os testes que encerram a
// sessão entram de novo pela tela (sessão nova): a sessão guardada pelo "preparar" é compartilhada com
// os outros testes e não pode ser revogada.

const SEM_SESSAO = { storageState: { cookies: [], origins: [] } };
const menu = (page: Page) => page.getByRole("navigation", { name: "Menu principal" });
const grupo = (page: Page, nome: string) =>
  menu(page).getByRole("button", { name: new RegExp(`^${nome}`) });

async function entrar(page: Page, codigo: CodigoDoPerfil, senha = senhaDe(codigo)) {
  await page.getByLabel("E-mail").fill(emailDe(codigo));
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.describe("sem sessão", () => {
  test.use(SEM_SESSAO);

  test("a tela do sistema manda para /entrar e, depois de entrar, volta ao mesmo lugar", async ({
    page,
  }) => {
    await page.goto("/frota/placas?pagina=1");
    await expect(page).toHaveURL(/\/entrar\?proximo=%2Ffrota%2Fplacas%3Fpagina%3D1/);
    await entrar(page, "gestor_de_frota");
    await expect(page).toHaveURL(/\/frota\/placas\?pagina=1$/);
  });

  test("senha errada e e-mail que não existe dão o mesmo erro, sem dizer qual", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await entrar(page, "administrador", "senha-errada-com-tamanho");
    const erro = page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos" });
    await expect(erro).toBeVisible();
    await page.getByLabel("E-mail").fill("ninguem@eixo.teste");
    await page.getByLabel("Senha", { exact: true }).fill("qualquer-senha-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(erro).toHaveText("E-mail ou senha incorretos. Confira e tente de novo.");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("redirecionamento aberto: o próximo de fora vira a tela inicial", async ({ page }) => {
    await page.goto("/entrar?proximo=%2F%2Fexemplo.com%2Fentrar");
    await entrar(page, "diretoria");
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/inicio\/tarefas$/);
  });

  test("sair encerra a sessão: a tela do sistema volta a pedir login", async ({ page }) => {
    await page.goto("/entrar");
    await entrar(page, "administrador");
    await expect(page).toHaveURL(/\/inicio\/tarefas/);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar$/);
    await page.goto("/frota/placas");
    await expect(page).toHaveURL(/\/entrar\?proximo=/);
    await entrar(page, "administrador");
    await expect(page).toHaveURL(/\/frota\/placas$/);
  });

  test("8 horas sem uso: a sessão termina e /entrar explica", async ({ page, baseURL }) => {
    await page.goto("/entrar");
    await entrar(page, "operacional");
    await expect(page).toHaveURL(/\/operacional\/patio$/);
    await page.context().addCookies([
      {
        name: "eixo_ultima_atividade",
        value: String(Date.now() - 8 * 60 * 60 * 1000 - 1000),
        url: baseURL ?? "http://localhost:3000",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/operacional");
    await expect(page).toHaveURL(/\/entrar\?motivo=inatividade/);
    await expect(page.getByText("Sua sessão terminou depois de 8 horas sem uso")).toBeVisible();
    await page.goto("/inicio/tarefas");
    await expect(page).toHaveURL(/\/entrar\?proximo=/);
  });

  test("sessão válida sem a marca de atividade (cookie apagado) também termina", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await entrar(page, "gestor_de_frota");
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await page.context().clearCookies({ name: "eixo_ultima_atividade" });
    await page.goto("/frota/placas");
    await expect(page).toHaveURL(/\/entrar\?motivo=inatividade/);
  });

  test("quem não tem vínculo vê o acesso não liberado e pode sair", async ({ page }) => {
    await page.goto("/entrar");
    await entrar(page, "sem_vinculo");
    await expect(page).toHaveURL(/\/acesso-nao-liberado$/);
    await expect(
      page.getByText("Seu acesso ainda não foi liberado. Fale com o administrador."),
    ).toBeVisible();
    await page.goto("/frota/placas");
    await expect(page).toHaveURL(/\/acesso-nao-liberado$/);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test("o cadastro está fechado: ninguém cria conta sozinho", async () => {
    const local = supabaseLocal();
    const publico = createClient(local.url, local.chavePublicavel, {
      auth: { persistSession: false },
    });
    const { data, error } = await publico.auth.signUp({
      email: `novo-${Date.now()}@eixo.teste`,
      password: "uma-senha-bem-longa",
    });
    expect(data.user).toBeNull();
    expect(error?.message).toMatch(/signups not allowed/i);
  });
});

// Aprovação da 3.8 (03/11/2026): cada perfil entra sem "proximo" e termina na sua primeira tela, que
// abre (sem 404); a raiz (/) leva ao mesmo lugar. Só no 1366 (cada entrada gasta uma tentativa do Auth).
test.describe("a primeira tela de cada perfil", () => {
  test.use(SEM_SESSAO);
  for (const caso of [
    { codigo: "administrador", destino: "/inicio/tarefas" },
    { codigo: "diretoria", destino: "/inicio/tarefas" },
    { codigo: "gestor_de_frota", destino: "/frota/placas" },
    { codigo: "operacional", destino: "/operacional/patio" },
  ] as const) {
    test(`${caso.codigo} entra e termina em ${caso.destino}, que abre`, async ({ page }, info) => {
      test.skip(info.project.name !== "tela-1366", "uma vez só: cada entrada gasta uma tentativa");
      await page.goto("/entrar");
      await entrar(page, caso.codigo);
      const destino = new RegExp(`${caso.destino}$`);
      await expect(page).toHaveURL(destino);
      await expect(page.getByRole("heading", { name: "Página não encontrada" })).toHaveCount(0);
      await expect(page.locator("main h1").first()).toBeVisible();
      const raiz = await page.goto("/");
      expect(raiz?.status()).toBe(200);
      await expect(page).toHaveURL(destino);
      await page.goto("/entrar");
      await expect(page).toHaveURL(destino);
    });
  }
});

test.describe("recuperação de senha pelo e-mail (Mailpit local)", () => {
  test.use(SEM_SESSAO);

  test("pede o link, abre pelo e-mail, cria a senha nova e entra com ela", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "tela-1366",
      "muda a senha de um usuário de teste: roda só uma vez",
    );
    // A senha do sem vínculo volta à do "preparar" no fim, passe ou falhe: o 1920 entra com ela.
    try {
      await recuperarSenhaPeloEmail(page);
    } finally {
      await restaurarSenha("sem_vinculo");
    }
  });
});

async function recuperarSenhaPeloEmail(page: Page) {
  const local = supabaseLocal();
  const email = emailDe("sem_vinculo");
  await fetch(`${local.correio}/api/v1/messages`, { method: "DELETE" });

  await page.goto("/esqueci-a-senha");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar o link" }).click();
  await expect(page.getByRole("status")).toHaveText(/Se o e-mail estiver cadastrado/);

  let link = "";
  await expect(async () => {
    const busca = (await (
      await fetch(`${local.correio}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
    ).json()) as {
      messages: { ID: string }[];
    };
    const id = busca.messages[0]?.ID;
    expect(id).toBeTruthy();
    const mensagem = (await (await fetch(`${local.correio}/api/v1/message/${id}`)).json()) as {
      HTML: string;
    };
    link = (/href="([^"]*token_hash[^"]*)"/.exec(mensagem.HTML)?.[1] ?? "").replace(/&amp;/g, "&");
    expect(link).toContain("/auth/confirmar?proximo=/nova-senha");
  }).toPass({ timeout: 30_000 });

  await page.goto(link);
  await expect(page).toHaveURL(/\/nova-senha$/);
  await page.getByLabel("Senha nova", { exact: true }).fill("curta");
  await page.getByLabel("Confirme a senha nova").fill("curta");
  await page.getByRole("button", { name: "Salvar a senha nova" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "no mínimo 12 caracteres" }),
  ).toBeVisible();
  const nova = `Nova-${Date.now()}-senha`;
  await page.getByLabel("Senha nova", { exact: true }).fill(nova);
  await page.getByLabel("Confirme a senha nova").fill(nova);
  await page.getByRole("button", { name: "Salvar a senha nova" }).click();
  // Sem vínculo: a senha nova vale, e o sistema mostra o acesso não liberado.
  await expect(page).toHaveURL(/\/acesso-nao-liberado$/);
  await page.getByRole("button", { name: "Sair" }).click();
  await entrar(page, "sem_vinculo", nova);
  await expect(page).toHaveURL(/\/acesso-nao-liberado$/);
}

for (const caso of [
  {
    codigo: "gestor_de_frota",
    ve: ["Frota"],
    naoVe: ["Operacional", "Pessoas", "Administração"],
    proibida: "/pessoas",
  },
  // As telas do Operacional ainda estão "em breve" (só Administrador e Diretoria as veem): o grupo não aparece.
  {
    codigo: "operacional",
    ve: [],
    naoVe: ["Frota", "Pessoas", "Administração"],
    proibida: "/frota/placas",
  },
  { codigo: "diretoria", ve: ["Frota", "Operacional", "Pessoas"], naoVe: [], proibida: null },
  {
    codigo: "administrador",
    ve: ["Frota", "Operacional", "Pessoas", "Administração"],
    naoVe: [],
    proibida: null,
  },
] as const) {
  test.describe(`perfil ${caso.codigo}`, () => {
    test.use({ storageState: sessaoDe(caso.codigo) });

    test("vê só os seus módulos; o endereço de outro módulo é 404", async ({ page }) => {
      await page.goto("/inicio/tarefas");
      await expect(menu(page)).toBeVisible();
      for (const nome of caso.ve) await expect(grupo(page, nome)).toBeVisible();
      for (const nome of caso.naoVe) await expect(grupo(page, nome)).toHaveCount(0);
      if (caso.proibida) {
        const resposta = await page.goto(caso.proibida);
        expect(resposta?.status()).toBe(404);
        await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
      }
    });
  });
}

test.describe("rebaixar o papel tira o acesso na hora", () => {
  test.use({ storageState: sessaoDe("diretoria") });

  test("com o mesmo token, o pedido seguinte já não vê o módulo", async ({ page }, info) => {
    test.skip(
      info.project.name !== "tela-1366",
      "muda o perfil de um usuário de teste: roda só uma vez",
    );
    await page.goto("/pessoas");
    expect(page.url()).not.toMatch(/nao-encontrada/);
    await expect(grupo(page, "Pessoas")).toBeVisible();
    const trocar = (perfil: string) =>
      comBanco((banco) =>
        banco.query(
          "update nucleo.usuario set perfil = $1 where auth_user_id = (select id from auth.users where email = $2)",
          [perfil, emailDe("diretoria")],
        ),
      );
    await trocar("operacional");
    try {
      const resposta = await page.goto("/pessoas");
      expect(resposta?.status()).toBe(404);
      await page.goto("/inicio/tarefas");
      await expect(grupo(page, "Pessoas")).toHaveCount(0);
      await expect(grupo(page, "Frota")).toHaveCount(0);
    } finally {
      await trocar("diretoria");
    }
  });
});
