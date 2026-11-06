import { describe, expect, it } from "vitest";
import { conjuntoFicticio, csvDeCrFicticio } from "./apoio/csv-de-cr-ficticio";
import { ErroDaImportacao, lerArgumentos, lerCsvDeCr, textoDoResumo } from "./importar-cr";

// Fatia 3.9c: `pnpm importar:cr -- <csv> [--simular|--aplicar]`. Os testes usam só CSV fictício
// (scripts/apoio/csv-de-cr-ficticio.ts); o arquivo real nunca entra no repositório nem em teste.

describe("lerArgumentos", () => {
  it("simular é o padrão", () => {
    expect(lerArgumentos(["importacao/cr.csv"])).toEqual({
      arquivo: "importacao/cr.csv",
      aplicar: false,
    });
    expect(lerArgumentos(["--", "importacao/cr.csv"])).toEqual({
      arquivo: "importacao/cr.csv",
      aplicar: false,
    });
    expect(lerArgumentos(["importacao/cr.csv", "--simular"])).toEqual({
      arquivo: "importacao/cr.csv",
      aplicar: false,
    });
  });

  it("--aplicar aplica", () => {
    expect(lerArgumentos(["importacao/cr.csv", "--aplicar"])).toEqual({
      arquivo: "importacao/cr.csv",
      aplicar: true,
    });
  });

  it.each([
    [[]],
    [["--aplicar"]],
    [["a.csv", "--simular", "--aplicar"]],
    [["a.csv", "--outro"]],
    [["a.csv", "b.csv"]],
  ])("recusa %j", (argumentos) => {
    expect(() => lerArgumentos(argumentos)).toThrow(ErroDaImportacao);
  });
});

describe("lerCsvDeCr", () => {
  it("acha o cabeçalho depois das linhas de título, tira o BOM e as linhas vazias", () => {
    const linhas = lerCsvDeCr(csvDeCrFicticio(conjuntoFicticio()));
    expect(linhas).toHaveLength(11);
    expect(linhas[0]).toEqual({
      codcencus: 2100001,
      nome: "CR FICTÍCIO 2100001",
      bloqueado: "N",
      gerencial: "TranSul Frota",
      operacao: "Operação Matriz (São Luís/MA)",
      filial: "Matriz",
      codcencusPai: 2000000,
      nomePai: "FROTA FICTÍCIA",
      frota: "S",
    });
  });

  it("vazio vira nulo; Sim e Não viram S e N", () => {
    const [semUnidade] = lerCsvDeCr(
      csvDeCrFicticio([
        {
          codigo: 2400001,
          gerencial: "",
          operacao: "",
          filial: "",
          frota: "Não",
          bloqueado: "Sim",
          codigoPai: null,
        },
      ]),
    );
    expect(semUnidade).toMatchObject({
      gerencial: null,
      operacao: null,
      filial: null,
      codcencusPai: null,
      nomePai: null,
      frota: "N",
      bloqueado: "S",
    });
  });

  it("o pai negativo do Sankhya (-999999999, a raiz) vira sem pai", () => {
    const texto = csvDeCrFicticio([{ codigo: 2100001, codigoPai: 2000000, nomePai: "" }]).replace(
      ";2000000;",
      ";-999999999;",
    );
    expect(lerCsvDeCr(texto)[0]).toMatchObject({ codcencusPai: null, nomePai: null });
  });

  it("aceita campo entre aspas com ponto e vírgula dentro", () => {
    const [linha] = lerCsvDeCr(csvDeCrFicticio([{ codigo: 2100009, nome: 'CR; "com" aspas' }]));
    expect(linha?.nome).toBe('CR; "com" aspas');
  });

  it("recusa arquivo sem o cabeçalho esperado", () => {
    expect(() => lerCsvDeCr("a;b;c\r\n1;2;3")).toThrow(/cabeçalho/);
  });

  it("recusa código de CR que não é número, e diz a linha", () => {
    const texto = csvDeCrFicticio([{ codigo: 2100001 }]).replace("2100001", "21A0001");
    expect(() => lerCsvDeCr(texto)).toThrow(/linha 4/);
  });

  it("recusa código repetido", () => {
    expect(() => lerCsvDeCr(csvDeCrFicticio([{ codigo: 2100001 }, { codigo: 2100001 }]))).toThrow(
      /repetido/,
    );
  });

  it("recusa Sim/Não fora do formato", () => {
    const texto = csvDeCrFicticio([{ codigo: 2100001 }]).replace(";Sim", ";Talvez");
    expect(() => lerCsvDeCr(texto)).toThrow(/Frota/);
  });
});

describe("textoDoResumo: só agregados", () => {
  const resumo = {
    modo: "simulação" as const,
    linhas: 11,
    novos: 9,
    atualizados: 1,
    iguais: 1,
    paisCriados: 3,
    porUnidade: {
      frota: 6,
      servico: 2,
      acionista: 1,
      participacoes: 1,
      transulog: 1,
      sem_unidade: 1,
    },
    porGaragem: { matriz: 8, cordeiropolis: 1, parauapebas: 1, sem_garagem: 1 },
    operacao: { casada: 8, acionista: 1, vazia: 1, desconhecida: 1 },
    excecoes: {
      cr_sem_unidade_gerencial: 1,
      cr_operacao_desconhecida: 1,
      cr_frota_diverge_da_unidade: 1,
    },
  };

  it("traz as contagens e diz se foi simulação", () => {
    const texto = textoDoResumo(resumo);
    expect(texto).toContain("simulação");
    expect(texto).toContain("Linhas lidas: 11");
    expect(texto).toContain("novos 9");
    expect(texto).toContain("cr_operacao_desconhecida: 1");
  });

  it("nunca traz nome de CR, de operação ou de acionista", () => {
    const linhas = lerCsvDeCr(csvDeCrFicticio(conjuntoFicticio()));
    const texto = textoDoResumo(resumo);
    for (const l of linhas) {
      expect(texto).not.toContain(l.nome);
      if (l.operacao) expect(texto).not.toContain(l.operacao);
      expect(texto).not.toContain(String(l.codcencus));
    }
  });
});
