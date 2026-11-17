import { expect, type Page, test } from "@playwright/test";
import { sessaoDe } from "./apoio/usuarios-de-teste";

// Galeria da Fase 1 (13/11/2026): cada tela e assistente do catálogo, a 1366, claro e escuro, como o
// Administrador. Só no CI do pull request (EIXO_CAPTURAS=1), no artefato "capturas-do-acesso", com o
// prefixo "tela-". Alexandre revisa pela galeria sem abrir o servidor.

const TELAS: readonly { readonly nome: string; readonly rota: string }[] = [
  // Nível 1
  { nome: "n1-meu-dia", rota: "/inicio/meu-dia" },
  { nome: "n1-tarefas", rota: "/inicio/tarefas" },
  { nome: "n1-acompanhamento-conjuntos", rota: "/frota/acompanhamento" },
  { nome: "n1-acompanhamento-soltas", rota: "/frota/acompanhamento?modo=soltas" },
  { nome: "n1-carteira", rota: "/frota/carteira" },
  { nome: "n1-confirmar-carteira", rota: "/frota/carteira?assistente=confirmar-carteira" },
  { nome: "n1-excecoes", rota: "/frota/excecoes" },
  { nome: "n1-placas", rota: "/frota/placas" },
  { nome: "n1-saude-do-cr", rota: "/cadastros/saude-do-cr" },
  { nome: "n1-operacoes", rota: "/operacoes/lista" },
  // Nível 2
  { nome: "n2-operacoes-comparativo", rota: "/operacoes/comparativo" },
  { nome: "n2-operacoes-analise", rota: "/operacoes/analise" },
  { nome: "n2-resultados-visao-geral", rota: "/resultados/visao-geral" },
  { nome: "n2-resultados-por-operacao", rota: "/resultados/por-operacao" },
  { nome: "n2-resultados-maturacao", rota: "/resultados/maturacao" },
  { nome: "n2-resultados-fechamentos", rota: "/resultados/fechamentos" },
  { nome: "n2-resultados-ajustes", rota: "/resultados/ajustes" },
  { nome: "n2-operacional-patio", rota: "/operacional/patio" },
  { nome: "n2-operacional-ordens", rota: "/operacional/ordens-de-carregamento" },
  { nome: "n2-operacional-totem", rota: "/operacional/totem" },
  { nome: "n2-operacional-analise", rota: "/operacional/analise" },
  { nome: "n2-pessoas-lista", rota: "/pessoas/lista" },
  { nome: "n2-pessoas-escala", rota: "/pessoas/escala" },
  { nome: "n2-pessoas-status-diario", rota: "/pessoas/status-diario" },
  { nome: "n2-pessoas-documentos", rota: "/pessoas/documentos" },
  { nome: "n2-pessoas-diarias", rota: "/pessoas/diarias-e-premiacao" },
  { nome: "n2-pessoas-campanhas", rota: "/pessoas/campanhas" },
  { nome: "n2-pessoas-analise", rota: "/pessoas/analise" },
  { nome: "n2-abastecimento", rota: "/frota/abastecimento" },
  // Nível 3
  { nome: "n3-resumo-do-dia", rota: "/inicio/resumo-do-dia" },
  { nome: "n3-mapa-do-sistema", rota: "/inicio/mapa-do-sistema" },
  { nome: "n3-auditoria", rota: "/admin/auditoria" },
  { nome: "n3-usuarios-e-perfis", rota: "/admin/usuarios-e-perfis" },
  { nome: "n3-cadastros-catalogos", rota: "/cadastros/catalogos" },
  { nome: "n3-parceiros", rota: "/parceiros/lista" },
  { nome: "n3-conciliacao", rota: "/parceiros/conciliacao" },
  { nome: "n3-livro-do-acionista", rota: "/parceiros/livro-do-acionista" },
  { nome: "n3-locacao", rota: "/parceiros/locacao" },
];

const TEMAS = [
  { nome: "claro", esquema: "light" },
  { nome: "escuro", esquema: "dark" },
] as const;

test.use({ storageState: sessaoDe("administrador") });

async function capturar(page: Page, nome: string) {
  for (const tema of TEMAS) {
    await page.emulateMedia({ colorScheme: tema.esquema });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `capturas/tela-1366-${tema.nome}-${nome}.png` });
  }
}

for (const tela of TELAS) {
  test(`captura ${tela.nome}`, async ({ page }, info) => {
    test.skip(info.project.name !== "capturas-1366", "a galeria é só a 1366");
    await page.goto(tela.rota);
    await expect(page.locator("main").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await capturar(page, tela.nome);
  });
}
