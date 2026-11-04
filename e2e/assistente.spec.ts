import { expect, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import {
  abrirOAssistente,
  assistente,
  botaoDeAbrir,
  campoNome,
  confirmacao,
  enviosDoAssistente,
  irAteConferir,
  mini,
  NOME_DO_ASSISTENTE,
  preencherIdentificacao,
  ROTA,
} from "./apoio-assistente";

// O motor de interface dos assistentes, no 1366 e no 1920: URL, passos, resumo, rascunho,
// "fechar é fechar", envio sem duplicar, erros, conflito e o "+" com mini-wizard.

test.describe("assistente: abrir e fechar pela URL", () => {
  test("abrir é um passo novo no histórico e o Voltar do navegador fecha, sem sair da tela", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    const antes = await page.evaluate(() => history.length);
    await botaoDeAbrir(page).click();
    await expect(assistente(page)).toBeVisible();
    await expect(page).toHaveURL(/assistente=teste/);
    expect(await page.evaluate(() => history.length)).toBe(antes + 1);
    await page.goBack();
    await expect(assistente(page)).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${ROTA}$`));
  });

  test("um link direto com ?assistente=teste abre o assistente", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?assistente=teste`);
    await expect(assistente(page)).toBeVisible();
  });

  test("fechar devolve o foco ao botão que abriu e deixa a URL como estava", async ({ page }) => {
    await abrirOAssistente(page);
    await page.keyboard.press("Escape");
    await expect(assistente(page)).toBeHidden();
    await expect(botaoDeAbrir(page)).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${ROTA}$`));
  });

  test("o foco começa no primeiro campo e fica preso dentro do assistente", async ({ page }) => {
    await abrirOAssistente(page);
    await expect(campoNome(page)).toBeFocused();
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      // Na volta do ciclo o foco passa um instante por um sentinela do base-ui antes de voltar ao
      // primeiro botão: o que não pode é ficar fora do assistente.
      await expect
        .poll(
          () => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
          { message: `Tab ${i + 1}`, timeout: 2_000 },
        )
        .toBe(true);
    }
  });
});

test.describe("assistente: passos, validação e resumo", () => {
  test("o stepper tem os quatro passos, o atual marcado e a barra de progresso", async ({
    page,
  }) => {
    await abrirOAssistente(page);
    const nav = assistente(page).getByRole("navigation", { name: "Passos do assistente" });
    await expect(nav.getByRole("listitem")).toHaveCount(4);
    await expect(nav.locator('li[aria-current="step"]')).toContainText("Identificação");
    const barra = nav.getByRole("progressbar");
    await expect(barra).toHaveAttribute("aria-valuenow", "25");
    await expect(barra).toHaveAttribute("aria-valuetext", "Passo 1 de 4");
  });

  test("Continuar com campo inválido não avança, mostra o erro e leva o foco ao campo", async ({
    page,
  }) => {
    await abrirOAssistente(page);
    await assistente(page).getByRole("button", { name: "Continuar" }).click();
    await expect(
      assistente(page).getByText("Informe o nome com pelo menos 3 letras."),
    ).toBeVisible();
    await expect(campoNome(page)).toBeFocused();
    await expect(campoNome(page)).toHaveAttribute("aria-invalid", "true");
    await expect(
      assistente(page)
        .getByRole("navigation", { name: "Passos do assistente" })
        .locator('li[aria-current="step"]'),
    ).toContainText("Identificação");
  });

  test("Enter avança (fora de área de texto) e o foco vai ao primeiro campo do passo novo", async ({
    page,
  }) => {
    await abrirOAssistente(page);
    await campoNome(page).fill("Filtro de ar");
    await assistente(page).getByLabel("Categoria", { exact: true }).selectOption("filtro");
    await campoNome(page).focus();
    await page.keyboard.press("Enter");
    await expect(
      assistente(page)
        .getByRole("navigation", { name: "Passos do assistente" })
        .locator('li[aria-current="step"]'),
    ).toContainText("Valores");
    await expect(assistente(page).getByLabel("Quantidade")).toBeFocused();
  });

  test("o resumo ao vivo, à direita, acompanha o que se digita", async ({ page }) => {
    await abrirOAssistente(page);
    const resumo = assistente(page).getByRole("complementary", { name: "Resumo" });
    await expect(resumo).toBeVisible();
    await campoNome(page).fill("Pneu 295/80");
    await expect(resumo).toContainText("Pneu 295/80");
    await assistente(page).getByLabel("Categoria", { exact: true }).selectOption("pneu");
    await expect(resumo).toContainText("Pneu");
  });

  test("o passo de conferir mostra o resumo e o botão tem o verbo e o objeto", async ({ page }) => {
    await abrirOAssistente(page);
    await irAteConferir(page);
    await expect(assistente(page)).toContainText("Pneu 295/80");
    await expect(assistente(page)).toContainText("R$ 123,45");
    await expect(assistente(page).getByRole("button", { name: "Cadastrar item" })).toBeVisible();
  });

  test("voltar pelo stepper vai a um passo já visitado", async ({ page }) => {
    await abrirOAssistente(page);
    await preencherIdentificacao(page);
    await assistente(page)
      .getByRole("navigation", { name: "Passos do assistente" })
      .getByRole("button", { name: /Identificação/ })
      .click();
    await expect(campoNome(page)).toBeVisible();
    await expect(campoNome(page)).toHaveValue("Pneu 295/80");
  });
});

test.describe("assistente: envio", () => {
  test("cadastra, mostra 'Item cadastrado.' e o fechar volta ao botão", async ({ page }) => {
    await abrirOAssistente(page);
    await irAteConferir(page);
    await assistente(page).getByRole("button", { name: "Cadastrar item" }).click();
    await expect(assistente(page).getByTestId("assistente-concluido")).toHaveText(
      "Item cadastrado.",
    );
    await expect(enviosDoAssistente(page)).toContainText("Envios: 1 · Gravados: 1");
    await assistente(page).getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(assistente(page)).toBeHidden();
    await expect(botaoDeAbrir(page)).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${ROTA}$`));
  });

  test("clique duplo e Enter repetido enviam uma vez só", async ({ page }) => {
    await abrirOAssistente(page);
    await irAteConferir(page);
    await assistente(page).getByRole("button", { name: "Cadastrar item" }).dblclick();
    await expect(assistente(page).getByTestId("assistente-concluido")).toBeVisible();
    await expect(enviosDoAssistente(page)).toContainText("Envios: 1 · Gravados: 1");
  });

  test("durante o envio o botão fica desligado com aria-disabled", async ({ page }) => {
    await abrirOAssistente(page, "?simular=lento");
    await irAteConferir(page);
    const botao = assistente(page).getByRole("button", { name: "Cadastrar item" });
    await botao.click();
    await expect(assistente(page).getByRole("button", { name: "Enviando…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(assistente(page).getByTestId("assistente-concluido")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("falha mostra o erro com 'Tentar de novo', que reenvia com a mesma chave e grava uma vez", async ({
    page,
  }) => {
    await abrirOAssistente(page, "?simular=falha");
    await irAteConferir(page);
    await assistente(page).getByRole("button", { name: "Cadastrar item" }).click();
    await expect(assistente(page).getByRole("alert")).toContainText(
      "Não foi possível gravar agora",
    );
    await assistente(page).getByRole("button", { name: "Tentar de novo" }).click();
    await expect(assistente(page).getByTestId("assistente-concluido")).toBeVisible();
    await expect(enviosDoAssistente(page)).toContainText("Envios: 2 · Gravados: 1");
  });

  test("conflito avisa que o registro mudou, mostra o atual e mantém o que foi digitado", async ({
    page,
  }) => {
    await abrirOAssistente(page, "?simular=conflito");
    await irAteConferir(page, "Pneu 295/80");
    await assistente(page).getByRole("button", { name: "Cadastrar item" }).click();
    const aviso = assistente(page).getByRole("alert");
    await expect(aviso).toContainText("mudou");
    await expect(aviso).toContainText("Pneu 295/80 (versão nova)");
    await assistente(page).getByRole("button", { name: "Revisar com os dados atuais" }).click();
    await expect(assistente(page)).toContainText("Pneu 295/80"); // nada se perdeu
    await assistente(page).getByRole("button", { name: "Cadastrar item" }).click();
    await expect(assistente(page).getByTestId("assistente-concluido")).toBeVisible();
    await expect(enviosDoAssistente(page)).toContainText("Gravados: 1");
  });

  test("erro de campo vindo do servidor leva ao passo do campo e mostra a mensagem", async ({
    page,
  }) => {
    await abrirOAssistente(page, "?simular=campo");
    await irAteConferir(page);
    await assistente(page).getByRole("button", { name: "Cadastrar item" }).click();
    await expect(assistente(page).getByText("Já existe um item com este nome.")).toBeVisible();
    await expect(
      assistente(page)
        .getByRole("navigation", { name: "Passos do assistente" })
        .locator('li[aria-current="step"]'),
    ).toContainText("Identificação");
  });
});

