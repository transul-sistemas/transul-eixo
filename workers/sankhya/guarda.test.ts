import { describe, expect, it } from "vitest";
import {
  ErroDaGuarda,
  LIMITE_MAXIMO_DE_LINHAS,
  conferirConsulta,
  envolverComLimite,
} from "./guarda.ts";

// A guarda de leitura da ponte S0: só SELECT ou WITH, sem comando escondido, sem campo proibido e sempre
// com limite de linhas. Cada regra tem um caso recusado e a consulta válida ao lado.

const recusa = (sql: string, modo: "resumo" | "linhas" = "resumo") => {
  try {
    conferirConsulta(sql, { modo });
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroDaGuarda);
    return (erro as ErroDaGuarda).regra;
  }
  throw new Error(`a guarda aceitou: ${sql}`);
};

const VALIDA = "SELECT V.CODVEICULO, V.NUMEIXOS FROM TGFVEI V WHERE V.ATIVO = 'S'";

describe("guarda: só leitura", () => {
  it("aceita SELECT e WITH", () => {
    expect(conferirConsulta(VALIDA, { modo: "resumo" })).toBe(VALIDA);
    const comWith =
      "WITH P AS (SELECT C.DESCRCENCUS, COUNT(*) AS QTD FROM TSICUS C GROUP BY C.DESCRCENCUS) SELECT P.QTD, COUNT(*) AS N FROM P GROUP BY P.QTD";
    expect(conferirConsulta(comWith, { modo: "resumo" })).toBe(comWith);
  });

  it("recusa o que não começa com SELECT ou WITH", () => {
    expect(recusa("EXPLAIN PLAN FOR SELECT V.CODVEICULO FROM TGFVEI V")).toBe("comeco");
    expect(recusa("(SELECT V.CODVEICULO FROM TGFVEI V)")).toBe("comeco");
  });

  it("recusa ponto e vírgula encadeando; o último, sozinho, sai", () => {
    expect(recusa(`${VALIDA}; SELECT C.CODCENCUS FROM TSICUS C`)).toBe("ponto_e_virgula");
    expect(conferirConsulta(`${VALIDA};`, { modo: "resumo" })).toBe(VALIDA);
    expect(conferirConsulta(`${VALIDA} ;  \n`, { modo: "resumo" })).toBe(VALIDA);
  });

  it.each([
    "INSERT",
    "UPDATE",
    "DELETE",
    "MERGE",
    "DROP",
    "ALTER",
    "CREATE",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "EXEC",
    "EXECUTE",
    "CALL",
    "BEGIN",
    "DECLARE",
    "COMMIT",
    "ROLLBACK",
  ])("recusa %s em qualquer lugar", (comando) => {
    expect(
      recusa(`SELECT V.CODVEICULO FROM TGFVEI V WHERE V.ATIVO = 'S' ${comando.toLowerCase()} X`),
    ).toBe("comando_proibido");
  });

  it("recusa pacotes do Oracle (DBMS_ e UTL_)", () => {
    expect(recusa("SELECT DBMS_RANDOM.VALUE AS X FROM DUAL")).toBe("comando_proibido");
    expect(recusa("SELECT UTL_HTTP.REQUEST('x') AS X FROM DUAL")).toBe("comando_proibido");
  });

  it("palavra parecida não é comando (DHALTER, DTCREATED não são ALTER nem CREATE)", () => {
    expect(
      conferirConsulta("SELECT T.CODTIPOPER, T.DHALTER FROM TGFTOP T", { modo: "resumo" }),
    ).toContain("DHALTER");
  });

  it("recusa comentário de bloco (pode esconder comando ou dica do Oracle)", () => {
    expect(recusa("SELECT /*+ FULL(V) */ V.CODVEICULO FROM TGFVEI V")).toBe("comentario");
    expect(recusa("SELECT V.CODVEICULO /* x */ FROM TGFVEI V")).toBe("comentario");
  });

  it("recusa comentário de linha que esconde comando e tira o comentário inofensivo", () => {
    expect(recusa(`${VALIDA}\n-- drop table x`)).toBe("comentario");
    expect(conferirConsulta(`-- veículos ativos\n${VALIDA}`, { modo: "resumo" })).toBe(VALIDA);
  });

  it("ponto e vírgula e comentário dentro de texto entre aspas não contam", () => {
    const sql = "SELECT V.CODVEICULO FROM TGFVEI V WHERE V.TIPOCAR = 'a;b--c'";
    expect(conferirConsulta(sql, { modo: "resumo" })).toBe(sql);
  });
});

