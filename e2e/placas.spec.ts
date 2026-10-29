import { expect, test, type Page } from "@playwright/test";
import { abrirHidratada } from "./apoio";

const ROTA = "/frota/placas";
const tabela = (page: Page) => page.getByRole("table", { name: "Placas" });
const linhas = (page: Page) => tabela(page).locator("tbody tr");
const consulta = (page: Page) => page.getByRole("search", { name: "Consulta" });
const chip = (page: Page, nome: string) =>
  consulta(page).getByRole("button", { name: new RegExp(`^${nome}`) });
const busca = (page: Page) => consulta(page).getByRole("searchbox", { name: "Buscar placa" });
const resumo = (page: Page) => page.getByTestId("resumo-da-pagina");

async function totalDoResumo(page: Page): Promise<number> {
  const texto = (await resumo(page).textContent()) ?? "";
  const achado = /de ([\d.]+) placas/.exec(texto);
  return Number((achado?.[1] ?? "").replaceAll(".", ""));
}

async function contagemDoChip(page: Page, id: string): Promise<number> {
  const texto = (await consulta(page).locator(`[data-contagem="${id}"]`).textContent()) ?? "";
  return Number(texto.replaceAll(".", ""));
}

test.describe("lista de placas", () => {
  test("mostra o título, a tabela e a primeira placa", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await expect(page.getByRole("heading", { level: 1, name: "Placas" })).toBeVisible();
    await expect(tabela(page)).toBeVisible();
    await expect(linhas(page).first()).toContainText("AAA0A00");
    await expect(linhas(page)).toHaveCount(25);
  });

  test("as colunas padrão estão no cabeçalho, e KM, CR e Valor FIPE não", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const cabecalho = tabela(page).locator("thead");
    for (const nome of ["Placa", "Tipo", "Modelo", "Gestor", "Operação", "Situação", "Alertas"]) {
      await expect(
        cabecalho.getByRole("columnheader", { name: new RegExp(`^${nome}`) }),
      ).toBeVisible();
    }
    for (const nome of ["KM", "CR", "Valor FIPE"]) {
      await expect(
        cabecalho.getByRole("columnheader", { name: new RegExp(`^${nome}`) }),
      ).toHaveCount(0);
    }
  });

  test("Alertas vem logo depois de Situação e cabe sem rolagem lateral; Conjunto só em tela larga", async ({
    page,
  }, info) => {
    await abrirHidratada(page, ROTA);
    const nomes = (await tabela(page).locator("thead th").allTextContents()).map((n) => n.trim());
    const situacao = nomes.findIndex((n) => n.startsWith("Situação"));
    const alertas = nomes.findIndex((n) => n.startsWith("Alertas"));
    expect(situacao).toBeGreaterThanOrEqual(0);
    expect(alertas).toBe(situacao + 1);
    const medidas = await tabela(page).evaluate((t) => {
      const caixa = t.parentElement as HTMLElement;
      return { rolagem: caixa.scrollWidth, visivel: caixa.clientWidth };
    });
    // a tabela inteira, com Alertas, cabe na largura: nada precisa rolar para o lado
    expect(medidas.rolagem).toBeLessThanOrEqual(medidas.visivel);
    const cabecalhoDeAlertas = tabela(page).getByRole("columnheader", { name: /^Alertas/ });
    await expect(cabecalhoDeAlertas).toBeInViewport();
    const conjunto = tabela(page).getByRole("columnheader", { name: /^Conjunto/ });
    if (info.project.name === "tela-1920") await expect(conjunto).toBeVisible();
    else await expect(conjunto).toBeHidden();
  });

  test("a situação mostra a sigla exata e o nome por extenso", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?q=AAA0A22`);
    await expect(linhas(page).first()).toContainText("ETc");
    await expect(linhas(page).first()).toContainText("Em trânsito carregado");
  });

  test("os chips mostram a contagem do servidor, e a soma dos cinco é o total", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    const ids = ["em-atividade", "atencao", "impedida", "patio", "fora"];
    let soma = 0;
    for (const id of ids) soma += await contagemDoChip(page, id);
    expect(soma).toBeGreaterThan(100);
    expect(await totalDoResumo(page)).toBe(soma);
  });

  test("ligar um chip filtra, vai à URL e sobrevive a recarregar", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await chip(page, "Pátio").click();
    await expect(page).toHaveURL(/chip=patio/);
    await expect(chip(page, "Pátio")).toHaveAttribute("aria-pressed", "true");
    await expect(linhas(page).first()).toContainText("PÁT");
    for (const celula of await linhas(page).allTextContents()) expect(celula).toContain("PÁT");
    await page.reload();
    await expect(chip(page, "Pátio")).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/chip=patio/);
  });

  test("a busca filtra e vai à URL", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await busca(page).fill("AAA0A0");
    await expect(page).toHaveURL(/q=AAA0A0/);
    await expect(linhas(page).first()).toContainText("AAA0A0");
    expect(await totalDoResumo(page)).toBeLessThan(15);
  });

  test("clicar no cabeçalho ordena, inverte e vai à URL", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const placa = tabela(page).getByRole("columnheader", { name: /^Placa/ });
    await expect(placa).toHaveAttribute("aria-sort", "ascending");
    const primeira = await linhas(page).first().textContent();
    await placa.getByRole("button").click();
    await expect(page).toHaveURL(/ordem=-placa/);
    await expect(placa).toHaveAttribute("aria-sort", "descending");
    await expect(linhas(page).first()).not.toHaveText(primeira ?? "");
    const tipo = tabela(page).getByRole("columnheader", { name: /^Tipo/ });
    await tipo.getByRole("button").click();
    await expect(page).toHaveURL(/ordem=tipo/);
    await expect(tipo).toHaveAttribute("aria-sort", "ascending");
  });

  test("a segunda página mostra outras linhas e o resumo certo", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const primeira = await linhas(page).first().textContent();
    await expect(resumo(page)).toContainText("Mostrando 1–25 de");
    await page.getByRole("link", { name: "Próxima página" }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(resumo(page)).toContainText("Mostrando 26–50 de");
    await expect(linhas(page).first()).not.toHaveText(primeira ?? "");
  });

  test("mudar um filtro na página 2 volta para a página 1", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?pagina=2`);
    await chip(page, "Pátio").click();
    await expect(page).toHaveURL(/chip=patio/);
    await expect(page).not.toHaveURL(/pagina=/);
  });

  test("Voltar desfaz um passo e não sai do sistema", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await chip(page, "Atenção").click();
    await expect(page).toHaveURL(/chip=atencao/);
    await page.goBack();
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await expect(chip(page, "Atenção")).toHaveAttribute("aria-pressed", "false");
  });

  test("a página não rola na horizontal", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const medidas = await page.evaluate(() => ({
      conteudo: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(medidas.conteudo).toBeLessThanOrEqual(medidas.janela);
  });
});