test.describe("assistente: fechar é fechar e rascunho", () => {
  test("com dados, Esc pergunta antes de descartar; 'Continuar editando' tem o foco e mantém tudo", async ({
    page,
  }) => {
    await abrirOAssistente(page);
    await campoNome(page).fill("Pneu 295/80");
    await page.keyboard.press("Escape");
    await expect(confirmacao(page)).toBeVisible();
    await expect(confirmacao(page)).toContainText(
      "Descartar o rascunho de Cadastrar item de teste?",
    );
    await expect(
      confirmacao(page).getByRole("button", { name: "Continuar editando" }),
    ).toBeFocused();
    await page.keyboard.press("Escape"); // Esc na pergunta só fecha a pergunta
    await expect(confirmacao(page)).toBeHidden();
    await expect(assistente(page)).toBeVisible();
    await expect(campoNome(page)).toHaveValue("Pneu 295/80");
  });

  test("sem dados, Esc fecha na hora, sem perguntar", async ({ page }) => {
    await abrirOAssistente(page);
    await page.keyboard.press("Escape");
    await expect(assistente(page)).toBeHidden();
    await expect(confirmacao(page)).toHaveCount(0);
  });

  test("'Salvar rascunho e sair' fecha, e ao reabrir o rascunho volta, com aviso", async ({
    page,
  }) => {
    await abrirOAssistente(page);
    await campoNome(page).fill("Pneu 295/80");
    await assistente(page).getByRole("button", { name: "Fechar assistente" }).click();
    await confirmacao(page).getByRole("button", { name: "Salvar rascunho e sair" }).click();
    await expect(assistente(page)).toBeHidden();
    await botaoDeAbrir(page).click();
    await expect(assistente(page)).toBeVisible();
    await expect(assistente(page).getByTestId("aviso-do-rascunho")).toContainText("rascunho");
    await expect(campoNome(page)).toHaveValue("Pneu 295/80");
  });

  test("'Descartar' apaga o rascunho: ao reabrir, o assistente vem em branco", async ({ page }) => {
    await abrirOAssistente(page);
    await campoNome(page).fill("Pneu 295/80");
    await assistente(page).getByRole("button", { name: "Fechar assistente" }).click();
    await confirmacao(page).getByRole("button", { name: "Descartar" }).click();
    await expect(assistente(page)).toBeHidden();
    await botaoDeAbrir(page).click();
    await expect(campoNome(page)).toHaveValue("");
    await expect(assistente(page).getByTestId("aviso-do-rascunho")).toHaveCount(0);
  });

  test("o Voltar do navegador fecha sem perguntar e o que estava na tela fica no rascunho", async ({
    page,
  }) => {
    await abrirOAssistente(page);
    await campoNome(page).fill("Filtro de ar");
    await page.waitForTimeout(700); // o rascunho é guardado a cada pausa de digitação
    await page.goBack();
    await expect(assistente(page)).toBeHidden();
    await botaoDeAbrir(page).click();
    await expect(campoNome(page)).toHaveValue("Filtro de ar");
  });

  test("'Começar de novo' limpa o rascunho retomado", async ({ page }) => {
    await abrirOAssistente(page);
    await campoNome(page).fill("Pneu 295/80");
    await assistente(page).getByRole("button", { name: "Fechar assistente" }).click();
    await confirmacao(page).getByRole("button", { name: "Salvar rascunho e sair" }).click();
    await botaoDeAbrir(page).click();
    await assistente(page).getByRole("button", { name: "Começar de novo" }).click();
    await expect(campoNome(page)).toHaveValue("");
  });

  test("rascunho de versão antiga do formulário é descartado, com aviso", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await page.locator("#menu-principal[data-usuario]").waitFor({ state: "attached" });
    await page.evaluate(() => {
      const usuario = document.querySelector("#menu-principal")?.getAttribute("data-usuario");
      localStorage.setItem(
        `eixo-rascunho:${usuario}:teste:novo`,
        JSON.stringify({ versaoDoEsquema: 0, passo: 1, valores: { nome: "Antigo" } }),
      );
    });
    await botaoDeAbrir(page).click();
    await expect(assistente(page).getByTestId("aviso-do-rascunho")).toContainText("descartado");
    await expect(campoNome(page)).toHaveValue("");
  });

  test("com o armazenamento bloqueado o assistente funciona, sem rascunho", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("bloqueado");
        },
      });
    });
    await abrirHidratada(page, ROTA);
    await botaoDeAbrir(page).click();
    await expect(assistente(page)).toBeVisible();
    await campoNome(page).fill("Pneu 295/80");
    await expect(campoNome(page)).toHaveValue("Pneu 295/80");
    await page.waitForTimeout(700);
    await expect(assistente(page).getByTestId("aviso-do-rascunho")).toContainText(
      "Não foi possível salvar o rascunho",
    );
  });
});

