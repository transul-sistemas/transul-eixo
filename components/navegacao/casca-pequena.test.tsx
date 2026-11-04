import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AreaPrincipal } from "./area-principal";
import { AvisoDeDispositivo } from "./aviso-de-dispositivo";
import { BarraLateral } from "./barra-lateral";
import { Topo } from "./topo";

const barra = (props: Partial<Parameters<typeof BarraLateral>[0]> = {}) =>
  renderToStaticMarkup(
    <BarraLateral perfil="Administrador" usuario="teste" rotaAtual="/inicio/tarefas" {...props} />,
  );
const topo = (props: Partial<Parameters<typeof Topo>[0]> = {}) =>
  renderToStaticMarkup(
    <Topo
      hoje="2026-10-29"
      perfil="Administrador"
      usuario="teste"
      rota="/frota/placas"
      {...props}
    />,
  );

describe("<BarraLateral>: gaveta (abaixo de 1024 px)", () => {
  it("o menu tem um id fixo, para o botão Abrir menu apontar para ele, e começa fechado", () => {
    const html = barra();
    expect(html).toContain('id="menu-principal"');
    expect(html).toContain('data-gaveta="fechada"');
  });
  it("traz o botão Fechar menu, que só aparece em tela pequena", () => {
    const html = barra();
    expect(html).toContain('aria-label="Fechar menu"');
    expect(html).toMatch(/aria-label="Fechar menu"[^>]*class="[^"]*lg:hidden/);
  });
  it("a cópia da página de demonstração não é gaveta", () => {
    const html = barra({ incorporada: true });
    expect(html).not.toContain('aria-label="Fechar menu"');
    expect(html).not.toContain("data-gaveta");
    expect(html).not.toContain('id="menu-principal"');
  });
  it("o botão de recolher (modo compacto) não aparece na gaveta, só no computador", () => {
    expect(barra()).toMatch(
      /<div class="[^"]*max-lg:hidden[^"]*"><button[^>]*aria-label="Recolher menu"/,
    );
    expect(barra({ incorporada: true })).not.toContain("max-lg:hidden");
  });
  it("fechada, a gaveta sai da ordem do teclado em tela pequena", () => {
    expect(barra()).toContain("max-lg:invisible");
  });
});

describe("<Topo>: botões de tela pequena", () => {
  it("tem Abrir menu, ligado ao menu, que só aparece abaixo de 1024 px", () => {
    const html = topo();
    expect(html).toMatch(
      /<button[^>]*aria-label="Abrir menu"[^>]*aria-controls="menu-principal"|<button[^>]*aria-controls="menu-principal"[^>]*aria-label="Abrir menu"/,
    );
    expect(html).toMatch(
      /aria-expanded="false"[^>]*aria-label="Abrir menu"|aria-label="Abrir menu"[^>]*aria-expanded="false"/,
    );
    expect(html).toMatch(
      /aria-label="Abrir menu"[^>]*class="[^"]*lg:hidden|class="[^"]*lg:hidden[^"]*"[^>]*aria-label="Abrir menu"/,
    );
  });
  it("o contexto global fica recolhido atrás de um botão Contexto", () => {
    const html = topo();
    expect(html).toContain("Contexto");
    expect(html).toMatch(/<button[^>]*aria-controls="contexto-global"/);
    expect(html).toMatch(
      /id="contexto-global"[^>]*class="[^"]*hidden lg:flex|class="[^"]*hidden lg:flex[^"]*"[^>]*id="contexto-global"/,
    );
  });
  it("a ordem do HTML é a ordem visual: Contexto, seus itens, busca e tema, sem reordenar por CSS", () => {
    const html = topo();
    expect(html).not.toContain("order-last");
    const posicao = (trecho: string) => html.indexOf(trecho);
    expect(posicao('aria-controls="contexto-global"')).toBeLessThan(
      posicao('id="contexto-global"'),
    );
    expect(posicao('id="contexto-global"')).toBeLessThan(posicao("Buscar"));
    expect(posicao("Buscar")).toBeLessThan(posicao("Alternar tema"));
  });
  it("o botão Contexto também some a partir de 1024 px", () => {
    expect(topo()).toMatch(
      /aria-controls="contexto-global"[^>]*class="[^"]*lg:hidden|class="[^"]*lg:hidden[^"]*"[^>]*aria-controls="contexto-global"/,
    );
  });
  it("continua com o contexto, a busca e o tema (só o jeito de mostrar muda)", () => {
    const html = topo();
    for (const rotulo of ["Período", "Filial", "Operação", "Regime", "Buscar", "Alternar tema"]) {
      expect(html, rotulo).toContain(rotulo);
    }
  });
});

describe("<AvisoDeDispositivo>", () => {
  it("tela sem versão de celular mostra o aviso, só em tela de celular", () => {
    const html = renderToStaticMarkup(<AvisoDeDispositivo rota="/pessoas/escala" />);
    expect(html).toContain("Esta tela funciona melhor em um computador.");
    expect(html).toContain('role="note"');
    expect(html).toMatch(/class="[^"]*md:hidden/);
  });
  it("tela de celular não mostra aviso", () => {
    expect(renderToStaticMarkup(<AvisoDeDispositivo rota="/operacional/patio" />)).toBe("");
  });
  it("rota fora do catálogo não mostra aviso", () => {
    expect(renderToStaticMarkup(<AvisoDeDispositivo rota="/nada" />)).toBe("");
  });
});

describe("<AreaPrincipal>", () => {
  it("mostra o conteúdo e, com a gaveta fechada, não o deixa inerte", () => {
    const html = renderToStaticMarkup(
      <AreaPrincipal>
        <p>CONTEUDO</p>
      </AreaPrincipal>,
    );
    expect(html).toContain("CONTEUDO");
    expect(html).not.toContain("inert");
  });
});
