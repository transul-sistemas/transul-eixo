import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { montarGrupos } from "@/lib/navegacao/busca-rapida";
import { BuscaRapida, ConteudoDaBusca } from "./busca-rapida";

const SEM_CONTEXTO = { fixados: [], recentes: [] };
const nada = () => {};

function conteudo(termo: string, props: Partial<Parameters<typeof ConteudoDaBusca>[0]> = {}) {
  return renderToStaticMarkup(
    <ConteudoDaBusca
      termo={termo}
      grupos={montarGrupos(termo, "Administrador", SEM_CONTEXTO)}
      ativo={0}
      idDaLista="lista"
      aoMudarTermo={nada}
      aoTeclar={nada}
      aoEscolher={nada}
      aoPassar={nada}
      {...props}
    />,
  );
}

describe("<ConteudoDaBusca>: campo e lista", () => {
  const html = conteudo("placa");

  it("o campo é um combobox ligado à lista, com a opção ativa indicada", () => {
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-controls="lista"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).toContain('aria-activedescendant="lista-opcao-0"');
    expect(html).toContain('aria-label="Buscar tela, modo ou ação"');
    expect(html).toContain('value="placa"');
  });
  it("a lista tem grupos com nome, e as opções têm id e estado de seleção", () => {
    expect(html).toContain('role="listbox"');
    expect(html).toContain('id="lista"');
    expect(html).toContain('role="group" aria-label="Telas"');
    expect(html).toContain('role="group" aria-label="Ações"');
    expect(html).toContain('id="lista-opcao-0"');
    expect(html.match(/role="option"/g)?.length).toBe(6); // a tela e as cinco ações que combinam
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/aria-selected="false"/g)).toHaveLength(5);
  });
  it("cada opção mostra o caminho Módulo › Tela", () => {
    expect(html).toContain("Frota › Placas");
    expect(html).toContain("Frota › Receber placa");
  });
  it("tela pronta da Fase 1 não leva etiqueta Estrutura nem Em breve", () => {
    const html = conteudo("livro do acionista");
    expect(html).not.toContain("Estrutura");
    expect(html).not.toContain("Em breve");
  });
  it("a ação pronta aparece habilitada e sem a etiqueta Em breve", () => {
    expect(html).toContain("Frota › Cadastrar placa");
    expect(html).not.toContain("Em breve");
    expect(html).not.toContain('aria-disabled="true"');
  });
  it("a opção ativa muda com o índice", () => {
    const outra = conteudo("placa", { ativo: 1 });
    expect(outra).toContain('aria-activedescendant="lista-opcao-1"');
  });
  it("as teclas que a janela entende estão à vista", () => {
    expect(html).toContain("Enter");
    expect(html).toContain("Esc");
  });
  it("não leva cor escrita à mão", () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("<ConteudoDaBusca>: sem resultado e sem termo", () => {
  it("termo sem resultado diz o que fazer, e a lista fica sem opções", () => {
    const html = conteudo("zzzz");
    expect(html).toContain("Nenhuma tela encontrada. Tente outro nome.");
    expect(html).not.toContain('role="option"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("aria-activedescendant");
  });
  it("sem termo e sem fixados nem recentes, convida a digitar", () => {
    const html = conteudo("");
    expect(html).toContain("Digite o nome de uma tela, de um modo ou de uma ação.");
    expect(html).not.toContain("Nenhuma tela encontrada");
  });
  it("sem termo, mostra os fixados e os recentes", () => {
    const grupos = montarGrupos("", "Administrador", {
      fixados: ["frota.carteira"],
      recentes: ["frota.placas"],
    });
    const html = conteudo("", { grupos });
    expect(html).toContain('aria-label="Fixados"');
    expect(html).toContain('aria-label="Recentes"');
    expect(html).toContain("Frota › Carteira");
    expect(html).toContain("Frota › Placas");
  });
  it("o aviso da ação reservada aparece como mensagem de estado", () => {
    const html = conteudo("placa", { aviso: "Esta ação chega com os assistentes (entrega 2D)." });
    expect(html).toMatch(
      /role="status"[^>]*>[^<]*Esta ação chega com os assistentes \(entrega 2D\)\./,
    );
  });
});

describe("<BuscaRapida>: fechada", () => {
  const fechada = renderToStaticMarkup(
    <BuscaRapida perfil="Administrador" usuario="teste" rota="/frota/placas" />,
  );

  it("mostra só o botão Buscar, com o atalho Ctrl+K à vista", () => {
    expect(fechada).toContain("Buscar");
    expect(fechada).toContain('aria-keyshortcuts="Control+K"');
    expect(fechada).toContain("Ctrl+K");
  });
  it("não desenha a janela enquanto não é aberta", () => {
    expect(fechada).not.toContain('role="dialog"');
    expect(fechada).not.toContain('role="combobox"');
  });
});