test.describe("lista de placas: estados", () => {
  const esqueleto = (page: Page) => page.getByRole("status", { name: "Carregando placas" });

  test("carregando: o título e a consulta ficam, e o esqueleto ocupa o lugar da tabela", async ({
    page,
  }) => {
    await page.goto(`${ROTA}?lento=2500`, { waitUntil: "commit" });
    await expect(esqueleto(page)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Placas" })).toBeVisible();
    await expect(tabela(page)).toBeVisible({ timeout: 15_000 });
    await expect(esqueleto(page)).toHaveCount(0);
  });

  test("vazio: explica o que houve e Limpar filtros devolve a lista", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?q=zzzzzzzz`);
    const vazio = page.getByTestId("lista-vazia");
    await expect(vazio).toBeVisible();
    await expect(vazio).toContainText("Nenhuma placa encontrada");
    await expect(resumo(page)).toContainText("Mostrando 0–0 de 0 placas");
    await vazio.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(tabela(page)).toBeVisible();
    await expect(linhas(page).first()).toContainText("AAA0A00");
  });

  test("erro: diz o que houve, mantém o título e Tentar de novo recarrega a lista", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?falha=1`, "header");
    const alerta = page.getByRole("main").getByRole("alert");
    await expect(alerta).toContainText("Não foi possível carregar as placas");
    await expect(page.getByRole("heading", { level: 1, name: "Placas" })).toBeVisible();
    // O servidor "se recupera": os próximos pedidos chegam sem a falha simulada.
    await page.route(/falha=1/, (rota) => {
      const url = new URL(rota.request().url());
      url.searchParams.delete("falha");
      return rota.continue({ url: url.toString() });
    });
    await alerta.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(tabela(page)).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });

  test("busca digitada cancela a resposta anterior (só vale a última)", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    // A resposta da primeira busca demora e chega depois da segunda: não pode trocar a lista.
    await page.route(/[?&]q=AAA0A0(&|$)/, async (rota) => {
      await new Promise((resolver) => setTimeout(resolver, 1800));
      await rota.continue();
    });
    await busca(page).fill("AAA0A0");
    await page.waitForTimeout(450); // a primeira busca já saiu e está parada no servidor
    await busca(page).fill("AAA0A1");
    await expect(page).toHaveURL(/q=AAA0A1/);
    await expect(resumo(page)).toContainText("de 9 placas", { timeout: 10_000 });
    for (const texto of await linhas(page).allTextContents()) expect(texto).toContain("AAA0A1");
    await page.waitForTimeout(2500); // a resposta atrasada já chegou: a tela continua na última
    await expect(page).toHaveURL(/q=AAA0A1/);
    await expect(busca(page)).toHaveValue("AAA0A1");
    await expect(resumo(page)).toContainText("de 9 placas");
    for (const texto of await linhas(page).allTextContents()) expect(texto).toContain("AAA0A1");
  });

  test("atualizar a página mantém filtro, ordem e página (armadilha 2)", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?chip=impedida&ordem=-gestor&pagina=2`);
    await expect(resumo(page)).toContainText("Mostrando 26–50 de");
    await page.reload();
    await expect(page).toHaveURL(/chip=impedida&ordem=-gestor&pagina=2/);
    await expect(chip(page, "Impedida")).toHaveAttribute("aria-pressed", "true");
    await expect(tabela(page).getByRole("columnheader", { name: /^Gestor/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await expect(resumo(page)).toContainText("Mostrando 26–50 de");
  });

  test("chip com zero fica apagado; o ligado com zero continua clicável", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?q=AAA0A00`);
    await expect(chip(page, "Fora")).toHaveAttribute("data-zerado", "true");
    await expect(chip(page, "Fora")).toBeEnabled();
    await abrirHidratada(page, `${ROTA}?q=AAA0A00&chip=fora`);
    await expect(chip(page, "Fora")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Fora")).not.toHaveAttribute("data-zerado", "true");
    await expect(page.getByTestId("lista-vazia")).toBeVisible();
    await chip(page, "Fora").click();
    await expect(chip(page, "Fora")).toHaveAttribute("aria-pressed", "false");
    await expect(linhas(page).first()).toContainText("AAA0A00");
  });
});

