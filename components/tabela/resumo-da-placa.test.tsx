import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obterPlaca } from "@/lib/dados/placas";
import type { DetalheDaPlaca } from "@/lib/dados/placas-tipos";
import { SIGLAS_DE_BAIXA } from "@/lib/dominio/status";
import { placasDeExemplo } from "@/lib/exemplo/placas";
import {
  BotaoDaFicha,
  ErroDoResumo,
  PlacaNaoEncontrada,
  ResumoCarregando,
  ResumoDaPlaca,
  SecoesDoResumo,
} from "./resumo-da-placa";

const HOJE = "2026-10-29";
const TODAS = placasDeExemplo(HOJE);

beforeEach(() => vi.stubEnv("EIXO_DADOS", "exemplo"));
afterEach(() => vi.unstubAllEnvs());

async function detalhe(placa: string): Promise<DetalheDaPlaca> {
  const achado = await obterPlaca(placa, HOJE);
  if (!achado) throw new Error(`a placa de exemplo ${placa} não existe`);
  return achado;
}

const html = (d: DetalheDaPlaca) =>
  renderToStaticMarkup(<ResumoDaPlaca detalhe={d} aoEspiar={() => {}} />);
const texto = (marcacao: string) =>
  marcacao
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Os pares da lista de definição, `Rótulo -> valor`, em texto puro. */
function campos(marcacao: string): Record<string, string> {
  const pares: Record<string, string> = {};
  for (const [, rotulo, valor] of marcacao.matchAll(
    /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g,
  )) {
    pares[texto(rotulo!)] = texto(valor!);
  }
  return pares;
}

const titulos = (marcacao: string) =>
  [...marcacao.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)].map(([, nivel, conteudo]) => [
    Number(nivel),
    texto(conteudo!),
  ]);

describe("<ResumoDaPlaca>: as seções, na ordem", () => {
  it("só usa títulos de terceiro nível (o painel é o segundo), na ordem do resumo", async () => {
    expect(titulos(html(await detalhe("AAA0A00")))).toEqual([
      [3, "Situação"],
      [3, "Conjunto"],
      [3, "Gestão"],
      [3, "Alertas"],
      [3, "Dados"],
    ]);
  });

  it("o cabeçalho traz o modelo, o tipo e o ano (a mini placa grande fica no título do painel)", async () => {
    const d = await detalhe("AAA0A00");
    const marcacao = html(d);
    expect(texto(marcacao)).toContain(d.modelo);
    expect(texto(marcacao)).toContain("Cavalo");
    if (d.ano !== null) expect(texto(marcacao)).toContain(String(d.ano));
  });
});

describe("<ResumoDaPlaca>: os casos feios", () => {
  it("AAA0A04 (modelo a definir): o alerta aparece por extenso", async () => {
    const marcacao = html(await detalhe("AAA0A04"));
    expect(texto(marcacao)).toContain("A DEFINIR");
    expect(texto(marcacao)).toContain("Modelo a definir");
    expect(texto(marcacao)).toContain("DOp");
  });

  it("AAA0A10 (dois CRs vigentes): mostra os dois e o aviso", async () => {
    const marcacao = html(await detalhe("AAA0A10"));
    const t = texto(marcacao);
    expect(t).toContain("CR-1001");
    expect(t).toContain("CR-1002");
    expect(t).toContain("Dois CRs vigentes ao mesmo tempo");
  });

  it("AAA0A14 (CRs em sequência): mostra só o vigente, não o histórico", async () => {
    const c = campos(html(await detalhe("AAA0A14")));
    expect(c["CR vigente"]).toContain("CR-1002");
    expect(c["CR vigente"]).not.toContain("CR-1001");
  });

  it("AAA0A22 (em trânsito sem motorista): o motorista é traço e o alerta aparece", async () => {
    const marcacao = html(await detalhe("AAA0A22"));
    expect(campos(marcacao)["Motorista"]).toBe("—");
    expect(texto(marcacao)).toContain("Cavalo em atividade sem motorista");
  });

  it("AAA0A24 (CRLV vencido): a data vem em dd/mm/aaaa, marcada como vencida, com o alerta", async () => {
    const d = await detalhe("AAA0A24");
    const marcacao = html(d);
    const [ano, mes, dia] = d.crlvVenceEm!.split("-");
    expect(campos(marcacao)["CRLV vence em"]).toBe(`${dia}/${mes}/${ano} (vencido)`);
    expect(texto(marcacao)).toContain("Documento (CRLV) vencido");
  });

  it("AAA0A28 (sem operação, sem CR, sem CRLV): tudo vazio é traço", async () => {
    const c = campos(html(await detalhe("AAA0A28")));
    expect(c["Operação"]).toBe("—");
    expect(c["CR vigente"]).toBe("—");
    expect(c["CRLV vence em"]).toBe("—");
  });

  it("AAA0C17 (implemento solto há 35 dias): sem conjunto, há 35 dias e o alerta", async () => {
    const marcacao = html(await detalhe("AAA0C17"));
    const t = texto(marcacao);
    expect(t).toContain("Sem conjunto");
    expect(t).toContain("há 35 dias");
    expect(t).toContain("Implemento solto há mais de 30 dias");
  });

  it("placa baixada (VND ou SUC) também abre o resumo", async () => {
    const baixada = TODAS.find((p) => SIGLAS_DE_BAIXA.includes(p.sigla))!;
    const marcacao = html(await detalhe(baixada.placa));
    expect(texto(marcacao)).toContain(baixada.sigla);
    expect(texto(marcacao)).toContain(baixada.modelo);
  });

  it("placa sem alertas diz que não há", async () => {
    const limpa = TODAS.find(
      (p) => !["AAA0A04", "AAA0A10", "AAA0A22", "AAA0A24", "AAA0C17"].includes(p.placa),
    );
    const d = await detalhe(limpa!.placa);
    const alertas = d.alertas.length;
    const t = texto(html(d));
    if (alertas === 0) expect(t).toContain("Sem alertas");
    else for (const a of d.alertas) expect(t).toContain(a.texto);
  });
});