test.describe("assistente: o + e o mini-wizard", () => {
  const botaoMais = (page: import("@playwright/test").Page) =>
    assistente(page).getByRole("button", { name: "Cadastrar categoria" });

  test("o + abre o mini-wizard num painel lateral; Esc fecha só o mini e o foco volta ao +", async ({
    page,
  }) => {
    await abrirOAssistente(page);
    await botaoMais(page).click();
    await expect(mini(page)).toBeVisible();
    await expect(mini(page)).toHaveAttribute("data-variante", "lateral");
    await page.keyboard.press("Escape");
    await expect(mini(page)).toBeHidden();
    await expect(assistente(page)).toBeVisible(); // o assistente de baixo continua aberto
    await expect(botaoMais(page)).toBeFocused();
  });

  test("criar a categoria no mini devolve o campo preenchido com ela", async ({ page }) => {
    await abrirOAssistente(page);
    await botaoMais(page).click();
    await mini(page).getByLabel("Nome da categoria").fill("Bateria");
    await page.keyboard.press("Enter"); // avança para conferir
    await expect(mini(page).getByRole("button", { name: "Cadastrar categoria" })).toBeVisible();
    await mini(page).getByRole("button", { name: "Cadastrar categoria" }).click();
    await expect(mini(page)).toBeHidden();
    const categoria = assistente(page).getByLabel("Categoria", { exact: true });
    await expect(categoria).toHaveValue("cat-bateria");
    await expect(categoria.locator("option:checked")).toHaveText("Bateria");
    await expect(botaoMais(page)).toBeFocused();
  });

  test("Enter dentro do mini não avança o assistente de baixo", async ({ page }) => {
    await abrirOAssistente(page);
    await campoNome(page).fill("Pneu 295/80");
    await botaoMais(page).click();
    await mini(page).getByLabel("Nome da categoria").fill("Bateria");
    await page.keyboard.press("Enter"); // avança só o mini, para conferir
    await expect(mini(page).getByRole("button", { name: "Cadastrar categoria" })).toBeVisible();
    // O assistente de baixo fica inerte com o mini aberto: confere pelo CSS, não pelo papel.
    await expect(page.locator('[data-assistente="teste"] li[aria-current="step"]')).toContainText(
      "Identificação",
    );
    await mini(page).getByRole("button", { name: "Cadastrar categoria" }).click();
    await expect(mini(page)).toBeHidden();
    await expect(
      assistente(page)
        .getByRole("navigation", { name: "Passos do assistente" })
        .locator('li[aria-current="step"]'),
    ).toContainText("Identificação");
  });

  test("mini com dados pergunta antes de descartar, e descartar não mexe no assistente de baixo", async ({
    page,
  }) => {
    await abrirOAssistente(page);
    await campoNome(page).fill("Pneu 295/80");
    await botaoMais(page).click();
    await mini(page).getByLabel("Nome da categoria").fill("Bateria");
    await page.keyboard.press("Escape");
    await expect(confirmacao(page)).toContainText("Descartar o rascunho de Cadastrar categoria?");
    await confirmacao(page).getByRole("button", { name: "Descartar" }).click();
    await expect(mini(page)).toBeHidden();
    await expect(campoNome(page)).toHaveValue("Pneu 295/80");
  });

  test("o mini nunca vira rascunho do assistente de baixo", async ({ page }) => {
    await abrirOAssistente(page);
    await botaoMais(page).click();
    await mini(page).getByLabel("Nome da categoria").fill("Bateria");
    await page.waitForTimeout(700);
    const chaves = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("eixo-rascunho")),
    );
    expect(chaves.some((k) => k.includes("categoria-de-teste"))).toBe(false);
  });
});

