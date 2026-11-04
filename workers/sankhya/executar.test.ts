import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ResultadoDaConsulta } from "./cliente.ts";
import {
  ErroDaExecucao,
  VARIAVEIS_DO_SANKHYA,
  executarConsulta,
  lerArgumentos,
} from "./executar.ts";

// O executor: lê o arquivo de consultas/, passa pela guarda, consulta e grava o resultado fora do Git.
// Na tela, só o resumo (agregados): nenhum valor de célula aparece.

let raiz: string;
let enviados: string[];

const VALOR_QUE_NAO_PODE_APARECER = "PLACA-QUE-NAO-PODE-APARECER";
const RESULTADO: ResultadoDaConsulta = {
  colunas: [
    { nome: "DESCRCENCUS", tipo: "S" },
    { nome: "QTD", tipo: "I" },
  ],
  linhas: [
    [VALOR_QUE_NAO_PODE_APARECER, 2],
    ["OUTRA", 1],
    ["MAIS UMA", 1],
  ],
};

const ambiente = {
  SANKHYA_BASE_URL: "http://127.0.0.1:1",
  SANKHYA_CLIENT_ID: "id",
  SANKHYA_CLIENT_SECRET: "segredo",
  SANKHYA_X_TOKEN: "xtoken",
};

const clienteFalso = {
  consultar: async (sql: string) => {
    enviados.push(sql);
    return RESULTADO;
  },
};

const consulta = (nome: string, sql: string) => {
  writeFileSync(join(raiz, "consultas", nome), sql, "utf8");
  return `consultas/${nome}`;
};

const executar = (
  arquivo: string,
  extra: { linhas?: number; ambiente?: Record<string, string | undefined> } = {},
) =>
  executarConsulta({
    arquivo,
    linhas: extra.linhas,
    raiz,
    ambiente: extra.ambiente ?? ambiente,
    criarCliente: () => clienteFalso,
    agora: () => new Date("2026-11-03T12:00:00Z"),
  });

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), "eixo-s0-"));
  mkdirSync(join(raiz, "consultas"));
  enviados = [];
});
afterEach(() => rmSync(raiz, { recursive: true, force: true }));