test.describe("lista de placas: preferências em cookie", () => {
  const NOME = "eixo-tabela-placas";
  const tamanho = (page: Page) => page.getByLabel("Linhas por página");
  const densidade = (page: Page, nome: string) =>
    page.getByRole("group", { name: "Densidade" }).getByRole("button", { name: nome });
  const alturaDaLinha = async (page: Page) =>
    (await linhas(page).first().boundingBox())?.height ?? 0;

  async function semeiaCookie(page: Page, valor: string, baseURL: string | undefined) {
    await page
      .context()
      .addCookies([{ name: NOME, value: valor, url: baseURL ?? "http://localhost:3000" }]);
  }

  test("o padrão é 25 linhas e densidade compacta", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await expect(tamanho(page)).toHaveValue("25");
    await expect(densidade(page, "Compacta")).toHaveAttribute("aria-pressed", "true");
    await expect(densidade(page, "Confortável")).toHaveAttribute("aria-pressed", "false");
  });

  test("escolher 50 por página mostra 50, vai ao cookie e é lembrado ao recarregar e voltar", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?pagina=3`);
    await tamanho(page).selectOption("50");
    await expect(linhas(page)).toHaveCount(50);
    await expect(resumo(page)).toContainText("Mostrando 1–50 de");
    await expect(page).not.toHaveURL(/tam=/);
    await expect(page).not.toHaveURL(/pagina=/);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === NOME)?.value).toContain("50");
    await page.reload();
    await expect(linhas(page)).toHaveCount(50);
    await expect(tamanho(page)).toHaveValue("50");
    await abrirHidratada(page, "/frota/carteira");
    await abrirHidratada(page, ROTA);
    await expect(linhas(page)).toHaveCount(50);
  });

  test("tam na URL vale mais que o cookie, e o servidor limita a 100", async ({
    page,
    baseURL,
  }) => {
    await semeiaCookie(page, encodeURIComponent('{"tam":50}'), baseURL);
    await abrirHidratada(page, ROTA);
    await expect(linhas(page)).toHaveCount(50);
    await abrirHidratada(page, `${ROTA}?tam=100`);
    await expect(linhas(page)).toHaveCount(100);
    await abrirHidratada(page, `${ROTA}?tam=500`);
    await expect(linhas(page)).toHaveCount(100);
    await abrirHidratada(page, `${ROTA}?tam=abc`);
    await expect(linhas(page)).toHaveCount(50);
  });

  test("a densidade confortável aumenta a linha, vai ao cookie e sobrevive a recarregar", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    const compacta = await alturaDaLinha(page);
    await densidade(page, "Confortável").click();
    await expect(densidade(page, "Confortável")).toHaveAttribute("aria-pressed", "true");
    const confortavel = await alturaDaLinha(page);
    expect(confortavel).toBeGreaterThan(compacta + 6);
    expect((await page.context().cookies()).find((c) => c.name === NOME)?.value).toContain(
      "confortavel",
    );
    await page.reload();
    await expect(densidade(page, "Confortável")).toHaveAttribute("aria-pressed", "true");
    expect(await alturaDaLinha(page)).toBeCloseTo(confortavel, 0);
  });

  test("mudar a densidade não perde filtro, ordem nem página", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?chip=impedida&ordem=-gestor&pagina=2`);
    await densidade(page, "Confortável").click();
    await expect(page).toHaveURL(/chip=impedida&ordem=-gestor&pagina=2/);
    await expect(resumo(page)).toContainText("Mostrando 26–50 de");
  });

  test("cookie corrompido ou adulterado cai no padrão, sem erro", async ({ page, baseURL }) => {
    for (const valor of [
      "lixo",
      encodeURIComponent("lixo{{"),
      "%E0%A4%A",
      encodeURIComponent('{"tam":9999,"densidade":"enorme","colunas":["xxx"]}'),
      // grande demais para nós (limite de 2000), mas ainda cabe nos 4 KB que o navegador aceita
      encodeURIComponent(JSON.stringify({ tam: 50, colunas: Array(200).fill("placa") })),
    ]) {
      await semeiaCookie(page, valor, baseURL);
      await abrirHidratada(page, ROTA);
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
      await expect(linhas(page)).toHaveCount(25);
      await expect(densidade(page, "Compacta")).toHaveAttribute("aria-pressed", "true");
    }
  });
});

test.describe("lista de placas: feedback de carregando", () => {
  const ocupada = (page: Page) => tabela(page).and(page.locator('[aria-busy="true"]'));

  test("clicar num chip esmaece a tabela, e chips e páginas não aceitam novo clique", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?lento=2500`);
    await chip(page, "Pátio").click();
    await expect(ocupada(page)).toBeVisible();
    await expect(chip(page, "Atenção")).toBeDisabled();
    await expect(page.getByRole("link", { name: "Próxima página" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await chip(page, "Atenção").click({ force: true });
    await expect(tabela(page)).toHaveAttribute("aria-busy", "false", { timeout: 10_000 });
    await expect(page).toHaveURL(/chip=patio/);
    await expect(page).not.toHaveURL(/chip=atencao/);
    await expect(chip(page, "Atenção")).toBeEnabled();
  });

  test("a busca esmaece a tabela enquanto o servidor responde", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?lento=2500`);
    await busca(page).fill("AAA0A1");
    await expect(ocupada(page)).toBeVisible();
    await expect(tabela(page)).toHaveAttribute("aria-busy", "false", { timeout: 10_000 });
    await expect(page).toHaveURL(/q=AAA0A1/);
  });

  test("a paginação esmaece a tabela e um segundo clique não pula duas páginas", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?lento=2500`);
    const proxima = page.getByRole("link", { name: "Próxima página" });
    await proxima.click();
    await expect(ocupada(page)).toBeVisible();
    await proxima.click({ force: true });
    await expect(tabela(page)).toHaveAttribute("aria-busy", "false", { timeout: 10_000 });
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page).not.toHaveURL(/pagina=3/);
    await expect(resumo(page)).toContainText("Mostrando 26–50 de");
  });

  test("ordenar por cabeçalho também bloqueia chips enquanto carrega", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?lento=2500`);
    await tabela(page).getByRole("columnheader", { name: /^Tipo/ }).getByRole("button").click();
    await expect(ocupada(page)).toBeVisible();
    await expect(chip(page, "Pátio")).toBeDisabled();
    await expect(tabela(page)).toHaveAttribute("aria-busy", "false", { timeout: 10_000 });
  });
});

