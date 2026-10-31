import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarraDeConsulta, type ChipDeConsulta } from "./barra-de-consulta";

// Os dois grupos de filtro da lista (Situação e Tipo de ativo) têm de parecer filtros diferentes à
// vista rápida: cada um na sua caixa, com título, subtítulo e barra colorida na lateral; Situação em
// pílulas com a bolinha da régua, Tipo em retângulos sem bolinha; seleção diferente em cada um.

const APRESENTACAO = {
  situacao: {
    titulo: "Situação",
    subtitulo: "como a placa está agora",
    forma: "pilula",
    destaque: "acao",
  },
  tipo: {
    titulo: "Tipo de ativo",
    subtitulo: "o que é a placa",
    forma: "retangulo",
    destaque: "escuro",
  },
} as const;

const CHIPS: ChipDeConsulta[] = [
  {
    id: "em-atividade",
    nome: "Em atividade",
    contagem: 80,
    grupo: "situacao",
    tom: "em-atividade",
  },
  { id: "atencao", nome: "Atenção", contagem: 37, grupo: "situacao", tom: "atencao" },
  { id: "cavalo", nome: "Cavalo", contagem: 55, grupo: "tipo" },
  { id: "apoio", nome: "Apoio", contagem: 30, grupo: "tipo" },
];

const com = (consulta = "", extras: string[] = []) =>
  renderToStaticMarkup(
    <BarraDeConsulta
      rotulo="Buscar placa"
      chips={CHIPS}
      apresentacaoDosGrupos={APRESENTACAO}
      filtrosExtras={extras}
      parametros={new URLSearchParams(consulta)}
    />,
  );
const grupo = (html: string, nome: string) =>
  new RegExp(`<div[^>]*role="group"[^>]*aria-label="${nome}"[^>]*>[\\s\\S]*?</div></div>`).exec(
    html,
  )?.[0] ?? "";
/** Só a tag de abertura do botão (a forma e a seleção estão nela; o contador interno tem o seu próprio arredondamento). */
const abertura = (html: string, nome: string) =>
  /^<button[^>]*>/.exec(botao(html, nome))?.[0] ?? "";
const botao = (html: string, nome: string) =>
  new RegExp(
    `<button[^>]*>(?:(?!</button>)[\\s\\S])*${nome}(?:(?!</button>)[\\s\\S])*</button>`,
  ).exec(html)?.[0] ?? "";

