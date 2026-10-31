import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PassoDoAssistente } from "@/lib/wizard/passos";
import { PassosDoAssistente } from "./passos-do-assistente";
import { ResumoAoVivo, type SecaoDoResumo } from "./resumo-ao-vivo";

const PASSOS: PassoDoAssistente[] = [
  { id: "identificacao", titulo: "Identificação", campos: ["nome"] },
  { id: "veiculo", titulo: "Veículo", campos: ["modelo"] },
  { id: "valor", titulo: "Valor", campos: ["valor"] },
  { id: "posse", titulo: "Posse", campos: ["gestor"] },
  { id: "conferir", titulo: "Conferir", campos: [] },
];

const com = (atual: number, maisAlto = atual) =>
  renderToStaticMarkup(
    <PassosDoAssistente passos={PASSOS} atual={atual} maisAlto={maisAlto} aoIr={() => {}} />,
  );

describe("<PassosDoAssistente>: stepper horizontal, barra de progresso e versão compacta", () => {
  it("é uma lista ordenada com um item por passo, dentro de uma navegação nomeada", () => {
    const html = com(1);
    expect(html).toMatch(/<nav[^>]*aria-label="Passos do assistente"/);
    expect(html).toMatch(/<ol/);
    expect([...html.matchAll(/<li/g)]).toHaveLength(5);
    for (const p of PASSOS) expect(html).toContain(p.titulo);
  });

  it("só o passo atual tem aria-current='step'", () => {
    const html = com(2);
    expect([...html.matchAll(/aria-current="step"/g)]).toHaveLength(1);
    const atual = /<li[^>]*data-estado="atual"[^>]*>[\s\S]*?<\/li>/.exec(html)?.[0] ?? "";
    expect(atual).toContain('aria-current="step"');
    expect(atual).toContain("Valor");
  });

  it("marca os passos como concluído, atual e pendente", () => {
    const html = com(2);
    expect([...html.matchAll(/data-estado="concluido"/g)]).toHaveLength(2);
    expect([...html.matchAll(/data-estado="atual"/g)]).toHaveLength(1);
    expect([...html.matchAll(/data-estado="pendente"/g)]).toHaveLength(2);
  });

  it("passos já visitados são botões para voltar; os que ainda não foram alcançados ficam desligados com aria-disabled", () => {
    const html = com(1, 2);
    const botoes = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(botoes).toHaveLength(5);
    // visitados (0, 1, 2) clicáveis; 3 e 4 não alcançados
    expect(botoes.filter((b) => b.includes('aria-disabled="true"'))).toHaveLength(2);
    for (const b of botoes) expect(b).toContain('type="button"');
    expect(html).not.toMatch(/<button[^>]*\sdisabled(=|\s|>)/);
  });

  it("a barra de progresso diz o passo e o percentual", () => {
    const html = com(1);
    const barra = /<div[^>]*role="progressbar"[^>]*>/.exec(html)?.[0] ?? "";
    expect(barra).toContain('aria-valuemin="0"');
    expect(barra).toContain('aria-valuemax="100"');
    expect(barra).toContain('aria-valuenow="40"');
    expect(barra).toContain('aria-valuetext="Passo 2 de 5"');
    expect(barra).toContain("aria-label=");
    expect(com(4)).toContain('aria-valuenow="100"');
  });

  it("em tela estreita vira 'Passo N de M · título'", () => {
    const html = com(1);
    expect(html).toMatch(/<p[^>]*data-passo-compacto[^>]*>[\s\S]*Passo 2 de 5[\s\S]*Veículo/);
    // abaixo de 1024 px (tablet e celular) o stepper some; a partir daí o texto compacto some
    expect(html).toMatch(/<ol[^>]*class="[^"]*max-lg:hidden/);
    expect(html).toMatch(/<p[^>]*data-passo-compacto[^>]*class="[^"]*lg:hidden/);
  });

  it("o passo atual diz 'etapa atual' ao leitor de tela, sem depender da cor", () => {
    expect(com(1)).toMatch(/class="sr-only"[^>]*>[^<]*(atual|etapa)/i);
  });

  it("só tokens do sistema visual: nenhuma cor escrita à mão", () => {
    const html = com(2);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/style="[^"]*(?:rgb|hsl|oklch)\(/);
  });
});

const SECOES: SecaoDoResumo[] = [
  {
    titulo: "Identificação",
    linhas: [
      { rotulo: "Nome", valor: "Pneu 295/80" },
      { rotulo: "Categoria", valor: "" },
    ],
  },
  { titulo: "Valores", linhas: [{ rotulo: "Quantidade", valor: 4 }] },
];
const resumo = (secoes = SECOES) => renderToStaticMarkup(<ResumoAoVivo secoes={secoes} />);

describe("<ResumoAoVivo>: o que a pessoa já informou, à direita", () => {
  it("é uma região nomeada com um título e uma lista de definições por seção", () => {
    const html = resumo();
    expect(html).toMatch(/<aside[^>]*aria-label="Resumo"/);
    expect(html).toContain("Identificação");
    expect(html).toContain("Valores");
    expect([...html.matchAll(/<dl/g)]).toHaveLength(2);
    expect(html).toContain("Pneu 295/80");
  });
  it("campo ainda vazio aparece como traço e marcado como vazio", () => {
    const html = resumo();
    expect(html).toMatch(/data-vazio[^>]*>[^<]*—/);
    expect(html).toContain("Categoria");
  });
  it("valor numérico zero é um valor, não vazio", () => {
    const html = resumo([{ titulo: "Valores", linhas: [{ rotulo: "Quantidade", valor: 0 }] }]);
    expect(html).not.toContain("data-vazio");
  });
  it("sem nenhuma seção, convida a preencher", () => {
    expect(resumo([])).toMatch(/Preencha os campos/);
  });
  it("aceita um nó de React como valor (a moeda, por exemplo)", () => {
    const html = resumo([
      { titulo: "Valores", linhas: [{ rotulo: "Valor", valor: <span data-x="1">R$ 10,00</span> }] },
    ]);
    expect(html).toContain('data-x="1"');
  });
});