describe("guarda: campos e tabelas", () => {
  it.each([
    "SENHA",
    "TIMSENHASITE",
    "SENHAECONECT",
    "CHAVEPIX",
    "AD_TIPCHAVEPIX",
    "CODBCO",
    "CODAGE",
    "AGENCIA",
    "CODCTABCO",
    "TIPCONTA",
    "IDENTIDADE",
    "IDENTINSCESTAD",
    "UFRG",
    "NOMEMAE",
    "TIMPAI",
    "ESTADOCIVIL",
    "TIMESTADOCIVIL",
    "RACAFUNCIONARIO",
    "SEXO",
    "IDENTIDADEGENERO",
    "TIPDEFICIENCIA",
    "TITELEITORAL",
    "NROCERTCIVIL",
    "CODUSURESP",
    "CODPARCRESP",
  ])("recusa o campo proibido %s", (campo) => {
    expect(recusa(`SELECT P.CODPARC, P.${campo} FROM TGFPAR P`)).toBe("campo_proibido");
  });

  it("recusa o campo proibido mesmo entre aspas duplas", () => {
    expect(recusa('SELECT P.CODPARC, P."CHAVEPIX" FROM TGFPAR P')).toBe("campo_proibido");
  });

  it("CODCENCUSPAI não é PAI (o nome inteiro decide)", () => {
    expect(
      conferirConsulta(
        "SELECT C.CODCENCUSPAI, COUNT(*) AS N FROM TSICUS C GROUP BY C.CODCENCUSPAI",
        { modo: "resumo" },
      ),
    ).toContain("CODCENCUSPAI");
  });

  it("CPF e CNPJ: aceitos no resumo, recusados na consulta de linhas", () => {
    const sql = "SELECT COUNT(DISTINCT P.CGC_CPF) AS N FROM TGFPAR P";
    expect(conferirConsulta(sql, { modo: "resumo" })).toBe(sql);
    expect(recusa("SELECT C.CODCENCUS, C.CGC_CPF FROM TSICUS C", "linhas")).toBe(
      "documento_em_linhas",
    );
    expect(recusa("SELECT C.CODCENCUS, C.CPF FROM TSICUS C", "linhas")).toBe("documento_em_linhas");
  });

  it("nunca SELECT * (nem T.*); COUNT(*) pode", () => {
    expect(recusa("SELECT * FROM TGFVEI")).toBe("select_asterisco");
    expect(recusa("SELECT DISTINCT * FROM TGFVEI")).toBe("select_asterisco");
    expect(recusa("SELECT V.* FROM TGFVEI V")).toBe("select_asterisco");
    expect(recusa("SELECT V.CODVEICULO, * FROM TGFVEI V")).toBe("select_asterisco");
    expect(conferirConsulta("SELECT COUNT(*) AS N FROM TGFVEI V", { modo: "resumo" })).toContain(
      "COUNT(*)",
    );
  });

  it("só tabelas do dicionário (docs/sankhya); o nome do WITH e o DUAL passam", () => {
    expect(recusa("SELECT U.NOMEUSU FROM TSIUSU U")).toBe("tabela_fora_do_dicionario");
    expect(
      recusa("SELECT V.CODVEICULO FROM TGFVEI V JOIN TSIUSU U ON U.CODUSU = V.CODVEICULO"),
    ).toBe("tabela_fora_do_dicionario");
    expect(conferirConsulta("SELECT 1 AS X FROM DUAL", { modo: "resumo" })).toContain("DUAL");
    expect(
      conferirConsulta("SELECT V.CODVEICULO FROM SANKHYA.TGFVEI V", { modo: "resumo" }),
    ).toContain("TGFVEI");
  });

  it("junção só com JOIN explícito (a vírgula no FROM esconderia uma tabela)", () => {
    expect(recusa("SELECT V.CODVEICULO FROM TGFVEI V, TSIUSU U")).toBe("juncao_por_virgula");
  });

  it("FROM dentro de EXTRACT ou TRIM não é tabela", () => {
    const sql =
      "SELECT EXTRACT(YEAR FROM C.DTINCLUSAO) AS ANO, COUNT(*) AS N FROM TSICUS C GROUP BY EXTRACT(YEAR FROM C.DTINCLUSAO)";
    expect(conferirConsulta(sql, { modo: "resumo" })).toBe(sql);
  });

  it("consulta de linhas só em tabela sem dado pessoal (TSICUS, TMSMODELOVEI, TMSMARCAVEI, TGFVEI)", () => {
    expect(
      conferirConsulta("SELECT C.CODCENCUS, C.AD_FROTA FROM TSICUS C", { modo: "linhas" }),
    ).toContain("TSICUS");
    expect(recusa("SELECT P.CODPARC, P.NOMEPARC FROM TGFPAR P", "linhas")).toBe(
      "tabela_com_dado_pessoal",
    );
  });

  it.each([
    "CODPARC",
    "CODMOTORISTA",
    "CODPARCPROPANTT",
    "CODFUNC",
    "AD_CODPARC",
    "CODPARCGESTOR",
    "DESCR_EMP_PARC",
  ])("TGFVEI em linhas sem proprietário nem motorista (%s)", (campo) => {
    expect(recusa(`SELECT V.CODVEICULO, V.${campo} FROM TGFVEI V`, "linhas")).toBe(
      "tabela_com_dado_pessoal",
    );
  });
});

describe("guarda: limite de linhas", () => {
  it("envolve a consulta num limite de 5000 linhas por padrão", () => {
    expect(LIMITE_MAXIMO_DE_LINHAS).toBe(5000);
    expect(envolverComLimite(VALIDA)).toBe(`SELECT * FROM (\n${VALIDA}\n) WHERE ROWNUM <= 5000`);
    expect(envolverComLimite(VALIDA, 10)).toBe(`SELECT * FROM (\n${VALIDA}\n) WHERE ROWNUM <= 10`);
  });

  it("recusa limite fora de 1 a 5000", () => {
    expect(() => envolverComLimite(VALIDA, 0)).toThrow(ErroDaGuarda);
    expect(() => envolverComLimite(VALIDA, 5001)).toThrow(ErroDaGuarda);
    expect(() => envolverComLimite(VALIDA, 2.5)).toThrow(ErroDaGuarda);
  });
});
