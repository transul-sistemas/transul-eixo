import { expect, type Page, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import {
  abrirLista,
  abrirOCadastro,
  cadastro,
  conclusao,
  dialogo,
  entrega,
  FICHA,
  irAteConferirOCadastro,
  LISTA,
  passoAtual,
  placaUnica,
  recebimento,
  sessaoIsolada,
} from "./apoio-assistentes-frota";

// Receber placa e Concluir recebimento (o pedido de transferência de exemplo está na AAA0A00, de
// Gestor Exemplo 1 para Gestor Exemplo 2, quem usa no exemplo), Entregar ao Operacional e
// Disponibilizar placa, pela ficha e pelo Ctrl+K. Cada teste usa um armazém de exemplo só dele.

test.beforeEach(async ({ context, baseURL }) => {
  await sessaoIsolada(context, baseURL);
});

const PLACA_COM_PEDIDO = "AAA0A00";
const PENDENCIAS = ["CRLV vence em breve", "Revisão dos 100 mil km em aberto"];

/** Receber placa: confere a chegada e vai ao passo de conferir. */
async function receberAteConferir(page: Page) {
  const r = recebimento(page);
  await r.getByLabel("Conferi o que chegou").check();
  await r.getByRole("button", { name: "Continuar" }).click();
  await expect(r.getByRole("button", { name: "Receber placa" })).toBeVisible();
}

/** Recebe a placa do pedido de exemplo pela ficha e fecha o assistente. */
async function receberPelaFicha(page: Page) {
  await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
  await page.getByRole("button", { name: "Receber placa" }).click();
  await receberAteConferir(page);
  const r = recebimento(page);
  await r.getByRole("button", { name: "Receber placa" }).click();
  await expect(r.getByTestId("assistente-concluido")).toHaveText(
    "Placa recebida. Agora conclua o recebimento, respondendo cada pendência.",
  );
  await r.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(r).toBeHidden();
}

/** A pendência no Concluir recebimento (o fieldset leva o texto dela). */
const pendencia = (page: Page, texto: string) =>
  conclusao(page).getByRole("group", { name: texto, exact: true });

test.describe("entregar ao Operacional", () => {
  test("pela ficha: escolhe a filial e a placa vai a DOp", async ({ page }) => {
    await abrirLista(page, "?chip=patio&chip=cavalo");
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await abrirHidratada(page, FICHA(placa));
    await page.getByRole("button", { name: "Entregar ao Operacional" }).click();
    const d = entrega(page);
    await expect(d).toBeVisible();
    await d.getByLabel("Filial", { exact: true }).selectOption({ label: "Filial Exemplo B" });
    await d.getByRole("button", { name: "Continuar" }).click();
    await expect(d).toContainText("Filial Exemplo B");
    await d.getByRole("button", { name: "Entregar ao Operacional" }).click();
    await expect(d.getByTestId("assistente-concluido")).toHaveText(
      "Placa entregue ao Operacional.",
    );
    await d.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(d).toBeHidden();
    await expect(page.getByText("DOp").first()).toBeVisible();
    // Já está no Operacional: a ação some.
    await expect(page.getByRole("button", { name: "Entregar ao Operacional" })).toHaveCount(0);
  });

  test("sem escolher a filial, avisa no campo e fica no passo", async ({ page }) => {
    await abrirLista(page, "?chip=patio&chip=cavalo");
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await abrirHidratada(page, FICHA(placa));
    await page.getByRole("button", { name: "Entregar ao Operacional" }).click();
    const d = entrega(page);
    await d.getByLabel("Filial", { exact: true }).selectOption({ label: "Escolha…" });
    await d.getByRole("button", { name: "Continuar" }).click();
    await expect(d.getByText("Escolha a filial.")).toBeVisible();
    await expect(passoAtual(d)).toContainText("Filial");
  });

  test("pelo Ctrl+K: pergunta a placa e continua", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: /Buscar tela, modo ou ação/ }).fill("entregar");
    await page.getByRole("option", { name: /Frota › Entregar ao Operacional/ }).click();
    const escolher = page.getByRole("dialog", { name: "Entregar ao Operacional" });
    await escolher.getByLabel("Escolher a placa").selectOption({ index: 1 });
    await escolher.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/placa=/);
    await expect(entrega(page).getByLabel("Filial", { exact: true })).toBeVisible();
  });

  test("placa que não pode ser entregue diz por quê", async ({ page }) => {
    await abrirHidratada(page, `${LISTA}?assistente=entregar-ao-operacional&placa=AAA0A04`);
    const aviso = page.getByRole("dialog", { name: "Entregar ao Operacional" });
    await expect(aviso).toContainText("Só placas em PÁT ou ETv");
    await aviso.getByRole("button", { name: "Fechar" }).click();
    await expect(aviso).toBeHidden();
  });

  test("duas abas: quem grava depois recebe o aviso de que a placa mudou", async ({
    page,
    context,
  }) => {
    // A placa é só deste teste: um cavalo novo, que nasce em PÁT (não a primeira da lista).
    const placa = placaUnica();
    await abrirOCadastro(page);
    await irAteConferirOCadastro(page, { placa });
    await cadastro(page).getByRole("button", { name: "Cadastrar placa" }).click();
    await expect(cadastro(page).getByTestId("assistente-concluido")).toHaveText(
      "Placa cadastrada.",
    );
    await abrirHidratada(page, FICHA(placa));
    await page.getByRole("button", { name: "Entregar ao Operacional" }).click();
    const outra = await context.newPage();
    await abrirHidratada(outra, FICHA(placa));
    await outra.getByRole("button", { name: "Entregar ao Operacional" }).click();
    const preencherEGravar = async (aba: Page, filial: string) => {
      const d = entrega(aba);
      await d.getByLabel("Filial", { exact: true }).selectOption({ label: filial });
      await d.getByRole("button", { name: "Continuar" }).click();
      await d.getByRole("button", { name: "Entregar ao Operacional" }).click();
    };
    // A outra aba grava primeiro e conclui; só então esta grava, com a versão que tinha aberto.
    await preencherEGravar(outra, "Filial Exemplo A");
    await expect(entrega(outra).getByTestId("assistente-concluido")).toBeVisible();
    await preencherEGravar(page, "Filial Exemplo B");
    await expect(entrega(page).getByRole("alert")).toContainText("mudou");
  });
});

