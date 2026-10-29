import { describe, expect, it } from "vitest";
import {
  alternarColuna,
  colunasVisiveis,
  type DefinicaoDeColuna,
  type EscolhaDeColunas,
  idsVisiveisNaTela,
  moverColuna,
  ordemCompleta,
  SEM_ESCOLHA_DE_COLUNAS,
} from "./colunas-da-tabela";

const DEFS: DefinicaoDeColuna[] = [
  { id: "placa", padrao: "sempre", fixa: true },
  { id: "tipo", padrao: "sempre" },
  { id: "modelo", padrao: "sempre" },
  { id: "conjunto", padrao: "largura" },
  { id: "gestor", padrao: "sempre" },
  { id: "km", padrao: "fora" },
  { id: "cr", padrao: "fora" },
];
const PADRAO = SEM_ESCOLHA_DE_COLUNAS;
const ids = (c: { id: string }[]) => c.map((x) => x.id);

describe("colunasVisiveis: o padrão da tela", () => {
  it("sem escolha: as de sempre e as de tela larga, na ordem das definições", () => {
    expect(ids(colunasVisiveis(DEFS, PADRAO))).toEqual([
      "placa",
      "tipo",
      "modelo",
      "conjunto",
      "gestor",
    ]);
  });
  it("as de tela larga só aparecem em tela larga (marcadas para o CSS esconder)", () => {
    const marcadas = colunasVisiveis(DEFS, PADRAO).filter((c) => c.soEmTelaLarga);
    expect(ids(marcadas)).toEqual(["conjunto"]);
  });
  it("as de fora (KM, CR) não aparecem sem escolha", () => {
    expect(ids(colunasVisiveis(DEFS, PADRAO))).not.toContain("km");
  });
});

describe("colunasVisiveis: a escolha da pessoa", () => {
  it("mostra exatamente as escolhidas, e a escolha vale em qualquer largura (não é só de tela larga)", () => {
    const visiveis = colunasVisiveis(DEFS, {
      colunas: ["placa", "conjunto", "km"],
      ordemDasColunas: null,
    });
    expect(ids(visiveis)).toEqual(["placa", "conjunto", "km"]);
    expect(visiveis.every((c) => !c.soEmTelaLarga)).toBe(true);
  });
  it("a coluna fixa (Placa) nunca some, mesmo que a escolha não a traga", () => {
    expect(ids(colunasVisiveis(DEFS, { colunas: ["tipo"], ordemDasColunas: null }))).toEqual([
      "placa",
      "tipo",
    ]);
  });
  it("aplica a ordem escolhida, mantendo a fixa sempre em primeiro", () => {
    const visiveis = colunasVisiveis(DEFS, {
      colunas: ["placa", "tipo", "modelo", "gestor"],
      ordemDasColunas: ["gestor", "modelo", "placa", "tipo"],
    });
    expect(ids(visiveis)).toEqual(["placa", "gestor", "modelo", "tipo"]);
  });
  it("coluna ausente da ordem vai para o fim, na ordem das definições; desconhecida é ignorada", () => {
    const completa = ordemCompleta(DEFS, {
      colunas: null,
      ordemDasColunas: ["xxx", "gestor", "tipo"],
    });
    expect(completa).toEqual(["placa", "gestor", "tipo", "modelo", "conjunto", "km", "cr"]);
  });
  it("a ordem vale também no padrão sem escolha de colunas", () => {
    const visiveis = colunasVisiveis(DEFS, { colunas: null, ordemDasColunas: ["gestor", "tipo"] });
    expect(ids(visiveis)).toEqual(["placa", "gestor", "tipo", "modelo", "conjunto"]);
  });
});

describe("idsVisiveisNaTela", () => {
  it("em tela estreita o padrão não traz as de tela larga; em larga traz", () => {
    expect(idsVisiveisNaTela(DEFS, PADRAO, false)).toEqual(["placa", "tipo", "modelo", "gestor"]);
    expect(idsVisiveisNaTela(DEFS, PADRAO, true)).toEqual([
      "placa",
      "tipo",
      "modelo",
      "conjunto",
      "gestor",
    ]);
  });
  it("com escolha, a largura da tela não muda nada", () => {
    const escolha = { colunas: ["placa", "conjunto"], ordemDasColunas: null };
    expect(idsVisiveisNaTela(DEFS, escolha, false)).toEqual(["placa", "conjunto"]);
    expect(idsVisiveisNaTela(DEFS, escolha, true)).toEqual(["placa", "conjunto"]);
  });
});