test.describe("lista de placas: colunas escolhíveis e reordenáveis", () => {
  const NOME = "eixo-tabela-placas";
  const botaoColunas = (page: Page) => page.getByRole("button", { name: "Colunas" });
  const painel = (page: Page) => page.getByRole("dialog", { name: "Colunas" });
  const caixa = (page: Page, nome: string) =>
    painel(page).getByRole("checkbox", { name: nome, exact: true });
  // só os visíveis: a coluna "só em tela larga" continua no DOM, escondida por CSS
  const cabecalhos = async (page: Page) =>
    (await tabela(page).getByRole("columnheader").allTextContents()).map((t) => t.trim());
  const abrir = async (page: Page) => {
    await botaoColunas(page).click();
    await expect(painel(page)).toBeVisible();
  };
  const cookie = async (page: Page) =>
    decodeURIComponent((await page.context().cookies()).find((c) => c.name === NOME)?.value ?? "");

  test("o menu lista as 14 colunas: Placa fixa, KM, CR e Valor FIPE desligadas", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await abrir(page);
    await expect(painel(page).getByRole("checkbox")).toHaveCount(14);
    await expect(caixa(page, "Placa")).toBeChecked();
    await expect(caixa(page, "Placa")).toBeDisabled();
    for (const nome of ["Tipo", "Modelo", "Gestor", "Operação", "Situação", "Alertas"]) {
      await expect(caixa(page, nome)).toBeChecked();
    }
    for (const nome of ["KM", "CR", "Valor FIPE", "Filial"]) {
      await expect(caixa(page, nome)).not.toBeChecked();
    }
  });

  test("ligar KM mostra a coluna, grava no cookie e sobrevive a recarregar", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await abrir(page);
    await caixa(page, "KM").check();
    await expect(tabela(page).getByRole("columnheader", { name: /^KM/ })).toBeVisible();
    await expect(tabela(page).locator("tbody tr").first()).not.toContainText("undefined");
    expect(await cookie(page)).toContain('"km"');
    await expect(page).toHaveURL(/\/frota\/placas$/);
    await page.reload();
    await expect(tabela(page).getByRole("columnheader", { name: /^KM/ })).toBeVisible();
  });

  test("desligar Gestor tira a coluna", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await abrir(page);
    await caixa(page, "Gestor").uncheck();
    await expect(tabela(page).getByRole("columnheader", { name: /^Gestor/ })).toHaveCount(0);
    await expect(tabela(page).getByRole("columnheader", { name: /^Tipo/ })).toBeVisible();
  });

  test("Mover Modelo para a esquerda troca com Tipo, e a ordem sobrevive a recarregar", async ({
    page,
  }) => {
    const primeiras = async () =>
      (await cabecalhos(page)).slice(0, 3).map((t) => t.replace(/\s.*/, ""));
    await abrirHidratada(page, ROTA);
    await abrir(page);
    await painel(page).getByRole("button", { name: "Mover Modelo para a esquerda" }).click();
    await expect.poll(primeiras).toEqual(["Placa", "Modelo", "Tipo"]);
    await page.reload();
    await expect(tabela(page)).toBeVisible();
    await expect.poll(primeiras).toEqual(["Placa", "Modelo", "Tipo"]);
  });

  test("a Placa não se move nem se desliga, e a primeira coluna depois dela não vai para a esquerda", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await abrir(page);
    await expect(painel(page).getByRole("button", { name: /Mover Placa/ })).toHaveCount(0);
    await expect(
      painel(page).getByRole("button", { name: "Mover Tipo para a esquerda" }),
    ).toBeDisabled();
    await expect(
      painel(page).getByRole("button", { name: "Mover Tipo para a direita" }),
    ).toBeEnabled();
  });

  test("Esc fecha o menu e o foco volta ao botão Colunas", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await abrir(page);
    await page.keyboard.press("Escape");
    await expect(painel(page)).toBeHidden();
    await expect(botaoColunas(page)).toBeFocused();
  });

  test("funciona só com o teclado: Tab até a caixa e Espaço liga a coluna", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await botaoColunas(page).focus();
    await page.keyboard.press("Enter");
    await expect(painel(page)).toBeVisible();
    await caixa(page, "CR").focus();
    await page.keyboard.press("Space");
    await expect(tabela(page).getByRole("columnheader", { name: /^CR/ })).toBeVisible();
  });

  test("Restaurar padrão devolve as colunas e a ordem", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const inicial = await cabecalhos(page);
    await abrir(page);
    await caixa(page, "KM").check();
    await painel(page).getByRole("button", { name: "Mover Modelo para a esquerda" }).click();
    await expect.poll(() => cabecalhos(page)).not.toEqual(inicial);
    await painel(page).getByRole("button", { name: "Restaurar padrão" }).click();
    await expect.poll(() => cabecalhos(page)).toEqual(inicial);
    expect(await cookie(page)).toContain('"colunas":null');
  });

  test("em 1920 aparecem mais colunas que em 1366, sem rolagem lateral nem da página nem da tabela", async ({
    page,
  }, info) => {
    await abrirHidratada(page, ROTA);
    const nomes = (await cabecalhos(page)).map((t) => t.replace(/\s.*/, ""));
    const medidas = await tabela(page).evaluate((t) => {
      const c = t.parentElement as HTMLElement;
      return { rolagem: c.scrollWidth, visivel: c.clientWidth };
    });
    expect(medidas.rolagem).toBeLessThanOrEqual(medidas.visivel);
    if (info.project.name === "tela-1920") {
      for (const n of ["Conjunto", "Motorista", "Dias"]) expect(nomes).toContain(n);
      expect(nomes.length).toBe(10);
    } else {
      for (const n of ["Conjunto", "Motorista", "Dias"]) expect(nomes).not.toContain(n);
      expect(nomes.length).toBe(7);
    }
  });

  test("a escolha da pessoa vale em qualquer largura: Conjunto ligado aparece no 1366", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await abrir(page);
    await caixa(page, "Conjunto").check();
    await expect(tabela(page).getByRole("columnheader", { name: /^Conjunto/ })).toBeVisible();
    await caixa(page, "Conjunto").uncheck();
    await expect(tabela(page).getByRole("columnheader", { name: /^Conjunto/ })).toHaveCount(0);
  });

  test("com as 14 colunas ligadas a página não rola; só a tabela rola", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await abrir(page);
    for (const nome of [
      "Conjunto",
      "Motorista",
      "Filial",
      "Dias na situação",
      "KM",
      "CR",
      "Valor FIPE",
    ]) {
      await caixa(page, nome).check();
    }
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await cabecalhos(page)).length).toBe(14);
    const medidas = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));
    expect(medidas.pagina).toBeLessThanOrEqual(medidas.janela);
    const tabelaRola = await tabela(page).evaluate((t) => {
      const c = t.parentElement as HTMLElement;
      return c.scrollWidth > c.clientWidth;
    });
    expect(tabelaRola).toBe(true);
  });

  test("dá para ordenar pelas colunas novas (KM, Valor FIPE, Motorista)", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await abrir(page);
    await caixa(page, "KM").check();
    await caixa(page, "Valor FIPE").check();
    await page.keyboard.press("Escape");
    await tabela(page).getByRole("columnheader", { name: /^KM/ }).getByRole("button").click();
    await expect(page).toHaveURL(/ordem=km/);
    await tabela(page)
      .getByRole("columnheader", { name: /^Valor FIPE/ })
      .getByRole("button")
      .click();
    await expect(page).toHaveURL(/ordem=fipe/);
  });
});

