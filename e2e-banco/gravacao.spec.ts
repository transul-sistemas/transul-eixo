import { type Browser, expect, type Page, test } from "@playwright/test";
import { comBanco, emailDe, sessaoDe } from "../e2e/apoio/usuarios-de-teste";

// O modo banco grava (fatia 3.9b-1): Disponibilizar placa (Administrador), Receber placa e Concluir
// recebimento (o Gestor de frota do e2e, que é o destino), com a chave de envio e a versão. As placas
// saem dos dados de desenvolvimento (`pnpm db:dev-dados`) e são escolhidas pelo banco a cada execução
// (sem pedido aberto), para a nova tentativa do CI não tropeçar no que a anterior gravou.

const ROTA = "/frota/placas";
const dialogo = (page: Page, nome: string) => page.getByRole("dialog", { name: nome, exact: true });
const continuar = (caixa: ReturnType<typeof dialogo>) =>
  caixa.getByRole("button", { name: "Continuar" }).click();

interface Gestor {
  id: string;
  nome: string;
}

/** O gestor de frota do e2e (a pessoa ligada ao login do perfil). */
// No banco do localhost (dados reais e a demonstração) este teste só grava em placa ZDM da demonstração (Alexandre, 10/11/2026).
async function gestorDoE2e(): Promise<Gestor> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<Gestor>(
      `select u.pessoa_id as id, p.nome
         from nucleo.usuario u
         join auth.users au on au.id = u.auth_user_id
         join nucleo.pessoa p on p.id = u.pessoa_id
        where au.email = $1`,
      [emailDe("gestor_de_frota")],
    );
    if (!rows[0]) throw new Error("O gestor de frota do e2e não tem pessoa.");
    return rows[0];
  });
}

/** Uma placa fora da carteira do e2e, na frota, sem pedido de transferência aberto. */
async function placaDeOutroGestor(
  gestorDoE2e: string,
  pular = 0,
): Promise<{ placa: string; ativo: string; gestor: string }> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ placa: string; ativo: string; gestor: string }>(
      `select l.placa, l.ativo_id as ativo, l.gestor_id as gestor
         from nucleo.leitura_da_placa l
        where l.gestor_id is not null and l.gestor_id <> $1 and l.baixada_em is null
          and not exists (select 1 from nucleo.transferencia t
                           where t.ativo_id = l.ativo_id and t.excluido_em is null
                             and t.situacao in ('pendente', 'em_conferencia'))
          and (l.placa like 'ZDM%'
               or not exists (select 1 from nucleo.leitura_da_placa z where z.placa like 'ZDM%'))
        order by l.placa
        offset $2 limit 1`,
      [gestorDoE2e, pular],
    );
    if (!rows[0])
      throw new Error("Os dados de desenvolvimento não têm placa livre de outro gestor.");
    return rows[0];
  });
}

async function comoGestor(browser: Browser) {
  const contexto = await browser.newContext({ storageState: sessaoDe("gestor_de_frota") });
  return { contexto, pagina: await contexto.newPage() };
}

