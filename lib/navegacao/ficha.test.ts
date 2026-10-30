import { describe, expect, it } from "vitest";
import { abaPorTecla, ABAS_DA_FICHA, comAba, lerAba, PARAMETRO_DE_ABA } from "./ficha";

const ler = (consulta: string) => lerAba(new URLSearchParams(consulta));

describe("as abas fixas da ficha", () => {
  it("são seis, na ordem do CLAUDE.md, e só as duas primeiras têm conteúdo na 2C-3", () => {
    expect(ABAS_DA_FICHA.map((a) => a.id)).toEqual([
      "resumo",
      "linha-do-tempo",
      "documentos",
      "resultado",
      "mapa",
      "mapa-mental",
    ]);
    expect(ABAS_DA_FICHA.map((a) => a.nome)).toEqual([
      "Resumo",
      "Linha do tempo",
      "Documentos",
      "Resultado",
      "Mapa",
      "Mapa mental",
    ]);
    expect(ABAS_DA_FICHA.filter((a) => a.comConteudo).map((a) => a.id)).toEqual([
      "resumo",
      "linha-do-tempo",
    ]);
  });
  it("o parâmetro se chama aba", () => {
    expect(PARAMETRO_DE_ABA).toBe("aba");
  });
});

describe("lerAba: só os seis ids conhecidos; o resto cai no Resumo, sem erro", () => {
  it.each(["resumo", "linha-do-tempo", "documentos", "resultado", "mapa", "mapa-mental"])(
    "aceita %s",
    (id) => {
      expect(ler(`aba=${id}`)).toBe(id);
    },
  );
  it.each([
    ["ausente", ""],
    ["vazia", "aba="],
    ["maiúscula", "aba=Documentos"],
    ["com espaço", "aba=%20mapa"],
    ["desconhecida", "aba=fotos"],
    ["HTML", "aba=%3Cscript%3E"],
    ["byte nulo", "aba=%00"],
    ["enorme", `aba=${"a".repeat(500)}`],
    ["a chave de outro parâmetro", "espiar=mapa"],
    ["protótipo", "aba=__proto__"],
    ["constructor", "aba=constructor"],
  ])("cai no Resumo: %s", (_nome, consulta) => {
    expect(ler(consulta)).toBe("resumo");
  });
  it("repetida: vale a primeira; se a primeira é inválida, é o Resumo (sem pular para a segunda)", () => {
    expect(ler("aba=mapa&aba=resultado")).toBe("mapa");
    expect(ler("aba=lixo&aba=mapa")).toBe("resumo");
  });
});

describe("comAba: põe ou tira a aba e não mexe em mais nada", () => {
  const tudo = "espiar=AAA0A00&chip=patio&chip=cavalo&ordem=-gestor&pagina=2";
  it("põe a aba e preserva o resto, com os valores repetidos e na mesma ordem", () => {
    const novos = comAba(new URLSearchParams(tudo), "documentos");
    expect(novos.get("aba")).toBe("documentos");
    expect(novos.getAll("chip")).toEqual(["patio", "cavalo"]);
    expect(novos.get("ordem")).toBe("-gestor");
    expect(novos.get("pagina")).toBe("2");
    expect(novos.get("espiar")).toBe("AAA0A00");
  });
  it("trocar de aba substitui, sem acumular", () => {
    const novos = comAba(new URLSearchParams("aba=mapa&pagina=2"), "resultado");
    expect(novos.getAll("aba")).toEqual(["resultado"]);
    expect(novos.get("pagina")).toBe("2");
  });
  it("o Resumo é a aba padrão: tira o parâmetro em vez de gravar aba=resumo", () => {
    const novos = comAba(new URLSearchParams("aba=mapa&pagina=2"), "resumo");
    expect(novos.has("aba")).toBe(false);
    expect(novos.get("pagina")).toBe("2");
  });
  it("nunca grava uma aba desconhecida: vale como o Resumo", () => {
    // @ts-expect-error: o teste passa de propósito um valor fora do tipo
    const novos = comAba(new URLSearchParams("aba=mapa"), "lixo");
    expect(novos.has("aba")).toBe(false);
  });
  it("não altera os parâmetros recebidos", () => {
    const original = new URLSearchParams("pagina=2");
    comAba(original, "mapa");
    expect(original.toString()).toBe("pagina=2");
  });
  it("ida e volta: o que se escreve se lê", () => {
    for (const aba of ABAS_DA_FICHA) {
      expect(lerAba(comAba(new URLSearchParams(tudo), aba.id))).toBe(aba.id);
    }
  });
});

describe("abaPorTecla: a navegação por setas das abas", () => {
  it("seta para a direita anda para a próxima e dá a volta no fim", () => {
    expect(abaPorTecla("resumo", "ArrowRight")).toBe("linha-do-tempo");
    expect(abaPorTecla("mapa", "ArrowRight")).toBe("mapa-mental");
    expect(abaPorTecla("mapa-mental", "ArrowRight")).toBe("resumo");
  });
  it("seta para a esquerda anda para a anterior e dá a volta no começo", () => {
    expect(abaPorTecla("linha-do-tempo", "ArrowLeft")).toBe("resumo");
    expect(abaPorTecla("resumo", "ArrowLeft")).toBe("mapa-mental");
  });
  it("Home vai à primeira e End vai à última, de qualquer aba", () => {
    expect(abaPorTecla("mapa", "Home")).toBe("resumo");
    expect(abaPorTecla("resumo", "End")).toBe("mapa-mental");
  });
  it("as outras teclas (inclusive as setas verticais) não mexem nas abas", () => {
    for (const tecla of ["ArrowUp", "ArrowDown", "Enter", " ", "Tab", "a", "Escape"]) {
      expect(abaPorTecla("mapa", tecla), tecla).toBeNull();
    }
  });
});
