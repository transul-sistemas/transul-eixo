import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ABAS_DA_FICHA } from "@/lib/navegacao/ficha";
import { AbasDaFicha } from "./abas-da-ficha";

const conteudos = Object.fromEntries(
  ABAS_DA_FICHA.map((a) => [a.id, <p key={a.id}>conteúdo de {a.nome}</p>]),
) as Record<(typeof ABAS_DA_FICHA)[number]["id"], React.ReactNode>;

const com = (ativa: (typeof ABAS_DA_FICHA)[number]["id"]) =>
  renderToStaticMarkup(
    <AbasDaFicha abas={ABAS_DA_FICHA} ativa={ativa} aoMudar={() => {}} conteudos={conteudos} />,
  );
const tab = (html: string, nome: string) =>
  new RegExp(`<button[^>]*role="tab"[^>]*>(?:(?!</button>)[\\s\\S])*${nome}`).exec(html)?.[0] ?? "";

describe("<AbasDaFicha>: o padrão ARIA de abas", () => {
  it("tem uma lista de abas com nome e seis abas, na ordem fixa", () => {
    const html = com("resumo");
    expect(html).toMatch(/role="tablist"[^>]*aria-label="Seções da ficha"/);
    const nomes = [...html.matchAll(/role="tab"[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
      m[1]!.replace(/<[^>]*>/g, "").trim(),
    );
    expect(nomes).toEqual([
      "Resumo",
      "Linha do tempo",
      "Documentos",
      "Resultado",
      "Mapa",
      "Mapa mental",
    ]);
  });

  it("só a aba ativa está selecionada e entra no Tab (roving tabindex)", () => {
    const html = com("documentos");
    const abas = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
    expect(abas.filter((a) => a.includes('aria-selected="true"'))).toHaveLength(1);
    expect(abas.filter((a) => a.includes('tabindex="0"'))).toHaveLength(1);
    expect(abas.filter((a) => a.includes('tabindex="-1"'))).toHaveLength(5);
    expect(tab(html, "Documentos")).toContain('aria-selected="true"');
    expect(tab(html, "Documentos")).toContain('tabindex="0"');
  });

  it("cada aba aponta para o seu painel e o painel aponta de volta", () => {
    const html = com("resumo");
    for (const aba of ABAS_DA_FICHA) {
      expect(html).toMatch(
        new RegExp(
          `id="aba-${aba.id}"[^>]*aria-controls="painel-${aba.id}"|aria-controls="painel-${aba.id}"[^>]*id="aba-${aba.id}"`,
        ),
      );
      expect(html).toMatch(
        new RegExp(
          `id="painel-${aba.id}"[^>]*aria-labelledby="aba-${aba.id}"|aria-labelledby="aba-${aba.id}"[^>]*id="painel-${aba.id}"`,
        ),
      );
    }
    expect([...html.matchAll(/role="tabpanel"/g)]).toHaveLength(6);
  });

  it("só o painel ativo aparece; os outros ficam ocultos (o conteúdo existe, a troca é instantânea)", () => {
    const html = com("linha-do-tempo");
    const painel = (id: string) =>
      new RegExp(`<div[^>]*id="painel-${id}"[^>]*>`).exec(html)?.[0] ?? "";
    expect(painel("linha-do-tempo")).not.toContain("hidden");
    for (const id of ["resumo", "documentos", "resultado", "mapa", "mapa-mental"]) {
      expect(painel(id), id).toContain("hidden");
    }
    expect(html).toContain("conteúdo de Resumo");
  });

  it("o painel é focável quando não tem nada focável dentro (tabindex 0)", () => {
    expect(com("resumo")).toMatch(/<div[^>]*id="painel-resumo"[^>]*tabindex="0"/);
  });

  it("os botões são type=button, com alvo de pelo menos 24 px e foco visível", () => {
    const abas = [...com("resumo").matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
    for (const a of abas) {
      expect(a).toContain('type="button"');
      expect(a).toMatch(/min-h-(?:6|8|9|10|11)/);
      expect(a).toContain("focus-visible:");
    }
  });

  it("as abas rolam dentro da própria faixa, sem rolagem lateral da página (390 px)", () => {
    expect(com("resumo")).toMatch(/role="tablist"[^>]*class="[^"]*overflow-x-auto/);
  });
});
