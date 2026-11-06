import { expect, test } from "@playwright/test";
import { abrirHidratada } from "./apoio";
import {
  abrirOCadastro,
  cadastro,
  FICHA,
  irAteConferirOCadastro,
  passoIdentificacao,
  passoVeiculo,
  placaUnica,
  sessaoIsolada,
} from "./apoio-assistentes-frota";

// O visual refinado dos assistentes da Frota (prévia: terceira tela): painel centralizado de 1024 px
// em diante, coluna de leitura, resumo de 300 px, campos em duas colunas, "+" tracejado, rodapé com
// rascunho salvo, Conferir em duas colunas e o seletor de implementos. No 1366 e no 1920.

test.beforeEach(async ({ context, baseURL }) => {
  await sessaoIsolada(context, baseURL);
});

const caixa = async (l: import("@playwright/test").Locator) => (await l.boundingBox())!;

test.describe("painel centralizado", () => {
  test("largura máxima de 1040 px, centralizado, até 90% da altura, cantos arredondados", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    const c = cadastro(page);
    const tela = page.viewportSize()!;
    const b = await caixa(c);
    expect(b.width).toBeLessThanOrEqual(1041);
    expect(b.width).toBeGreaterThan(900);
    expect(Math.abs(b.x + b.width / 2 - tela.width / 2)).toBeLessThanOrEqual(2);
    expect(b.height).toBeLessThanOrEqual(tela.height * 0.9 + 1);
    expect(b.x).toBeGreaterThanOrEqual(24);
    expect(
      await c.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius)),
    ).toBeGreaterThanOrEqual(12);
  });

  test("o fundo ao redor fica escurecido", async ({ page }) => {
    await abrirOCadastro(page);
    const fundo = await page.evaluate(() => {
      const el = document.elementFromPoint(4, 4) as HTMLElement | null;
      return {
        tag: el?.tagName ?? "",
        cor: el ? getComputedStyle(el).backgroundColor : "",
      };
    });
    // O que está sob o canto da tela é a cortina, não a página: tem cor própria, com transparência.
    expect(["HTML", "BODY", "MAIN"]).not.toContain(fundo.tag);
    expect(["", "transparent", "rgba(0, 0, 0, 0)"]).not.toContain(fundo.cor);
  });
});

test.describe("coluna de leitura e resumo ao vivo", () => {
  test("o formulário fica numa coluna de até 620 px, centrada ao lado do resumo de 300 px", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    const c = cadastro(page);
    const coluna = await caixa(c.getByTestId("coluna-de-leitura"));
    const resumo = await caixa(c.getByRole("complementary", { name: "Resumo" }));
    expect(coluna.width).toBeLessThanOrEqual(621);
    expect(Math.round(resumo.width)).toBe(300);
    const painel = await caixa(c);
    const centroDaArea = (painel.x + resumo.x) / 2;
    expect(Math.abs(coluna.x + coluna.width / 2 - centroDaArea)).toBeLessThanOrEqual(24);
  });

  test("no passo Conferir o resumo lateral some e entram Dados e O que vai acontecer, lado a lado", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    await irAteConferirOCadastro(page, { placa: placaUnica(), operacao: "Operação Exemplo 1" });
    const c = cadastro(page);
    await expect(c.getByRole("complementary", { name: "Resumo" })).toHaveCount(0);
    const dados = await caixa(c.getByRole("region", { name: "Dados" }));
    const efeitos = await caixa(c.getByRole("region", { name: "O que vai acontecer" }));
    expect(Math.abs(dados.y - efeitos.y)).toBeLessThanOrEqual(2);
    expect(efeitos.x).toBeGreaterThan(dados.x + dados.width - 2);
    const texto = await c.getByRole("region", { name: "O que vai acontecer" }).innerText();
    expect(texto).toMatch(/PÁT/);
    expect(texto).toMatch(/Gestor Exemplo 1/);
    expect(texto).toMatch(/Operação Exemplo 1/);
    expect(texto).toMatch(/CR-1001/);
    expect(texto).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/); // o evento, com data e hora
    expect(texto).toMatch(/conjunto/i);
  });
});

