import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ehBaixada, grupoDaSigla, NOMES_DAS_SIGLAS, SIGLAS, SIGLAS_DE_BAIXA } from "./status";

// A régua do CLAUDE.md, copiada aqui de propósito: se alguém mexer na régua, o teste acusa.
const REGUA_DO_CLAUDE = [
  "ETc",
  "ETv",
  "CAr",
  "DEs",
  "DOp",
  "ACe",
  "ADe",
  "CAn",
  "MAc",
  "MAt",
  "MAv",
  "MAN",
  "REF",
  "SIN",
  "VAz",
  "FOg",
  "FEr",
  "SMo",
  "SDo",
  "PÁT",
  "DOC",
  "ALU",
  "EMP",
  "VEN",
  "SUC",
  "VND",
];

// Tabela aprovada por Alexandre (29/10/2026).
const TABELA = {
  "em-atividade": ["DOp", "ACe", "CAr", "CAn", "ETc", "ADe", "DEs", "ETv"],
  impedida: ["MAc", "MAt", "MAv", "MAN", "REF", "SIN", "SDo", "DOC"],
  atencao: ["SMo", "FOg", "FEr", "VAz"],
  patio: ["PÁT"],
  fora: ["ALU", "EMP", "VEN", "SUC", "VND"],
} as const;

const NOMES = {
  DOp: "Disponível no Operacional",
  ACe: "Aguardando carregamento",
  CAr: "Carregando",
  CAn: "Carregado aguardando nota",
  ETc: "Em trânsito carregado",
  ADe: "Aguardando descarga",
  DEs: "Descarregando",
  ETv: "Em trânsito vazio",
  MAc: "Manutenção / carregado",
  MAt: "Manutenção / tombado",
  MAv: "Manutenção / vazio",
  MAN: "Em manutenção",
  REF: "Em reforma",
  SIN: "Sinistro",
  VAz: "Vazio",
  FOg: "Folga",
  FEr: "Férias",
  SMo: "Sem motorista",
  SDo: "Sem documento",
  PÁT: "Pátio",
  DOC: "Problema documental",
  ALU: "Alugado a terceiro",
  EMP: "Emprestado",
  VEN: "Disponível para venda",
  SUC: "Sucata",
  VND: "Vendido",
} as const;

describe("siglas e chips", () => {
  it("as 26 siglas são exatamente as da régua do CLAUDE.md", () => {
    expect([...SIGLAS].sort()).toEqual([...REGUA_DO_CLAUDE].sort());
    expect(SIGLAS).toHaveLength(26);
  });
  it("cada sigla cai em exatamente um chip, o aprovado", () => {
    for (const [grupo, siglas] of Object.entries(TABELA)) {
      for (const sigla of siglas) expect(grupoDaSigla(sigla), sigla).toBe(grupo);
    }
    expect(Object.values(TABELA).flat()).toHaveLength(26);
  });
  it("Em atividade tem 8, Impedida 8, Atenção 4, Pátio 1 e Fora 5", () => {
    const quantas = (g: string) => SIGLAS.filter((s) => grupoDaSigla(s) === g).length;
    expect([
      quantas("em-atividade"),
      quantas("impedida"),
      quantas("atencao"),
      quantas("patio"),
      quantas("fora"),
    ]).toEqual([8, 8, 4, 1, 5]);
  });
  it("PÁT mantém o acento", () => {
    expect(SIGLAS).toContain("PÁT");
    expect(grupoDaSigla("PÁT")).toBe("patio");
  });
  it("só VND e SUC são baixadas", () => {
    expect([...SIGLAS_DE_BAIXA].sort()).toEqual(["SUC", "VND"]);
    expect(SIGLAS.filter(ehBaixada).sort()).toEqual(["SUC", "VND"]);
  });
});

describe("nomes por extenso", () => {
  it("são exatamente os aprovados", () => {
    expect(NOMES_DAS_SIGLAS).toEqual(NOMES);
  });
  it("o glossário traz cada sigla com o mesmo nome", () => {
    const glossario = readFileSync("docs/glossario.md", "utf-8");
    for (const [sigla, nome] of Object.entries(NOMES)) {
      expect(glossario, sigla).toContain(`| ${sigla} | ${nome} |`);
    }
  });
});
