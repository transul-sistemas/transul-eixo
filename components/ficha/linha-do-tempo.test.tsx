import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { segmentosDaLinhaDoTempo } from "@/lib/dominio/linha-do-tempo";
import { LinhaDoTempo } from "./linha-do-tempo";

const AGORA = "2026-10-30T12:00";
const JANELA = { de: "2026-10-01T00:00", ate: AGORA };

const segmentos = segmentosDaLinhaDoTempo(
  [
    { sigla: "PÁT", em: "2026-10-03T07:30" },
    { sigla: "DOp", em: "2026-10-12T10:00" },
    { sigla: "ACe", em: "2026-10-12T10:05" }, // a DOp fica com 5 minutos: faixa estreita de propósito
    { sigla: "ETc", em: "2026-10-20T08:00" },
  ],
  JANELA,
  AGORA,
);
const html = renderToStaticMarkup(
  <LinhaDoTempo segmentos={segmentos} de={JANELA.de} ate={JANELA.ate} nome="AAA0A00" />,
);
const texto = (m: string) =>
  m
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("<LinhaDoTempo>", () => {
  it("é uma figura com nome que resume as faixas para o leitor de tela", () => {
    expect(html).toMatch(/role="img"/);
    const rotulo = /aria-label="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(rotulo).toContain("Linha do tempo de AAA0A00");
    expect(rotulo).toContain("01/10/2026");
    expect(rotulo).toContain("30/10/2026");
    expect(rotulo).toContain("PÁT");
    expect(rotulo).toContain("Em trânsito carregado");
    expect(rotulo).toContain("sem registro");
  });

  it("cada faixa pesa pelos minutos e guarda o grupo da régua", () => {
    const faixas = [...html.matchAll(/<div[^>]*data-faixa[^>]*>/g)].map((m) => m[0]);
    expect(faixas).toHaveLength(segmentos.length);
    segmentos.forEach((s, i) => {
      expect(faixas[i]).toContain(`flex:${s.minutos} 1 0%`);
      expect(faixas[i]).toContain(`data-grupo="${s.grupo ?? "sem-registro"}"`);
    });
  });

  it("usa só tokens: cor suave do status e linha forte, nunca hex nem cor sólida de fundo", () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).toContain("--status-patio");
    expect(html).toContain("--status-em-atividade-suave");
    expect(html).toContain("--status-em-atividade)");
  });

  it("a sigla aparece escrita nas faixas largas, e não nas estreitas", () => {
    const faixaEstreita =
      [
        ...html.matchAll(/<div[^>]*data-faixa[^>]*data-sigla="DOp"[^>]*>[\s\S]*?<\/div>/g),
      ][0]?.[0] ?? "";
    expect(faixaEstreita).not.toBe("");
    expect(texto(faixaEstreita)).not.toContain("DOp");
    const faixaDaETc =
      [
        ...html.matchAll(/<div[^>]*data-faixa[^>]*data-sigla="ETc"[^>]*>[\s\S]*?<\/div>/g),
      ][0]?.[0] ?? "";
    expect(texto(faixaDaETc)).toContain("ETc");
  });

  it("a informação não depende só da cor: há legenda com a sigla e o nome de cada situação", () => {
    const legenda = /<ul[^>]*data-legenda[^>]*>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "";
    for (const nome of [
      "Pátio",
      "Disponível no Operacional",
      "Aguardando carregamento",
      "Em trânsito carregado",
    ]) {
      expect(texto(legenda)).toContain(nome);
    }
    expect(texto(legenda)).toContain("Sem registro");
  });

  it("mostra as duas pontas da janela com a data em dd/mm/aaaa", () => {
    expect(texto(html)).toContain("01/10/2026");
    expect(texto(html)).toContain("30/10/2026");
  });

  it("sem faixas, diz que não há registro no período", () => {
    const vazio = renderToStaticMarkup(
      <LinhaDoTempo segmentos={[]} de={JANELA.de} ate={JANELA.ate} nome="AAA0A00" />,
    );
    expect(texto(vazio)).toContain("Sem registro no período");
    expect(vazio).not.toContain("data-faixa");
  });
});