test.describe("disponibilizar placa (enviar a outro gestor)", () => {
  test("pela ficha: escolhe o destino, o motivo e uma pendência; depois a ação some", async ({
    page,
  }) => {
    await abrirLista(page, "?chip=patio&chip=cavalo");
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await abrirHidratada(page, FICHA(placa));
    await page.getByRole("button", { name: "Enviar placa" }).click();
    const d = dialogo(page, "Enviar placa");
    await expect(d).toBeVisible();
    // O dono da placa não aparece entre os destinos: o primeiro da lista serve.
    await d.getByLabel("Gestor que vai receber").selectOption({ index: 1 });
    await d.getByLabel("Motivo").fill("Troca de carteira entre filiais");
    await d.getByRole("button", { name: "Continuar" }).click();
    await d.getByLabel("Pendências conhecidas").fill("CRLV vence em breve");
    await d.getByRole("button", { name: "Continuar" }).click();
    await d.getByRole("button", { name: "Enviar placa" }).click();
    await expect(d.getByTestId("assistente-concluido")).toHaveText(
      "Placa enviada. Ela muda de carteira quando quem recebe concluir o recebimento.",
    );
    await d.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(d).toBeHidden();
    // Com o pedido aberto, a placa não se envia de novo.
    await expect(page.getByRole("button", { name: "Enviar placa" })).toHaveCount(0);
  });

  test("sem motivo, avisa no campo e fica no passo", async ({ page }) => {
    await abrirLista(page, "?chip=patio&chip=cavalo");
    const placa = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await abrirHidratada(page, FICHA(placa));
    await page.getByRole("button", { name: "Enviar placa" }).click();
    const d = dialogo(page, "Enviar placa");
    await d.getByLabel("Gestor que vai receber").selectOption({ index: 1 });
    await d.getByRole("button", { name: "Continuar" }).click();
    await expect(d.getByText("Informe o motivo.")).toBeVisible();
    await expect(passoAtual(d)).toContainText("Destino e motivo");
  });
});