test.describe("lista de placas: chips por tipo de ativo", () => {
  const TIPOS = ["cavalo", "implemento", "equipamento", "caminhao", "veiculo-pequeno", "apoio"];
  const contagens = async (page: Page, ids: string[]) => {
    const resultado: Record<string, number> = {};
    for (const id of ids) {
      const texto = (await consulta(page).locator(`[data-contagem="${id}"]`).textContent()) ?? "0";
      resultado[id] = Number(texto.replaceAll(".", ""));
    }
    return resultado;
  };
  const STATUS = ["em-atividade", "atencao", "impedida", "patio", "fora"];

  test("há seis chips de tipo, e a soma deles é o total", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    for (const nome of [
      "Cavalo",
      "Implemento",
      "Equipamento",
      "Caminhão",
      "Veículo pequeno",
      "Apoio",
    ]) {
      await expect(chip(page, nome)).toBeVisible();
    }
    const porTipo = await contagens(page, TIPOS);
    const soma = Object.values(porTipo).reduce((a, b) => a + b, 0);
    expect(soma).toBe(await totalDoResumo(page));
  });

  test("filtrar por Cavalo muda as contagens de situação, mas não as de tipo", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const tiposAntes = await contagens(page, TIPOS);
    const statusAntes = await contagens(page, STATUS);
    await chip(page, "Cavalo").click();
    await expect(page).toHaveURL(/chip=cavalo/);
    await expect(chip(page, "Cavalo")).toHaveAttribute("aria-pressed", "true");
    await expect(linhas(page).first()).toContainText("Cavalo");
    const tiposDepois = await contagens(page, TIPOS);
    const statusDepois = await contagens(page, STATUS);
    expect(tiposDepois).toEqual(tiposAntes);
    expect(statusDepois).not.toEqual(statusAntes);
    expect(Object.values(statusDepois).reduce((a, b) => a + b, 0)).toBe(tiposAntes["cavalo"]);
    expect(await totalDoResumo(page)).toBe(tiposAntes["cavalo"]);
  });

  test("dois tipos valem OU, e tipo com situação vale E", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const base = await contagens(page, TIPOS);
    await chip(page, "Cavalo").click();
    await expect(page).toHaveURL(/chip=cavalo/);
    await chip(page, "Apoio").click();
    await expect(page).toHaveURL(/chip=apoio/);
    expect(await totalDoResumo(page)).toBe((base["cavalo"] ?? 0) + (base["apoio"] ?? 0));
    await chip(page, "Pátio").click();
    await expect(page).toHaveURL(/chip=patio/);
    for (const texto of await linhas(page).allTextContents()) {
      expect(texto).toContain("PÁT");
      expect(/Cavalo|Apoio/.test(texto)).toBe(true);
    }
  });
});

