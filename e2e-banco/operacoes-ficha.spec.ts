import { expect, type Page, test } from "@playwright/test";
import { comBanco } from "../e2e/apoio/usuarios-de-teste";

// Operações › padrão de telas e ficha completa (10/11/2026), o caminho principal no modo banco, com a
// sessão do Administrador. SÓ LEITURA: nada é gravado (a regra de gravar só em placas ZDM não se
// aplica). Abre a lista, confere o mês padrão (o mês fechado mais recente, não 11/2025), abre o olho
// da primeira linha (o painel lateral abre, Esc fecha e o foco volta ao olho), abre a ficha e percorre
// as oito abas. Precisa de uma operação com placas (a demonstração: `pnpm demo:carregar`).

const ABAS = [
  "Resumo",
  "Placas",
  "Pessoas",
  "Resultado",
  "Linha do tempo",
  "Documentos",
  "Mapa",
  "Mapa mental",
] as const;

async function mesFechadoDoBanco(): Promise<string> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ mes: string }>(
      "select to_char(nucleo.mes_fechado_mais_recente(), 'MM/YYYY') as mes",
    );
    return rows[0]!.mes;
  });
}

async function operacaoComPlacas(): Promise<{ id: string; nome: string }> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string; nome: string }>(
      `select o.id, o.nome from nucleo.operacao o
        where o.excluido_em is null
          and exists (select 1 from nucleo.placa_na_operacao p where p.operacao_id = o.id and p.excluido_em is null)
        order by o.nome limit 1`,
    );
    if (rows.length === 0) throw new Error("Sem operação com placas: rode `pnpm demo:carregar`.");
    return rows[0]!;
  });
}

const aba = (page: Page, nome: string) => page.getByRole("tab", { name: nome, exact: true });

test.describe("Operações: padrão de telas (Administrador)", () => {
  test("lista, olho, ficha e as oito abas", async ({ page }) => {
    const operacao = await operacaoComPlacas();
    const mesFechado = await mesFechadoDoBanco();

    // ---- A lista abre no mês fechado mais recente, com 20 por página ----
    await page.goto("/operacoes/lista");
    await expect(page.getByRole("heading", { level: 1, name: "Operações" })).toBeVisible();
    const mes = page.getByRole("navigation", { name: "Mês do resultado" });
    await expect(mes.locator('a[aria-current="page"]')).toHaveText(mesFechado);
    await expect(page.getByRole("list", { name: "Indicadores" })).toBeVisible();
    const tabela = page.getByRole("table", { name: "Operações do mês" });
    await expect(tabela).toBeVisible();
    expect(await tabela.getByRole("row").count()).toBeLessThanOrEqual(21);

    // ---- O olho é o último botão da linha: abre o painel, Esc fecha e devolve o foco ----
    const linha = tabela.getByRole("row").filter({ hasText: operacao.nome }).first();
    const olho = linha.getByRole("button", { name: `Ver detalhes de ${operacao.nome}` });
    await expect(olho).toBeVisible();
    await olho.click();
    const painel = page.getByRole("dialog", { name: `Detalhes de ${operacao.nome}` });
    await expect(painel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(painel).toBeHidden();
    await expect(olho).toBeFocused();

    // ---- A ficha: chips de mês e o acumulado; as oito abas ----
    await page.goto(`/operacoes/lista/${operacao.id}`);
    await expect(page.getByRole("heading", { level: 1, name: operacao.nome })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Mês do resultado" }).locator('a[aria-current="page"]'),
    ).toHaveText(mesFechado);
    await expect(page.getByRole("navigation", { name: "Acumulado" })).toContainText(
      "Últimos 12 meses",
    );
    for (const nome of ABAS) {
      await aba(page, nome).click();
      await expect(aba(page, nome)).toHaveAttribute("aria-selected", "true");
    }

    // O acumulado vai para a URL e destaca o chip.
    await page.getByRole("link", { name: "Últimos 12 meses" }).click();
    await expect(page).toHaveURL(/acum=12m/);
    await expect(
      page.getByRole("navigation", { name: "Acumulado" }).locator('a[aria-current="page"]'),
    ).toHaveText("Últimos 12 meses");

    // Documentos diz o que falta; Mapa não promete posição ao vivo.
    await aba(page, "Documentos").click();
    await expect(page.getByText("Sem dados ainda: depende do módulo de documentos")).toBeVisible();
    await aba(page, "Mapa").click();
    await expect(page.getByText("não há telemetria")).toBeVisible();

    // Placas: o olho de uma placa abre o painel, Esc fecha e o foco volta.
    await aba(page, "Placas").click();
    const placas = page.getByRole("table", { name: "Placas vinculadas agora" });
    const olhoDaPlaca = placas.getByRole("button", { name: /^Ver detalhes de / }).first();
    await olhoDaPlaca.click();
    await expect(page.getByRole("dialog", { name: /^Detalhes de / })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /^Detalhes de / })).toBeHidden();
    await expect(olhoDaPlaca).toBeFocused();

    // Mapa mental: o gráfico da árvore está na tela.
    await aba(page, "Mapa mental").click();
    await expect(page.getByRole("img", { name: /^Mapa mental da operação/ })).toBeVisible();
  });

  test("sem receita nem custo no staging, a tela diz 'Sem dados ainda' e não mostra R$ 0,00", async ({
    page,
  }) => {
    const operacao = await operacaoComPlacas();
    const temDado = await comBanco(async (banco) => {
      const { rows } = await banco.query<{ n: string }>(
        "select count(*)::text as n from staging.viagem",
      );
      return Number(rows[0]!.n) > 0;
    });
    test.skip(
      temDado,
      "O staging tem viagens: este teste vale para o banco sem a ponte do Sankhya.",
    );
    await page.goto(`/operacoes/lista/${operacao.id}`);
    await expect(page.getByRole("list", { name: "Indicadores" })).toContainText("Sem dados ainda");
    await expect(page.getByRole("list", { name: "Indicadores" })).not.toContainText("R$ 0,00");
  });
});