test.describe("campos em duas colunas e o +", () => {
  test("placa e RENAVAM, tipo e ano na mesma linha; marca e modelo também", async ({ page }) => {
    await abrirOCadastro(page);
    const c = cadastro(page);
    const placa = await caixa(c.getByLabel("Placa", { exact: true }));
    const renavam = await caixa(c.getByLabel("RENAVAM"));
    expect(Math.abs(placa.y - renavam.y)).toBeLessThanOrEqual(2);
    expect(renavam.x).toBeGreaterThan(placa.x + placa.width - 2);
    const tipo = await caixa(c.getByLabel("Tipo de ativo"));
    const ano = await caixa(c.getByLabel("Ano"));
    expect(Math.abs(tipo.y - ano.y)).toBeLessThanOrEqual(2);
    await passoIdentificacao(page, { placa: placaUnica() });
    const marca = await caixa(c.getByLabel("Marca", { exact: true }));
    const modelo = await caixa(c.getByLabel("Modelo", { exact: true }));
    expect(Math.abs(marca.y - modelo.y)).toBeLessThanOrEqual(2);
  });

  test("o + é um botão quadrado de 40 px, com borda tracejada e fundo suave", async ({ page }) => {
    await abrirOCadastro(page);
    await passoIdentificacao(page, { placa: placaUnica() });
    const mais = cadastro(page).getByRole("button", { name: "Cadastrar marca" });
    const b = await caixa(mais);
    expect(Math.round(b.width)).toBe(40);
    expect(Math.round(b.height)).toBe(40);
    const estilo = await mais.evaluate((el) => {
      const s = getComputedStyle(el);
      return { borda: s.borderTopStyle, fundo: s.backgroundColor };
    });
    expect(estilo.borda).toBe("dashed");
    expect(estilo.fundo).not.toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("stepper e rodapé", () => {
  test("círculos de 28 px, passo atual em destaque e barra de progresso fina", async ({ page }) => {
    await abrirOCadastro(page);
    const c = cadastro(page);
    const circulo = c.locator('li[aria-current="step"] span[aria-hidden]').first();
    const b = await caixa(circulo);
    expect(Math.round(b.width)).toBe(28);
    expect(Math.round(b.height)).toBe(28);
    const barra = await caixa(c.getByRole("progressbar"));
    expect(barra.height).toBeLessThanOrEqual(4);
    await expect(c.locator('li[aria-current="step"]')).toContainText("Identificação");
  });

  test("o rodapé mostra o rascunho salvo, Voltar e Continuar; no fim, o nome da ação", async ({
    page,
  }) => {
    await abrirOCadastro(page);
    const c = cadastro(page);
    await c.getByLabel("Placa", { exact: true }).fill(placaUnica());
    await expect(c.getByText(/Rascunho salvo às \d{2}:\d{2}/)).toBeVisible();
    await expect(c.getByRole("button", { name: "Voltar" })).toBeVisible();
    await expect(c.getByRole("button", { name: "Continuar" })).toBeVisible();
    await expect(c.getByRole("button", { name: "Avançar" })).toHaveCount(0);
    await irAteConferirOCadastro(page, { placa: placaUnica() });
    await expect(c.getByRole("button", { name: "Cadastrar placa" })).toBeVisible();
    await expect(c.getByRole("button", { name: "Continuar" })).toHaveCount(0);
    const rodape = await caixa(c.getByRole("button", { name: "Cadastrar placa" }));
    const painel = await caixa(c);
    expect(rodape.y + rodape.height).toBeGreaterThan(painel.y + painel.height - 24);
  });
});

test.describe("ficha sem ações", () => {
  test("não deixa espaço vazio no cabeçalho", async ({ page }) => {
    // Placa baixada (VND): nenhuma ação (toda placa fora da baixa pode ser disponibilizada).
    await abrirHidratada(page, "/frota/placas?baixadas=1&sigla=VND");
    const baixada = (await page
      .locator("[data-espiar-placa]")
      .first()
      .getAttribute("data-espiar-placa"))!;
    await abrirHidratada(page, FICHA(baixada));
    await expect(page.getByRole("heading", { level: 1, name: baixada })).toBeVisible();
    await expect(page.locator('header [role="group"][aria-label="Ações"]')).toBeHidden();
  });
});

test("o painel não muda de tamanho ao trocar de passo", async ({ page }) => {
  await abrirOCadastro(page);
  const c = cadastro(page);
  const antes = await caixa(c);
  await passoIdentificacao(page, { placa: placaUnica() });
  await passoVeiculo(page, {});
  const depois = await caixa(c);
  expect(Math.abs(antes.height - depois.height)).toBeLessThanOrEqual(2);
});