describe("alternarColuna", () => {
  it("ligar KM no padrão, em tela estreita, vira escolha explícita com o que a pessoa já via", () => {
    expect(alternarColuna(DEFS, PADRAO, "km", false).colunas).toEqual([
      "placa",
      "tipo",
      "modelo",
      "gestor",
      "km",
    ]);
  });
  it("em tela larga a escolha explícita inclui as de tela larga, para nada sumir", () => {
    expect(alternarColuna(DEFS, PADRAO, "km", true).colunas).toEqual([
      "placa",
      "tipo",
      "modelo",
      "conjunto",
      "gestor",
      "km",
    ]);
  });
  it("ligar Conjunto em tela estreita faz ele aparecer, e a escolha vale em qualquer largura", () => {
    const nova = alternarColuna(DEFS, PADRAO, "conjunto", false);
    expect(idsVisiveisNaTela(DEFS, nova, false)).toContain("conjunto");
  });
  it("desligar tira a coluna e mantém as outras", () => {
    const nova = alternarColuna(
      DEFS,
      { colunas: ["placa", "tipo", "gestor"], ordemDasColunas: null },
      "tipo",
      false,
    );
    expect(nova.colunas).toEqual(["placa", "gestor"]);
  });
  it("a coluna fixa não se desliga", () => {
    const antes = { colunas: ["placa", "tipo"], ordemDasColunas: null };
    expect(alternarColuna(DEFS, antes, "placa", false)).toEqual(antes);
  });
  it("coluna que não existe é ignorada", () => {
    expect(alternarColuna(DEFS, PADRAO, "xxx", false)).toEqual(PADRAO);
  });
  it("não mexe na ordem escolhida", () => {
    const nova = alternarColuna(DEFS, { colunas: null, ordemDasColunas: ["gestor"] }, "km", false);
    expect(nova.ordemDasColunas).toEqual(["gestor"]);
  });
});

describe("moverColuna", () => {
  const escolha: EscolhaDeColunas = {
    colunas: ["placa", "tipo", "modelo", "gestor"],
    ordemDasColunas: null,
  };
  it("para a esquerda troca com a vizinha visível", () => {
    const nova = moverColuna(DEFS, escolha, "modelo", -1, false);
    expect(ids(colunasVisiveis(DEFS, nova))).toEqual(["placa", "modelo", "tipo", "gestor"]);
  });
  it("para a direita troca com a vizinha visível, pulando as ocultas no meio", () => {
    // conjunto está entre modelo e gestor, mas oculto: modelo vai direto para depois de gestor
    const nova = moverColuna(DEFS, escolha, "modelo", 1, false);
    expect(ids(colunasVisiveis(DEFS, nova))).toEqual(["placa", "tipo", "gestor", "modelo"]);
  });
  it("a primeira movível não passa da fixa, e a última não passa do fim", () => {
    expect(moverColuna(DEFS, escolha, "tipo", -1, false)).toEqual(escolha);
    expect(moverColuna(DEFS, escolha, "gestor", 1, false)).toEqual(escolha);
  });
  it("a fixa não se move, e coluna oculta ou desconhecida também não", () => {
    expect(moverColuna(DEFS, escolha, "placa", 1, false)).toEqual(escolha);
    expect(moverColuna(DEFS, escolha, "km", -1, false)).toEqual(escolha);
    expect(moverColuna(DEFS, escolha, "xxx", -1, false)).toEqual(escolha);
  });
  it("grava a ordem completa e não mexe na escolha de colunas", () => {
    const nova = moverColuna(DEFS, escolha, "modelo", -1, false);
    expect(nova.colunas).toEqual(escolha.colunas);
    expect(nova.ordemDasColunas).toHaveLength(DEFS.length);
    expect(new Set(nova.ordemDasColunas)).toEqual(new Set(DEFS.map((d) => d.id)));
  });
  it("mover repetidas vezes nunca perde nem repete coluna", () => {
    let atual = escolha;
    for (let i = 0; i < 20; i++) {
      atual = moverColuna(
        DEFS,
        atual,
        i % 2 === 0 ? "tipo" : "gestor",
        i % 3 === 0 ? -1 : 1,
        false,
      );
      expect(new Set(ids(colunasVisiveis(DEFS, atual)))).toEqual(
        new Set(["placa", "tipo", "modelo", "gestor"]),
      );
      expect(colunasVisiveis(DEFS, atual)[0]?.id).toBe("placa");
    }
  });
});

describe("restaurar o padrão", () => {
  it("SEM_ESCOLHA_DE_COLUNAS devolve tudo ao padrão da tela", () => {
    expect(SEM_ESCOLHA_DE_COLUNAS).toEqual({ colunas: null, ordemDasColunas: null });
  });
});
