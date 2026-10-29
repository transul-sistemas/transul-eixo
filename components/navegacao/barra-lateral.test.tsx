import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarraLateral } from "./barra-lateral";

const contar = (html: string, trecho: string) => html.split(trecho).length - 1;

function barra(props: Partial<Parameters<typeof BarraLateral>[0]> = {}) {
  return renderToStaticMarkup(
    <BarraLateral perfil="Administrador" usuario="teste" rotaAtual="/inicio/tarefas" {...props} />,
  );
}

describe("<BarraLateral>: grupos", () => {
  it("o Administrador vê os 9 módulos, cada um num grupo recolhível", () => {
    const html = barra();
    expect(contar(html, "aria-expanded=")).toBe(9);
    for (const nome of [
      "Início",
      "Frota",
      "Operacional",
      "Operações",
      "Pessoas",
      "Parceiros",
      "Resultados",
      "Cadastros",
      "Administração",
    ]) {
      expect(html, nome).toContain(nome);
    }
  });
  it("só o grupo da tela atual começa aberto, com a tela marcada como atual", () => {
    const html = barra({ rotaAtual: "/frota/placas" });
    expect(contar(html, 'aria-expanded="true"')).toBe(1);
    expect(contar(html, 'aria-current="page"')).toBe(1);
    expect(html).toContain('href="/frota/placas"');
    expect(html).toContain("Acompanhamento");
  });
  it("grupo fechado não mostra as telas", () => {
    const html = barra({ rotaAtual: "/frota/placas" });
    expect(html).not.toContain('href="/pessoas/escala"');
  });
  it("tela em breve leva a etiqueta Em breve; a pronta não", () => {
    const html = barra({ rotaAtual: "/admin/demonstracao" });
    expect(contar(html, "Em breve")).toBe(2);
  });
  it("quem não vê nenhuma tela recebe um aviso, não uma barra vazia", () => {
    const html = barra({ perfil: "Gestor de frota", rotaAtual: "/" });
    expect(html).toContain("Nenhuma tela disponível para o seu perfil.");
    expect(html).not.toContain("aria-expanded=");
  });
  it("o menu tem nome acessível, e o da demonstração é outro", () => {
    expect(barra()).toContain('aria-label="Menu principal"');
    expect(barra({ rotulo: "Menu de demonstração" })).toContain(
      'aria-label="Menu de demonstração"',
    );
  });
});

describe("<BarraLateral>: contadores", () => {
  const contadores = { "frota.placas": 3, "frota.carteira": 2, "pessoas.status-diario": 120 };

  it("o contador da tela sobe, somado, para o grupo do módulo", () => {
    const html = barra({ contadores, rotaAtual: "/frota/placas" });
    expect(html).toMatch(/data-contador="frota"[^>]*>5</);
    expect(html).toMatch(/data-contador="frota\.placas"[^>]*>3</);
    expect(html).toMatch(/data-contador="frota\.carteira"[^>]*>2</);
  });
  it("passou de 99 mostra 99+, e o leitor de tela recebe o número inteiro", () => {
    const html = barra({ contadores });
    expect(html).toMatch(/data-contador="pessoas"[^>]*>99\+</);
    expect(html).toContain('aria-label="120 itens"');
  });
  it("sem contador não aparece nada, nem zero", () => {
    expect(barra()).not.toContain("data-contador");
    expect(barra({ contadores: { "frota.placas": 0 } })).not.toContain("data-contador");
  });
});

describe("<BarraLateral>: fixados", () => {
  it("sem fixados não há a seção", () => {
    expect(barra()).not.toContain('aria-label="Fixados"');
  });
  it("tela fixada aparece na seção Fixados, mesmo com o grupo fechado", () => {
    const html = barra({ estadoInicial: { fixados: ["frota.placas"] } });
    expect(html).toContain('aria-label="Fixados"');
    expect(html).toContain('href="/frota/placas"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Fixar Placas"');
  });
  it("fixado que saiu do catálogo ou que o perfil não vê não aparece", () => {
    expect(barra({ estadoInicial: { fixados: ["frota.sumiu"] } })).not.toContain(
      'aria-label="Fixados"',
    );
    expect(
      barra({ perfil: "Gestor de frota", estadoInicial: { fixados: ["frota.placas"] } }),
    ).not.toContain('href="/frota/placas"');
  });
});

describe("<BarraLateral>: modo compacto", () => {
  it("só ícones: cada módulo é um link para o módulo, e a busca some", () => {
    const html = barra({ estadoInicial: { compacta: true } });
    expect(html).toContain('data-compacta="true"');
    expect(html).toContain('aria-label="Frota"');
    expect(html).toContain('href="/frota/acompanhamento"');
    expect(html).not.toContain('type="search"');
    expect(html).not.toContain("aria-expanded=");
  });
  it("o botão de recolher diz o que faz e qual é o atalho", () => {
    const aberta = barra();
    expect(aberta).toContain('aria-label="Recolher menu"');
    expect(aberta).toContain('aria-keyshortcuts="Control+B"');
    expect(aberta).toContain('data-compacta="false"');
    expect(barra({ estadoInicial: { compacta: true } })).toContain('aria-label="Expandir menu"');
  });
  it("expandida tem o campo Buscar no menu", () => {
    const html = barra();
    expect(html).toContain('type="search"');
    expect(html).toContain('aria-label="Buscar no menu"');
  });
});

describe("<BarraLateral>: cor", () => {
  it("usa variáveis de cor e nunca hexadecimal escrito à mão", () => {
    expect(barra({ rotaAtual: "/frota/placas" })).not.toContain("#");
    expect(barra({ estadoInicial: { compacta: true } })).not.toContain("#");
  });
});

describe("<BarraLateral>: incorporada (página de demonstração)", () => {
  it("se marca como demonstração, para não ser confundida com a barra do sistema", () => {
    const html = barra({ incorporada: true });
    expect(html).toContain('data-barra="demonstracao"');
    expect(barra()).toContain('data-barra="principal"');
  });
});