test.describe.serial("transferência pelo banco: disponibilizar, receber e concluir", () => {
  let gestor: Gestor;
  let alvo: { placa: string; ativo: string; gestor: string };

  test.beforeAll(async () => {
    gestor = await gestorDoE2e();
    alvo = await placaDeOutroGestor(gestor.id);
  });

  test("o Administrador disponibiliza; o mesmo envio repetido grava um pedido só (chave de envio)", async ({
    page,
  }) => {
    // Cada Server Action deste teste vai ao servidor duas vezes, com o mesmo corpo (a mesma chave de
    // envio): sem a idempotência, a segunda daria "já tem um pedido aberto".
    await page.route(`**${ROTA}/**`, async (rota) => {
      const pedido = rota.request();
      if (pedido.method() !== "POST" || !pedido.headers()["next-action"]) return rota.continue();
      await rota.fetch();
      await rota.fulfill({ response: await rota.fetch() });
    });
    await page.goto(`${ROTA}/${alvo.placa}`);
    await page.getByRole("button", { name: "Disponibilizar placa" }).click();
    const d = dialogo(page, "Disponibilizar placa");
    await d.getByLabel("Gestor que vai receber").selectOption({ label: gestor.nome });
    await d.getByLabel("Motivo").fill("Troca de carteira (e2e do modo banco)");
    await continuar(d);
    await d.getByLabel("Pendências conhecidas").fill("CRLV vence em breve");
    await continuar(d);
    await d.getByRole("button", { name: "Disponibilizar placa" }).click();
    await expect(d.getByTestId("assistente-concluido")).toBeVisible();

    const abertos = await comBanco((banco) =>
      banco.query<{ n: string }>(
        `select count(*) as n from nucleo.transferencia
          where ativo_id = $1 and situacao in ('pendente', 'em_conferencia') and excluido_em is null`,
        [alvo.ativo],
      ),
    );
    expect(Number(abertos.rows[0]?.n)).toBe(1);
  });

  test("o destino vê Para receber (selo, faixa e chip) e a placa ainda não é dele", async ({
    browser,
  }) => {
    const { contexto, pagina } = await comoGestor(browser);
    await pagina.goto(ROTA);
    // Pelo menu à vista: enquanto o streaming troca a barra, o React guarda uma cópia oculta dela.
    await expect(
      pagina
        .getByRole("navigation", { name: "Menu principal" })
        .locator('[data-contador="frota.placas"]'),
    ).toBeVisible();
    await expect(pagina.locator("[data-faixa-para-receber]")).toBeVisible();
    await pagina.getByRole("link", { name: "Ver placas para receber" }).click();
    await expect(pagina).toHaveURL(/chip=para_receber/);
    await expect(pagina.getByRole("table", { name: "Placas" })).toContainText(alvo.placa);
    await pagina.goto(`${ROTA}/${alvo.placa}`);
    await expect(pagina.locator("[data-faixa-para-receber]")).toContainText("Aguardando você");
    await contexto.close();
  });

  test("Receber placa: a segunda aba, com a versão velha do pedido, vê que o registro mudou", async ({
    browser,
  }) => {
    const um = await comoGestor(browser);
    const dois = await comoGestor(browser);
    for (const { pagina } of [um, dois]) {
      await pagina.goto(`${ROTA}/${alvo.placa}?assistente=receber-placa`);
      const r = dialogo(pagina, "Receber placa");
      await r.getByLabel("Conferi o que chegou").check();
      await continuar(r);
    }
    await dialogo(um.pagina, "Receber placa")
      .getByRole("button", { name: "Receber placa" })
      .click();
    await expect(
      dialogo(um.pagina, "Receber placa").getByTestId("assistente-concluido"),
    ).toBeVisible();
    await dialogo(dois.pagina, "Receber placa")
      .getByRole("button", { name: "Receber placa" })
      .click();
    await expect(dialogo(dois.pagina, "Receber placa").getByRole("alert")).toContainText("mudou");
    await um.contexto.close();
    await dois.contexto.close();
  });

  test("Concluir recebimento: a pendência não resolvida pede a nota; concluído, a placa é do destino", async ({
    browser,
  }) => {
    const { contexto, pagina } = await comoGestor(browser);
    await pagina.goto(`${ROTA}/${alvo.placa}?assistente=concluir-recebimento`);
    const c = dialogo(pagina, "Concluir recebimento");
    await c.getByLabel("Não resolvida").check();
    await continuar(c);
    await expect(c).toContainText("Diga na nota o que ficou pendente.");
    await c.getByLabel("Nota", { exact: false }).fill("Renovação marcada");
    await continuar(c);
    await c.getByRole("button", { name: "Concluir recebimento" }).click();
    await expect(c.getByTestId("assistente-concluido")).toBeVisible();
    await contexto.close();

    const vigente = await comBanco((banco) =>
      banco.query<{ gestor_id: string }>(
        `select gestor_id from nucleo.gestor_da_carteira
          where ativo_id = $1 and fim is null and excluido_em is null`,
        [alvo.ativo],
      ),
    );
    expect(vigente.rows[0]?.gestor_id).toBe(gestor.id);
  });
});

test.describe("perfil errado não grava", () => {
  test("o gestor que não é o destino não vê nem recebe a placa", async ({ browser }) => {
    const gestor = await gestorDoE2e();
    const alvo = await placaDeOutroGestor(gestor.id, 3);
    // O pedido nasce pelo dono do banco local (como no Studio), para um terceiro gestor.
    await comBanco(async (banco) => {
      const { rows } = await banco.query<{ id: string }>(
        `select pp.pessoa_id as id from nucleo.papel_da_pessoa pp
          where pp.papel = 'gestor_de_frota' and pp.pessoa_id not in ($1, $2)
          order by pp.pessoa_id limit 1`,
        [gestor.id, alvo.gestor],
      );
      if (!rows[0]) throw new Error("Os dados de desenvolvimento não têm um terceiro gestor.");
      await banco.query(
        `insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo)
         values ($1, $2, $3, 'e2e: pedido para outro gestor')`,
        [alvo.ativo, alvo.gestor, rows[0].id],
      );
    });
    const { contexto, pagina } = await comoGestor(browser);
    await pagina.goto(`${ROTA}/${alvo.placa}`);
    await expect(
      pagina.getByRole("heading", { level: 1, name: "Placa não encontrada" }),
    ).toBeVisible();
    await pagina.goto(`${ROTA}?assistente=receber-placa&placa=${alvo.placa}`);
    await expect(dialogo(pagina, "Receber placa")).toContainText(
      `Não achamos a placa ${alvo.placa}`,
    );
    await contexto.close();
  });

  test("o Operacional não abre a Frota (nem as ações dela)", async ({ browser }) => {
    const contexto = await browser.newContext({ storageState: sessaoDe("operacional") });
    const pagina = await contexto.newPage();
    const resposta = await pagina.goto(`${ROTA}?assistente=cadastrar-placa`);
    expect(resposta?.status()).toBe(404);
    await contexto.close();
  });
});