describe("executor da consulta (pnpm sankhya:consulta)", () => {
  it("por padrão mostra só o resumo e grava só o resumo em importacao/resultados", async () => {
    const arquivo = consulta(
      "cr.sql",
      "-- CRs\nSELECT C.DESCRCENCUS, COUNT(*) AS QTD FROM TSICUS C GROUP BY C.DESCRCENCUS",
    );
    const saida = await executar(arquivo);

    expect(enviados).toEqual([
      "SELECT * FROM (\nSELECT C.DESCRCENCUS, COUNT(*) AS QTD FROM TSICUS C GROUP BY C.DESCRCENCUS\n) WHERE ROWNUM <= 5000",
    ]);
    expect(saida.texto).toContain("3 linhas");
    expect(saida.texto).toContain("DESCRCENCUS");
    expect(saida.texto).toContain("QTD");
    expect(saida.texto).not.toContain(VALOR_QUE_NAO_PODE_APARECER);
    expect(saida.texto).not.toContain("OUTRA");

    const gravados = readdirSync(join(raiz, "importacao", "resultados"));
    expect(gravados).toEqual(["cr-2026-11-03T12-00-00.json"]);
    const conteudo = readFileSync(
      join(raiz, "importacao", "resultados", gravados[0] as string),
      "utf8",
    );
    expect(conteudo).not.toContain(VALOR_QUE_NAO_PODE_APARECER);
    expect(JSON.parse(conteudo)).toMatchObject({
      arquivo: "consultas/cr.sql",
      modo: "resumo",
      resumo: { linhas: 3 },
    });
  });

  it("--linhas N grava até N linhas no arquivo (fora do Git) e a tela continua só com o resumo", async () => {
    const arquivo = consulta(
      "cr-linhas.sql",
      "SELECT C.DESCRCENCUS, C.CODCENCUS AS QTD FROM TSICUS C",
    );
    const saida = await executar(arquivo, { linhas: 2 });
    expect(enviados[0]).toContain("ROWNUM <= 2");
    expect(saida.texto).not.toContain(VALOR_QUE_NAO_PODE_APARECER);
    const [gravado] = readdirSync(join(raiz, "importacao", "resultados"));
    const conteudo = JSON.parse(
      readFileSync(join(raiz, "importacao", "resultados", gravado as string), "utf8"),
    );
    expect(conteudo.modo).toBe("linhas");
    expect(conteudo.linhas).toHaveLength(2);
  });

  it("--linhas em tabela com dado pessoal é recusado antes de consultar", async () => {
    const arquivo = consulta("parceiros.sql", "SELECT P.CODPARC, P.NOMEPARC FROM TGFPAR P");
    await expect(executar(arquivo, { linhas: 10 })).rejects.toThrow("tabela_com_dado_pessoal");
    expect(enviados).toEqual([]);
  });

  it("consulta recusada pela guarda nunca chega ao Sankhya", async () => {
    const arquivo = consulta("ruim.sql", "SELECT * FROM TGFVEI");
    await expect(executar(arquivo)).rejects.toThrow("select_asterisco");
    expect(enviados).toEqual([]);
  });

  it("só arquivos .sql de consultas/ (nunca SQL montado na hora nem fora da pasta)", async () => {
    writeFileSync(join(raiz, "fora.sql"), "SELECT 1 AS X FROM DUAL", "utf8");
    await expect(executar("fora.sql")).rejects.toBeInstanceOf(ErroDaExecucao);
    await expect(executar("consultas/../fora.sql")).rejects.toBeInstanceOf(ErroDaExecucao);
    await expect(executar("consultas/cr.txt")).rejects.toBeInstanceOf(ErroDaExecucao);
  });

  it("sem as variáveis, diz quais faltam (só os nomes, nunca valores)", async () => {
    const arquivo = consulta("ok.sql", "SELECT 1 AS X FROM DUAL");
    const erro = (await executar(arquivo, {
      ambiente: { SANKHYA_BASE_URL: "http://x", SANKHYA_CLIENT_ID: "id-visivel" },
    }).catch((e: unknown) => e)) as Error;
    expect(erro.message).toContain("SANKHYA_CLIENT_SECRET");
    expect(erro.message).toContain("SANKHYA_X_TOKEN");
    expect(erro.message).not.toContain("id-visivel");
    expect(VARIAVEIS_DO_SANKHYA).toEqual([
      "SANKHYA_BASE_URL",
      "SANKHYA_CLIENT_ID",
      "SANKHYA_CLIENT_SECRET",
      "SANKHYA_X_TOKEN",
    ]);
  });

  it("no CI nunca consulta o Sankhya real", async () => {
    const arquivo = consulta("ok.sql", "SELECT 1 AS X FROM DUAL");
    await expect(executar(arquivo, { ambiente: { ...ambiente, CI: "true" } })).rejects.toThrow(
      "CI",
    );
    expect(enviados).toEqual([]);
  });
});

describe("argumentos", () => {
  it("lê o arquivo e o --linhas", () => {
    expect(lerArgumentos(["consultas/a.sql"])).toEqual({
      arquivo: "consultas/a.sql",
      linhas: undefined,
    });
    expect(lerArgumentos(["consultas/a.sql", "--linhas", "20"])).toEqual({
      arquivo: "consultas/a.sql",
      linhas: 20,
    });
    expect(() => lerArgumentos([])).toThrow(ErroDaExecucao);
    expect(() => lerArgumentos(["consultas/a.sql", "--linhas"])).toThrow(ErroDaExecucao);
    expect(() => lerArgumentos(["consultas/a.sql", "--outra"])).toThrow(ErroDaExecucao);
  });
});