test.describe("lista de placas: grupos de chips com rótulo", () => {
  const grupo = (page: Page, nome: string) =>
    consulta(page).getByRole("group", { name: nome, exact: true });
  const topos = async (page: Page, nome: string) =>
    grupo(page, nome)
      .getByRole("button")
      .evaluateAll((botoes) => botoes.map((b) => Math.round(b.getBoundingClientRect().y)));

  test("cada grupo tem o seu rótulo visível: Situação e Tipo", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await expect(grupo(page, "Situação")).toBeVisible();
    await expect(grupo(page, "Tipo")).toBeVisible();
    await expect(grupo(page, "Situação")).toContainText("Situação");
    await expect(grupo(page, "Tipo")).toContainText("Tipo");
    await expect(grupo(page, "Situação").getByRole("button")).toHaveCount(5);
    await expect(grupo(page, "Tipo").getByRole("button")).toHaveCount(6);
  });

  test("a quebra de linha acontece entre os grupos, nunca dentro de um", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    for (const nome of ["Situação", "Tipo"]) {
      const ys = await topos(page, nome);
      expect(new Set(ys).size, `chips de ${nome} em linhas diferentes: ${ys}`).toBe(1);
    }
    const situacao = await grupo(page, "Situação").boundingBox();
    const tipo = await grupo(page, "Tipo").boundingBox();
    expect(situacao && tipo).toBeTruthy();
    // ou lado a lado (mesma linha) ou um embaixo do outro, mas nunca sobrepostos
    const mesmaLinha = Math.abs((tipo?.y ?? 0) - (situacao?.y ?? 0)) < 4;
    const embaixo = (tipo?.y ?? 0) >= (situacao?.y ?? 0) + (situacao?.height ?? 0) - 1;
    expect(mesmaLinha || embaixo).toBe(true);
  });

  test("no 1366 os dois grupos não cabem juntos: o Tipo desce inteiro para a linha de baixo", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "tela-1366", "só o 1366 é estreito para isso");
    await abrirHidratada(page, ROTA);
    const situacao = await grupo(page, "Situação").boundingBox();
    const tipo = await grupo(page, "Tipo").boundingBox();
    expect((tipo?.y ?? 0) > (situacao?.y ?? 0) + 10).toBe(true);
  });

  test("os filtros continuam funcionando com os grupos rotulados", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await grupo(page, "Tipo")
      .getByRole("button", { name: /^Cavalo/ })
      .click();
    await expect(page).toHaveURL(/chip=cavalo/);
    await grupo(page, "Situação")
      .getByRole("button", { name: /^Pátio/ })
      .click();
    await expect(page).toHaveURL(/chip=patio/);
  });
});

test.describe("lista de placas: menu Colunas com rodapé fixo", () => {
  const botaoColunas = (page: Page) => page.getByRole("button", { name: "Colunas" });
  const painel = (page: Page) => page.getByRole("dialog", { name: "Colunas" });

  test("Restaurar padrão fica sempre à vista, sem rolar, e o menu usa até 85% da altura", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    await botaoColunas(page).click();
    await expect(painel(page)).toBeVisible();
    const altura = page.viewportSize()?.height ?? 0;
    const caixa = await painel(page).boundingBox();
    expect(caixa?.height ?? 0).toBeLessThanOrEqual(altura * 0.85 + 1);
    const restaurar = painel(page).getByRole("button", { name: "Restaurar padrão" });
    await expect(restaurar).toBeInViewport({ ratio: 1 });
    const rodape = await restaurar.boundingBox();
    expect((rodape?.y ?? 0) + (rodape?.height ?? 0)).toBeLessThanOrEqual(
      (caixa?.y ?? 0) + (caixa?.height ?? 0) + 1,
    );
  });

  test("a lista de colunas rola por dentro: a última coluna fica ao alcance, e o rodapé não se mexe", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "tela-1366", "no 1920 a lista inteira cabe sem rolar");
    await abrirHidratada(page, ROTA);
    await botaoColunas(page).click();
    const restaurar = painel(page).getByRole("button", { name: "Restaurar padrão" });
    const antes = await restaurar.boundingBox();
    const ultima = painel(page).getByRole("checkbox", { name: "Valor FIPE", exact: true });
    await ultima.scrollIntoViewIfNeeded();
    await expect(ultima).toBeInViewport();
    const depois = await restaurar.boundingBox();
    expect(depois?.y).toBe(antes?.y);
    await expect(restaurar).toBeInViewport({ ratio: 1 });
  });

  test("Restaurar padrão continua funcionando", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await botaoColunas(page).click();
    await painel(page).getByRole("checkbox", { name: "KM", exact: true }).check();
    await expect(tabela(page).getByRole("columnheader", { name: /^KM/ })).toBeVisible();
    await painel(page).getByRole("button", { name: "Restaurar padrão" }).click();
    await expect(tabela(page).getByRole("columnheader", { name: /^KM/ })).toHaveCount(0);
  });
});

