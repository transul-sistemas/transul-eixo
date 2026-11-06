import { expect, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import {
  abrirOCadastro,
  buscarNaLista,
  cadastro,
  dialogo,
  FICHA,
  irAteConferirOCadastro,
  LISTA,
  passoAtual,
  passoIdentificacao,
  passoPosse,
  passoSituacao,
  passoValor,
  passoVeiculo,
  placaUnica,
  sessaoIsolada,
} from "./apoio-assistentes-frota";

// Cadastrar placa (seis passos, com o "+" para marca, modelo, gestor, operação e CR; operação e CR
// obrigatórios; sem filial nem garagem, que vem do CR), no 1366 e no 1920. Cada teste usa um armazém de exemplo só dele (cookie de sessão).

test.beforeEach(async ({ context, baseURL }) => {
  await sessaoIsolada(context, baseURL);
});

test.describe("cadastrar placa: abrir e fechar", () => {
  test("o botão Cadastrar placa da lista abre o assistente pela URL e o Esc fecha", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    await expect(page).toHaveURL(/assistente=cadastrar-placa/);
    await page.keyboard.press("Escape");
    await expect(cadastro(page)).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${LISTA}$`));
    await expect(page.getByRole("button", { name: "Cadastrar placa", exact: true })).toBeFocused();
  });

  test("o Ctrl+K leva ao assistente de cadastrar a partir de outra tela", async ({ page }) => {
    await abrirHidratada(page, "/inicio/tarefas");
    await page.keyboard.press("Control+k");
    const busca = page.getByRole("combobox", { name: /Buscar tela, modo ou ação/ });
    await busca.fill("cadastrar placa");
    await page.getByRole("option", { name: /Frota › Cadastrar placa/ }).click();
    await expect(cadastro(page)).toBeVisible();
    await expect(page).toHaveURL(/\/frota\/placas\?.*assistente=cadastrar-placa/);
  });

  test("os seis passos aparecem no stepper, na ordem", async ({ page }) => {
    await abrirOCadastro(page);
    const itens = cadastro(page)
      .getByRole("navigation", { name: "Passos do assistente" })
      .getByRole("listitem");
    await expect(itens).toHaveText([
      /Identificação/,
      /Veículo/,
      /Valor/,
      /Posse/,
      /Situação inicial/,
      /Conferir/,
    ]);
  });
});

test.describe("cadastrar placa: o fluxo", () => {
  test("cadastra um cavalo pelos seis passos e a placa aparece na lista e na ficha, sem recarregar", async ({
    page,
  }) => {
    const placa = placaUnica();
    await abrirOCadastro(page);
    await page.evaluate(() => ((window as unknown as { __mesmaPagina: number }).__mesmaPagina = 1));
    await irAteConferirOCadastro(page, { placa, operacao: "Operação Exemplo 1" });
    await expect(cadastro(page)).toContainText(placa);
    await expect(cadastro(page)).toContainText("R$ 78.500,00");
    await cadastro(page).getByRole("button", { name: "Cadastrar placa" }).click();
    await expect(cadastro(page).getByTestId("assistente-concluido")).toHaveText(
      "Placa cadastrada.",
    );
    await cadastro(page).getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(cadastro(page)).toBeHidden();

    const linha = await buscarNaLista(page, placa);
    await expect(linha).toHaveCount(1);
    await expect(page.getByTestId("resumo-da-pagina")).toContainText("Mostrando 1–1 de 1");
    expect(
      await page.evaluate(() => (window as unknown as { __mesmaPagina?: number }).__mesmaPagina),
    ).toBe(1); // a página não foi recarregada

    await page.getByRole("link", { name: `Abrir ficha de ${placa}`, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: placa })).toBeVisible();
    await expect(page.getByText("PÁT").first()).toBeVisible();
  });

  test("clique duplo em Cadastrar placa grava uma placa só", async ({ page }) => {
    const placa = placaUnica();
    await abrirOCadastro(page);
    await irAteConferirOCadastro(page, { placa });
    await cadastro(page).getByRole("button", { name: "Cadastrar placa" }).dblclick();
    await expect(cadastro(page).getByTestId("assistente-concluido")).toBeVisible();
    await cadastro(page).getByRole("button", { name: "Fechar", exact: true }).click();
    await buscarNaLista(page, placa);
    await expect(page.getByTestId("resumo-da-pagina")).toContainText("de 1");
  });

  test("cada passo valida os seus campos antes de avançar, e o foco vai ao primeiro erro", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    await cadastro(page).getByRole("button", { name: "Continuar" }).click();
    await expect(cadastro(page).getByText("Placa inválida.", { exact: false })).toBeVisible();
    await expect(cadastro(page).getByText("RENAVAM inválido.", { exact: false })).toBeVisible();
    await expect(cadastro(page).getByText("Escolha o tipo de ativo.")).toBeVisible();
    await expect(cadastro(page).getByLabel("Placa", { exact: true })).toBeFocused();
    await expect(passoAtual(cadastro(page))).toContainText("Identificação");
  });

  test("placa que já existe é acusada, com o link para a ficha dela", async ({ page }) => {
    await abrirOCadastro(page);
    await irAteConferirOCadastro(page, { placa: "AAA0A00" });
    await cadastro(page).getByRole("button", { name: "Cadastrar placa" }).click();
    const alerta = cadastro(page).getByRole("alert");
    await expect(alerta).toContainText("já está cadastrada");
    await expect(alerta.getByRole("link", { name: "Abrir a ficha de AAA0A00" })).toHaveAttribute(
      "href",
      FICHA("AAA0A00"),
    );
    await expect(cadastro(page).getByRole("button", { name: "Tentar de novo" })).toHaveCount(0);
  });

  test("a situação inicial começa em PÁT e não oferece baixa nem situação de operação", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica() });
    await passoVeiculo(page, {});
    await passoValor(page);
    await passoPosse(page, {});
    const situacao = cadastro(page).getByLabel("Situação inicial");
    await expect(situacao).toHaveValue("PÁT");
    const textos = await situacao.locator("option").allTextContents();
    expect(textos.join("|")).not.toMatch(/Vendido|Sucata|Disponível no Operacional|Em trânsito/);
    expect(textos.join("|")).toMatch(/Em manutenção/);
  });
});

test.describe("cadastrar placa: valor por tipo", () => {
  test("implemento pede valor manual, fonte e data do valor, e não o código FIPE", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica(), tipo: "Implemento" });
    await passoVeiculo(page, { tipo: "Implemento", marca: "Randon", modelo: "Sider 3 eixos" });
    const c = cadastro(page);
    await expect(c.getByLabel("Valor", { exact: true })).toBeVisible();
    await expect(c.getByLabel("Fonte do valor")).toBeVisible();
    await expect(c.getByLabel("Data do valor")).toBeVisible();
    await expect(c.getByLabel("Código FIPE")).toHaveCount(0);
  });

  test("cavalo pede código FIPE e valor FIPE", async ({ page }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica() });
    await passoVeiculo(page, {});
    const c = cadastro(page);
    await expect(c.getByLabel("Código FIPE")).toBeVisible();
    await expect(c.getByLabel("Valor FIPE")).toBeVisible();
    await expect(c.getByLabel("Fonte do valor")).toHaveCount(0);
  });

  test("a data do valor no futuro é recusada", async ({ page }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica(), tipo: "Implemento" });
    await passoVeiculo(page, { tipo: "Implemento", marca: "Randon", modelo: "Sider 3 eixos" });
    const c = cadastro(page);
    await c.getByLabel("Valor", { exact: true }).click();
    await page.keyboard.type("2500000");
    await c.getByLabel("Fonte do valor").fill("Nota fiscal");
    await c.getByLabel("Data do valor").fill("2099-01-01");
    await c.getByRole("button", { name: "Continuar" }).click();
    await expect(c.getByText("A data do valor não pode ser no futuro.")).toBeVisible();
  });

  test("trocar o tipo troca os campos de valor sem perder o que foi digitado nos outros passos", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    const placa = placaUnica();
    await passoIdentificacao(page, { placa });
    await passoVeiculo(page, {});
    const c = cadastro(page);
    await c.getByRole("button", { name: "Voltar" }).click(); // para o veículo
    await c.getByRole("button", { name: "Voltar" }).click(); // para a identificação
    await c.getByLabel("Tipo de ativo").selectOption({ label: "Apoio" });
    await expect(c.getByLabel("Placa", { exact: true })).toHaveValue(placa);
    await c.getByRole("button", { name: "Continuar" }).click();
    await expect(c.getByLabel("Marca", { exact: true }).locator("option:checked")).toHaveText(
      "Volvo",
    );
    await c.getByRole("button", { name: "Continuar" }).click();
    await c.getByRole("button", { name: "Continuar" }).click(); // o valor está vazio: fica no passo
    await expect(c.getByLabel("Fonte do valor")).toBeVisible();
    await expect(c.getByLabel("Código FIPE")).toHaveCount(0);
  });
});

test.describe("cadastrar placa: dependências entre campos", () => {
  test("o modelo é da marca escolhida; mudar a marca limpa o modelo", async ({ page }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica() });
    const c = cadastro(page);
    const modelo = c.getByLabel("Modelo", { exact: true });
    await c.getByLabel("Marca", { exact: true }).selectOption({ label: "Volvo" });
    await expect(modelo.locator("option")).toHaveText(["Escolha…", "FH 540"]);
    await modelo.selectOption({ label: "FH 540" });
    await c.getByLabel("Marca", { exact: true }).selectOption({ label: "Scania" });
    await expect(modelo).toHaveValue("");
    await expect(modelo.locator("option")).toHaveText(["Escolha…", "R 450"]);
  });

  test("o CR é da operação escolhida; sem operação o + do CR está desligado", async ({ page }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica() });
    await passoVeiculo(page, {});
    await passoValor(page);
    const c = cadastro(page);
    await expect(c.getByRole("button", { name: "Cadastrar CR" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await c.getByLabel("Operação", { exact: true }).selectOption({ label: "Operação Exemplo 2" });
    await expect(c.getByLabel("CR", { exact: true }).locator("option")).toHaveText([
      "Escolha…",
      "CR-1002",
    ]);
    await expect(c.getByRole("button", { name: "Cadastrar CR" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("operação e CR são obrigatórios: sem eles o cadastro não avança", async ({ page }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica() });
    await passoVeiculo(page, {});
    await passoValor(page);
    const c = cadastro(page);
    await c.getByLabel("Gestor de frota").selectOption({ label: "Gestor Exemplo 1" });
    await c.getByRole("button", { name: "Continuar" }).click();
    await expect(c.getByText("Escolha a operação.")).toBeVisible();
    await expect(c.getByText("Escolha o CR.")).toBeVisible();
    await expect(passoAtual(c)).toContainText("Posse");
  });

  test("implemento pede função, carroceria e eixos; o dolly não tem carroceria", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica(), tipo: "Implemento" });
    const c = cadastro(page);
    await c.getByLabel("Marca", { exact: true }).selectOption({ label: "Randon" });
    await c.getByLabel("Modelo", { exact: true }).selectOption({ label: "Sider 3 eixos" });
    await c.getByLabel("Função", { exact: true }).selectOption({ label: "Semirreboque" });
    await expect(c.getByLabel("Carroceria", { exact: true })).toBeVisible();
    await expect(c.getByLabel("Eixos", { exact: true })).toBeVisible();
    await c.getByLabel("Função", { exact: true }).selectOption({ label: "Dolly" });
    await expect(c.getByLabel("Carroceria", { exact: true })).toHaveCount(0);
    await expect(c.getByText("O dolly não tem carroceria e tem sempre 2 eixos.")).toBeVisible();
  });
});

test.describe("cadastrar placa: o + cria o que falta, na hora", () => {
  test("marca e depois modelo: o + do modelo só liga depois da marca, e ambos voltam escolhidos", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica() });
    const c = cadastro(page);
    await expect(c.getByRole("button", { name: "Cadastrar modelo" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await c.getByRole("button", { name: "Cadastrar marca" }).click();
    const marca = dialogo(page, "Cadastrar marca");
    await expect(marca).toBeVisible();
    await marca.getByLabel("Nome da marca").fill("DAF");
    await page.keyboard.press("Enter");
    await marca.getByRole("button", { name: "Cadastrar marca" }).click();
    await expect(marca).toBeHidden();
    await expect(c.getByLabel("Marca", { exact: true }).locator("option:checked")).toHaveText(
      "DAF",
    );
    await expect(c.getByRole("button", { name: "Cadastrar marca" })).toBeFocused();

    await c.getByRole("button", { name: "Cadastrar modelo" }).click();
    const modelo = dialogo(page, "Cadastrar modelo");
    await modelo.getByLabel("Nome do modelo").fill("XF 530");
    await page.keyboard.press("Enter");
    await modelo.getByRole("button", { name: "Cadastrar modelo" }).click();
    await expect(c.getByLabel("Modelo", { exact: true }).locator("option:checked")).toHaveText(
      "XF 530",
    );
  });

  test("a marca e o modelo criados valem no cadastro: a placa nasce com eles", async ({ page }) => {
    const placa = placaUnica();
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa });
    const c = cadastro(page);
    await c.getByRole("button", { name: "Cadastrar marca" }).click();
    await dialogo(page, "Cadastrar marca").getByLabel("Nome da marca").fill("DAF");
    await page.keyboard.press("Enter");
    await dialogo(page, "Cadastrar marca").getByRole("button", { name: "Cadastrar marca" }).click();
    await c.getByRole("button", { name: "Cadastrar modelo" }).click();
    await dialogo(page, "Cadastrar modelo").getByLabel("Nome do modelo").fill("XF 530");
    await page.keyboard.press("Enter");
    await dialogo(page, "Cadastrar modelo")
      .getByRole("button", { name: "Cadastrar modelo" })
      .click();
    await c.getByRole("button", { name: "Continuar" }).click();
    await passoValor(page);
    await passoPosse(page, {});
    await passoSituacao(page);
    await c.getByRole("button", { name: "Cadastrar placa" }).click();
    await expect(c.getByTestId("assistente-concluido")).toBeVisible();
    await c.getByRole("button", { name: "Fechar", exact: true }).click();
    await buscarNaLista(page, placa);
    await expect(page.locator(`tr:has([data-espiar-placa="${placa}"])`)).toContainText("XF 530");
  });

  test("gestor, operação e CR (com o CODCENCUS) também se criam pelo +", async ({ page }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica() });
    await passoVeiculo(page, {});
    await passoValor(page);
    const c = cadastro(page);
    await c.getByRole("button", { name: "Cadastrar gestor" }).click();
    await dialogo(page, "Cadastrar gestor").getByLabel("Nome do gestor").fill("Gestor Novo");
    await page.keyboard.press("Enter");
    await dialogo(page, "Cadastrar gestor")
      .getByRole("button", { name: "Cadastrar gestor" })
      .click();
    await expect(c.getByLabel("Gestor de frota").locator("option:checked")).toHaveText(
      "Gestor Novo",
    );

    await c.getByRole("button", { name: "Cadastrar operação" }).click();
    await dialogo(page, "Cadastrar operação").getByLabel("Nome da operação").fill("Operação Nova");
    await page.keyboard.press("Enter");
    await dialogo(page, "Cadastrar operação")
      .getByRole("button", { name: "Cadastrar operação" })
      .click();
    await expect(c.getByLabel("Operação", { exact: true }).locator("option:checked")).toHaveText(
      "Operação Nova",
    );

    await c.getByRole("button", { name: "Cadastrar CR" }).click();
    await dialogo(page, "Cadastrar CR").getByLabel("Código do CR").fill("CR-2001");
    await dialogo(page, "Cadastrar CR").getByLabel("Código do Sankhya (CODCENCUS)").fill("2010101");
    await page.keyboard.press("Enter");
    await dialogo(page, "Cadastrar CR").getByRole("button", { name: "Cadastrar CR" }).click();
    await expect(c.getByLabel("CR", { exact: true }).locator("option:checked")).toHaveText(
      "CR-2001",
    );
  });

  test("nome repetido no + mostra o erro no campo, sem fechar o mini-wizard", async ({ page }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica() });
    await cadastro(page).getByRole("button", { name: "Cadastrar marca" }).click();
    const marca = dialogo(page, "Cadastrar marca");
    await marca.getByLabel("Nome da marca").fill("Volvo");
    await page.keyboard.press("Enter");
    await marca.getByRole("button", { name: "Cadastrar marca" }).click();
    await expect(marca.getByText("Já existe um cadastro com este nome.")).toBeVisible();
    await expect(marca).toBeVisible();
  });

  test("Esc no mini fecha só o mini; o assistente do cadastro continua com o que foi digitado", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    const placa = placaUnica();
    await cadastro(page).getByLabel("Placa", { exact: true }).fill(placa);
    await cadastro(page).getByLabel("RENAVAM").fill("00639884962");
    await cadastro(page).getByLabel("Tipo de ativo").selectOption({ label: "Cavalo" });
    await cadastro(page).getByLabel("Ano").fill("2022");
    await cadastro(page).getByRole("button", { name: "Continuar" }).click();
    await cadastro(page).getByRole("button", { name: "Cadastrar marca" }).click();
    await page.keyboard.press("Escape");
    await expect(dialogo(page, "Cadastrar marca")).toBeHidden();
    await expect(cadastro(page)).toBeVisible();
    await cadastro(page).getByRole("button", { name: "Voltar" }).click();
    await expect(cadastro(page).getByLabel("Placa", { exact: true })).toHaveValue(placa);
  });
});

test.describe("cadastrar placa: fechar é fechar", () => {
  test("com dados, Esc pergunta; Salvar rascunho e sair guarda, e o rascunho volta", async ({
    page,
  }) => {
    const placa = placaUnica();
    await abrirOCadastro(page);
    await cadastro(page).getByLabel("Placa", { exact: true }).fill(placa);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toContainText(
      "Descartar o rascunho de Cadastrar placa?",
    );
    await page.getByRole("button", { name: "Salvar rascunho e sair" }).click();
    await expect(cadastro(page)).toBeHidden();
    await page.getByRole("button", { name: "Cadastrar placa", exact: true }).click();
    await expect(cadastro(page).getByLabel("Placa", { exact: true })).toHaveValue(placa);
    await expect(cadastro(page).getByTestId("aviso-do-rascunho")).toBeVisible();
  });

  test("o RENAVAM não vai para o rascunho (dado sensível)", async ({ page }) => {
    await abrirOCadastro(page);
    await cadastro(page).getByLabel("RENAVAM").fill("00639884962");
    await cadastro(page).getByLabel("Placa", { exact: true }).fill(placaUnica());
    await page.waitForTimeout(700);
    const guardado = await page.evaluate(() =>
      Object.entries(localStorage)
        .filter(([k]) => k.startsWith("eixo-rascunho"))
        .map(([, v]) => v)
        .join(""),
    );
    expect(guardado).not.toContain("00639884962");
    expect(guardado).toContain("ZZ");
  });
});
