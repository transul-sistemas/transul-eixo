import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import * as visibilidade from "@/lib/navegacao/visibilidade";
import { BarraLateral } from "./barra-lateral";

// Com o Operacional pronto, todo perfil do catálogo real vê alguma tela; o aviso de "nenhuma tela" é
// conferido com a lista de módulos visíveis vazia.
vi.mock("@/lib/navegacao/visibilidade", async (original) => {
  const m = await original<typeof import("@/lib/navegacao/visibilidade")>();
  return { ...m, modulosVisiveis: vi.fn(m.modulosVisiveis) };
});

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
  it("na ficha da placa, o grupo Frota abre e 'Placas' fica marcada como a seção atual", () => {
    const html = barra({ rotaAtual: "/frota/placas/AAA0A00" });
    expect(contar(html, 'aria-expanded="true"')).toBe(1);
    expect(html).toContain('href="/frota/placas"');
    expect(contar(html, 'aria-current="page"')).toBe(0); // a página é a ficha; Placas é a seção
    expect(html).toMatch(
      /aria-current="true"[^>]*href="\/frota\/placas"|href="\/frota\/placas"[^>]*aria-current="true"/,
    );
  });
  it("grupo fechado não mostra as telas", () => {
    const html = barra({ rotaAtual: "/frota/placas" });
    expect(html).not.toContain('href="/pessoas/escala"');
  });
  it("tela esqueleto leva o selo Estrutura, e nenhuma tela leva Em breve; a pronta não leva selo", () => {
    // No grupo Administração só a Auditoria é esqueleto (Usuários e perfis e Demonstração, prontas).
    const html = barra({ rotaAtual: "/admin/demonstracao" });
    expect(contar(html, "Estrutura")).toBe(1);
    expect(contar(html, "Em breve")).toBe(0);
  });
  it("quem não acompanha a obra não vê o selo Estrutura em lugar nenhum", () => {
    const html = barra({ perfil: "Gestor de frota", rotaAtual: "/frota/placas" });
    expect(contar(html, "Estrutura")).toBe(0);
  });
  it("quem não vê nenhuma tela recebe um aviso, não uma barra vazia", () => {
    vi.mocked(visibilidade.modulosVisiveis).mockReturnValueOnce([]);
    const html = barra({ perfil: "Operacional", rotaAtual: "/" });
    expect(html).toContain("Nenhuma tela disponível para o seu perfil.");
    expect(html).not.toContain("aria-expanded=");
  });
  it("o Operacional vê os grupos Operacional (Pátio, Totem e Ordens de carregamento) e Pessoas (só a Escala)", () => {
    const html = barra({ perfil: "Operacional", rotaAtual: "/operacional/patio" });
    expect(contar(html, "aria-expanded=")).toBe(3); // Início (só o Mapa), Operacional e Pessoas
    expect(html).toContain('href="/operacional/patio"');
    expect(html).toContain('href="/operacional/totem"');
    expect(html).toContain('href="/operacional/ordens-de-carregamento"');
    expect(html).not.toContain('href="/operacional/analise"');
    const naPessoas = barra({ perfil: "Operacional", rotaAtual: "/pessoas/escala" });
    expect(naPessoas).toContain('href="/pessoas/escala"');
    expect(naPessoas).not.toContain('href="/pessoas/lista"');
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
  it("um só item fala no singular", () => {
    expect(barra({ contadores: { "frota.carteira": 1 } })).toContain('aria-label="1 item"');
  });
  it("compacta, o nome do módulo continua só o nome; o número vai na descrição", () => {
    const html = barra({ contadores, estadoInicial: { compacta: true } });
    expect(html).toContain('aria-label="Frota"');
    expect(html).not.toContain("Frota, ");
    expect(html).toContain('aria-describedby="grupo-soma-frota"');
    expect(html).toMatch(/id="grupo-soma-frota"[^>]*>5 itens</);
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
      barra({ perfil: "Operacional", estadoInicial: { fixados: ["frota.placas"] } }),
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

// CI do PR #31 (04/11/2026): o Sair no topo fazia o topo quebrar linha no 1366 e no celular. O Sair
// fica no rodapé da barra lateral, visível também na gaveta (abaixo de 1024 px).
describe("<BarraLateral>: sair", () => {
  const sair = async () => {};
  it("com a ação de sair, o rodapé tem o botão Sair num formulário, também na gaveta", () => {
    const html = barra({ aoSair: sair });
    expect(html).toMatch(/<div data-rodape-sair=""[^>]*><form[^>]*>[\s\S]*?>Sair</);
    expect(html).not.toMatch(/data-rodape-sair=""[^>]*class="[^"]*max-lg:hidden/);
  });
  it("compacta, o Sair vira só ícone com nome acessível", () => {
    const html = barra({ aoSair: sair, estadoInicial: { compacta: true } });
    expect(html).toContain('aria-label="Sair"');
  });
  it("sem a ação (demonstração, testes), não há botão Sair", () => {
    expect(barra()).not.toContain(">Sair<");
    expect(barra()).not.toContain('aria-label="Sair"');
  });
});

// Fatia 3.9a: quem entrou aparece no rodapé (nome e e-mail), e a memória da barra é de cada pessoa.
describe("<BarraLateral>: quem entrou", () => {
  const sair = async () => {};
  const quem = { nome: "Ana Ribeiro", email: "ana@transul.com.br" };

  it("expandida, o rodapé mostra o nome e o e-mail acima do Sair", () => {
    const html = barra({ aoSair: sair, quem });
    expect(html).toMatch(
      /data-rodape-sair=""[\s\S]*Ana Ribeiro[\s\S]*ana@transul\.com\.br[\s\S]*>Sair</,
    );
  });
  it("compacta, o nome e o e-mail ficam no título do Sair", () => {
    const html = barra({ aoSair: sair, quem, estadoInicial: { compacta: true } });
    expect(html).toContain('title="Sair (Ana Ribeiro, ana@transul.com.br)"');
    expect(html).not.toContain(">Ana Ribeiro<");
  });
  it("a barra principal diz de quem é a memória (os testes de tela leem a chave)", () => {
    expect(barra({ usuario: "u-123" })).toContain('data-usuario="u-123"');
    expect(barra({ usuario: "u-123", incorporada: true })).not.toContain("data-usuario");
  });
});