test.describe("lista de placas: rolagem só dentro da tabela", () => {
  const caixa = (page: Page) => tabela(page).locator("xpath=..");
  const TODAS_AS_COLUNAS = [
    "placa",
    "tipo",
    "modelo",
    "conjunto",
    "gestor",
    "operacao",
    "situacao",
    "alertas",
    "motorista",
    "filial",
    "dias",
    "km",
    "cr",
    "fipe",
  ];
  const medidasDaPagina = (page: Page) =>
    page.evaluate(() => ({
      altura: document.documentElement.scrollHeight,
      largura: document.documentElement.scrollWidth,
      janelaAltura: window.innerHeight,
      janelaLargura: window.innerWidth,
    }));

  test("com 100 linhas a página não rola, nem na vertical nem na horizontal; só a tabela rola", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?tam=100`);
    await expect(linhas(page)).toHaveCount(100);
    const m = await medidasDaPagina(page);
    expect(m.altura).toBeLessThanOrEqual(m.janelaAltura + 1);
    expect(m.largura).toBeLessThanOrEqual(m.janelaLargura);
    const rolagem = await caixa(page).evaluate((c) => ({
      total: c.scrollHeight,
      visivel: c.clientHeight,
    }));
    expect(rolagem.total).toBeGreaterThan(rolagem.visivel);
    await caixa(page).evaluate((c) => (c.scrollTop = 900));
    expect(await caixa(page).evaluate((c) => c.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("o resumo e a troca de página ficam à vista sem rolar a página", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?tam=100`);
    await expect(resumo(page)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("link", { name: "Próxima página" })).toBeInViewport({ ratio: 1 });
    await expect(page.getByLabel("Linhas por página")).toBeInViewport({ ratio: 1 });
  });

  test("a tabela com poucas linhas não estica: a caixa acompanha o conteúdo", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?q=AAA0A00`);
    await expect(linhas(page)).toHaveCount(1);
    const alturas = await caixa(page).evaluate((c) => ({
      caixa: c.clientHeight,
      janela: window.innerHeight,
    }));
    expect(alturas.caixa).toBeLessThan(alturas.janela / 3);
  });

  test("o cabeçalho continua no topo da tabela ao rolar", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?tam=100`);
    await caixa(page).evaluate((c) => (c.scrollTop = 1200));
    const topoDaCaixa = (await caixa(page).boundingBox())?.y ?? 0;
    const cabecalho = await tabela(page)
      .getByRole("columnheader", { name: /^Placa/ })
      .boundingBox();
    expect(Math.abs((cabecalho?.y ?? -99) - topoDaCaixa)).toBeLessThanOrEqual(3);
    // e a linha que estava no começo já saiu da vista
    await expect(linhas(page).first()).not.toBeInViewport();
  });

  test("a coluna Placa continua à esquerda ao rolar para o lado, por cima das outras", async ({
    page,
    baseURL,
  }) => {
    await page.context().addCookies([
      {
        name: "eixo-tabela-placas",
        value: encodeURIComponent(JSON.stringify({ colunas: TODAS_AS_COLUNAS })),
        url: baseURL ?? "http://localhost:3000",
      },
    ]);
    await abrirHidratada(page, ROTA);
    const largura = await caixa(page).evaluate((c) => ({
      total: c.scrollWidth,
      visivel: c.clientWidth,
    }));
    expect(largura.total).toBeGreaterThan(largura.visivel);
    await caixa(page).evaluate((c) => (c.scrollLeft = 600));
    const esquerdaDaCaixa = (await caixa(page).boundingBox())?.x ?? 0;
    const primeiraCelula = linhas(page).first().locator("td").first();
    const celula = await primeiraCelula.boundingBox();
    expect(Math.abs((celula?.x ?? -99) - esquerdaDaCaixa)).toBeLessThanOrEqual(3);
    const quemEstaPorCima = await primeiraCelula.evaluate((td) => {
      const r = td.getBoundingClientRect();
      const alvo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return alvo === td || td.contains(alvo);
    });
    expect(quemEstaPorCima).toBe(true);
    const cabecalho = await tabela(page)
      .getByRole("columnheader", { name: /^Placa/ })
      .boundingBox();
    expect(Math.abs((cabecalho?.x ?? -99) - esquerdaDaCaixa)).toBeLessThanOrEqual(3);
  });

  test("a caixa da tabela é uma região que se rola com o teclado", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?tam=100`);
    const regiao = page.getByRole("region", { name: /Placas/ });
    await expect(regiao).toBeVisible();
    await regiao.focus();
    await page.keyboard.press("PageDown");
    await expect.poll(() => caixa(page).evaluate((c) => c.scrollTop)).toBeGreaterThan(0);
  });
});

test.describe("lista de placas: modo foco", () => {
  const lateral = (page: Page) => page.locator('aside[data-barra="principal"]');
  const topo = (page: Page) => page.locator("header");
  const entrar = (page: Page) => page.getByRole("button", { name: "Modo foco", exact: true });
  const sair = (page: Page) => page.getByRole("button", { name: "Sair do modo foco" });
  const alturaDaTabela = (page: Page) =>
    tabela(page)
      .locator("xpath=..")
      .evaluate((c) => c.clientHeight);

  test("o botão Modo foco esconde a barra lateral e o topo e dá mais altura à tabela", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?tam=100`);
    await expect(lateral(page)).toBeVisible();
    await expect(topo(page)).toBeVisible();
    const antes = await alturaDaTabela(page);
    await entrar(page).click();
    await expect(page).toHaveURL(/foco=1/);
    await expect(lateral(page)).toBeHidden();
    await expect(topo(page)).toBeHidden();
    await expect(sair(page)).toBeVisible();
    expect(await alturaDaTabela(page)).toBeGreaterThan(antes);
    const m = await page.evaluate(() => ({
      altura: document.documentElement.scrollHeight,
      janela: window.innerHeight,
    }));
    expect(m.altura).toBeLessThanOrEqual(m.janela + 1);
  });

  test("a tabela ocupa a largura da janela inteira, sem a barra lateral", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?foco=1`);
    const janela = page.viewportSize()?.width ?? 0;
    const caixa = await tabela(page).locator("xpath=..").boundingBox();
    expect((caixa?.width ?? 0) + 2 * 32).toBeGreaterThanOrEqual(janela - 2);
  });

  test("o link com foco=1 abre direto no modo foco e sobrevive a recarregar", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?foco=1`);
    await expect(lateral(page)).toBeHidden();
    await page.reload();
    await expect(lateral(page)).toBeHidden();
    await expect(sair(page)).toBeVisible();
  });

  test("Sair do modo foco volta a barra lateral e o topo", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?foco=1`);
    await sair(page).click();
    await expect(page).not.toHaveURL(/foco=/);
    await expect(lateral(page)).toBeVisible();
    await expect(topo(page)).toBeVisible();
  });

  test("Esc sai do modo foco", async ({ page }) => {
    await abrirHidratada(page, `${ROTA}?foco=1`);
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/foco=/);
    await expect(lateral(page)).toBeVisible();
  });

  test("Esc com o menu Colunas aberto fecha só o menu e continua no modo foco", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?foco=1`);
    await page.getByRole("button", { name: "Colunas" }).click();
    await expect(page.getByRole("dialog", { name: "Colunas" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Colunas" })).toBeHidden();
    await expect(page).toHaveURL(/foco=1/);
    await expect(lateral(page)).toBeHidden();
  });

  test("os filtros e a ordem continuam no modo foco, e o foco continua com eles", async ({
    page,
  }) => {
    await abrirHidratada(page, `${ROTA}?foco=1`);
    await chip(page, "Pátio").click();
    await expect(page).toHaveURL(/foco=1/);
    await expect(page).toHaveURL(/chip=patio/);
    await tabela(page).getByRole("columnheader", { name: /^Tipo/ }).getByRole("button").click();
    await expect(page).toHaveURL(/foco=1/);
    await expect(page).toHaveURL(/ordem=tipo/);
  });

  test("Voltar do navegador sai do modo foco, um passo de cada vez", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await entrar(page).click();
    await expect(page).toHaveURL(/foco=1/);
    await page.goBack();
    await expect(page).not.toHaveURL(/foco=/);
    await expect(lateral(page)).toBeVisible();
    await expect(page).toHaveURL(/\/frota\/placas$/);
  });

  test("Sair do modo foco devolve o foco do teclado ao botão que abriu", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await entrar(page).click();
    await expect(sair(page)).toBeVisible();
    await sair(page).click();
    await expect(entrar(page)).toBeVisible();
  });
});