test.describe("receber placa e concluir recebimento (as duas etapas)", () => {
  test("pela ficha: recebe (a carteira não muda) e depois conclui respondendo cada pendência", async ({
    page,
  }) => {
    await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
    await page.getByRole("button", { name: "Receber placa" }).click();
    const r = recebimento(page);
    await expect(r.getByTestId("motivo-da-transferencia")).not.toBeEmpty();
    for (const texto of PENDENCIAS) await expect(r).toContainText(texto);
    await r.getByRole("button", { name: "Fechar assistente" }).click();
    await expect(r).toBeHidden();

    await receberPelaFicha(page);
    // A primeira etapa foi atendida: Receber some e aparece Concluir recebimento.
    await expect(page.getByRole("button", { name: "Receber placa" })).toHaveCount(0);
    await page.getByRole("button", { name: "Concluir recebimento" }).click();
    const c = conclusao(page);
    await expect(c).toBeVisible();
    await pendencia(page, PENDENCIAS[0]!).getByLabel("Resolvida", { exact: true }).check();
    await pendencia(page, PENDENCIAS[1]!).getByLabel("Não resolvida", { exact: true }).check();
    await pendencia(page, PENDENCIAS[1]!).getByLabel(/^Nota/).fill("Revisão marcada");
    await c.getByRole("button", { name: "Continuar" }).click();
    await c.getByRole("button", { name: "Concluir recebimento" }).click();
    await expect(c.getByTestId("assistente-concluido")).toHaveText(
      "Recebimento concluído. A placa está na sua carteira.",
    );
    await c.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(c).toBeHidden();
    await expect(page.getByRole("button", { name: "Concluir recebimento" })).toHaveCount(0);
  });

  test("não recebe sem conferir o que chegou", async ({ page }) => {
    await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
    await page.getByRole("button", { name: "Receber placa" }).click();
    const r = recebimento(page);
    await r.getByRole("button", { name: "Continuar" }).click();
    await expect(r.getByText("Confira o que chegou antes de receber.")).toBeVisible();
    await expect(passoAtual(r)).toContainText("Chegada");
  });

  test("não conclui sem responder cada pendência; não resolvida pede a nota", async ({ page }) => {
    await receberPelaFicha(page);
    await page.getByRole("button", { name: "Concluir recebimento" }).click();
    const c = conclusao(page);
    await c.getByRole("button", { name: "Continuar" }).click();
    await expect(c.getByText("Diga se a pendência foi resolvida.").first()).toBeVisible();
    await expect(passoAtual(c)).toContainText("Pendências");
    for (const texto of PENDENCIAS) {
      await pendencia(page, texto).getByLabel("Não resolvida", { exact: true }).check();
    }
    await c.getByRole("button", { name: "Continuar" }).click();
    await expect(c.getByText("Diga na nota o que ficou pendente.").first()).toBeVisible();
    await expect(passoAtual(c)).toContainText("Pendências");
  });

  test("duas abas recebendo o mesmo pedido: a segunda vê que ele mudou", async ({
    page,
    context,
  }) => {
    await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
    await page.getByRole("button", { name: "Receber placa" }).click();
    const outra = await context.newPage();
    await abrirHidratada(outra, FICHA(PLACA_COM_PEDIDO));
    await outra.getByRole("button", { name: "Receber placa" }).click();
    await receberAteConferir(outra);
    await recebimento(outra).getByRole("button", { name: "Receber placa" }).click();
    await expect(recebimento(outra).getByTestId("assistente-concluido")).toBeVisible();
    await receberAteConferir(page);
    await recebimento(page).getByRole("button", { name: "Receber placa" }).click();
    await expect(recebimento(page).getByRole("alert")).toContainText("mudou");
  });

  test("pelo Ctrl+K: lista as placas que esperam por você e abre o assistente da escolhida", async ({
    page,
  }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: /Buscar tela, modo ou ação/ }).fill("receber placa");
    await page.getByRole("option", { name: /Frota › Receber placa/ }).click();
    const escolher = page.getByRole("dialog", { name: "Receber placa" });
    await expect(escolher.getByLabel("Escolher a placa").locator("option")).toHaveCount(2);
    await escolher.getByLabel("Escolher a placa").selectOption({ index: 1 });
    await escolher.getByRole("button", { name: "Continuar" }).click();
    await expect(recebimento(page).getByLabel("Conferi o que chegou")).toBeVisible();
  });

  test("placa sem pedido esperando por você diz o que fazer", async ({ page }) => {
    await abrirHidratada(page, `${LISTA}?assistente=receber-placa&placa=AAA0A04`);
    await expect(page.getByRole("dialog", { name: "Receber placa" })).toContainText(
      "não tem pedido de transferência esperando por você",
    );
  });

  test("Esc fecha o assistente e devolve o foco ao botão da ficha", async ({ page }) => {
    await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
    const botao = page.getByRole("button", { name: "Receber placa" });
    await botao.click();
    await expect(recebimento(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(recebimento(page)).toBeHidden();
    await expect(botao).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${FICHA(PLACA_COM_PEDIDO)}$`));
  });
});

test.describe("para receber: bem aparente", () => {
  test("a lista mostra a faixa e o chip; o chip filtra só as placas que esperam por você", async ({
    page,
  }) => {
    await abrirLista(page);
    const faixa = page.locator("[data-faixa-para-receber]");
    await expect(faixa).toBeVisible();
    await expect(faixa).toContainText("1 placa espera por você.");
    await faixa.getByRole("link", { name: "Ver placas para receber" }).click();
    await expect(page).toHaveURL(/chip=para_receber/);
    await expect(page.locator("[data-espiar-placa]")).toHaveCount(1);
    await expect(page.locator(`[data-espiar-placa="${PLACA_COM_PEDIDO}"]`)).toBeVisible();
  });

  test("a ficha mostra a faixa da etapa: Receber placa, e depois Concluir recebimento", async ({
    page,
  }) => {
    await abrirHidratada(page, FICHA(PLACA_COM_PEDIDO));
    const faixa = page.locator("[data-faixa-para-receber]");
    await expect(faixa).toContainText("Aguardando você");
    await expect(faixa.getByRole("link", { name: "Receber placa" })).toBeVisible();
    await receberPelaFicha(page);
    await expect(faixa.getByRole("link", { name: "Concluir recebimento" })).toBeVisible();
  });
});

// Só cavalo ou caminhão vão ao Operacional: carreta (implemento), apoio e equipamento nunca, mesmo
// em PÁT ou ETv (o catálogo da régua diz em `tipos_validos` de DOp).
const MENSAGEM_DO_TIPO = "Só cavalo ou caminhão podem ser entregues ao Operacional.";

async function primeiraPlacaDe(page: Page, consulta: string) {
  await abrirLista(page, consulta);
  return (await page.locator("[data-espiar-placa]").first().getAttribute("data-espiar-placa"))!;
}

test.describe("entregar ao Operacional: só cavalo ou caminhão", () => {
  test("a ficha de uma carreta em PÁT não tem o botão", async ({ page }) => {
    const carreta = await primeiraPlacaDe(page, "?chip=patio&chip=implemento");
    await abrirHidratada(page, FICHA(carreta));
    await expect(page.getByRole("heading", { level: 1, name: carreta })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entregar ao Operacional" })).toHaveCount(0);
  });

  test("a ficha de um cavalo em PÁT tem o botão", async ({ page }) => {
    const cavalo = await primeiraPlacaDe(page, "?chip=patio&chip=cavalo");
    await abrirHidratada(page, FICHA(cavalo));
    await expect(page.getByRole("button", { name: "Entregar ao Operacional" })).toBeVisible();
  });

  test("pelo Ctrl+K, a carreta não aparece na lista de placas a escolher", async ({ page }) => {
    const carreta = await primeiraPlacaDe(page, "?chip=patio&chip=implemento");
    await abrirHidratada(page, "/inicio/tarefas");
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: /Buscar tela, modo ou ação/ }).fill("entregar");
    await page.getByRole("option", { name: /Frota › Entregar ao Operacional/ }).click();
    const escolher = page.getByRole("dialog", { name: "Entregar ao Operacional" });
    const opcoes = escolher.getByLabel("Escolher a placa").locator("option");
    await expect(opcoes.nth(1)).toBeAttached(); // a lista chegou: além do "Escolha…", há placas
    const textos = await opcoes.allTextContents();
    expect(textos.length).toBeGreaterThan(1);
    expect(textos.join("|")).not.toContain(carreta);
  });

  test("pela URL, a carreta é recusada com a mensagem do tipo, e nada abre", async ({ page }) => {
    const carreta = await primeiraPlacaDe(page, "?chip=patio&chip=implemento");
    await abrirHidratada(page, `${LISTA}?assistente=entregar-ao-operacional&placa=${carreta}`);
    const aviso = page.getByRole("dialog", { name: "Entregar ao Operacional" });
    await expect(aviso).toContainText(MENSAGEM_DO_TIPO);
    await expect(aviso.getByLabel("Filial", { exact: true })).toHaveCount(0);
  });
});

test.describe("devolver placa", () => {
  test("pela ficha: o destino recebe e devolve com o motivo; o recebimento sai da ficha", async ({
    page,
  }) => {
    await receberPelaFicha(page);
    await page.getByRole("button", { name: "Devolver placa" }).click();
    const d = dialogo(page, "Devolver placa");
    await d.getByRole("button", { name: "Continuar" }).click();
    await expect(d.getByText("Informe o motivo.")).toBeVisible();
    await d.getByLabel("Motivo da devolução").fill("Avaria não informada");
    await d.getByRole("button", { name: "Continuar" }).click();
    await d.getByRole("button", { name: "Devolver placa" }).click();
    await expect(d.getByTestId("assistente-concluido")).toContainText("Placa devolvida.");
    await d.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(d).toBeHidden();
    await expect(page.getByRole("button", { name: "Concluir recebimento" })).toHaveCount(0);
  });
});
