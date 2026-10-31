import { expect, test, type Page } from "@playwright/test";
import { deixarLento } from "./apoio-lentidao";

// "Mais filtros" e "Visões salvas" não podem pular enquanto a lista chega: a caixa de cada botão
// (posição e tamanho) é a mesma do primeiro desenho até a tabela carregada. Mede quadro a quadro,
// com rede e CPU lentas. REPETIR=30 repete 30 vezes seguidas (padrão: 1).

const ROTA = "/frota/placas";
const REPETICOES = Number(process.env.REPETIR ?? "1");
const CPU = Number(process.env.CPU_LENTA ?? "6");
const REDE_MS = Number(process.env.REDE_MS ?? "300");

type Caixa = [number, number, number, number];
type Amostra = {
  t: number;
  botoes: Record<string, Caixa | null>;
  carregada: boolean;
  detalhe: string;
};

async function comecarAMedir(page: Page) {
  await page.addInitScript(() => {
    const amostras: unknown[] = [];
    (window as unknown as { __amostras: unknown[] }).__amostras = amostras;
    const nomes: Record<string, RegExp> = {
      "Mais filtros": /^Mais filtros/,
      "Visões salvas": /^Visões salvas/,
    };
    const busca = () => document.querySelector('input[type="search"]');
    const medir = () => {
      const botoes: Record<string, number[] | null> = {};
      for (const [nome, padrao] of Object.entries(nomes)) {
        const achado = [...document.querySelectorAll("button")].find((b) =>
          padrao.test((b.getAttribute("aria-label") ?? b.textContent ?? "").trim()),
        );
        const r = achado?.getBoundingClientRect();
        botoes[nome] = r ? [r.x, r.y, r.width, r.height] : null;
      }
      const quantos = [...document.querySelectorAll("button")].filter((b) =>
        /^Mais filtros/.test((b.getAttribute("aria-label") ?? b.textContent ?? "").trim()),
      );
      botoes["Cópias de Mais filtros"] = [quantos.length, 0, 0, 0];
      const detalhe = quantos
        .map((b) => {
          const r = b.getBoundingClientRect();
          let oculto = "visível";
          for (let e: Element | null = b; e; e = e.parentElement) {
            if (e.hasAttribute("hidden") || getComputedStyle(e).display === "none") {
              oculto = `oculto em ${e.tagName}#${e.id}`;
              break;
            }
          }
          const pai = b.parentElement?.getBoundingClientRect();
          const irmaos = [...(b.parentElement?.children ?? [])]
            .map((c) => {
              const q = c.getBoundingClientRect();
              return `${c.tagName.toLowerCase()}(${(c.getAttribute("class") ?? "").slice(0, 40)}|${(c.innerHTML ?? "").slice(0, 60)})@${Math.round(q.x)}+${Math.round(q.width)}y${Math.round(q.y)}`;
            })
            .join(";");
          return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} ${oculto} pai ${Math.round(pai?.x ?? -1)},${Math.round(pai?.width ?? -1)} [${irmaos}] estilo-pai ${b.parentElement ? getComputedStyle(b.parentElement).flexWrap : ""}`;
        })
        .join(" | ");
      const campo = busca()?.getBoundingClientRect();
      botoes["Busca"] = campo ? [campo.x, campo.y, campo.width, campo.height] : null;
      amostras.push({
        t: performance.now(),
        botoes,
        carregada: document.querySelector('table[aria-label="Placas"]') !== null,
        detalhe,
      });
      requestAnimationFrame(medir);
    };
    requestAnimationFrame(medir);
  });
}

const amostrasDe = (page: Page) =>
  page.evaluate(() => (window as unknown as { __amostras: Amostra[] }).__amostras);

/**
 * `extras`: larguras de janela a mais (nos pontos de quebra do topo), medidas só no projeto que
 * as pede (`projeto`), para a reserva do topo não acertar só nos tamanhos de referência.
 */
export function testesDoMaisFiltrosSemPular(
  extras: { projeto: string; larguras: readonly number[] } = { projeto: "", larguras: [] },
) {
  for (let n = 1; n <= REPETICOES; n++) {
    const sufixo = REPETICOES > 1 ? ` (${n}/${REPETICOES})` : "";
    const larguras: (number | null)[] = [null, ...extras.larguras];
    for (const largura of larguras) {
      test(`Mais filtros e Visões salvas não pulam do esqueleto à tabela${largura ? ` em ${largura} px` : ""}, com CPU ${CPU}x e rede lenta${sufixo}`, async ({
        page,
      }, info) => {
        test.skip(
          largura !== null && info.project.name !== extras.projeto,
          "largura extra só no projeto que a pede",
        );
        if (largura) await page.setViewportSize({ width: largura, height: 800 });
        await deixarLento(page, { cpu: CPU, redeMs: REDE_MS });
        await comecarAMedir(page);
        await page.goto(`${ROTA}?lento=2500`, { waitUntil: "commit" });
        await page.waitForSelector('table[aria-label="Placas"]', { timeout: 60_000 });
        await page.waitForTimeout(500);
        const amostras = await amostrasDe(page);
        const sequenciaDe = (nome: string) =>
          amostras
            .map((a) => a.botoes[nome])
            .filter((c): c is Caixa => c !== null && c !== undefined)
            .map((c) => c.map((n) => Math.round(n)).join(","))
            .filter((c, i, todas) => i === 0 || c !== todas[i - 1])
            .join(" → ");
        const saltou = amostras.findIndex((q, i) => {
          const x = q.botoes["Mais filtros"]?.[0];
          const antes = amostras[i - 1]?.botoes["Mais filtros"]?.[0];
          return x !== undefined && antes !== undefined && i > 0 && Math.abs(x - antes) > 1;
        });
        const emTorno =
          saltou < 0
            ? ""
            : amostras
                .slice(Math.max(0, saltou - 2), saltou + 2)
                .map((q) => `[${Math.round(q.t)} ms: ${q.detalhe}]`)
                .join(" ");
        const vizinhos = ["Visões salvas", "Busca", "Cópias de Mais filtros"]
          .map((n) => `${n}: ${sequenciaDe(n)}`)
          .join(" | ");
        for (const nome of ["Mais filtros", "Visões salvas"]) {
          const caixas = amostras
            .map((a) => a.botoes[nome])
            .filter((c): c is Caixa => c !== null && c !== undefined);
          expect(caixas.length, `${nome}: apareceu em algum quadro`).toBeGreaterThan(0);
          const [x0, y0, l0, a0] = caixas[caixas.length - 1] as Caixa; // a caixa final, já carregada
          const piores = caixas.reduce(
            (p, [x, y, l, a]) => ({
              x: Math.max(p.x, Math.abs(x - x0)),
              y: Math.max(p.y, Math.abs(y - y0)),
              largura: Math.max(p.largura, Math.abs(l - l0)),
              altura: Math.max(p.altura, Math.abs(a - a0)),
            }),
            { x: 0, y: 0, largura: 0, altura: 0 },
          );
          // As caixas distintas, na ordem em que apareceram, para o relatório mostrar o que pulou.
          const sequencia = caixas
            .map((c) => c.map((n) => Math.round(n)).join(","))
            .filter((c, i, todas) => i === 0 || c !== todas[i - 1])
            .join(" → ");
          for (const [campo, valor] of Object.entries(piores)) {
            expect(
              valor,
              `${nome}: ${campo} mudou ${Math.round(valor * 10) / 10} px entre quadros (x,y,largura,altura: ${sequencia}; ${vizinhos}; quadros do salto: ${emTorno})`,
            ).toBeLessThanOrEqual(1);
          }
        }
      });
    }
  }
}