test.describe("lista de placas: aproveitamento de tela", () => {
  const caixa = (page: Page) => tabela(page).locator("xpath=..");
  const linhasInteiras = (page: Page) =>
    caixa(page).evaluate((c) => {
      const cabecalho = (c.querySelector("thead") as HTMLElement).getBoundingClientRect();
      const limite = c.getBoundingClientRect().bottom;
      return [...c.querySelectorAll("tbody tr")].filter((tr) => {
        const r = tr.getBoundingClientRect();
        return r.top >= cabecalho.bottom - 1 && r.bottom <= limite + 1;
      }).length;
    });
  const meioY = async (l: ReturnType<Page["locator"]>) => {
    const b = await l.boundingBox();
    return (b?.y ?? -999) + (b?.height ?? 0) / 2;
  };

  test("no 1366×768, densidade compacta, a tabela mostra pelo menos 9 linhas inteiras", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "tela-1366", "o aceite é no 1366×768");
    expect(page.viewportSize()).toEqual({ width: 1366, height: 768 });
    await abrirHidratada(page, ROTA);
    await expect(
      page.getByRole("group", { name: "Densidade" }).getByRole("button", { name: "Compacta" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(await linhasInteiras(page)).toBeGreaterThanOrEqual(9);
  });

  test("em 1920 a tabela mostra ainda mais linhas (pelo menos 14)", async ({ page }, info) => {
    test.skip(info.project.name !== "tela-1920", "só o 1920");
    await abrirHidratada(page, ROTA);
    expect(await linhasInteiras(page)).toBeGreaterThanOrEqual(14);
  });

  test("Mais filtros e Visões salvas ficam na linha da busca", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    const busca = await meioY(consulta(page).getByRole("searchbox", { name: "Buscar placa" }));
    for (const nome of ["Mais filtros", "Visões salvas"]) {
      const y = await meioY(consulta(page).getByRole("button", { name: nome }));
      expect(Math.abs(y - busca), nome).toBeLessThanOrEqual(6);
    }
  });

  test("a descrição do título não aparece nas telas de lista (mas continua para leitor de tela)", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    const descricao = page.getByText("Lista todas as placas e abre a ficha de cada uma.");
    await expect(descricao).toHaveCount(1);
    const caixaDaDescricao = await descricao.boundingBox();
    expect((caixaDaDescricao?.width ?? 99) <= 2 && (caixaDaDescricao?.height ?? 99) <= 2).toBe(
      true,
    );
  });

  test("Modo foco, Colunas e Densidade ficam na linha da paginação, tudo numa linha só", async ({
    page,
  }) => {
    await abrirHidratada(page, ROTA);
    const referencia = await meioY(resumo(page));
    const itens = [
      page.getByRole("button", { name: "Modo foco", exact: true }),
      page.getByRole("button", { name: "Colunas" }),
      page.getByRole("group", { name: "Densidade" }),
      page.getByLabel("Linhas por página"),
      page.getByRole("link", { name: "Próxima página" }),
    ];
    for (const item of itens) {
      expect(Math.abs((await meioY(item)) - referencia)).toBeLessThanOrEqual(8);
    }
  });

  test("o botão de tema é só o ícone abaixo de 1536 px, com nome e tooltip; em 1920 mostra o texto", async ({
    page,
  }, info) => {
    await abrirHidratada(page, ROTA);
    const tema = page.locator("header").getByRole("button", { name: "Alternar tema" });
    await expect(tema).toHaveAttribute("title", "Alternar tema");
    const largura = (await tema.boundingBox())?.width ?? 0;
    if (info.project.name === "tela-1920") expect(largura).toBeGreaterThan(80);
    else expect(largura).toBeLessThanOrEqual(44);
  });

  test("no 1366 o topo cabe em duas linhas", async ({ page }, info) => {
    test.skip(info.project.name !== "tela-1366", "só o 1366 é estreito");
    await abrirHidratada(page, ROTA);
    const altura = (await page.locator("header").boundingBox())?.height ?? 999;
    expect(altura).toBeLessThanOrEqual(95);
  });

  test("a barra de consulta continua funcionando com o novo arranjo", async ({ page }) => {
    await abrirHidratada(page, ROTA);
    await busca(page).fill("AAA0A1");
    await expect(page).toHaveURL(/q=AAA0A1/);
    await consulta(page).getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await chip(page, "Pátio").click();
    await expect(page).toHaveURL(/chip=patio/);
  });
});
