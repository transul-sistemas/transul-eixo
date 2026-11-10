import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { comBanco } from "../e2e/apoio/usuarios-de-teste";

// A galeria de Operações (padrão de telas, 10/11/2026): capturas em 1366, claro e escuro, da lista e
// de cada aba da ficha, em capturas/galeria/ (fora do Git). Só roda com EIXO_GALERIA=1. Mede também o
// tempo de abertura da lista e da ficha (meta: abaixo de 1,5 s com a demonstração). SÓ LEITURA.

const PASTA = "capturas/galeria";
const ABAS = [
  ["resumo", "Resumo"],
  ["placas", "Placas"],
  ["pessoas", "Pessoas"],
  ["resultado", "Resultado"],
  ["linha-do-tempo", "Linha do tempo"],
  ["documentos", "Documentos"],
  ["mapa", "Mapa"],
  ["mapa-mental", "Mapa mental"],
] as const;

test.skip(!process.env.EIXO_GALERIA, "Só com EIXO_GALERIA=1.");

for (const esquema of ["light", "dark"] as const) {
  test(`galeria de Operações, tema ${esquema}`, async ({ page }) => {
    mkdirSync(PASTA, { recursive: true });
    const operacao = await comBanco(async (banco) => {
      const { rows } = await banco.query<{ id: string }>(
        `select o.id from nucleo.operacao o
          where o.excluido_em is null
            and exists (select 1 from nucleo.placa_na_operacao p where p.operacao_id = o.id and p.excluido_em is null)
          order by o.nome limit 1`,
      );
      return rows[0]!.id;
    });
    await page.emulateMedia({ colorScheme: esquema });
    // Aquece as rotas (a primeira compilação do next dev não vale como medida).
    await page.goto("/operacoes/lista");
    await page.goto(`/operacoes/lista/${operacao}`);

    let t = Date.now();
    await page.goto("/operacoes/lista");
    await expect(page.getByRole("table", { name: "Operações do mês" })).toBeVisible();
    console.log(`TEMPO lista ${esquema}: ${Date.now() - t} ms`);
    await page.screenshot({ path: `${PASTA}/operacoes-lista-${esquema}.png`, fullPage: true });

    t = Date.now();
    await page.goto(`/operacoes/lista/${operacao}`);
    await expect(page.getByRole("tab", { name: "Resumo" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Indicadores" })).toBeVisible();
    console.log(`TEMPO ficha ${esquema}: ${Date.now() - t} ms`);
    for (const [id, nome] of ABAS) {
      await page.getByRole("tab", { name: nome, exact: true }).click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `${PASTA}/operacoes-ficha-${id}-${esquema}.png`,
        fullPage: true,
      });
    }
  });
}
