import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Topo } from "./topo";

const HOJE = "2026-10-29";

function topo(props: Partial<Parameters<typeof Topo>[0]> = {}) {
  return renderToStaticMarkup(
    <Topo hoje={HOJE} perfil="Administrador" rota="/frota/placas" {...props} />,
  );
}

describe("<Topo>: contexto global", () => {
  it("mostra período, filial, operação e regime, com nome acessível", () => {
    const html = topo();
    for (const rotulo of ["Período", "Filial", "Operação", "Regime"]) {
      expect(html, rotulo).toContain(rotulo);
    }
    expect(html).toContain('aria-label="Contexto global"');
  });
  it("o período padrão é o mês de hoje, e o regime é Gerencial", () => {
    const html = topo();
    expect(html).toMatch(/type="month"[^>]*value="2026-10"|value="2026-10"[^>]*type="month"/);
    expect(html).toMatch(
      /<option[^>]*value="gerencial"[^>]*selected|<option[^>]*selected[^>]*value="gerencial"/,
    );
    expect(html).toContain("Gerencial");
    expect(html).toContain("Todas as filiais");
    expect(html).toContain("Todas as operações");
  });
  it("o período da URL vale mais que o de hoje", () => {
    const html = topo({ parametros: new URLSearchParams("periodo=2026-09") });
    expect(html).toMatch(/value="2026-09"/);
    expect(html).not.toMatch(/type="month"[^>]*value="2026-10"/);
  });
  it("período inválido na URL volta ao mês de hoje", () => {
    expect(topo({ parametros: new URLSearchParams("periodo=2026-13") })).toMatch(/value="2026-10"/);
  });
});

describe("<Topo>: trilha e tema", () => {
  it("a trilha mostra Módulo e Tela, com o módulo clicável e a tela atual marcada", () => {
    const html = topo();
    expect(html).toContain('aria-label="Trilha"');
    expect(html).toContain('href="/frota/acompanhamento"');
    expect(html).toContain("Frota");
    expect(html).toMatch(/aria-current="page"[^>]*>Placas|Placas<\/[^>]*>/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
  it("com ?modo=mapa a trilha ganha o modo, e a tela vira link", () => {
    const html = topo({
      rota: "/frota/acompanhamento",
      parametros: new URLSearchParams("modo=mapa"),
    });
    expect(html).toContain("Mapa");
    expect(html).toContain('href="/frota/acompanhamento"');
  });
  it("a busca rápida (Ctrl+K) fica no topo", () => {
    const html = topo();
    expect(html).toContain('aria-keyshortcuts="Control+K"');
    expect(html).toContain("Buscar");
  });
  it("o botão de tema fica no topo", () => {
    expect(topo()).toContain("Alternar tema");
  });
  it("rota fora do catálogo não quebra o topo", () => {
    const html = topo({ rota: "/nada" });
    expect(html).toContain("Período");
  });
  it("não leva cor escrita à mão", () => {
    expect(topo()).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