describe("<ResumoDaPlaca>: formatos e valores", () => {
  it("situação com sigla, nome por extenso, dias e a data com a hora", async () => {
    const d = await detalhe("AAA0A00");
    const t = texto(html(d));
    expect(t).toContain(d.sigla);
    expect(t).toContain(d.nomeDaSituacao);
    expect(t).toMatch(/há \d+ dias?|hoje/);
    expect(t).toMatch(/desde \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
  });

  it("KM sem casas, FIPE com centavos e RENAVAM", async () => {
    const comValores = TODAS.find((p) => p.km !== null && p.valorFipeCentavos !== null)!;
    const d = await detalhe(comValores.placa);
    const c = campos(html(d));
    expect(c["KM"]).toMatch(/^\d{1,3}(\.\d{3})* km$/);
    expect(c["Valor FIPE"]).toMatch(/^R\$ \d{1,3}(\.\d{3})*,\d{2}$/);
    expect(c["RENAVAM"]).toBe(d.renavam);
  });

  it("valores vazios viram traço, nunca 'null' nem 'undefined'", async () => {
    for (const p of TODAS) {
      const t = texto(html(await detalhe(p.placa)));
      expect(t, p.placa).not.toMatch(/null|undefined|NaN/);
    }
  });

  it("nenhuma data aparece em formato de máquina (aaaa-mm-dd)", async () => {
    for (const placa of ["AAA0A00", "AAA0A24", "AAA0C17"]) {
      expect(texto(html(await detalhe(placa)))).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });
});

describe("<ResumoDaPlaca>: o conjunto", () => {
  it("cada placa do conjunto é um botão 'Espiar AAA0B45' que troca o painel", async () => {
    const cavalo = TODAS.find((p) => p.tipo === "cavalo" && p.conjunto.implementoIds.length > 0)!;
    const d = await detalhe(cavalo.placa);
    const marcacao = html(d);
    for (const placa of d.conjunto.implementos) {
      expect(marcacao).toMatch(
        new RegExp(
          `<button[^>]*type="button"[^>]*aria-label="Espiar ${placa}"|<button[^>]*aria-label="Espiar ${placa}"[^>]*type="button"`,
        ),
      );
    }
  });

  it("o implemento aponta para o cavalo", async () => {
    const implemento = TODAS.find((p) => p.tipo === "implemento" && p.conjunto.cavaloId !== null)!;
    const d = await detalhe(implemento.placa);
    expect(d.conjunto.cavalo).not.toBeNull();
    expect(html(d)).toContain(`aria-label="Espiar ${d.conjunto.cavalo}"`);
  });

  it("os botões do conjunto têm alvo de pelo menos 24 px", async () => {
    const cavalo = TODAS.find((p) => p.tipo === "cavalo" && p.conjunto.implementoIds.length > 0)!;
    const marcacao = html(await detalhe(cavalo.placa));
    expect(marcacao).toMatch(/<button[^>]*class="[^"]*min-h-6/);
  });
});

describe("Abrir ficha completa", () => {
  it("é um link para a ficha da placa, com o texto do botão e sem dica de 'em breve'", () => {
    const marcacao = renderToStaticMarkup(<BotaoDaFicha placa="AAA0A00" />);
    expect(marcacao).toMatch(/<a[^>]*href="\/frota\/placas\/AAA0A00"/);
    expect(marcacao).toContain("Abrir ficha completa");
    expect(marcacao).not.toContain("aria-disabled");
    expect(marcacao).not.toContain("Entra na próxima entrega");
  });
  it("tem alvo de pelo menos 24 px e ocupa a largura do rodapé", () => {
    const marcacao = renderToStaticMarkup(<BotaoDaFicha placa="AAA0A00" />);
    expect(marcacao).toMatch(/class="[^"]*min-h-(?:8|9|10)/);
    expect(marcacao).toMatch(/class="[^"]*w-full/);
  });
});