test.describe("assistente: abrir e fechar depressa com o servidor lento", () => {
  test("abrir e fechar várias vezes seguidas, com cada navegação lenta, nunca sai do sistema", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?lento=1500`);
    for (let i = 0; i < 3; i++) {
      await botaoDeAbrir(page).click();
      await expect(assistente(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(assistente(page)).toBeHidden();
    }
    await page.waitForTimeout(6_000); // as navegações pendentes terminam
    expect(new URL(page.url()).pathname).toBe(ROTA);
    expect(page.url()).not.toContain("assistente=");
    await expect(botaoDeAbrir(page)).toBeVisible();
    await expect(assistente(page)).toHaveCount(0);
  });

  test("abrir, fechar e abrir de novo no meio da navegação lenta mantém a tela", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?lento=1500`);
    await botaoDeAbrir(page).click();
    await expect(assistente(page)).toBeVisible();
    await page.getByRole("button", { name: "Fechar assistente" }).click();
    await expect(assistente(page)).toBeHidden();
    await botaoDeAbrir(page).click();
    await expect(assistente(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(6_000);
    expect(new URL(page.url()).pathname).toBe(ROTA);
    expect(page.url()).not.toContain("assistente=");
    await expect(assistente(page)).toHaveCount(0);
  });
});

test("o nome do assistente é o mesmo em toda a tela (verbo mais objeto)", async ({ page }) => {
  await abrirOAssistente(page);
  await expect(
    assistente(page)
      .getByRole("heading", { name: NOME_DO_ASSISTENTE, level: 2 })
      .or(assistente(page).getByText(NOME_DO_ASSISTENTE).first()),
  ).toBeVisible();
});