describe("grupos de filtro rápido: duas caixas, dois nomes, duas aparências", () => {
  it("cada grupo tem nome acessível próprio, com título e subtítulo", () => {
    const html = com();
    expect(html).toContain('aria-label="Situação, como a placa está agora"');
    expect(html).toContain('aria-label="Tipo de ativo, o que é a placa"');
    expect(html).toMatch(/<span[^>]*>Situação<\/span>/);
    expect(html).toMatch(/<span[^>]*>como a placa está agora<\/span>/);
    expect(html).toMatch(/<span[^>]*>Tipo de ativo<\/span>/);
    expect(html).toMatch(/<span[^>]*>o que é a placa<\/span>/);
  });

  it("os nomes dos dois grupos são diferentes entre si", () => {
    const nomes = [...com().matchAll(/role="group"[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);
    const dosGrupos = nomes.filter((n) => n !== "Filtros rápidos");
    expect(dosGrupos).toHaveLength(2);
    expect(new Set(dosGrupos).size).toBe(2);
  });

  it("cada grupo é uma caixa, com a barra colorida na lateral (uma de cada cor)", () => {
    const html = com();
    expect(grupo(html, "Situação, como a placa está agora")).toMatch(
      /class="[^"]*rounded-xl[^"]*border/,
    );
    expect(html).toMatch(/data-barra="acao"/);
    expect(html).toMatch(/data-barra="escuro"/);
    expect(html.indexOf('data-barra="acao"')).toBeLessThan(html.indexOf('data-barra="escuro"'));
  });

  it("Situação é de pílulas com a bolinha da régua; Tipo é de retângulos de canto leve, sem bolinha", () => {
    const html = com();
    const situacao = grupo(html, "Situação, como a placa está agora");
    const tipo = grupo(html, "Tipo de ativo, o que é a placa");
    expect(abertura(situacao, "Em atividade")).toMatch(/class="[^"]*rounded-full/);
    expect(botao(situacao, "Em atividade")).toContain("data-bolinha");
    expect(abertura(tipo, "Cavalo")).toMatch(/class="[^"]*rounded-md/);
    expect(abertura(tipo, "Cavalo")).not.toMatch(/class="[^"]*rounded-full/);
    expect(botao(tipo, "Cavalo")).not.toContain("data-bolinha");
  });

  it("a bolinha usa a cor do status pelo token (nunca uma cor escrita à mão)", () => {
    const html = com();
    expect(botao(html, "Em atividade")).toContain("--status-em-atividade");
    expect(botao(html, "Atenção")).toContain("--status-atencao");
  });

  it("selecionado: Situação com fundo azul claro e borda azul; Tipo com fundo escuro e texto claro", () => {
    const situacao = botao(com("chip=em-atividade"), "Em atividade");
    expect(situacao).toContain('aria-pressed="true"');
    expect(situacao).toContain("bg-[var(--acao-suave)]");
    expect(situacao).toContain("border-[var(--acao)]");
    const tipo = botao(com("chip=cavalo"), "Cavalo");
    expect(tipo).toContain('aria-pressed="true"');
    expect(tipo).toMatch(/class="[^"]*\bbg-foreground\b/);
    expect(tipo).toMatch(/class="[^"]*\btext-background\b/);
  });

  it("os dois estilos de seleção são diferentes entre si", () => {
    const situacao = botao(com("chip=em-atividade"), "Em atividade");
    const tipo = botao(com("chip=cavalo"), "Cavalo");
    expect(situacao).not.toContain("bg-foreground");
    expect(tipo).not.toContain("--acao-suave");
  });

  it("não selecionado, os chips ficam na superfície, sem o estilo de seleção", () => {
    const html = com();
    for (const nome of ["Em atividade", "Atenção", "Cavalo", "Apoio"]) {
      expect(botao(html, nome), nome).toContain('aria-pressed="false"');
      expect(botao(html, nome), nome).not.toContain("--acao-suave");
      expect(botao(html, nome), nome).not.toMatch(/\bbg-foreground\b/);
    }
  });

  it("só tokens do sistema visual: nenhuma cor escrita à mão no desenho dos grupos", () => {
    const html = com("chip=em-atividade&chip=cavalo");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/rgba?\(|hsla?\(|oklch\(/);
  });

  it("o título é de frase normal, nunca em maiúsculas", () => {
    const html = com();
    expect(html).not.toMatch(/uppercase/);
  });

  it("a contagem de cada chip continua visível dentro do botão", () => {
    const html = com();
    expect(botao(html, "Em atividade")).toContain('data-contagem="em-atividade"');
    expect(botao(html, "Cavalo")).toContain('data-contagem="cavalo"');
  });

  it("as caixas ficam sempre empilhadas; em tela larga o título vai à esquerda e os chips à direita, na mesma linha", () => {
    const html = com();
    const area =
      /aria-label="Filtros rápidos"[^>]*class="([^"]*)"|class="([^"]*)"[^>]*aria-label="Filtros rápidos"/.exec(
        html,
      );
    const classes = area?.[1] ?? area?.[2] ?? "";
    expect(classes).toMatch(/flex-col/);
    expect(classes).not.toMatch(/(?:sm|md|lg|xl):flex-row/);
    const caixa = grupo(html, "Situação, como a placa está agora");
    expect(caixa).toMatch(/class="[^"]*lg:flex-row/);
    expect(caixa).toMatch(/class="[^"]*lg:items-center/);
  });

  it("os chips das caixas são de 28 px (h-7), para a tabela não perder linhas no 1366×768", () => {
    const html = com();
    for (const nome of ["Em atividade", "Cavalo"])
      expect(abertura(html, nome), nome).toMatch(/class="[^"]*h-7/);
  });

  it("grupos sem apresentação continuam como antes (o rótulo simples)", () => {
    const html = renderToStaticMarkup(
      <BarraDeConsulta
        rotulo="Buscar"
        chips={[{ id: "a", nome: "Primeiro", contagem: 1, grupo: "Outro" }]}
        parametros={new URLSearchParams()}
      />,
    );
    expect(html).toContain('aria-label="Outro"');
    expect(html).not.toContain("data-barra");
  });
});

