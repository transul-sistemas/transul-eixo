import { expect, type Page, test } from "@playwright/test";
import { comBanco, emailDe, sessaoDe } from "../e2e/apoio/usuarios-de-teste";

// Operacional (primeira versão), o caminho principal no modo banco, com a sessão do Operacional: o
// motorista registra a chegada no Totem, o Pátio mostra a placa na fila e aceita (DOp → ACe), e a ordem
// de carregamento nasce pelo assistente "Criar ordem" (ACe → CAr). Dados: `pnpm db:dev-dados`.
// Preparo (pelo dono do banco LOCAL, como no Studio): um caminhão ou um conjunto (cavalo com implemento
// engatado; o ACe só vale para eles) livre em PÁT ou ETv (os dados de desenvolvimento têm conjuntos
// assim; os caminhões nascem em manutenção) é entregue ao Operacional de uma filial do usuário do e2e
// (a primeira por nome; criada se não houver nenhuma). No fim, a placa volta ao gestor em PÁT, para
// rodar de novo com segurança.

test.use({ storageState: sessaoDe("operacional") });

const dialogo = (page: Page, nome: string) => page.getByRole("dialog", { name: nome, exact: true });

interface Alvo {
  placa: string;
  ativo: string;
}

async function entregarUmaPlaca(): Promise<Alvo> {
  return comBanco(async (banco) => {
    await banco.query(
      `insert into config.filial (nome)
       select 'Filial do e2e (fictícia)'
        where not exists (select 1 from config.filial where excluido_em is null)
       on conflict do nothing`,
    );
    const { rows } = await banco.query<Alvo & { filial: string; versao: number }>(
      `select l.placa, l.ativo_id as ativo, a.versao,
              (select id from config.filial where excluido_em is null order by nome, id limit 1) as filial
         from nucleo.leitura_da_placa l join nucleo.ativo a on a.id = l.ativo_id
        where (l.tipo = 'caminhao' or (l.tipo = 'cavalo' and cardinality(l.implementos) > 0))
          and l.sigla in ('PÁT', 'ETv') and l.baixada_em is null
          and l.filial_da_custodia_id is null
        order by l.placa, l.ativo_id limit 1`,
    );
    const alvo = rows[0];
    if (!alvo?.filial)
      throw new Error(
        "Os dados de desenvolvimento não têm caminhão ou conjunto livre em PÁT ou ETv.",
      );
    await banco.query(
      `insert into nucleo.usuario_filial (usuario_id, filial_id)
       select u.pessoa_id, $2 from nucleo.usuario u join auth.users au on au.id = u.auth_user_id
        where au.email = $1
       on conflict do nothing`,
      [emailDe("operacional"), alvo.filial],
    );
    await banco.query(`select nucleo.entregar_ao_operacional($1, $2, now(), $3)`, [
      alvo.ativo,
      alvo.filial,
      alvo.versao,
    ]);
    return { placa: alvo.placa, ativo: alvo.ativo };
  });
}

/** Devolve a placa ao gestor em PÁT (encerra a ordem aberta), para a próxima rodada. */
async function devolverAoGestor(alvo: Alvo): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query("begin");
    await banco.query(
      `update operacional.ordem_de_carregamento
          set situacao = 'em_viagem', carregada_em = coalesce(carregada_em, now()), saiu_em = now()
        where ativo_id = $1 and situacao in ('carregando', 'carregada')`,
      [alvo.ativo],
    );
    await banco.query(
      `update operacional.chegada set saiu_em = now(), motivo_da_saida = 'devolucao'
        where ativo_id = $1 and saiu_em is null`,
      [alvo.ativo],
    );
    await banco.query(
      `select nucleo.devolver_custodia_ao_gestor($1, c.id, now())
         from nucleo.custodia c
        where c.ativo_id = $1 and c.com_quem = 'operacional' and c.fim is null and c.excluido_em is null`,
      [alvo.ativo],
    );
    await banco.query(`select nucleo.registrar_evento($1, 'PÁT', now() + interval '1 second')`, [
      alvo.ativo,
    ]);
    await banco.query("commit");
  });
}

test("Totem, Pátio e Ordens: a chegada entra na fila, a placa é aceita e ganha a ordem", async ({
  page,
}) => {
  const alvo = await entregarUmaPlaca();
  try {
    // Totem: a chegada entra na fila.
    await page.goto("/operacional/totem");
    await expect(page.getByRole("heading", { level: 1, name: "Totem" })).toBeVisible();
    await page.getByRole("textbox", { name: "Digite a placa do caminhão" }).fill(alvo.placa);
    await page.getByRole("button", { name: "Registrar chegada" }).click();
    const chegada = page.getByTestId("chegada-registrada");
    await expect(chegada).toContainText("Chegada registrada.");
    await expect(chegada).toContainText("na fila");

    // Pátio: a placa está na fila, em DOp; aceitar pelo assistente.
    await page.goto("/operacional/patio?filtro=fila");
    await expect(page.getByRole("heading", { level: 1, name: "Pátio" })).toBeVisible();
    const tabela = page.getByTestId("tabela-do-patio");
    await page.getByRole("button", { name: `Aceitar placa: ${alvo.placa}` }).click();
    const aceitar = dialogo(page, "Aceitar placa");
    await expect(aceitar).toBeVisible();
    await aceitar.getByRole("button", { name: "Continuar" }).click();
    await aceitar.getByRole("button", { name: "Aceitar placa" }).click();
    await expect(aceitar).toBeHidden();
    await expect(tabela.getByRole("button", { name: `Criar ordem: ${alvo.placa}` })).toBeVisible();

    // Ordens: "Criar ordem" com a placa aceita; a placa passa a carregando (CAr).
    await page.goto("/operacional/ordens-de-carregamento");
    await expect(
      page.getByRole("heading", { level: 1, name: "Ordens de carregamento" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Criar ordem" }).click();
    const criar = dialogo(page, "Criar ordem");
    await expect(criar).toBeVisible();
    await criar.getByRole("radio", { name: new RegExp(alvo.placa) }).check();
    await criar.getByRole("button", { name: "Continuar" }).click();
    await criar.getByRole("combobox", { name: "Operação" }).selectOption({ index: 1 });
    await criar.getByRole("textbox", { name: "Destino" }).fill("Porto (teste e2e)");
    await criar.getByRole("button", { name: "Continuar" }).click();
    await criar.getByRole("button", { name: "Criar ordem" }).click();
    await expect(criar).toBeHidden();
    await expect(page.getByTestId("tabela-das-ordens")).toContainText("Porto (teste e2e)");

    const sigla = await comBanco(async (banco) => {
      const { rows } = await banco.query<{ sigla: string }>(
        "select nucleo.situacao_atual($1) as sigla",
        [alvo.ativo],
      );
      return rows[0]?.sigla;
    });
    expect(sigla).toBe("CAr");
  } finally {
    await devolverAoGestor(alvo);
  }
});