describe("<SecoesDoResumo> na ficha: as placas do conjunto levam à ficha delas", () => {
  it("com hrefDaPlaca, cada placa do conjunto é um link e não um botão", async () => {
    const cavalo = TODAS.find((p) => p.tipo === "cavalo" && p.conjunto.implementoIds.length > 0)!;
    const d = await detalhe(cavalo.placa);
    const marcacao = renderToStaticMarkup(
      <SecoesDoResumo detalhe={d} hrefDaPlaca={(p) => `/frota/placas/${p}`} />,
    );
    for (const placa of d.conjunto.implementos) {
      expect(marcacao).toMatch(
        new RegExp(
          `<a[^>]*href="/frota/placas/${placa}"[^>]*aria-label="Abrir ficha de ${placa}"|<a[^>]*aria-label="Abrir ficha de ${placa}"[^>]*href="/frota/placas/${placa}"`,
        ),
      );
    }
    expect(marcacao).not.toMatch(/<button[^>]*aria-label="Espiar /);
  });
  it("tem as mesmas cinco seções do resumo do painel, em grade quando pedido", async () => {
    const d = await detalhe("AAA0A00");
    const marcacao = renderToStaticMarkup(
      <SecoesDoResumo detalhe={d} hrefDaPlaca={(p) => `/frota/placas/${p}`} disposicao="grade" />,
    );
    expect(titulos(marcacao)).toEqual([
      [3, "Situação"],
      [3, "Conjunto"],
      [3, "Gestão"],
      [3, "Alertas"],
      [3, "Dados"],
    ]);
    expect(marcacao).toMatch(/lg:grid-cols-2/);
  });
  it("o resumo do painel continua igual: botões que trocam o painel", async () => {
    const cavalo = TODAS.find((p) => p.tipo === "cavalo" && p.conjunto.implementoIds.length > 0)!;
    const d = await detalhe(cavalo.placa);
    expect(html(d)).toContain(`aria-label="Espiar ${d.conjunto.implementos[0]}"`);
  });
});

describe("os outros estados do painel", () => {
  it("carregando: aviso para o leitor de tela e esqueleto, sem pulo", () => {
    const marcacao = renderToStaticMarkup(<ResumoCarregando />);
    expect(marcacao).toContain('role="status"');
    expect(texto(marcacao)).toContain("Carregando o resumo");
    expect(marcacao).toContain("animate-pulse");
  });

  it("placa não encontrada: diz o que houve e o que fazer", () => {
    const marcacao = renderToStaticMarkup(<PlacaNaoEncontrada placa="ZZZ9Z99" />);
    const t = texto(marcacao);
    expect(t).toContain("Placa não encontrada");
    expect(t).toContain("ZZZ9Z99");
    expect(t).toMatch(/Confira/);
    expect(t).not.toMatch(/desculp/i);
  });

  it("erro: diz o que houve, como resolver e oferece tentar de novo", () => {
    const marcacao = renderToStaticMarkup(<ErroDoResumo aoTentar={() => {}} pendente={false} />);
    const t = texto(marcacao);
    expect(marcacao).toContain('role="alert"');
    expect(t).toContain("Não foi possível carregar o resumo");
    expect(t).toContain("Tentar de novo");
    expect(t).not.toMatch(/desculp/i);
  });
});