describe("botões fixos da barra: a largura do texto é reservada", () => {
  it("Visões salvas reserva 103 px: o grupo alinhado à direita não empurra o Mais filtros quando o texto chega depois", () => {
    const html = com();
    const botao =
      /<button[^>]*>(?:(?!<\/button>)[\s\S])*Visões salvas(?:(?!<\/button>)[\s\S])*<\/button>/.exec(
        html,
      )?.[0] ?? "";
    expect(botao).toContain("min-w-[6.4375rem]");
  });

  it("o grupo de ações reserva a largura dos dois botões (220 px) e alinha os botões à esquerda do espaço reservado: nada anda se o HTML parte antes do segundo botão", () => {
    const html = com();
    const grupo = /<div class="([^"]*ml-auto[^"]*)"/.exec(html)?.[1] ?? "";
    expect(grupo).toContain("min-w-[13.75rem]");
    expect(grupo).toContain("justify-start");
    expect(grupo).not.toContain("justify-end");
  });

  it("o Mais filtros provisório da barra (sem o botão de verdade) reserva os mesmos 109 px", () => {
    const html = com();
    const botao =
      /<button[^>]*>(?:(?!<\/button>)[\s\S])*Mais filtros(?:(?!<\/button>)[\s\S])*<\/button>/.exec(
        html,
      )?.[0] ?? "";
    expect(botao).toContain("min-w-[6.8125rem]");
  });
});

describe("contador de filtros ativos, ao lado da busca", () => {
  const contador = (html: string) =>
    /<p[^>]*role="status"[^>]*data-filtros-ativos[^>]*>([^<]*)<\/p>|<p[^>]*data-filtros-ativos[^>]*role="status"[^>]*>([^<]*)<\/p>/.exec(
      html,
    );

  it("sem filtro nenhum, não aparece", () => {
    expect(com()).not.toContain("data-filtros-ativos");
  });

  it("a região de status fica sempre montada (vazia sem filtros), para o primeiro filtro ser anunciado", () => {
    expect(com()).toMatch(/<p[^>]*role="status"[^>]*><\/p>/);
  });

  it("um filtro: '1 filtro ativo' (singular)", () => {
    const c = contador(com("chip=cavalo"));
    expect((c?.[1] ?? c?.[2] ?? "").trim()).toBe("1 filtro ativo");
  });

  it("vários: chips, busca e filtros de 'Mais filtros' contam cada um", () => {
    const c = contador(
      com("chip=cavalo&chip=em-atividade&q=abc&sigla=P%C3%81T&baixadas=1", ["sigla", "baixadas"]),
    );
    expect((c?.[1] ?? c?.[2] ?? "").trim()).toBe("5 filtros ativos");
  });

  it("fica logo depois do campo de busca e antes das ações", () => {
    const html = com("chip=cavalo");
    const busca = html.indexOf('type="search"');
    const marca = html.indexOf("data-filtros-ativos");
    const mais = html.indexOf("Mais filtros");
    expect(busca).toBeGreaterThan(-1);
    expect(busca).toBeLessThan(marca);
    expect(marca).toBeLessThan(mais);
  });

  it("é um aviso educado para o leitor de tela (status), sem interromper", () => {
    expect(com("chip=cavalo")).toMatch(
      /role="status"[^>]*data-filtros-ativos|data-filtros-ativos[^>]*role="status"/,
    );
  });
});
